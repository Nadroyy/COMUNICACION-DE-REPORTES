// Controlador de comentarios — usa users de al2 (name_user, no nombre)
const pool = require('../config/db');
const S = () => pool.mainDb; // base del sistema (users, warehouses)
const { v4: uuidv4 } = require('uuid');
const { registrarAudit } = require('../middleware/audit');
const {
  crearNotificaciones,
  publicarNotificacionesPendientes,
  descartarNotificacionesPendientes
} = require('../services/notifications');

/**
 * GET /api/reports/:id/comments
 */
const listar = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT
         rc.id_comment, rc.contenido, rc.es_resolucion, rc.created_at,
         u.name_user AS autor_nombre, u.email AS autor_email
       FROM report_comments rc
       JOIN ${S()}.users u ON rc.id_autor = u.id_user
       WHERE rc.id_report = ?
       ORDER BY rc.created_at ASC`,
      [id]
    );
    return res.json({ comentarios: rows });
  } catch (err) {
    console.error('Error al listar comentarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * POST /api/reports/:id/comments
 * Body: { contenido, es_resolucion }
 */
const crear = async (req, res) => {
  const { id } = req.params;
  const { contenido, es_resolucion = false } = req.body;

  if (!contenido || contenido.trim() === '') {
    return res.status(400).json({ error: 'El contenido es requerido' });
  }
  if (typeof es_resolucion !== 'boolean') {
    return res.status(400).json({ error: 'es_resolucion debe ser booleano' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [repRows] = await conn.execute(
      `SELECT id_report, id_autor, id_responsable, visibilidad_usuarios, titulo, status
       FROM reports WHERE id_report = ? FOR UPDATE`,
      [id]
    );
    if (repRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    const reporte = repRows[0];
    if (es_resolucion && Number(req.usuario.id_role) !== 1
      && Number(reporte.id_responsable) !== Number(req.usuario.id_usuario)) {
      await conn.rollback();
      return res.status(403).json({ error: 'Solo el responsable o un administrador puede registrar la resolución' });
    }
    if (es_resolucion && reporte.status !== 'en_revision') {
      await conn.rollback();
      return res.status(400).json({ error: 'Solo se puede resolver un ticket en revisión' });
    }

    const id_comment = uuidv4();
    await conn.execute(
      `INSERT INTO report_comments (id_comment, id_report, id_autor, contenido, es_resolucion)
       VALUES (?, ?, ?, ?, ?)`,
      [id_comment, id, req.usuario.id_usuario, contenido.trim(), es_resolucion ? 1 : 0]
    );

    const visibilidad = Array.isArray(reporte.visibilidad_usuarios)
      ? reporte.visibilidad_usuarios
      : JSON.parse(reporte.visibilidad_usuarios || '[]');
    const destinatariosComentario = [
      reporte.id_autor,
      reporte.id_responsable,
      ...visibilidad
    ].filter(idUsuario => idUsuario
      && Number(idUsuario) !== Number(req.usuario.id_usuario));

    // Si es resolución y el reporte está en revisión → pasar a resuelto automáticamente
    if (es_resolucion) {
      await conn.execute(
        'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id_report = ?',
        ['resuelto', id]
      );
      const destinatariosEstado = [reporte.id_autor, reporte.id_responsable]
        .filter(idUsuario => idUsuario && Number(idUsuario) !== Number(req.usuario.id_usuario));
      await crearNotificaciones(conn, {
        userIds: [...new Set([...destinatariosEstado, ...visibilidad.map(Number)])
          .filter(idUsuario => idUsuario && Number(idUsuario) !== Number(req.usuario.id_usuario))],
        reportId: id,
        tipo: 'cambio_estado',
        mensaje: 'El ticket fue marcado como resuelto'
      });
      await registrarAudit({
        entidad_tipo: 'report',
        entidad_id:   id,
        accion:       'cambio_estado',
        id_usuario:   req.usuario.id_usuario,
        cambios:      { status: { antes: 'en_revision', despues: 'resuelto' } }
      }, conn);
    } else {
      await crearNotificaciones(conn, {
        userIds: destinatariosComentario,
        reportId: id,
        tipo: 'comentario',
        mensaje: `${req.usuario.nombre || 'Un usuario'} agregó un comentario`
      });
    }

    await registrarAudit({
      entidad_tipo: 'comment',
      entidad_id:   id_comment,
      accion:       'crear_comentario',
      id_usuario:   req.usuario.id_usuario,
      cambios:      { es_resolucion: { antes: null, despues: es_resolucion } }
    }, conn);

    await conn.commit();
    publicarNotificacionesPendientes(conn);
    return res.status(201).json({ mensaje: 'Comentario agregado', id_comment });

  } catch (err) {
    await conn.rollback();
    descartarNotificacionesPendientes(conn);
    console.error('Error al crear comentario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
};

module.exports = { listar, crear };
