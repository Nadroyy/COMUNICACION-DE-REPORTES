// Middleware de autenticación con JWT
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const S = () => pool.mainDb;
const { buscarUsuarioActivo, fetchUsuariosSistemaPrincipal } = require('../services/mainSystemUsers');

/**
 * Verifica el token JWT en el header Authorization.
 * Inyecta req.usuario con { id_usuario, email, id_role, id_warehouse, nombre, cajera }
 * En modo host-jwt, la identidad y los permisos se obtienen de /getUsersReportes.
 */
const verificarToken = async (req, res, next) => {
  if (process.env.AUTH_MODE === 'host-jwt') {
    const secret = process.env.HOST_JWT_SECRET;
    if (!secret) {
      return res.status(503).json({ error: 'Autenticación del sistema principal no configurada' });
    }

    const authHeader = req.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Token del sistema principal requerido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(match[1], secret, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ error: err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido' });
    }

    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const idUsuario = Number(decoded?.id);
    const email = typeof decoded?.email === 'string' ? decoded.email.trim() : '';
    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0 || !email || !Number.isInteger(decoded.exp)) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    try {
      const usuarios = await fetchUsuariosSistemaPrincipal(`Bearer ${match[1]}`);
      const usuario = buscarUsuarioActivo(usuarios, idUsuario, email);
      if (!usuario) {
        return res.status(401).json({ error: 'Usuario activo no encontrado' });
      }

      req.usuario = usuario;
      return next();
    } catch (err) {
      console.error('Error al validar el JWT con /getUsersReportes:', err.message);
      return res.status(err.status || 502).json({ error: 'No se pudo validar el usuario con el sistema principal' });
    }
  }

  if (process.env.AUTH_MODE === 'host-email') {
    const email = req.get('X-User-Email')?.trim();
    if (!email) {
      return res.status(401).json({ error: 'Sesión del sistema requerida' });
    }

    try {
      const [rows] = await pool.execute(
        `SELECT u.id_user AS id_usuario, u.email, u.name_user AS nombre,
                u.role AS id_role, r.name_role,
                u.sede_user AS id_warehouse, w.name AS nombre_warehouse,
                u.cajera
         FROM ${S()}.users u
         LEFT JOIN ${S()}.roles r ON r.id_role = u.role
         LEFT JOIN ${S()}.warehouses w ON w.id_warehouse = u.sede_user
         WHERE u.email = ? AND u.status = 1
         LIMIT 1`,
        [email]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Usuario activo no encontrado' });
      }

      req.usuario = rows[0];
      return next();
    } catch (err) {
      console.error('Error al validar la sesión del sistema:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  // Formato esperado: "Bearer <token>"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Formato de token inválido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

/**
 * Middleware para verificar que el usuario tiene uno de los roles permitidos.
 * Uso: requireRoles(1, 2) — solo administrador y financiero
 */
const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.usuario.id_role)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
};

module.exports = { verificarToken, requireRoles };
