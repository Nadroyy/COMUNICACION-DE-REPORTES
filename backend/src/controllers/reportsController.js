// Controlador principal de reportes
// tickets_db  → tablas propias (reports, report_types, etc.)
// DB_MAIN_NAME → tablas del sistema (users, warehouses, roles)
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { registrarAudit } = require('../middleware/audit');
const { puedeVerReporte } = require('../middleware/reportAccess');
const { removeStoredFiles } = require('../services/attachmentStorage');
const {
  crearNotificaciones,
  publicarNotificacionesPendientes,
  descartarNotificacionesPendientes
} = require('../services/notifications');

// Base del sistema principal — usada en JOINs cross-database
const S = () => pool.mainDb; // ej: `inventario_catalogo`
const formatearNumeroTicket = numero => String(numero).padStart(3, '0');

// Transiciones de estado válidas
const TRANSICIONES = {
  borrador:    ['enviado'],
  enviado:     ['en_revision', 'aprobado', 'negado', 'cerrado'],
  en_revision: ['aprobado', 'negado', 'resuelto', 'cerrado'],
  resuelto:    ['cerrado'],
  cerrado:     []
};

const fechaActual = () => {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
};

const fechaLimiteValida = fecha =>
  typeof fecha === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  && fecha >= fechaActual();

/**
 * Cláusula de visibilidad para la consulta de reportes.
 * Los borradores solo son visibles para su autor y administradores.
 * Los demás reportes son visibles para el autor, responsable,
 * usuarios compartidos explícitamente y administradores.
 */
const clausulaVisibilidad = (usuario) => {
  if (Number(usuario.id_role) === 1) return '1=1';
  const uid = Number(usuario.id_usuario);
  if (!Number.isSafeInteger(uid) || uid <= 0) return '1=0';
  return `(
    CAST(r.id_autor AS UNSIGNED) = ${uid}
    OR (r.status <> 'borrador' AND (
      CAST(r.id_responsable AS UNSIGNED) = ${uid}
      OR JSON_CONTAINS(r.visibilidad_usuarios, '${uid}')
    ))
  )`;
};

/**
 * GET /api/reports
 * Filtros: status, type (slug), responsible, warehouse, from, to, search, page, limit, scope=mine
 */
const listar = async (req, res) => {
  const {
    status, type, author, responsible, warehouse,
    from, to, search,
    page = 1, limit = 10, sort = 'newest', scope
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  let where = `WHERE ${clausulaVisibilidad(req.usuario)}`;

  if (scope === 'mine' && Number(req.usuario.id_role) === 1) {
    const uid = Number(req.usuario.id_usuario);
    if (Number.isSafeInteger(uid) && uid > 0) {
      where += ` AND (
        CAST(r.id_autor AS UNSIGNED) = ${uid}
        OR CAST(r.id_responsable AS UNSIGNED) = ${uid}
        OR JSON_CONTAINS(r.visibilidad_usuarios, '${uid}')
      )`;
    }
  }

  if (status)      { where += ` AND r.status = ?`;             params.push(status); }
  if (author)      { where += ` AND r.id_autor = ?`;           params.push(parseInt(author)); }
  if (responsible) { where += ` AND r.id_responsable = ?`;     params.push(parseInt(responsible)); }
  if (warehouse)   { where += ` AND r.id_warehouse = ?`;       params.push(warehouse); }
  if (from)        { where += ` AND DATE(r.created_at) >= ?`;  params.push(from); }
  if (to)          { where += ` AND DATE(r.created_at) <= ?`;  params.push(to); }
  if (search)      { where += ` AND r.titulo LIKE ?`;          params.push(`%${search}%`); }
  if (type)        { where += ` AND rt.slug = ?`;              params.push(type); }

  const ordenes = {
    newest: 'r.created_at DESC',
    oldest: 'r.created_at ASC',
    due_soon: 'CASE WHEN r.fecha_limite IS NULL THEN 1 ELSE 0 END, r.fecha_limite ASC, r.created_at DESC',
    priority: `CASE r.prioridad
      WHEN 'critica' THEN 1
      WHEN 'alta' THEN 2
      WHEN 'media' THEN 3
      WHEN 'baja' THEN 4
      ELSE 5
    END, r.created_at DESC`
  };
  const orden = ordenes[sort] || ordenes.newest;

  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM reports r
       JOIN report_types rt ON r.id_type = rt.id_type
       ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT
         r.id_report, r.numero_ticket, r.titulo, r.status, r.prioridad,
         r.id_autor, r.id_responsable, r.visibilidad_usuarios,
         r.fecha_hecho, r.fecha_limite, r.created_at, r.updated_at,
         rt.nombre      AS tipo_nombre,
         rt.slug        AS tipo_slug,
         COALESCE(ua.name_user, CONCAT('Usuario #', r.id_autor)) AS autor_nombre,
         ur.name_user   AS responsable_nombre,
         w_new.name AS warehouse_nombre
       FROM reports r
       JOIN report_types rt   ON r.id_type        = rt.id_type
       LEFT JOIN ${S()}.users ua      ON ua.id_user       = CAST(r.id_autor AS UNSIGNED)
       LEFT JOIN ${S()}.users ur      ON ur.id_user       = CAST(r.id_responsable AS UNSIGNED)
       LEFT JOIN ${S()}.warehouses w_new ON w_new.id_warehouse = r.id_warehouse
       ${where}
       ORDER BY ${orden}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      reportes: rows,
      paginacion: {
        total,
        pagina:  parseInt(page),
        limite:  parseInt(limit),
        paginas: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error al listar reportes:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/reports/stats
 * Contadores por estado (dashboard)
 */
const stats = async (req, res) => {
  try {
    const vis = clausulaVisibilidad(req.usuario);
    const [rows] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN r.status = 'borrador'    THEN 1 ELSE 0 END), 0) AS borrador,
         COALESCE(SUM(CASE WHEN r.status = 'enviado'     THEN 1 ELSE 0 END), 0) AS enviado,
         COALESCE(SUM(CASE WHEN r.status = 'en_revision' THEN 1 ELSE 0 END), 0) AS en_revision,
         COALESCE(SUM(CASE WHEN r.status = 'aprobado'    THEN 1 ELSE 0 END), 0) AS aprobado,
         COALESCE(SUM(CASE WHEN r.status = 'negado'      THEN 1 ELSE 0 END), 0) AS negado,
         COALESCE(SUM(CASE WHEN r.status = 'resuelto'    THEN 1 ELSE 0 END), 0) AS resuelto,
         COALESCE(SUM(CASE WHEN r.status = 'cerrado'     THEN 1 ELSE 0 END), 0) AS cerrado,
         COUNT(*) AS total
       FROM reports r
       WHERE ${vis}`
    );
    return res.json({ stats: rows[0] });
  } catch (err) {
    console.error('Error al obtener stats:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/reports/:id
 * Detalle completo con comentarios, tareas y adjuntos
 */
const detalle = async (req, res) => {
  const { id } = req.params;
  try {
    const [repRows] = await pool.execute(
      `SELECT
         r.*,
         rt.nombre        AS tipo_nombre,
         rt.slug          AS tipo_slug,
         rt.template_fields,
         COALESCE(ua.name_user, CONCAT('Usuario #', r.id_autor)) AS autor_nombre,
         ua.email         AS autor_email,
         ur.name_user     AS responsable_nombre,
         w_new.name AS warehouse_nombre,
         w_new.address AS warehouse_address
       FROM reports r
       JOIN report_types rt   ON r.id_type        = rt.id_type
       LEFT JOIN ${S()}.users ua      ON ua.id_user       = CAST(r.id_autor AS UNSIGNED)
       LEFT JOIN ${S()}.users ur      ON ur.id_user       = CAST(r.id_responsable AS UNSIGNED)
       LEFT JOIN ${S()}.warehouses w_new ON w_new.id_warehouse = r.id_warehouse
       WHERE r.id_report = ?`,
      [id]
    );

    if (repRows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const reporte = repRows[0];

    if (!puedeVerReporte(reporte, req.usuario)) {
      return res.status(403).json({ error: 'No tienes acceso a este reporte' });
    }

    // Comentarios
    const [comentarios] = await pool.execute(
      `SELECT
         rc.id_comment, rc.contenido, rc.es_resolucion, rc.created_at,
         u.name_user AS autor_nombre, u.email AS autor_email
       FROM report_comments rc
       JOIN ${S()}.users u ON rc.id_autor = u.id_user
       WHERE rc.id_report = ?
       ORDER BY rc.created_at ASC`,
      [id]
    );

    // Tareas
    const [tareas] = await pool.execute(
      `SELECT
         t.id_task, t.titulo, t.descripcion, t.status,
         t.fecha_limite, t.created_at, t.updated_at,
         u.name_user AS asignado_nombre
       FROM tasks t
       LEFT JOIN ${S()}.users u ON t.id_asignado = u.id_user
       WHERE t.id_report = ?
       ORDER BY t.created_at ASC`,
      [id]
    );

    // Adjuntos
    const [adjuntos] = await pool.execute(
      `SELECT
         a.id_attachment, a.nombre_archivo,
         a.tipo_mime, a.created_at,
         u.name_user AS subido_por
       FROM attachments a
       JOIN ${S()}.users u ON a.id_subido_por = u.id_user
       WHERE a.id_report = ?
       ORDER BY a.created_at ASC`,
      [id]
    );

    // Parsear campos JSON (mysql2 puede devolverlos ya como objetos)
    const parseJSON = (val, fallback) => {
      if (!val) return fallback;
      if (typeof val === 'string') return JSON.parse(val);
      return val;
    };
    reporte.extra_data           = parseJSON(reporte.extra_data, {});
    reporte.template_fields      = parseJSON(reporte.template_fields, []);
    reporte.visibilidad_usuarios = parseJSON(reporte.visibilidad_usuarios, []);

    return res.json({ reporte, comentarios, tareas, adjuntos });

  } catch (err) {
    console.error('Error al obtener reporte:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * POST /api/reports
 * Crear nuevo reporte
 */
const crear = async (req, res) => {
  const {
    id_type, titulo, descripcion,
    prioridad = 'media',
    id_responsable, id_warehouse,
    notificar_a_todos = false, usuarios_notificados = [],
    fecha_hecho, fecha_limite, ubicacion,
    extra_data, tarea,
    status: statusInicial = 'borrador'
  } = req.body;

  if (fecha_limite && !fechaLimiteValida(fecha_limite)) {
    return res.status(400).json({ error: 'La fecha límite debe ser hoy o una fecha futura' });
  }

  // Solo se aceptan estos dos estados al crear
  const statusCreacion = statusInicial === 'enviado' ? 'enviado' : 'borrador';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verificar tipo
    const [tipoRows] = await conn.execute(
      'SELECT * FROM report_types WHERE id_type = ? AND activo = 1',
      [id_type]
    );
    if (tipoRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Tipo de reporte inválido' });
    }

    const tipo = tipoRows[0];
    const parseJSON = (val) => {
      if (!val) return [];
      if (typeof val === 'string') return JSON.parse(val);
      return val; // mysql2 ya lo parseó
    };
    const rolesPermitidos = parseJSON(tipo.roles_permitidos);
    if (rolesPermitidos.length > 0
      && !rolesPermitidos.some(role => Number(role) === Number(req.usuario.id_role))) {
      await conn.rollback();
      return res.status(403).json({ error: 'Tu rol no puede crear este tipo de reporte' });
    }
    const camposRequeridos = parseJSON(tipo.required_fields);

    const idsSolicitados = !notificar_a_todos && Array.isArray(usuarios_notificados)
      ? [...new Set(usuarios_notificados.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
      : [];
    const idsActivosSolicitados = idsSolicitados.length
      ? await conn.execute(
          `SELECT id_user FROM users WHERE status = 1 AND id_user IN (${idsSolicitados.map(() => '?').join(',')})`,
          idsSolicitados
        ).then(([rows]) => rows.map(row => row.id_user))
      : [];
    const idsTodosActivos = notificar_a_todos
      ? await conn.execute('SELECT id_user FROM users WHERE status = 1')
          .then(([rows]) => rows.map(row => row.id_user))
      : [];
    const destinatarios = [...new Set([
      ...idsActivosSolicitados,
      ...idsTodosActivos,
      ...(id_responsable ? [Number(id_responsable)] : [])
    ])];
    const idAutor = Number(req.usuario.id_usuario);
    const idResponsable = id_responsable ? Number(id_responsable) : null;
    const usuariosVisibles = [...new Set([...idsActivosSolicitados, ...idsTodosActivos]
      .filter(id => Number.isSafeInteger(Number(id)) && Number(id) > 0)
      .map(Number)
      .filter(id => id !== idAutor && id !== idResponsable))];

    // Validar campos requeridos según plantilla
    const bodyPlano = { titulo, descripcion, prioridad, id_responsable, fecha_hecho, ubicacion };
    for (const campo of camposRequeridos) {
      if (!bodyPlano[campo] && !(extra_data && extra_data[campo])) {
        await conn.rollback();
        return res.status(400).json({
          error: `El campo '${campo}' es requerido para este tipo de reporte`
        });
      }
    }

    const id_report = uuidv4();

    const [insertResult] = await conn.execute(
      `INSERT INTO reports
         (id_report, id_type, titulo, descripcion, status, prioridad,
          id_autor, id_responsable, id_warehouse,
          visibilidad_usuarios, es_publico,
          fecha_hecho, fecha_limite, ubicacion, extra_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_report, id_type, titulo, descripcion || null, statusCreacion, prioridad,
        req.usuario.id_usuario,
        id_responsable  ? parseInt(id_responsable) : null,
        id_warehouse    || req.usuario.id_warehouse || null,
        usuariosVisibles.length ? JSON.stringify(usuariosVisibles) : null,
        0,
        fecha_hecho  || null,
        fecha_limite || null,
        ubicacion    || null,
        extra_data   ? JSON.stringify(extra_data) : null
      ]
    );

    // Auditoría
    await registrarAudit({
      entidad_tipo: 'report',
      entidad_id:   id_report,
      accion:       'crear',
      id_usuario:   req.usuario.id_usuario,
      cambios:      { status: { antes: null, despues: statusCreacion } }
    }, conn);

    // Tarea inicial opcional
    if (tarea && tarea.titulo) {
      const id_task = uuidv4();
      await conn.execute(
        `INSERT INTO tasks (id_task, id_report, titulo, descripcion, id_asignado, fecha_limite)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id_task, id_report,
          tarea.titulo,
          tarea.descripcion || null,
          tarea.id_asignado ? parseInt(tarea.id_asignado) : null,
          tarea.fecha_limite || null
        ]
      );
    }

    if (statusCreacion === 'enviado') {
      await crearNotificaciones(conn, {
        userIds: idResponsable && idResponsable !== idAutor ? [idResponsable] : [],
        reportId: id_report,
        tipo: 'asignacion',
        mensaje: `Tienes asignado el ticket #${formatearNumeroTicket(insertResult.insertId)}`
      });
      await crearNotificaciones(conn, {
        userIds: destinatarios.filter(id => id !== idAutor && id !== idResponsable),
        reportId: id_report,
        tipo: 'ticket_creado',
        mensaje: `Se creó el ticket #${formatearNumeroTicket(insertResult.insertId)} para ti`
      });
    }

    await conn.commit();
    publicarNotificacionesPendientes(conn);
    return res.status(201).json({
      mensaje: 'Reporte creado exitosamente',
      id_report,
      numero_ticket: insertResult.insertId
    });

  } catch (err) {
    await conn.rollback();
    descartarNotificacionesPendientes(conn);
    console.error('Error al crear reporte:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
};

/**
 * PATCH /api/reports/:id
 * Actualizar estado, responsable, campos editables
 */
const actualizar = async (req, res) => {
  const { id } = req.params;
  const {
    status, id_responsable, prioridad,
    titulo, descripcion, fecha_limite,
    ubicacion, extra_data
  } = req.body;

  if (fecha_limite && !fechaLimiteValida(fecha_limite)) {
    return res.status(400).json({ error: 'La fecha límite debe ser hoy o una fecha futura' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM reports WHERE id_report = ?', [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const reporte = rows[0];

    if (id_responsable !== undefined && reporte.status !== 'borrador'
      && Number(id_responsable || 0) !== Number(reporte.id_responsable || 0)) {
      return res.status(400).json({ error: 'Usa la acción de transferencia para cambiar el responsable' });
    }

    if (status === 'enviado' && reporte.status === 'borrador'
      && !(id_responsable || reporte.id_responsable)) {
      return res.status(400).json({ error: 'Selecciona un responsable antes de enviar el ticket' });
    }

    // Solo autor o admin puede editar
    if (Number(reporte.id_autor) !== Number(req.usuario.id_usuario)
      && Number(req.usuario.id_role) !== 1) {
      return res.status(403).json({
        error: 'Solo el autor o un administrador puede editar este reporte'
      });
    }

    // Validar transición de estado (admin puede saltar restricciones de flujo)
    const ESTADOS_VALIDOS = ['borrador', 'enviado', 'en_revision', 'aprobado', 'negado', 'resuelto', 'cerrado'];
    if (status && !ESTADOS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: `Estado inválido: ${status}` });
    }
    if (status && status !== reporte.status && Number(req.usuario.id_role) !== 1) {
      const permitidas = TRANSICIONES[reporte.status] || [];
      if (!permitidas.includes(status)) {
        return res.status(400).json({
          error: `Transición no permitida: ${reporte.status} → ${status}`,
          permitidas
        });
      }
    }

    const cambios = {};
    const sets    = [];
    const params  = [];

    const agregar = (campo, valorNuevo, valorActual) => {
      if (valorNuevo !== undefined && valorNuevo !== valorActual) {
        sets.push(`${campo} = ?`);
        params.push(valorNuevo);
        cambios[campo] = { antes: valorActual, despues: valorNuevo };
      }
    };

    agregar('status',         status,         reporte.status);
    agregar(
      'id_responsable',
      id_responsable === undefined ? reporte.id_responsable : id_responsable ? parseInt(id_responsable) : null,
      reporte.id_responsable
    );
    agregar('prioridad',      prioridad,       reporte.prioridad);
    agregar('titulo',         titulo,          reporte.titulo);
    agregar('descripcion',    descripcion,     reporte.descripcion);
    agregar('fecha_limite',   fecha_limite,    reporte.fecha_limite);
    agregar('ubicacion',      ubicacion,       reporte.ubicacion);

    if (extra_data !== undefined) {
      sets.push('extra_data = ?');
      params.push(JSON.stringify(extra_data));
      cambios['extra_data'] = { antes: reporte.extra_data, despues: extra_data };
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No se enviaron cambios' });
    }

    params.push(id);
    await pool.execute(
      `UPDATE reports SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id_report = ?`,
      params
    );

    if (cambios.id_responsable && id_responsable && !cambios.status && reporte.status !== 'borrador') {
      await crearNotificaciones(pool, {
        userIds: [parseInt(id_responsable)],
        reportId: id,
        tipo: 'asignacion',
        mensaje: 'El ticket fue asignado a ti'
      });
    }

    // Aviso al cambiar estado
    if (cambios.status) {
      const etiquetas = {
        enviado:     'enviado al responsable',
        en_revision: 'en revisión',
        aprobado:    'aprobado',
        negado:      'negado',
        resuelto:    'resuelto',
        cerrado:     'cerrado'
      };
      const etiqueta  = etiquetas[status] || status;
      const idAutor   = parseInt(reporte.id_autor);
      const responsableFinal = id_responsable === undefined ? reporte.id_responsable : id_responsable;
      const idResp    = responsableFinal ? parseInt(responsableFinal) : null;
      const idUsuario = parseInt(req.usuario.id_usuario);
      const destinatarios = [idAutor, idResp].filter(id => id && id !== idUsuario);
      if (destinatarios.length) {
        await crearNotificaciones(pool, {
          userIds: destinatarios,
          reportId: id,
          tipo: 'cambio_estado',
          mensaje: `El ticket cambió a: ${etiqueta}`
        });
      }
    }

    await registrarAudit({
      entidad_tipo: 'report',
      entidad_id:   id,
      accion:       status ? 'cambio_estado' : 'actualizar',
      id_usuario:   req.usuario.id_usuario,
      cambios
    });

    return res.json({ mensaje: 'Reporte actualizado', cambios });

  } catch (err) {
    console.error('Error al actualizar reporte:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * DELETE /api/reports/:id — soft delete (cambia a 'cerrado')
 */
const eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT id_autor, id_responsable, visibilidad_usuarios, titulo, status FROM reports WHERE id_report = ?', [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const reporte = rows[0];
    if (Number(reporte.id_autor) !== Number(req.usuario.id_usuario)
      && Number(req.usuario.id_role) !== 1) {
      return res.status(403).json({ error: 'No tienes permiso para cerrar este reporte' });
    }

    if (reporte.status !== 'cerrado') {
      await pool.execute(
        'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id_report = ?',
        ['cerrado', id]
      );

      const visibilidad = Array.isArray(reporte.visibilidad_usuarios)
        ? reporte.visibilidad_usuarios
        : JSON.parse(reporte.visibilidad_usuarios || '[]');
      const destinatarios = [
        reporte.id_autor,
        reporte.id_responsable,
        ...visibilidad
      ]
        .map(Number)
        .filter(userId => userId > 0 && userId !== Number(req.usuario.id_usuario));
      await crearNotificaciones(pool, {
        userIds: destinatarios,
        reportId: id,
        tipo: 'cambio_estado',
        mensaje: 'El ticket fue cerrado'
      });
    }

    await registrarAudit({
      entidad_tipo: 'report',
      entidad_id:   id,
      accion:       'cerrar',
      id_usuario:   req.usuario.id_usuario,
      cambios:      { status: { antes: reporte.status, despues: 'cerrado' } }
    });

    return res.json({ mensaje: 'Reporte cerrado' });
  } catch (err) {
    console.error('Error al cerrar reporte:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * DELETE /api/reports/:id/permanent — elimina definitivamente un ticket
 */
const eliminarDefinitivamente = async (req, res) => {
  const { id } = req.params;
  if (Number(req.usuario.id_role) !== 1) {
    return res.status(403).json({ error: 'Solo un administrador puede eliminar tickets definitivamente' });
  }

  let conn;
  let archivosAdjuntos = [];
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id_report FROM reports WHERE id_report = ? FOR UPDATE', [id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const [adjuntos] = await conn.execute(
      'SELECT url_archivo FROM attachments WHERE id_report = ?',
      [id]
    );
    archivosAdjuntos = adjuntos.map(adjunto => adjunto.url_archivo);

    await conn.execute(
      `DELETE FROM audit_events
       WHERE (entidad_tipo = 'report' AND entidad_id = ?)
          OR entidad_id IN (SELECT id_comment FROM report_comments WHERE id_report = ?)
          OR entidad_id IN (SELECT id_task FROM tasks WHERE id_report = ?)`,
      [id, id, id]
    );
    await conn.execute('DELETE FROM reports WHERE id_report = ?', [id]);
    await conn.commit();
    try {
      await removeStoredFiles(archivosAdjuntos);
    } catch (cleanupError) {
      console.error('Error al limpiar archivos adjuntos del ticket eliminado:', cleanupError);
    }
    return res.json({ mensaje: 'Ticket eliminado definitivamente' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Error al eliminar ticket definitivamente:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el ticket definitivamente' });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * GET /api/reports/:id/history
 */
const historial = async (req, res) => {
  const { id } = req.params;
  if (Number(req.usuario.id_role) !== 1) {
    return res.status(403).json({ error: 'Solo un administrador puede consultar la auditoría' });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT
         ae.id_audit, ae.entidad_tipo, ae.accion, ae.cambios, ae.created_at,
         u.name_user AS usuario_nombre
       FROM audit_events ae
       LEFT JOIN ${S()}.users u ON ae.id_usuario = u.id_user
       LEFT JOIN report_comments rc
         ON ae.entidad_tipo = 'comment' AND ae.entidad_id = rc.id_comment
       LEFT JOIN tasks t
         ON ae.entidad_tipo = 'task' AND ae.entidad_id = t.id_task
       WHERE (ae.entidad_tipo = 'report' AND ae.entidad_id = ?)
          OR (ae.entidad_tipo = 'comment' AND rc.id_report = ?)
          OR (ae.entidad_tipo = 'task' AND t.id_report = ?)
       ORDER BY ae.created_at DESC`,
      [id, id, id]
    );

    const eventos = rows.map(e => ({
      ...e,
      cambios: e.cambios
        ? (typeof e.cambios === 'string' ? JSON.parse(e.cambios) : e.cambios)
        : {}
    }));

    return res.json({ historial: eventos });
  } catch (err) {
    console.error('Error al obtener historial:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── Funciones de gestión de flujo ────────────────────────────

/**
 * POST /api/reports/:id/review
 * Toma el ticket para revisión (enviado → en_revision)
 */
const iniciarRevision = async (req, res) => {
  const { id } = req.params;
  const uid = parseInt(req.usuario.id_usuario);
  const esAdmin = Number(req.usuario.id_role) === 1;
  try {
    const [rows] = await pool.execute(
      'SELECT status, titulo, id_autor, id_responsable FROM reports WHERE id_report = ?', [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    const rep = rows[0];
    // Solo admin o responsable actual puede tomar revisión
    if (!esAdmin && parseInt(rep.id_responsable) !== uid) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    if (rep.status !== 'enviado') {
      return res.status(400).json({ error: `No se puede iniciar revisión desde estado '${rep.status}'` });
    }
    await pool.execute(
      'UPDATE reports SET status = ?, id_responsable = ?, updated_at = CURRENT_TIMESTAMP WHERE id_report = ?',
      ['en_revision', uid, id]
    );
    await registrarAudit({ entidad_tipo: 'report', entidad_id: id, accion: 'cambio_estado', id_usuario: uid, cambios: { status: { antes: rep.status, despues: 'en_revision' } } });
    // Notificar al autor si no es quien tomó la revisión
    const idAutor = parseInt(rep.id_autor);
    if (idAutor && idAutor !== uid) {
      await crearNotificaciones(pool, {
        userIds: [idAutor], reportId: id, tipo: 'cambio_estado',
        mensaje: 'El ticket está en revisión'
      });
    }
    return res.json({ mensaje: 'Ticket tomado para revisión' });
  } catch (err) {
    console.error('Error al iniciar revisión:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * POST /api/reports/:id/decision
 * Aprueba o niega un ticket (en_revision → aprobado/negado)
 * Body: { decision: 'aprobar'|'negar', motivo?: string }
 */
const decidir = async (req, res) => {
  const { id } = req.params;
  const { decision, motivo } = req.body;
  const motivoDecision = typeof motivo === 'string' ? motivo.trim() : '';
  const uid = parseInt(req.usuario.id_usuario);
  const esAdmin = Number(req.usuario.id_role) === 1;
  if (!['aprobar', 'negar'].includes(decision)) {
    return res.status(400).json({ error: 'Decisión inválida. Use aprobar o negar' });
  }
  if (decision === 'negar' && !motivoDecision) {
    return res.status(400).json({ error: 'El motivo de negación es requerido' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT status, titulo, id_autor, id_responsable FROM reports WHERE id_report = ?', [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    const rep = rows[0];
    // Solo admin o responsable puede decidir
    if (!esAdmin && parseInt(rep.id_responsable) !== uid) {
      return res.status(403).json({ error: 'Solo el responsable o un administrador puede aprobar o negar' });
    }
    if (!['enviado', 'en_revision'].includes(rep.status)) {
      return res.status(400).json({ error: 'Solo se puede decidir sobre tickets pendientes o en revisión' });
    }
    const nuevoStatus = decision === 'aprobar' ? 'aprobado' : 'negado';
    // Usar SQL que actualiza el enum directamente — funciona aunque la columna sea VARCHAR o ENUM extendido
    await pool.execute(
      "UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id_report = ?",
      [nuevoStatus, id]
    );
    if (motivoDecision) {
      await pool.execute(
        'INSERT INTO report_comments (id_report, id_autor, contenido, es_resolucion) VALUES (?, ?, ?, 1)',
        [id, uid, motivoDecision]
      );
    }
    await registrarAudit({ entidad_tipo: 'report', entidad_id: id, accion: 'cambio_estado', id_usuario: uid, cambios: { status: { antes: 'en_revision', despues: nuevoStatus } } });
    const idAutor = parseInt(rep.id_autor);
    if (idAutor && idAutor !== uid) {
      await crearNotificaciones(pool, {
        userIds: [idAutor], reportId: id, tipo: 'cambio_estado',
        mensaje: `Tu ticket fue ${nuevoStatus}`
      });
    }
    return res.json({ mensaje: `Ticket ${nuevoStatus}` });
  } catch (err) {
    console.error('Error al decidir:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * POST /api/reports/:id/transfer
 * Transfiere el responsable del ticket
 * Body: { id_responsable: number, motivo: string }
 */
const transferir = async (req, res) => {
  const { id } = req.params;
  const { id_responsable, motivo } = req.body;
  const uid = parseInt(req.usuario.id_usuario);
  const esAdmin = Number(req.usuario.id_role) === 1;
  const nuevoResponsable = Number(id_responsable);
  const motivoTransferencia = typeof motivo === 'string' ? motivo.trim() : '';
  if (!Number.isSafeInteger(nuevoResponsable) || nuevoResponsable <= 0) {
    return res.status(400).json({ error: 'id_responsable debe ser un usuario válido' });
  }
  if (!motivoTransferencia) {
    return res.status(400).json({ error: 'El motivo de transferencia es requerido' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT titulo, id_autor, id_responsable, status FROM reports WHERE id_report = ?', [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });
    const rep = rows[0];
    // Solo admin o responsable actual puede transferir
    if (!esAdmin && parseInt(rep.id_responsable) !== uid) {
      return res.status(403).json({ error: 'No tienes permiso para transferir este ticket' });
    }
    if (!['borrador', 'enviado', 'en_revision'].includes(rep.status)) {
      return res.status(400).json({ error: `No se puede transferir un ticket desde estado '${rep.status}'` });
    }
    if (Number(rep.id_responsable) === nuevoResponsable) {
      return res.status(400).json({ error: 'El usuario ya es el responsable del ticket' });
    }
    const [destinatarios] = await pool.execute(
      `SELECT id_user FROM ${S()}.users WHERE id_user = ? AND status = 1 LIMIT 1`,
      [nuevoResponsable]
    );
    if (destinatarios.length === 0) {
      return res.status(400).json({ error: 'El nuevo responsable no existe o está inactivo' });
    }
    await pool.execute(
      'UPDATE reports SET id_responsable = ?, updated_at = CURRENT_TIMESTAMP WHERE id_report = ?',
      [nuevoResponsable, id]
    );
    await pool.execute(
      'INSERT INTO report_comments (id_report, id_autor, contenido) VALUES (?, ?, ?)',
      [id, uid, `Transferido: ${motivoTransferencia}`]
    );
    await registrarAudit({ entidad_tipo: 'report', entidad_id: id, accion: 'transferir', id_usuario: uid, cambios: { id_responsable: { antes: rep.id_responsable, despues: nuevoResponsable } } });
    await crearNotificaciones(pool, {
      userIds: [nuevoResponsable],
      reportId: id, tipo: 'asignacion',
      mensaje: 'El ticket fue transferido a ti'
    });
    return res.json({ mensaje: 'Ticket transferido correctamente' });
  } catch (err) {
    console.error('Error al transferir:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, detalle, crear, actualizar, eliminar, eliminarDefinitivamente, historial, stats, iniciarRevision, decidir, transferir };
