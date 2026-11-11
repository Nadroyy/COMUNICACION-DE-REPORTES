const express = require('express');
const router = express.Router();
const { listarAsignables } = require('../controllers/usersController');

router.get('/assignable', listarAsignables);

module.exports = router;