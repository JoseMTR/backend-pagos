const express = require('express');
const router = express.Router();
const custodias = require('../controllers/custodias.controller');
const { soloStaff, soloVerTodo } = require('../middlewares/auth');

router.get('/', soloVerTodo, custodias.obtenerCustodias);
router.get('/trabajador/:correo', custodias.custodiasDelTrabajador);
router.get('/cliente/:correo', custodias.custodiasDelCliente);
router.get('/contratacion/:id', custodias.obtenerPorContratacion);
router.get('/:id', custodias.obtenerCustodia);
router.post('/', soloStaff, custodias.crearCustodia);
router.put('/:id', soloStaff, custodias.actualizarCustodia);
router.delete('/:id', soloStaff, custodias.eliminarCustodia);

router.post('/:id/depositar', custodias.depositar);
router.post('/:id/confirmar', custodias.confirmar);
router.post('/:id/disputa', custodias.abrirDisputa);
router.post('/:id/resolver', soloStaff, custodias.resolverDisputa);

module.exports = router;
