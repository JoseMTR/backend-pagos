const crypto = require('crypto');

// Protege la API de pagos con el MISMO token (JWT) que entrega la API principal (FastAPI)
// cuando el usuario inicia sesion. Las dos APIs comparten la SECRET_KEY, asi que aqui
// se puede comprobar que el token es real sin preguntarle nada a la otra API.
//
// Un JWT tiene 3 partes separadas por puntos:  cabecera.datos.firma
// La firma es un HMAC-SHA256 de "cabecera.datos" hecho con la SECRET_KEY.

function verificarToken(req, res, next) {
    const secreto = process.env.SECRET_KEY;
    if (!secreto) {
        return res.status(500).json({ mensaje: 'Falta la SECRET_KEY en el archivo .env' });
    }

    const encabezado = req.headers.authorization || '';
    if (!encabezado.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'Debes iniciar sesion: falta el token' });
    }

    const partes = encabezado.slice(7).split('.');
    if (partes.length !== 3) {
        return res.status(401).json({ mensaje: 'Token invalido' });
    }
    const [cabecera, datos, firma] = partes;

    // 1. Se calcula la firma con nuestra SECRET_KEY y se compara con la que trae el token
    const firmaCorrecta = crypto
        .createHmac('sha256', secreto)
        .update(`${cabecera}.${datos}`)
        .digest('base64url');

    const a = Buffer.from(firma);
    const b = Buffer.from(firmaCorrecta);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ mensaje: 'Token invalido' });
    }

    // 2. Se leen los datos del token: { sub, rol, correo, exp }
    let usuario;
    try {
        usuario = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    } catch (error) {
        return res.status(401).json({ mensaje: 'Token invalido' });
    }

    // 3. El token no puede estar vencido (exp viene en segundos)
    if (!usuario.exp || usuario.exp * 1000 < Date.now()) {
        return res.status(401).json({ mensaje: 'El token expiro, inicia sesion de nuevo' });
    }

    req.usuario = usuario;
    next();
}

// Roles (los mismos de la API principal):
// 1 Administrador, 2 Moderador, 3 Analista, 4 Empleador, 5 Empleado.
// 'sistema' es la propia API principal.

// Administrador, moderador o la API principal: pueden modificar
function esStaff(req) {
    return [1, 2, 'sistema'].includes(req.usuario.rol);
}

// Ademas el analista: puede VER todo, pero no modificar
function veTodo(req) {
    return esStaff(req) || req.usuario.rol === 3;
}

// El usuario solo puede ver o tocar lo que es suyo. El staff puede todo.
// Si solo es para ver, el analista tambien.
function esDueno(req, correo, soloLectura = false) {
    if (soloLectura && veTodo(req)) {
        return true;
    }
    return esStaff(req) || req.usuario.correo === correo;
}

// Para las rutas que solo puede usar el staff
function soloStaff(req, res, next) {
    if (!esStaff(req)) {
        return res.status(403).json({ mensaje: 'Solo un administrador o moderador puede hacer esto' });
    }
    next();
}

// Para las rutas de solo lectura del staff y el analista
function soloVerTodo(req, res, next) {
    if (!veTodo(req)) {
        return res.status(403).json({ mensaje: 'No tienes permiso para ver esta informacion' });
    }
    next();
}

module.exports = { verificarToken, esStaff, veTodo, esDueno, soloStaff, soloVerTodo };
