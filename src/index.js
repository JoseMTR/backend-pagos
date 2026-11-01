const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const { verificarToken } = require('./middlewares/auth');
const cuentasRoutes = require('./routes/cuentas.routes');
const custodiasRoutes = require('./routes/custodias.routes');
const pagosRoutes = require('./routes/pagos.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'API de pagos en custodia de InWork funcionando',
        rutas: ['/api/cuentas', '/api/custodias', '/api/pagos', '/api/prueba-db']
    });
});

app.get('/api/prueba-db', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ mensaje: 'Conexion a la base de datos correcta' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'No se pudo conectar a la base de datos' });
    }
});

// Desde aqui todas las rutas piden el token de la API principal (Authorization: Bearer ...)
app.use('/api/cuentas', verificarToken, cuentasRoutes);
app.use('/api/custodias', verificarToken, custodiasRoutes);
app.use('/api/pagos', verificarToken, pagosRoutes);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Si el JSON que se envia esta mal escrito
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ mensaje: 'El JSON enviado no es valido' });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error en el servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API de pagos en puerto ' + PORT));
