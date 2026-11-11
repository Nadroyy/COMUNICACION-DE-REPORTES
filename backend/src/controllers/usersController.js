// Controlador de usuarios — usa la fuente de verdad del sistema principal cuando está configurada.
// Si no existe una URL del sistema principal, se usa la base local como fallback.
const pool = require('../config/db');
const S = () => pool.mainDb;
const { fetchUsuariosSistemaPrincipal, getSistemaPrincipalBaseUrl } = require('../services/mainSystemUsers');

/**
 * GET /api/users/asignables
 * Lista usuarios activos con su sede y rol para asignar en reportes/tareas.
 * Prioriza el endpoint real del sistema principal: /getUsersReportes.
 */
const listarAsignables = async (req, res) => {
  const sistemaPrincipalUrl = getSistemaPrincipalBaseUrl();

  if (sistemaPrincipalUrl) {
    try {
      const authHeader = req.get('Authorization') || '';
      const usuarios = await fetchUsuariosSistemaPrincipal(authHeader);
      return res.json({ usuarios });
    } catch (err) {
      console.error('No se pudo consultar /getUsersReportes del sistema principal:', err.message);
      return res.status(err.status || 502).json({ error: 'No se pudo obtener la lista del sistema principal' });
    }
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
         u.id_user      AS id_usuario,
         u.name_user    AS nombre,
         u.email,
         u.role         AS id_role,
         r.name_role,
         u.sede_user    AS id_warehouse,
         w.name         AS nombre_warehouse
       FROM ${S()}.users u
       LEFT JOIN roles      r ON r.id_role      = u.role
       LEFT JOIN ${S()}.warehouses w ON w.id_warehouse = u.sede_user
       WHERE u.status = 1
       ORDER BY u.name_user`
    );
    return res.json({ usuarios: rows });
  } catch (err) {
    console.error('Error al listar asignables:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listarAsignables };
