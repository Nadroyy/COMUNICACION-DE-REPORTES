// Controlador de autenticación — usa tabla users de la BD al2
// Estructura real: id_user (int unsigned), name_user, email, password,
//                  role (FK→roles.id_role), sede_user (FK→warehouses.id_warehouse), status
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const S = () => pool.mainDb;

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Nota: la BD al2 guarda la contraseña en el campo `password` (no password_hash)
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT
         u.id_user, u.name_user, u.email, u.password,
         u.role AS id_role, r.name_role, r.desc_role,
         u.sede_user AS id_warehouse,
         w.name AS nombre_warehouse,
         u.status, u.cajera
       FROM ${S()}.users u
       LEFT JOIN roles      r ON u.role       = r.id_role
       LEFT JOIN ${S()}.warehouses w ON u.sede_user  = w.id_warehouse
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];

    if (!usuario.status) {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    // La BD al2 puede tener contraseñas en texto plano o con bcrypt.
    // Intentamos bcrypt primero; si falla, comparamos directo.
    let coincide = false;
    if (usuario.password && usuario.password.startsWith('$2')) {
      coincide = await bcrypt.compare(password, usuario.password);
    } else {
      coincide = (password === usuario.password);
    }

    if (!coincide) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Payload del token — usamos id_user (int) como identificador
    const payload = {
      id_usuario:       usuario.id_user,          // int unsigned
      email:            usuario.email,
      nombre:           usuario.name_user,
      id_role:          usuario.id_role,           // int
      name_role:        usuario.name_role,
      id_warehouse:     usuario.id_warehouse,      // varchar(36) — sede del usuario
      nombre_warehouse: usuario.nombre_warehouse,
      cajera:           usuario.cajera
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    return res.json({
      token,
      usuario: {
        id_usuario:       usuario.id_user,
        nombre:           usuario.name_user,
        email:            usuario.email,
        id_role:          usuario.id_role,
        name_role:        usuario.name_role,
        id_warehouse:     usuario.id_warehouse,
        nombre_warehouse: usuario.nombre_warehouse
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado actualizado desde BD
 */
const me = async (req, res) => {
  if (process.env.AUTH_MODE === 'host-jwt') {
    const usuario = req.usuario;
    return res.json({
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        id_role: usuario.id_role,
        name_role: usuario.name_role,
        id_warehouse: usuario.id_warehouse,
        nombre_warehouse: usuario.nombre_warehouse
      }
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
         u.id_user, u.name_user, u.email,
         u.role AS id_role, r.name_role,
         u.sede_user AS id_warehouse,
         w.name AS nombre_warehouse
       FROM ${S()}.users u
       LEFT JOIN roles      r ON u.role      = r.id_role
       LEFT JOIN ${S()}.warehouses w ON u.sede_user = w.id_warehouse
       WHERE u.id_user = ?`,
      [req.usuario.id_usuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = rows[0];
    return res.json({
      usuario: {
        id_usuario:       u.id_user,
        nombre:           u.name_user,
        email:            u.email,
        id_role:          u.id_role,
        name_role:        u.name_role,
        id_warehouse:     u.id_warehouse,
        nombre_warehouse: u.nombre_warehouse
      }
    });
  } catch (err) {
    console.error('Error en /me:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/auth/users
 * Lista usuarios activos para asignar responsables/tareas en el frontend
 */
const listarUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         u.id_user, u.name_user, u.email,
         u.role AS id_role, r.name_role,
         u.sede_user AS id_warehouse,
         w.name AS nombre_warehouse
       FROM ${S()}.users u
       LEFT JOIN roles      r ON u.role      = r.id_role
       LEFT JOIN ${S()}.warehouses w ON u.sede_user = w.id_warehouse
       WHERE u.status = 1
       ORDER BY u.name_user ASC`
    );
    return res.json({ usuarios: rows });
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * GET /api/auth/warehouses
 * Lista todas las sedes (warehouses) para filtros
 */
const listarWarehouses = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_warehouse, name, address FROM ${S()}.warehouses ORDER BY name'
    );
    return res.json({ warehouses: rows });
  } catch (err) {
    console.error('Error al listar warehouses:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, me, listarUsuarios, listarWarehouses };
