const express = require('express');
const router = express.Router();
const { actualizar } = require('../controllers/tasksController');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// PATCH /api/tasks/:id
router.patch('/:id', actualizar);

module.exports = router;
