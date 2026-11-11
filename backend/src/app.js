// Punto de entrada del servidor Express
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { configurarRealtime } = require('./services/realtime');

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const server = http.createServer(app);
configurarRealtime(server, corsOrigins);

// ── Middlewares globales ─────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || corsOrigins.includes(origin)),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/report-types', require('./routes/reportTypes'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/integration',  require('./routes/integration'));
app.use('/api/taskview',     require('./routes/taskview'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Manejo de rutas no encontradas ───────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Manejo global de errores ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Iniciar servidor ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
