// Middleware de acceso a reportes — usa users y warehouses de al2
// req.usuario tiene: id_usuario (int), id_role (int), id_warehouse (varchar)
const pool = require('../config/db');

const parseArray = value => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

/**
 * Los borradores son privados para su autor y administradores.
 * Los reportes publicados son visibles para su autor, responsable,
 * usuarios compartidos explícitamente y administradores.
 */
const puedeVerReporte = (reporte, usuario) => {
  const uid = Number(usuario.id_usuario);

  return Number(usuario.id_role) === 1
    || Number(reporte.id_autor) === uid
    || (reporte.status !== 'borrador' && (
      Number(reporte.id_responsable) === uid
      || parseArray(reporte.visibilidad_usuarios).map(Number).includes(uid)
    ));
};

/**
 * Middleware: carga el reporte y verifica acceso.
 * Si pasa, inyecta req.reporte para los siguientes handlers.
 */
const verificarAccesoReporte = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM reports WHERE id_report = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    if (!puedeVerReporte(rows[0], req.usuario)) {
      return res.status(403).json({ error: 'No tienes acceso a este reporte' });
    }

    req.reporte = rows[0];
    next();
  } catch (err) {
    console.error('Error al verificar acceso al reporte:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { puedeVerReporte, verificarAccesoReporte };
