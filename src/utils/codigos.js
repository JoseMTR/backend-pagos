function generarCodigo(prefijo) {
    const aleatorio = Math.floor(Math.random() * 900) + 100;
    return `${prefijo}-${Date.now()}-${aleatorio}`;
}

module.exports = generarCodigo;
