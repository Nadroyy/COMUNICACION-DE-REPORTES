const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { verificarAccesoReporte } = require('../middleware/reportAccess');
const { createTaskFromReport } = require('../services/taskview');

router.use(verificarToken);

router.post('/sync-report/:id', verificarAccesoReporte, async (req, res) => {
  if (req.reporte.status === 'borrador') {
    return res.status(409).json({ error: 'Publica el reporte antes de sincronizarlo con TaskView' });
  }

  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT r.*, rt.slug AS tipo_slug, rt.nombre AS tipo_nombre
       FROM reports r
       JOIN report_types rt ON rt.id_type = r.id_type
       WHERE r.id_report = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const reporte = rows[0];

    let payload;
    try {
      payload = await createTaskFromReport(reporte);
    } catch (err) {
      await pool.execute(
        `INSERT INTO report_taskview_links (id_report, sync_status, last_error, updated_at)
         VALUES (?, 'failed', ?, NOW())
         ON DUPLICATE KEY UPDATE sync_status = 'failed', last_error = VALUES(last_error), updated_at = NOW()`,
        [id, err.message]
      );

      return res.status(502).json({
        error: 'No se pudo sincronizar con TaskView',
        detalle: err.message
      });
    }

    const { project, task, taskviewProjectId, taskviewTaskId, taskviewUrl } = payload;

    await pool.execute(
      `INSERT INTO report_taskview_links
        (id_report, taskview_project_id, taskview_task_id, taskview_project_name, taskview_task_title, taskview_url, sync_status, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'created', NULL, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         taskview_project_id = VALUES(taskview_project_id),
         taskview_task_id = VALUES(taskview_task_id),
         taskview_project_name = VALUES(taskview_project_name),
         taskview_task_title = VALUES(taskview_task_title),
         taskview_url = VALUES(taskview_url),
         sync_status = 'created',
         last_error = NULL,
         updated_at = NOW()`,
      [
        id,
        taskviewProjectId,
        taskviewTaskId,
        project?.name || null,
        task?.description || null,
        taskviewUrl || null
      ]
    );

    return res.status(200).json({
      ok: true,
      mensaje: 'Reporte sincronizado con TaskView',
      reportId: id,
      projectId: taskviewProjectId,
      taskId: taskviewTaskId,
      taskviewUrl,
      taskviewProject: project,
      taskviewTask: task
    });
  } catch (err) {
    console.error('Error al sincronizar reporte con TaskView:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/status/:id', verificarAccesoReporte, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM report_taskview_links WHERE id_report = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.json({ ok: true, sincronizado: false });
    }

    return res.json({ ok: true, sincronizado: true, data: rows[0] });
  } catch (err) {
    console.error('Error consultando estado de TaskView:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
