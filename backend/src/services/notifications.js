const { v4: uuidv4 } = require('uuid');
const { emitirNotificaciones } = require('./realtime');
const notificacionesPendientes = new WeakMap();

const crearNotificaciones = async (db, { userIds, reportId, tipo, mensaje }) => {
  const destinatarios = [...new Set(userIds.map(Number))]
    .filter(id => Number.isSafeInteger(id) && id > 0);
  const enTransaccion = typeof db.commit === 'function' && typeof db.rollback === 'function';
  const creadas = [];

  for (const idUsuario of destinatarios) {
    const notificacion = {
      id_notif: uuidv4(),
      id_usuario: idUsuario,
      id_report: reportId,
      tipo,
      mensaje
    };
    await db.execute(
      `INSERT INTO notifications (id_notif, id_usuario, id_report, tipo, mensaje)
       VALUES (?, ?, ?, ?, ?)`,
      [notificacion.id_notif, idUsuario, reportId, tipo, mensaje]
    );
    creadas.push(notificacion);
  }

  if (enTransaccion && creadas.length > 0) {
    notificacionesPendientes.set(db, [
      ...(notificacionesPendientes.get(db) || []),
      ...creadas
    ]);
  } else {
    emitirNotificaciones(creadas);
  }
};

const publicarNotificacionesPendientes = db => {
  const pendientes = notificacionesPendientes.get(db) || [];
  notificacionesPendientes.delete(db);
  emitirNotificaciones(pendientes);
};

const descartarNotificacionesPendientes = db => {
  notificacionesPendientes.delete(db);
};

module.exports = {
  crearNotificaciones,
  publicarNotificacionesPendientes,
  descartarNotificacionesPendientes
};
