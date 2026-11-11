const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const pool = require('../config/db');
const { buscarUsuarioActivo, fetchUsuariosSistemaPrincipal } = require('./mainSystemUsers');

let io;

const validarTokenHost = async token => {
  const secret = process.env.HOST_JWT_SECRET;
  if (!secret) throw new Error('Autenticación del sistema principal no configurada');

  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Token inválido');
  }

  const idUsuario = Number(decoded.id);
  const email = typeof decoded.email === 'string' ? decoded.email.trim() : '';
  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0 || !email || !Number.isInteger(decoded.exp)) {
    throw new Error('Token inválido');
  }

  const usuarios = await fetchUsuariosSistemaPrincipal(`Bearer ${token}`);
  const usuario = buscarUsuarioActivo(usuarios, idUsuario, email);
  if (!usuario) throw new Error('Usuario activo no encontrado');
  return { usuario, exp: decoded.exp };
};

const autenticarSocket = async socket => {
  const { token, email } = socket.handshake.auth || {};

  if (process.env.AUTH_MODE === 'host-jwt') {
    if (typeof token !== 'string' || !token) throw new Error('Sesión del sistema requerida');
    return validarTokenHost(token);
  }

  if (process.env.AUTH_MODE === 'host-email') {
    if (typeof email !== 'string' || !email.trim()) throw new Error('Sesión del sistema requerida');
    const [rows] = await pool.execute(
      `SELECT u.id_user AS id_usuario, u.email, u.name_user AS nombre,
              u.role AS id_role, r.name_role,
              u.sede_user AS id_warehouse, w.name AS nombre_warehouse,
              u.cajera
       FROM ${pool.mainDb}.users u
       LEFT JOIN ${pool.mainDb}.roles r ON r.id_role = u.role
       LEFT JOIN ${pool.mainDb}.warehouses w ON w.id_warehouse = u.sede_user
       WHERE u.email = ? AND u.status = 1
       LIMIT 1`,
      [email.trim()]
    );
    if (rows.length === 0) throw new Error('Usuario activo no encontrado');
    return { usuario: rows[0], exp: null };
  }

  if (typeof token !== 'string' || !token) throw new Error('Token requerido');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return { usuario: decoded, exp: decoded.exp };
};

const configurarRealtime = (server, corsOrigins) => {
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: corsOrigins,
      credentials: true
    },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      callback(null, !origin || corsOrigins.includes(origin));
    }
  });

  io.use(async (socket, next) => {
    try {
      const { usuario, exp } = await autenticarSocket(socket);
      const idUsuario = Number(usuario.id_usuario);
      if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
        throw new Error('Usuario inválido');
      }
      socket.data.idUsuario = idUsuario;
      if (exp) socket.data.exp = exp;
      return next();
    } catch (err) {
      console.warn('Conexión WebSocket rechazada:', err.message);
      return next(new Error('No autorizado'));
    }
  });

  io.on('connection', socket => {
    socket.join(`user:${socket.data.idUsuario}`);
    if (socket.data.exp) {
      const remaining = socket.data.exp * 1000 - Date.now();
      const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(remaining, 0));
      expiryTimer.unref?.();
      socket.on('disconnect', () => clearTimeout(expiryTimer));
    }
  });

  return io;
};

const emitirNotificacion = notificacion => {
  if (!io) return;
  io.to(`user:${notificacion.id_usuario}`).emit('notifications:new', {
    id_notif: notificacion.id_notif,
    id_report: notificacion.id_report,
    tipo: notificacion.tipo,
    mensaje: notificacion.mensaje
  });
};

const emitirNotificaciones = notificaciones => {
  for (const notificacion of notificaciones) emitirNotificacion(notificacion);
};

module.exports = { configurarRealtime, emitirNotificacion, emitirNotificaciones };
