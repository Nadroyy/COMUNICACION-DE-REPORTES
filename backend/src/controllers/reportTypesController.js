// Controlador de tipos de reporte
const pool = require('../config/db');

const parseJsonArray = value => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
};

/**
 * GET /api/report-types
 * Lista todos los tipos de reporte activos
 */
const listar = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id_type, nombre, slug, descripcion,
              template_fields, required_fields, roles_permitidos
       FROM report_types
       WHERE activo = 1
       ORDER BY nombre`
    );

    // Parsear JSON fields
    const tipos = rows.filter(t => {
      const roles = parseJsonArray(t.roles_permitidos);
      return roles.length === 0 || roles.some(role => Number(role) === Number(req.usuario.id_role));
    }).map(t => ({
      ...t,
      template_fields:  parseJsonArray(t.template_fields),
      required_fields:  parseJsonArray(t.required_fields),
      roles_permitidos: parseJsonArray(t.roles_permitidos)
    }));

    return res.json({ tipos });
  } catch (err) {
    console.error('Error al listar tipos de reporte:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/report-types/:slug
 * Detalle de un tipo por slug
 */
const detalle = async (req, res) => {
  const { slug } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT id_type, nombre, slug, descripcion,
              template_fields, required_fields, roles_permitidos
       FROM report_types
       WHERE slug = ? AND activo = 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tipo de reporte no encontrado' });
    }

    const tipo = rows[0];
    const roles = parseJsonArray(tipo.roles_permitidos);
    if (roles.length > 0 && !roles.some(role => Number(role) === Number(req.usuario.id_role))) {
      return res.status(403).json({ error: 'No tienes permiso para crear este tipo de reporte' });
    }

    return res.json({
      tipo: {
        ...tipo,
        template_fields:  parseJsonArray(tipo.template_fields),
        required_fields:  parseJsonArray(tipo.required_fields),
        roles_permitidos: roles
      }
    });
  } catch (err) {
    console.error('Error al obtener tipo de reporte:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, detalle };
