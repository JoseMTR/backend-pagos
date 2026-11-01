const express = require('express');
const router = express.Router();
const cuentas = require('../controllers/cuentas.controller');

router.get('/', cuentas.obtenerCuentas);
router.get('/:id', cuentas.obtenerCuenta);
router.post('/', cuentas.crearCuenta);
router.put('/:id', cuentas.actualizarCuenta);
router.delete('/:id', cuentas.eliminarCuenta);

module.exports = router;
