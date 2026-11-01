function manejarError(res, error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ mensaje: 'Ya existe un registro con ese dato unico', detalle: error.sqlMessage });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ mensaje: 'El registro relacionado no existe', detalle: error.sqlMessage });
    }
    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
        return res.status(400).json({ mensaje: 'Los datos no cumplen las reglas de la tabla', detalle: error.sqlMessage });
    }
    if (error.code === 'WARN_DATA_TRUNCATED' || error.code === 'ER_BAD_NULL_ERROR' ||
        error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || error.code === 'ER_DATA_TOO_LONG') {
        return res.status(400).json({ mensaje: 'Algun dato tiene un valor no permitido', detalle: error.sqlMessage });
    }

    return res.status(500).json({ mensaje: 'Error en el servidor' });
}

module.exports = manejarError;
