const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationsController');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);
router.get('/count', ctrl.contarNoLeidas);
router.get('/', ctrl.listar);
router.patch('/read-all', ctrl.marcarTodasLeidas);
router.patch('/:id/read', ctrl.marcarLeida);

module.exports = router;