// Controlador de tareas — usa users de al2 (id_user int unsigned, name_user)
const pool = require('../config/db');
const S = () => pool.mainDb; // base del sistema (users, warehouses)
const { v4: uuidv4 } = require('uuid');
const { registrarAudit } = require('../middleware/audit');

/**
 * GET /api/reports/:id/tasks
 */
const listar = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT
         t.id_task, t.titulo, t.descripcion, t.status,
         t.fecha_limite, t.created_at, t.updated_at,
         u.name_user AS asignado_nombre, u.email AS asignado_email
       FROM tasks t
       LEFT JOIN ${S()}.users u ON t.id_asignado = u.id_user
       WHERE t.id_report = ?
       ORDER BY t.created_at ASC`,
      [id]
    );
    return res.json({ tareas: rows });
  } catch (err) {
    console.error('Error al listar tareas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * POST /api/reports/:id/tasks
 * Body: { titulo, descripcion, id_asignado, fecha_limite }
 */
const crear = async (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, id_asignado, fecha_limite } = req.body;

  if (!titulo || titulo.trim() === '') {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  try {
    const [repRows] = await pool.execute(
      'SELECT id_report FROM reports WHERE id_report = ?', [id]
    );
    if (repRows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const id_task = uuidv4();
    await pool.execute(
      `INSERT INTO tasks (id_task, id_report, titulo, descripcion, id_asignado, fecha_limite)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_task, id,
        titulo.trim(),
        descripcion  || null,
        id_asignado  ? parseInt(id_asignado) : null,
        fecha_limite || null
      ]
    );

    await registrarAudit({
      entidad_tipo: 'task',
      entidad_id:   id_task,
      accion:       'crear_tarea',
      id_usuario:   req.usuario.id_usuario,
      cambios:      { id_report: { antes: null, despues: id } }
    });

    return res.status(201).json({ mensaje: 'Tarea creada', id_task });
  } catch (err) {
    console.error('Error al crear tarea:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * PATCH /api/tasks/:id
 * Body: { status, id_asignado, titulo, descripcion, fecha_limite }
 */
const actualizar = async (req, res) => {
  const { id } = req.params;
  const { status, id_asignado, titulo, descripcion, fecha_limite } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE id_task = ?', [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    const tarea  = rows[0];
    const sets   = [];
    const params = [];
    const cambios = {};

    const agregar = (campo, valorNuevo, valorActual) => {
      if (valorNuevo !== undefined && valorNuevo !== valorActual) {
        sets.push(`${campo} = ?`);
        params.push(valorNuevo);
        cambios[campo] = { antes: valorActual, despues: valorNuevo };
      }
    };

    agregar('status',      status,      tarea.status);
    agregar('id_asignado', id_asignado ? parseInt(id_asignado) : null, tarea.id_asignado);
    agregar('titulo',      titulo,      tarea.titulo);
    agregar('descripcion', descripcion, tarea.descripcion);
    agregar('fecha_limite',fecha_limite,tarea.fecha_limite);

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No se enviaron cambios' });
    }

    params.push(id);
    await pool.execute(
      `UPDATE tasks SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id_task = ?`,
      params
    );

    await registrarAudit({
      entidad_tipo: 'task',
      entidad_id:   id,
      accion:       'actualizar_tarea',
      id_usuario:   req.usuario.id_usuario,
      cambios
    });

    return res.json({ mensaje: 'Tarea actualizada', cambios });
  } catch (err) {
    console.error('Error al actualizar tarea:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listar, crear, actualizar };
