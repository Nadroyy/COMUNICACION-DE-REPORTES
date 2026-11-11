const DEFAULT_TASKVIEW_TIMEOUT = 20000;

const normalizeBaseUrl = (value) => {
  if (!value) return '';
  return String(value).trim().replace(/\/+$/, '');
};

const readTaskviewConfig = () => {
  const baseUrl = normalizeBaseUrl(process.env.TASKVIEW_API_URL || '');
  const token = process.env.TASKVIEW_API_TOKEN || '';

  if (!baseUrl || !token) {
    throw new Error('Falta TASKVIEW_API_URL o TASKVIEW_API_TOKEN en el entorno');
  }

  return { baseUrl, token };
};

const mapPriorityToTaskview = (prioridad) => {
  const value = String(prioridad || '').toLowerCase();
  const map = {
    baja: 1,
    media: 2,
    alta: 3,
    critica: 3,
    low: 1,
    normal: 2,
    high: 3,
    urgent: 3
  };

  return map[value] || 2;
};

const requestToTaskview = async (endpoint, options = {}) => {
  const { baseUrl, token } = readTaskviewConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TASKVIEW_TIMEOUT);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = { raw: text };
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `TaskView respondió ${response.status}`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
};

const ensureProject = async ({ reportId, title, description }) => {
  const projectName = `Reporte ${reportId}`;
  const payload = {
    name: projectName,
    description: description || `Proyecto generado automáticamente desde el sistema principal para el reporte ${reportId}`,
    color: '#4A90D9'
  };

  const response = await requestToTaskview('/module/goals', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return response.response || response;
};

const createTaskFromReport = async (reporte) => {
  if (!reporte || !reporte.id_report) {
    throw new Error('Falta el reporte para sincronizar con TaskView');
  }

  const project = await ensureProject({
    reportId: reporte.id_report,
    title: reporte.titulo,
    description: reporte.descripcion || 'Reporte sincronizado desde el sistema principal'
  });

  const body = {
    goalId: project.id,
    description: reporte.titulo || `Reporte ${reporte.id_report}`,
    priorityId: mapPriorityToTaskview(reporte.prioridad),
    note: reporte.descripcion || `Sincronizado desde el sistema principal (${reporte.id_report})`,
    endDate: reporte.fecha_limite || null,
    startDate: reporte.fecha_hecho || null,
    sourceUrl: `${process.env.APP_URL || 'http://localhost:3000'}/reports/${reporte.id_report}`
  };

  const response = await requestToTaskview('/module/tasks', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const task = response.response || response;

  return {
    project,
    task,
    taskviewProjectId: project.id,
    taskviewTaskId: task.id,
    taskviewUrl: `${normalizeBaseUrl(process.env.TASKVIEW_API_URL || '')}/app/projects/${project.id}/tasks/${task.id}`
  };
};

module.exports = {
  createTaskFromReport,
  requestToTaskview,
  readTaskviewConfig,
  mapPriorityToTaskview
};
