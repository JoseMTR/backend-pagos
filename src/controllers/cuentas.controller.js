const pool = require('../config/db');
const manejarError = require('../utils/errores');
const { esStaff, esDueno } = require('../middlewares/auth');

async function buscarCuenta(id) {
    const [filas] = await pool.query('SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = TRUE', [id]);
    return filas[0];
}

const obtenerCuentas = async (req, res) => {
    try {
        let sql = 'SELECT * FROM cuentas_pago WHERE estado = TRUE';
        const valores = [];

        // El staff ve todas (y puede filtrar por ?correo=). Un usuario solo ve las suyas.
        const correo = esStaff(req) ? req.query.correo : req.usuario.correo;
        if (correo) {
            sql += ' AND correo_usuario = ?';
            valores.push(correo);
        }

        const [filas] = await pool.query(sql + ' ORDER BY id_cuenta', valores);
        res.json(filas);
    } catch (error) {
        manejarError(res, error);
    }
};

const obtenerCuenta = async (req, res) => {
    try {
        const cuenta = await buscarCuenta(req.params.id);
        if (!cuenta) {
            return res.status(404).json({ mensaje: 'Cuenta no encontrada' });
        }
        if (!esDueno(req, cuenta.correo_usuario)) {
            return res.status(403).json({ mensaje: 'Esta cuenta no es tuya' });
        }
        res.json(cuenta);
    } catch (error) {
        manejarError(res, error);
    }
};

const crearCuenta = async (req, res) => {
    try {
        const { titular, tipo_cuenta, numero_cuenta } = req.body;
        // Un trabajador solo puede registrar cuentas a su propio correo
        const correo_usuario = esStaff(req) ? req.body.correo_usuario : req.usuario.correo;

        if (!correo_usuario || !titular || !tipo_cuenta || !numero_cuenta) {
            return res.status(400).json({
                mensaje: 'Faltan datos: correo_usuario, titular, tipo_cuenta y numero_cuenta son obligatorios'
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO cuentas_pago (correo_usuario, titular, tipo_cuenta, numero_cuenta)
             VALUES (?, ?, ?, ?)`,
            [correo_usuario, titular, tipo_cuenta, numero_cuenta]
        );

        res.status(201).json({ mensaje: 'Cuenta registrada correctamente', id_cuenta: resultado.insertId });
    } catch (error) {
        manejarError(res, error);
    }
};

const actualizarCuenta = async (req, res) => {
    try {
        const cuenta = await buscarCuenta(req.params.id);
        if (!cuenta) {
            return res.status(404).json({ mensaje: 'Cuenta no encontrada' });
        }
        if (!esDueno(req, cuenta.correo_usuario)) {
            return res.status(403).json({ mensaje: 'Esta cuenta no es tuya' });
        }

        const { titular, tipo_cuenta, numero_cuenta } = req.body;
        // Solo el staff puede pasar la cuenta a otro correo
        const correo_usuario = esStaff(req) ? req.body.correo_usuario : null;

        const [resultado] = await pool.query(
            `UPDATE cuentas_pago
             SET correo_usuario = COALESCE(?, correo_usuario),
                 titular        = COALESCE(?, titular),
                 tipo_cuenta    = COALESCE(?, tipo_cuenta),
                 numero_cuenta  = COALESCE(?, numero_cuenta)
             WHERE id_cuenta = ? AND estado = TRUE`,
            [correo_usuario, titular, tipo_cuenta, numero_cuenta, req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Cuenta no encontrada' });
        }
        res.json({ mensaje: 'Cuenta actualizada correctamente' });
    } catch (error) {
        manejarError(res, error);
    }
};

const eliminarCuenta = async (req, res) => {
    try {
        const cuenta = await buscarCuenta(req.params.id);
        if (!cuenta) {
            return res.status(404).json({ mensaje: 'Cuenta no encontrada' });
        }
        if (!esDueno(req, cuenta.correo_usuario)) {
            return res.status(403).json({ mensaje: 'Esta cuenta no es tuya' });
        }

        // No se puede borrar una cuenta que tiene dinero pendiente por recibir
        const [pendientes] = await pool.query(
            `SELECT COUNT(*) AS total FROM custodias
             WHERE id_cuenta = ? AND estado_custodia IN ('pendiente_pago', 'asegurado', 'en_disputa')`,
            [req.params.id]
        );
        if (pendientes[0].total > 0) {
            return res.status(400).json({ mensaje: 'La cuenta tiene pagos pendientes, no se puede eliminar' });
        }

        const [resultado] = await pool.query(
            'UPDATE cuentas_pago SET estado = FALSE WHERE id_cuenta = ? AND estado = TRUE',
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Cuenta no encontrada' });
        }
        res.json({ mensaje: 'Cuenta eliminada correctamente' });
    } catch (error) {
        manejarError(res, error);
    }
};

module.exports = {
    obtenerCuentas,
    obtenerCuenta,
    crearCuenta,
    actualizarCuenta,
    eliminarCuenta
};
