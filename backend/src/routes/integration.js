/**
 * Endpoints de integración para el sistema principal (al2)
 *
 * El sistema principal llama estos endpoints con:
 *   Authorization: Bearer <INTEGRATION_SECRET>   (variable de entorno)
 *
 * Esto desacopla el módulo de tickets del sistema principal:
 * el sistema principal no necesita acceder directamente a esta BD,
 * solo hace llamadas HTTP a estos endpoints.
 *
 * Flujos disponibles:
 *   POST /api/integration/notify        → Enviar aviso a uno o varios usuarios
 *   POST /api/integration/ticket        → Crear ticket desde el sistema principal
 *   GET  /api/integration/user-pending  → Contador y resumen de avisos pendientes
 *   PATCH /api/integration/user-pending/read → Marcar un aviso como leído
 */
const express = require('express');
const router  = express.Router();
const formatearNumeroTicket = numero => String(numero).padStart(3, '0');
const {
  crearNotificaciones,
  publicarNotificacionesPendientes,
  descartarNotificacionesPendientes
} = require('../services/notifications');
const pool    = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const S = () => pool.mainDb;

// ── Middleware: valida la clave de integración ───────────────────────────────
const verificarIntegracion = (req, res, next) => {
  const secret = process.env.INTEGRATION_SECRET;
  if (!secret) {
    // Si no está configurada la clave, el endpoint está deshabilitado
    return res.status(503).json({ error: 'Integración no configurada' });
  }
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== secret) {
    return res.status(401).json({ error: 'Clave de integración inválida' });
  }
  next();
};

router.use(verificarIntegracion);

// ── POST /api/integration/notify ────────────────────────────────────────────
/**
 * Envía un aviso interno a uno o varios usuarios.
 *
 * Body:
 *   userIds   number[]   IDs de usuarios a notificar (requerido)
 *   reportId  string     ID del ticket relacionado (requerido)
 *   tipo      string     Tipo de aviso: ticket_creado | comentario_nuevo | cambio_estado | asignacion | sistema
 *   mensaje   string     Texto del aviso (requerido)
 *
 * Respuesta: { enviados: number }
 */
router.post('/notify', async (req, res) => {
  const { userIds, reportId, tipo = 'sistema', mensaje } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds debe ser un array con al menos un id' });
  }
  if (!reportId || typeof reportId !== 'string') {
    return res.status(400).json({ error: 'reportId es requerido' });
  }
  if (!mensaje || typeof mensaje !== 'string') {
    return res.status(400).json({ error: 'mensaje es requerido' });
  }

  const idsSolicitados = [...new Set(userIds
    .map(Number)
    .filter(id => Number.isSafeInteger(id) && id > 0))];
  if (!idsSolicitados.length) {
    return res.status(400).json({ error: 'userIds debe incluir ids válidos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Verificar que el ticket existe
    const [repRows] = await conn.execute(
      'SELECT id_report, id_autor, id_responsable, visibilidad_usuarios, status FROM reports WHERE id_report = ? FOR UPDATE',
      [reportId]
    );
    if (repRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    if (repRows[0].status === 'borrador') {
      await conn.rollback();
      return res.status(409).json({ error: 'No se pueden enviar avisos sobre un borrador' });
    }

    const [usuariosActivos] = await conn.execute(
      `SELECT id_user FROM ${S()}.users
       WHERE status = 1 AND id_user IN (${idsSolicitados.map(() => '?').join(',')})`,
      idsSolicitados
    );
    const destinatarios = usuariosActivos.map(row => Number(row.id_user));
    const visibilidadActual = Array.isArray(repRows[0].visibilidad_usuarios)
      ? repRows[0].visibilidad_usuarios
      : JSON.parse(repRows[0].visibilidad_usuarios || '[]');
    const visibilidadActualizada = [...new Set([
      ...visibilidadActual.map(Number),
      ...destinatarios.filter(id =>
        id !== Number(repRows[0].id_autor) && id !== Number(repRows[0].id_responsable)
      )
    ].filter(id => Number.isSafeInteger(id) && id > 0))];

    await conn.execute(
      'UPDATE reports SET visibilidad_usuarios = ? WHERE id_report = ?',
      [visibilidadActualizada.length ? JSON.stringify(visibilidadActualizada) : null, reportId]
    );
    await crearNotificaciones(conn, { userIds: destinatarios, reportId, tipo, mensaje });
    await conn.commit();
    publicarNotificacionesPendientes(conn);

    return res.json({ enviados: destinatarios.length, ok: true });
  } catch (err) {
    await conn.rollback();
    descartarNotificacionesPendientes(conn);
    console.error('Error en integration/notify:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// ── POST /api/integration/ticket ────────────────────────────────────────────
/**
 * Crea un ticket desde el sistema principal.
 * Útil para que el sistema principal genere tickets automáticos
 * (ej: "Se detectó falta de inventario en bodega X").
 *
 * Body:
 *   id_type        string   Slug del tipo (aviso_evento | solicitud_decision | reporte_operativo)
 *   titulo         string   Título del ticket
 *   descripcion    string   Descripción (opcional)
 *   id_autor       number   ID del usuario que origina el ticket
 *   id_responsable number   ID del responsable (opcional)
 *   prioridad      string   baja | media | alta | critica (default: media)
 *   notificar      number[] IDs adicionales a notificar (opcional)
 *   extra_data     object   Campos extra del tipo (opcional)
 *
 * Respuesta: { id_report, mensaje }
 */
router.post('/ticket', async (req, res) => {
  const {
    id_type, titulo, descripcion,
    id_autor, id_responsable,
    prioridad = 'media',
    notificar = [],
    extra_data
  } = req.body;

  if (!id_type || !titulo || !id_autor) {
    return res.status(400).json({ error: 'id_type, titulo e id_autor son requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Resolver tipo por slug o id
    const [tipoRows] = await conn.execute(
      'SELECT id_type, nombre FROM report_types WHERE (slug = ? OR id_type = ?) AND activo = 1 LIMIT 1',
      [id_type, id_type]
    );
    if (tipoRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Tipo de ticket no válido' });
    }

    const tipo      = tipoRows[0];
    const id_report = uuidv4();
    const idsNotificados = Array.isArray(notificar)
      ? [...new Set(notificar.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
      : [];
    const idsNotificadosActivos = idsNotificados.length
      ? await conn.execute(
          `SELECT id_user FROM ${S()}.users
           WHERE status = 1 AND id_user IN (${idsNotificados.map(() => '?').join(',')})`,
          idsNotificados
        ).then(([rows]) => rows.map(row => Number(row.id_user)))
      : [];
    const usuariosVisibles = idsNotificadosActivos.filter(id => id !== Number(id_autor));

    const [insertResult] = await conn.execute(
      `INSERT INTO reports
         (id_report, id_type, titulo, descripcion, status, prioridad,
          id_autor, id_responsable, visibilidad_usuarios, extra_data)
       VALUES (?, ?, ?, ?, 'enviado', ?, ?, ?, ?, ?)`,
      [
        id_report, tipo.id_type, titulo, descripcion || null, prioridad,
        String(id_autor),
        id_responsable ? String(id_responsable) : null,
        usuariosVisibles.length ? JSON.stringify(usuariosVisibles) : null,
        extra_data ? JSON.stringify(extra_data) : null
      ]
    );

    // Notificar responsable y destinatarios adicionales
    const destinatarios = [...new Set([
      ...(id_responsable ? [Number(id_responsable)] : []),
      ...idsNotificadosActivos
    ].filter(id => Number.isSafeInteger(id) && id > 0 && id !== Number(id_autor)))];

    if (destinatarios.length) {
      await crearNotificaciones(conn, {
        userIds: destinatarios,
        reportId: id_report,
        tipo: 'ticket_creado',
        mensaje: `Nuevo ticket #${formatearNumeroTicket(insertResult.insertId)} desde el sistema: ${titulo}`
      });
    }

    await conn.commit();
    publicarNotificacionesPendientes(conn);
    return res.status(201).json({
      id_report,
      numero_ticket: insertResult.insertId,
      mensaje: 'Ticket creado exitosamente'
    });
  } catch (err) {
    await conn.rollback();
    descartarNotificacionesPendientes(conn);
    console.error('Error en integration/ticket:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
});

// ── GET /api/integration/user-pending ───────────────────────────────────────
/**
 * Avisos sin leer y siguiente paso sugerido para mostrar en el sistema principal.
 *
 * Query: ?userId=910003
 *
 * Respuesta: { userId, pendientes, notificaciones: [...] }
 */
router.get('/user-pending', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'userId es requerido' });
  }
  try {
    const [[usuario]] = await pool.execute(
      `SELECT role AS id_role FROM ${S()}.users WHERE id_user = ? AND status = 1`,
      [userId]
    );
    if (!usuario) return res.status(404).json({ error: 'Usuario activo no encontrado' });
    const esAdmin = Number(usuario.id_role) === 1;
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM notifications n
       JOIN reports r ON r.id_report = n.id_report
       WHERE n.id_usuario = ? AND n.leido = 0
         AND (r.id_autor = ? OR ? = 1 OR (
           r.status <> 'borrador'
           AND (
             r.id_responsable = ?
             OR JSON_CONTAINS(r.visibilidad_usuarios, CAST(? AS JSON))
           )
         ))`,
      [userId, userId, esAdmin ? 1 : 0, userId, String(userId)]
    );
    const [rows] = await pool.execute(
      `SELECT n.id_notif, n.id_report, n.tipo, n.mensaje, n.created_at,
              r.titulo, r.status, r.id_autor, r.id_responsable
       FROM notifications n
       JOIN reports r ON r.id_report = n.id_report
       WHERE n.id_usuario = ? AND n.leido = 0
         AND (r.id_autor = ? OR ? = 1 OR (
           r.status <> 'borrador'
           AND (
             r.id_responsable = ?
             OR JSON_CONTAINS(r.visibilidad_usuarios, CAST(? AS JSON))
           )
         ))
       ORDER BY n.created_at DESC
       LIMIT 10`,
      [userId, userId, esAdmin ? 1 : 0, userId, String(userId)]
    );
    const notificaciones = rows.map(row => {
      const esResponsable = Number(row.id_responsable) === userId;
      const esAutor = Number(row.id_autor) === userId;
      let siguientePaso = 'Abrir el ticket para revisar la novedad';
      if (row.status === 'enviado') {
        siguientePaso = esResponsable || esAdmin ? 'Tomar el ticket para revisión' : 'Revisar el ticket pendiente';
      } else if (row.status === 'en_revision' && (esResponsable || esAdmin)) {
        siguientePaso = 'Revisar el ticket y registrar una decisión';
      } else if (row.status === 'resuelto' && (esAutor || esAdmin)) {
        siguientePaso = 'Revisar la resolución';
      } else if (row.status === 'cerrado') {
        siguientePaso = 'Consultar la actualización del ticket';
      }
      return {
        id_notif: row.id_notif,
        id_report: row.id_report,
        titulo: row.titulo,
        tipo: row.tipo,
        mensaje: row.mensaje,
        status: row.status,
        created_at: row.created_at,
        siguiente_paso: siguientePaso,
        ruta: `/reports/${encodeURIComponent(row.id_report)}`
      };
    });
    return res.json({ userId, pendientes: Number(total), notificaciones });
  } catch (err) {
    console.error('Error en integration/user-pending:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/user-pending/read', async (req, res) => {
  const userId = Number(req.body.userId);
  const { notificationId } = req.body;
  if (!Number.isSafeInteger(userId) || userId <= 0 || typeof notificationId !== 'string' || !notificationId.trim()) {
    return res.status(400).json({ error: 'userId y notificationId son requeridos' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE notifications SET leido = 1 WHERE id_notif = ? AND id_usuario = ? AND leido = 0',
      [notificationId, userId]
    );
    return res.json({ ok: true, marcada: result.affectedRows === 1 });
  } catch (err) {
    console.error('Error al marcar aviso de integración:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
