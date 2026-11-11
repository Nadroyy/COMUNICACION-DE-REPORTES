const express = require('express');
const router = express.Router();
const { listar, detalle } = require('../controllers/reportTypesController');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/',      listar);
router.get('/:slug', detalle);

module.exports = router;
