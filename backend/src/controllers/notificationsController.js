const pool = require('../config/db');

const condicionAccesoNotificacion = `
  (r.id_autor = ? OR ? = 1 OR (
    r.status <> 'borrador'
    AND (
      r.id_responsable = ?
      OR JSON_CONTAINS(r.visibilidad_usuarios, CAST(? AS JSON))
    )
  ))
`;

const parametrosAccesoNotificacion = (userId, esAdmin) => [
  userId, esAdmin ? 1 : 0, userId, String(userId)
];

const contarNoLeidas = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;
    const esAdmin = Number(req.usuario.id_role) === 1;
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM notifications n
       JOIN reports r ON r.id_report = n.id_report
       WHERE n.id_usuario = ? AND n.leido = 0
         AND ${condicionAccesoNotificacion}`,
      [userId, ...parametrosAccesoNotificacion(userId, esAdmin)]
    );
    return res.json({ no_leidas: Number(total) || 0 });
  } catch (err) {
    console.error('Error al contar notificaciones no leídas:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const listar = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;
    const esAdmin = Number(req.usuario.id_role) === 1;
    const [rows] = await pool.execute(
      `SELECT n.id_notif, n.id_report, n.tipo, n.mensaje,
              n.leido, n.created_at, r.titulo
       FROM notifications n
       JOIN reports r ON r.id_report = n.id_report
       WHERE n.id_usuario = ?
         AND ${condicionAccesoNotificacion}
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [userId, ...parametrosAccesoNotificacion(userId, esAdmin)]
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM notifications n
       JOIN reports r ON r.id_report = n.id_report
       WHERE n.id_usuario = ? AND n.leido = 0
         AND ${condicionAccesoNotificacion}`,
      [userId, ...parametrosAccesoNotificacion(userId, esAdmin)]
    );

    return res.json({
      notificaciones: rows,
      no_leidas: total
    });
  } catch (err) {
    console.error('Error al listar notificaciones:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const marcarLeida = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;
    const esAdmin = Number(req.usuario.id_role) === 1;
    await pool.execute(
      `UPDATE notifications n
       JOIN reports r ON r.id_report = n.id_report
       SET n.leido = 1
       WHERE n.id_notif = ? AND n.id_usuario = ?
         AND ${condicionAccesoNotificacion}`,
      [req.params.id, userId, ...parametrosAccesoNotificacion(userId, esAdmin)]
    );
    return res.json({ mensaje: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('Error al marcar notificación:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;
    const esAdmin = Number(req.usuario.id_role) === 1;
    await pool.execute(
      `UPDATE notifications n
       JOIN reports r ON r.id_report = n.id_report
       SET n.leido = 1
       WHERE n.id_usuario = ? AND n.leido = 0
         AND ${condicionAccesoNotificacion}`,
      [userId, ...parametrosAccesoNotificacion(userId, esAdmin)]
    );
    return res.json({ mensaje: 'Notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('Error al marcar notificaciones:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { contarNoLeidas, listar, marcarLeida, marcarTodasLeidas };
