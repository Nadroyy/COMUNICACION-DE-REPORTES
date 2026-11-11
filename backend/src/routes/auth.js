const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const { login, me, listarUsuarios, listarWarehouses } = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');
const validate = require('../middleware/validate');

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Contraseña requerida')
  ],
  validate,
  login
);

// GET /api/auth/me — usuario autenticado
router.get('/me', verificarToken, me);

// GET /api/auth/users — lista de usuarios activos (para asignar responsables/tareas)
router.get('/users', verificarToken, listarUsuarios);

// GET /api/auth/warehouses — lista de sedes para filtros
router.get('/warehouses', verificarToken, listarWarehouses);

module.exports = router;
