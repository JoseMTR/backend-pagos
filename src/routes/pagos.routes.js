const express = require('express');
const router = express.Router();
const pagos = require('../controllers/pagos.controller');
const { soloStaff, soloVerTodo } = require('../middlewares/auth');

// Los movimientos de dinero los ven el administrador, el moderador y el analista.
// Solo el administrador y el moderador los pueden modificar.
router.get('/', soloVerTodo, pagos.obtenerPagos);
router.get('/:id', soloVerTodo, pagos.obtenerPago);
router.post('/', soloStaff, pagos.crearPago);
router.put('/:id', soloStaff, pagos.actualizarPago);
router.delete('/:id', soloStaff, pagos.eliminarPago);

module.exports = router;
