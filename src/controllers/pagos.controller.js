const pool = require('../config/db');
const manejarError = require('../utils/errores');
const generarCodigo = require('../utils/codigos');

// Cada pago trae tambien el codigo de su custodia y el contrato, para que el frontend
// muestre "CUS-..." en vez del id_custodia
const SQL_PAGO = `
    SELECT p.*, c.codigo AS codigo_custodia, c.id_contratacion, c.correo_cliente
    FROM pagos p
    INNER JOIN custodias c ON c.id_custodia = p.id_custodia
`;

const obtenerPagos = async (req, res) => {
    try {
        let sql = SQL_PAGO + ' WHERE p.estado = TRUE';
        const valores = [];

        if (req.query.id_custodia) {
            sql += ' AND p.id_custodia = ?';
            valores.push(req.query.id_custodia);
        }

        const [filas] = await pool.query(sql + ' ORDER BY p.id_pago DESC', valores);
        res.json(filas);
    } catch (error) {
        manejarError(res, error);
    }
};

const obtenerPago = async (req, res) => {
    try {
        const [filas] = await pool.query(
            SQL_PAGO + ' WHERE p.id_pago = ? AND p.estado = TRUE',
            [req.params.id]
        );

        if (filas.length === 0) {
            return res.status(404).json({ mensaje: 'Pago no encontrado' });
        }
        res.json(filas[0]);
    } catch (error) {
        manejarError(res, error);
    }
};

const crearPago = async (req, res) => {
    try {
        const { id_custodia, tipo_pago, monto, metodo_pago, descripcion } = req.body;

        if (!id_custodia || !tipo_pago || !monto) {
            return res.status(400).json({
                mensaje: 'Faltan datos: id_custodia, tipo_pago y monto son obligatorios'
            });
        }

        const referencia = generarCodigo('PAG');
        const [resultado] = await pool.query(
            `INSERT INTO pagos (referencia, id_custodia, tipo_pago, monto, metodo_pago, descripcion)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [referencia, id_custodia, tipo_pago, monto, metodo_pago, descripcion]
        );

        res.status(201).json({
            mensaje: 'Pago registrado correctamente',
            id_pago: resultado.insertId,
            referencia
        });
    } catch (error) {
        manejarError(res, error);
    }
};

const actualizarPago = async (req, res) => {
    try {
        const { metodo_pago, descripcion } = req.body;

        const [resultado] = await pool.query(
            `UPDATE pagos
             SET metodo_pago = COALESCE(?, metodo_pago),
                 descripcion = COALESCE(?, descripcion)
             WHERE id_pago = ? AND estado = TRUE`,
            [metodo_pago, descripcion, req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Pago no encontrado' });
        }
        res.json({ mensaje: 'Pago actualizado correctamente' });
    } catch (error) {
        manejarError(res, error);
    }
};

const eliminarPago = async (req, res) => {
    try {
        const [resultado] = await pool.query(
            'UPDATE pagos SET estado = FALSE WHERE id_pago = ? AND estado = TRUE',
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Pago no encontrado' });
        }
        res.json({ mensaje: 'Pago eliminado correctamente' });
    } catch (error) {
        manejarError(res, error);
    }
};

module.exports = {
    obtenerPagos,
    obtenerPago,
    crearPago,
    actualizarPago,
    eliminarPago
};
