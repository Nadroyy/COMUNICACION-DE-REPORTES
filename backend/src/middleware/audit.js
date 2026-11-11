// Helper para registrar eventos de auditoría en audit_events
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Registra un cambio en la tabla audit_events.
 * @param {object} params
 * @param {string} params.entidad_tipo  — 'report' | 'task' | 'comment'
 * @param {string} params.entidad_id   — UUID de la entidad
 * @param {string} params.accion       — ej. 'cambio_estado', 'asignar_responsable'
 * @param {number} params.id_usuario   — id_user (int) del usuario que hizo el cambio
 * @param {object} params.cambios      — { campo: { antes, despues } }
 * @param {object} [conn]              — conexión opcional (para transacciones)
 */
const registrarAudit = async ({ entidad_tipo, entidad_id, accion, id_usuario, cambios }, conn) => {
  const query = `
    INSERT INTO audit_events (id_audit, entidad_tipo, entidad_id, accion, id_usuario, cambios)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const db = conn || pool;
  await db.execute(query, [
    uuidv4(),
    entidad_tipo,
    entidad_id,
    accion,
    id_usuario || null,
    JSON.stringify(cambios || {})
  ]);
};

module.exports = { registrarAudit };
