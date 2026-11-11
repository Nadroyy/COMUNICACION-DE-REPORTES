const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl     = require('../controllers/reportsController');
const comments = require('../controllers/commentsController');
const tasks    = require('../controllers/tasksController');
const attachments = require('../controllers/attachmentsController');
const { verificarToken, requireRoles } = require('../middleware/auth');
const { verificarAccesoReporte } = require('../middleware/reportAccess');
const { uploadImages } = require('../middleware/imageUpload');
const validate = require('../middleware/validate');

router.use(verificarToken);

// Stats para dashboard — debe ir ANTES de /:id
router.get('/stats', ctrl.stats);

// CRUD reportes
router.get('/', ctrl.listar);

router.post('/',
  [
    body('id_type').notEmpty().withMessage('El tipo de reporte es requerido'),
    body('titulo').notEmpty().withMessage('El título es requerido')
                  .isLength({ max: 200 }).withMessage('Máximo 200 caracteres')
  ],
  validate,
  ctrl.crear
);

router.get('/:id',        verificarAccesoReporte, ctrl.detalle);
router.patch('/:id',      verificarAccesoReporte, ctrl.actualizar);
router.delete('/:id/permanent', requireRoles(1), ctrl.eliminarDefinitivamente);
router.delete('/:id',     verificarAccesoReporte, ctrl.eliminar);
router.get('/:id/history',verificarAccesoReporte, ctrl.historial);

// Imágenes privadas del reporte
router.post('/:id/attachments', verificarAccesoReporte, uploadImages, attachments.subir);
router.get('/:id/attachments/:attachmentId/file', verificarAccesoReporte, attachments.descargar);

// Flujo de gestión
router.post('/:id/review',   verificarAccesoReporte, ctrl.iniciarRevision);
router.post('/:id/decision', verificarAccesoReporte, ctrl.decidir);
router.post('/:id/transfer', verificarAccesoReporte, ctrl.transferir);

// Comentarios
router.get('/:id/comments',  verificarAccesoReporte, comments.listar);
router.post('/:id/comments', verificarAccesoReporte, comments.crear);

// Tareas
router.get('/:id/tasks',  verificarAccesoReporte, tasks.listar);
router.post('/:id/tasks', verificarAccesoReporte, tasks.crear);

module.exports = router;
