const pool = require('../config/db');
const manejarError = require('../utils/errores');
const generarCodigo = require('../utils/codigos');
const { esDueno } = require('../middlewares/auth');

const SQL_CUSTODIA = `
    SELECT c.*, cp.correo_usuario AS correo_trabajador, cp.titular AS nombre_trabajador
    FROM custodias c
    INNER JOIN cuentas_pago cp ON cp.id_cuenta = c.id_cuenta
`;

const AVISOS = {
    pendiente_pago: 'El cliente todavia no ha pagado. No empieces el trabajo aun.',
    asegurado: 'El pago esta asegurado en InWork. Ya puedes empezar el trabajo con tranquilidad.',
    en_disputa: 'Hay una disputa abierta. InWork esta revisando el caso.',
    liberado: 'El trabajo fue confirmado y el dinero ya fue enviado a tu cuenta.',
    reembolsado: 'El pago fue devuelto al cliente.',
    cancelado: 'Esta contratacion fue cancelada.'
};

// Lo mismo, pero explicado para el cliente
const AVISOS_CLIENTE = {
    pendiente_pago: 'Debes realizar el pago para que el trabajador pueda empezar.',
    asegurado: 'Tu pago esta guardado en InWork. Confirma cuando el trabajo termine.',
    en_disputa: 'Hay una disputa abierta. InWork esta revisando el caso.',
    liberado: 'Confirmaste el trabajo y el pago fue enviado al trabajador.',
    reembolsado: 'Te devolvimos el dinero.',
    cancelado: 'Esta contratacion fue cancelada.'
};

// Para VER una custodia: el cliente, el trabajador, el staff o el analista
function participa(req, custodia) {
    return esDueno(req, custodia.correo_cliente, true) || esDueno(req, custodia.correo_trabajador, true);
}

async function buscarCustodia(conexion, id, bloquear = false) {
    let sql = SQL_CUSTODIA + ' WHERE c.id_custodia = ? AND c.estado = TRUE';
    if (bloquear) {
        sql += ' FOR UPDATE';
    }
    const [filas] = await conexion.query(sql, [id]);
    return filas[0];
}

async function liberarPago(conexion, custodia) {
    const comision = Math.round(custodia.monto * custodia.porcentaje_comision) / 100;
    const pagoTrabajador = Math.round((custodia.monto - comision) * 100) / 100;

    await conexion.query(
        `INSERT INTO pagos (referencia, id_custodia, tipo_pago, monto, descripcion)
         VALUES (?, ?, 'liberacion', ?, ?)`,
        [generarCodigo('PAG'), custodia.id_custodia, pagoTrabajador,
         `Pago enviado a ${custodia.nombre_trabajador}`]
    );

    if (comision > 0) {
        await conexion.query(
            `INSERT INTO pagos (referencia, id_custodia, tipo_pago, monto, descripcion)
             VALUES (?, ?, 'comision', ?, ?)`,
            [generarCodigo('PAG'), custodia.id_custodia, comision,
             `Comision de InWork (${custodia.porcentaje_comision}%)`]
        );
    }

    await conexion.query(
        "UPDATE custodias SET estado_custodia = 'liberado' WHERE id_custodia = ?",
        [custodia.id_custodia]
    );

    return { pago_trabajador: pagoTrabajador, comision_inwork: comision };
}


const obtenerCustodias = async (req, res) => {
    try {
        let sql = SQL_CUSTODIA + ' WHERE c.estado = TRUE';
        const valores = [];

        if (req.query.estado_custodia) {
            sql += ' AND c.estado_custodia = ?';
            valores.push(req.query.estado_custodia);
        }

        const [filas] = await pool.query(sql + ' ORDER BY c.id_custodia DESC', valores);
        res.json(filas);
    } catch (error) {
        manejarError(res, error);
    }
};

const obtenerCustodia = async (req, res) => {
    try {
        const custodia = await buscarCustodia(pool, req.params.id);
        if (!custodia) {
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (!participa(req, custodia)) {
            return res.status(403).json({ mensaje: 'Esta custodia no es tuya' });
        }
        res.json(custodia);
    } catch (error) {
        manejarError(res, error);
    }
};

const crearCustodia = async (req, res) => {
    try {
        const { id_contratacion, correo_cliente, correo_trabajador, id_cuenta, monto, porcentaje_comision } = req.body;

        if (!id_contratacion || !correo_cliente || !monto || (!correo_trabajador && !id_cuenta)) {
            return res.status(400).json({
                mensaje: 'Faltan datos: id_contratacion, correo_cliente, monto y (correo_trabajador o id_cuenta) son obligatorios'
            });
        }
        if (monto <= 0) {
            return res.status(400).json({ mensaje: 'El monto debe ser mayor a 0' });
        }

        let cuentas;
        if (id_cuenta) {
            [cuentas] = await pool.query('SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = TRUE', [id_cuenta]);
        } else {
            [cuentas] = await pool.query(
                'SELECT * FROM cuentas_pago WHERE correo_usuario = ? AND estado = TRUE ORDER BY id_cuenta DESC LIMIT 1',
                [correo_trabajador]
            );
        }
        if (cuentas.length === 0) {
            return res.status(400).json({
                mensaje: 'El trabajador no tiene una cuenta de pago registrada. Debe registrarla en /api/cuentas'
            });
        }

        if (cuentas[0].correo_usuario === correo_cliente) {
            return res.status(400).json({ mensaje: 'El cliente y el trabajador no pueden ser la misma persona' });
        }

        const codigo = generarCodigo('CUS');
        const [resultado] = await pool.query(
            `INSERT INTO custodias (codigo, id_contratacion, correo_cliente, id_cuenta, monto, porcentaje_comision)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [codigo, id_contratacion, correo_cliente, cuentas[0].id_cuenta, monto, porcentaje_comision ?? 10]
        );

        res.status(201).json({
            mensaje: 'Custodia creada. El cliente debe realizar el pago.',
            id_custodia: resultado.insertId,
            codigo,
            monto,
            estado_custodia: 'pendiente_pago'
        });
    } catch (error) {
        manejarError(res, error);
    }
};


const obtenerPorContratacion = async (req, res) => {
    try {
        const [filas] = await pool.query(
            SQL_CUSTODIA + ' WHERE c.id_contratacion = ? AND c.estado = TRUE',
            [req.params.id]
        );
        if (filas.length === 0) {
            return res.status(404).json({ mensaje: 'Ese contrato no tiene custodia' });
        }
        if (!participa(req, filas[0])) {
            return res.status(403).json({ mensaje: 'Esta custodia no es tuya' });
        }
        res.json(filas[0]);
    } catch (error) {
        manejarError(res, error);
    }
};

const actualizarCustodia = async (req, res) => {
    try {
        const custodia = await buscarCustodia(pool, req.params.id);
        if (!custodia) {
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (custodia.estado_custodia !== 'pendiente_pago') {
            return res.status(400).json({ mensaje: 'Solo se puede modificar una custodia que aun no ha sido pagada' });
        }

        const { monto, porcentaje_comision, id_cuenta } = req.body;
        await pool.query(
            `UPDATE custodias
             SET monto               = COALESCE(?, monto),
                 porcentaje_comision = COALESCE(?, porcentaje_comision),
                 id_cuenta           = COALESCE(?, id_cuenta)
             WHERE id_custodia = ?`,
            [monto, porcentaje_comision, id_cuenta, req.params.id]
        );

        res.json({ mensaje: 'Custodia actualizada correctamente' });
    } catch (error) {
        manejarError(res, error);
    }
};

const eliminarCustodia = async (req, res) => {
    try {
        const custodia = await buscarCustodia(pool, req.params.id);
        if (!custodia) {
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (custodia.estado_custodia !== 'pendiente_pago') {
            return res.status(400).json({ mensaje: 'No se puede eliminar: la custodia ya tiene dinero' });
        }

        await pool.query(
            "UPDATE custodias SET estado = FALSE, estado_custodia = 'cancelado' WHERE id_custodia = ?",
            [req.params.id]
        );
        res.json({ mensaje: 'Custodia eliminada correctamente' });
    } catch (error) {
        manejarError(res, error);
    }
};




const depositar = async (req, res) => {
    const conexion = await pool.getConnection();
    try {
        const { metodo_pago } = req.body;
        if (!metodo_pago) {
            return res.status(400).json({ mensaje: 'Debes indicar el metodo_pago' });
        }

        await conexion.beginTransaction();

        const custodia = await buscarCustodia(conexion, req.params.id, true);
        if (!custodia) {
            await conexion.rollback();
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (req.usuario.correo !== custodia.correo_cliente) {
            await conexion.rollback();
            return res.status(403).json({ mensaje: 'Solo el cliente de esta custodia puede pagar' });
        }
        if (custodia.estado_custodia !== 'pendiente_pago') {
            await conexion.rollback();
            return res.status(400).json({ mensaje: `No se puede pagar: la custodia esta '${custodia.estado_custodia}'` });
        }

        await conexion.query(
            `INSERT INTO pagos (referencia, id_custodia, tipo_pago, monto, metodo_pago, descripcion)
             VALUES (?, ?, 'deposito', ?, ?, 'Pago del cliente asegurado en InWork')`,
            [generarCodigo('PAG'), custodia.id_custodia, custodia.monto, metodo_pago]
        );
        await conexion.query(
            "UPDATE custodias SET estado_custodia = 'asegurado' WHERE id_custodia = ?",
            [custodia.id_custodia]
        );

        await conexion.commit();
        res.json({
            mensaje: 'Pago recibido. El dinero queda guardado en InWork hasta que el trabajo termine.',
            aviso_trabajador: `Se aviso a ${custodia.correo_trabajador}: ${AVISOS.asegurado}`
        });
    } catch (error) {
        await conexion.rollback();
        manejarError(res, error);
    } finally {
        conexion.release();
    }
};

const confirmar = async (req, res) => {
    const conexion = await pool.getConnection();
    try {
        // El correo sale del token: nadie puede confirmar a nombre de otro
        const correo = req.usuario.correo;

        await conexion.beginTransaction();

        const custodia = await buscarCustodia(conexion, req.params.id, true);
        if (!custodia) {
            await conexion.rollback();
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (custodia.estado_custodia !== 'asegurado') {
            await conexion.rollback();
            return res.status(400).json({
                mensaje: `Solo se puede confirmar cuando el pago esta asegurado (estado actual: '${custodia.estado_custodia}')`
            });
        }

        if (correo === custodia.correo_cliente) {
            custodia.confirmado_cliente = 1;
            await conexion.query('UPDATE custodias SET confirmado_cliente = TRUE WHERE id_custodia = ?', [custodia.id_custodia]);
        } else if (correo === custodia.correo_trabajador) {
            custodia.confirmado_trabajador = 1;
            await conexion.query('UPDATE custodias SET confirmado_trabajador = TRUE WHERE id_custodia = ?', [custodia.id_custodia]);
        } else {
            await conexion.rollback();
            return res.status(403).json({ mensaje: 'Ese correo no pertenece al cliente ni al trabajador de esta custodia' });
        }

        if (custodia.confirmado_cliente && custodia.confirmado_trabajador) {
            const resumen = await liberarPago(conexion, custodia);
            await conexion.commit();
            return res.json({
                mensaje: 'Ambos confirmaron. El dinero fue enviado al trabajador.',
                ...resumen
            });
        }

        await conexion.commit();
        const falta = custodia.confirmado_cliente ? 'el trabajador' : 'el cliente';
        res.json({ mensaje: `Confirmacion registrada. Falta que confirme ${falta}.` });
    } catch (error) {
        await conexion.rollback();
        manejarError(res, error);
    } finally {
        conexion.release();
    }
};

const abrirDisputa = async (req, res) => {
    try {
        const correo = req.usuario.correo; // sale del token
        const { motivo } = req.body;
        if (!motivo) {
            return res.status(400).json({ mensaje: 'Debes enviar el motivo de la disputa' });
        }

        const custodia = await buscarCustodia(pool, req.params.id);
        if (!custodia) {
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (correo !== custodia.correo_cliente && correo !== custodia.correo_trabajador) {
            return res.status(403).json({ mensaje: 'Solo el cliente o el trabajador pueden abrir una disputa' });
        }
        if (custodia.estado_custodia !== 'asegurado') {
            return res.status(400).json({ mensaje: 'Solo se puede abrir una disputa cuando el pago esta asegurado' });
        }

        await pool.query(
            "UPDATE custodias SET estado_custodia = 'en_disputa', motivo_disputa = ? WHERE id_custodia = ?",
            [motivo, custodia.id_custodia]
        );
        res.json({ mensaje: 'Disputa abierta. El dinero queda congelado hasta que InWork revise el caso.' });
    } catch (error) {
        manejarError(res, error);
    }
};


const resolverDisputa = async (req, res) => {
    const conexion = await pool.getConnection();
    try {
        const { decision } = req.body;
        if (decision !== 'liberar' && decision !== 'reembolsar') {
            return res.status(400).json({ mensaje: "La decision debe ser 'liberar' o 'reembolsar'" });
        }

        await conexion.beginTransaction();

        const custodia = await buscarCustodia(conexion, req.params.id, true);
        if (!custodia) {
            await conexion.rollback();
            return res.status(404).json({ mensaje: 'Custodia no encontrada' });
        }
        if (custodia.estado_custodia !== 'en_disputa') {
            await conexion.rollback();
            return res.status(400).json({ mensaje: 'Esta custodia no tiene una disputa abierta' });
        }

        if (decision === 'liberar') {
            const resumen = await liberarPago(conexion, custodia);
            await conexion.commit();
            return res.json({ mensaje: 'Disputa resuelta: el dinero se envio al trabajador.', ...resumen });
        }

        // Reembolso: se le devuelve todo al cliente
        await conexion.query(
            `INSERT INTO pagos (referencia, id_custodia, tipo_pago, monto, descripcion)
             VALUES (?, ?, 'reembolso', ?, ?)`,
            [generarCodigo('PAG'), custodia.id_custodia, custodia.monto, `Devolucion a ${custodia.correo_cliente}`]
        );
        await conexion.query(
            "UPDATE custodias SET estado_custodia = 'reembolsado' WHERE id_custodia = ?",
            [custodia.id_custodia]
        );
        await conexion.commit();
        res.json({ mensaje: 'Disputa resuelta: el dinero se devolvio al cliente.', monto_reembolsado: custodia.monto });
    } catch (error) {
        await conexion.rollback();
        manejarError(res, error);
    } finally {
        conexion.release();
    }
};

const custodiasDelTrabajador = async (req, res) => {
    try {
        if (!esDueno(req, req.params.correo, true)) {
            return res.status(403).json({ mensaje: 'Solo puedes ver tus propias custodias' });
        }
        const [filas] = await pool.query(
            SQL_CUSTODIA + ' WHERE cp.correo_usuario = ? AND c.estado = TRUE ORDER BY c.id_custodia DESC',
            [req.params.correo]
        );

        const resultado = filas.map((custodia) => ({
            id_custodia: custodia.id_custodia,
            codigo: custodia.codigo,
            id_contratacion: custodia.id_contratacion,
            monto: custodia.monto,
            estado_custodia: custodia.estado_custodia,
            aviso: AVISOS[custodia.estado_custodia]
        }));

        res.json(resultado);
    } catch (error) {
        manejarError(res, error);
    }
};

// El cliente ve sus custodias: cuales debe pagar y cuales le falta confirmar
const custodiasDelCliente = async (req, res) => {
    try {
        if (!esDueno(req, req.params.correo, true)) {
            return res.status(403).json({ mensaje: 'Solo puedes ver tus propias custodias' });
        }
        const [filas] = await pool.query(
            SQL_CUSTODIA + ' WHERE c.correo_cliente = ? AND c.estado = TRUE ORDER BY c.id_custodia DESC',
            [req.params.correo]
        );

        const resultado = filas.map((custodia) => ({
            id_custodia: custodia.id_custodia,
            codigo: custodia.codigo,
            id_contratacion: custodia.id_contratacion,
            nombre_trabajador: custodia.nombre_trabajador,
            monto: custodia.monto,
            estado_custodia: custodia.estado_custodia,
            confirmado_cliente: custodia.confirmado_cliente,
            aviso: AVISOS_CLIENTE[custodia.estado_custodia]
        }));

        res.json(resultado);
    } catch (error) {
        manejarError(res, error);
    }
};

module.exports = {
    obtenerCustodias,
    obtenerCustodia,
    crearCustodia,
    obtenerPorContratacion,
    actualizarCustodia,
    eliminarCustodia,
    depositar,
    confirmar,
    abrirDisputa,
    resolverDisputa,
    custodiasDelTrabajador,
    custodiasDelCliente
};
