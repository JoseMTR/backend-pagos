
CREATE DATABASE IF NOT EXISTS inwork_pagos;
USE inwork_pagos;


CREATE TABLE cuentas_pago (
    id_cuenta       INT AUTO_INCREMENT PRIMARY KEY,
    correo_usuario  VARCHAR(150) NOT NULL,     -- correo del trabajador en InWork
    titular         VARCHAR(150) NOT NULL,
    tipo_cuenta     ENUM('nequi', 'daviplata', 'bancolombia', 'otro_banco') NOT NULL,
    numero_cuenta   VARCHAR(30)  NOT NULL,

    estado   BOOLEAN  NOT NULL DEFAULT TRUE,
    created  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_cuenta UNIQUE (tipo_cuenta, numero_cuenta)
);


CREATE TABLE custodias (
    id_custodia           INT AUTO_INCREMENT PRIMARY KEY,
    codigo                VARCHAR(30)   NOT NULL,
    id_contratacion       INT           NOT NULL, 
    correo_cliente        VARCHAR(150)  NOT NULL,
    id_cuenta             INT           NOT NULL, 
    monto                 DECIMAL(12,2) NOT NULL,
    porcentaje_comision   DECIMAL(5,2)  NOT NULL DEFAULT 10.00,
    estado_custodia       ENUM('pendiente_pago', 'asegurado', 'en_disputa',
                               'liberado', 'reembolsado', 'cancelado')
                          NOT NULL DEFAULT 'pendiente_pago',
    confirmado_cliente    BOOLEAN NOT NULL DEFAULT FALSE,
    confirmado_trabajador BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_disputa        TEXT NULL,

    estado   BOOLEAN  NOT NULL DEFAULT TRUE,
    created  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_custodia_codigo      UNIQUE (codigo),
    CONSTRAINT uq_custodia_contratacion UNIQUE (id_contratacion),  -- una custodia por contratacion

    CONSTRAINT fk_custodia_cuenta
        FOREIGN KEY (id_cuenta) REFERENCES cuentas_pago(id_cuenta),

    CONSTRAINT chk_custodia_monto      CHECK (monto > 0),
    CONSTRAINT chk_custodia_comision   CHECK (porcentaje_comision BETWEEN 0 AND 50)
);

CREATE TABLE pagos (
    id_pago          INT AUTO_INCREMENT PRIMARY KEY,
    referencia       VARCHAR(30)   NOT NULL,
    id_custodia      INT           NOT NULL,
    tipo_pago        ENUM('deposito', 'liberacion', 'comision', 'reembolso') NOT NULL,
    monto            DECIMAL(12,2) NOT NULL,
    metodo_pago      VARCHAR(30)   NULL,   
    descripcion      VARCHAR(255)  NULL,

    estado   BOOLEAN  NOT NULL DEFAULT TRUE,
    created  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_pago_referencia UNIQUE (referencia),

    CONSTRAINT fk_pago_custodia
        FOREIGN KEY (id_custodia) REFERENCES custodias(id_custodia),

    CONSTRAINT chk_pago_monto CHECK (monto > 0)
);

-- =====================================================================
-- DATOS DE PRUEBA
-- Coinciden con la base de datos de la API principal (FastAPI):
-- custodia N = contratacion N, con los mismos correos y montos.
-- Los IDs de los comentarios (-- id N) son los que quedan al correr el script en una BD nueva.
-- =====================================================================

-- CUENTAS DE PAGO (10): una por cada trabajador. Kevin tiene dos (nequi y bancolombia).
INSERT INTO cuentas_pago (correo_usuario, titular, tipo_cuenta, numero_cuenta) VALUES
    ('kevin.escorcia.elec@gmail.com', 'Kevin Escorcia Rada', 'nequi', '3016548923'),  -- id 1
    ('yesid.cantillo@gmail.com', 'Yesid Cantillo Barraza', 'daviplata', '3135478962'),  -- id 2
    ('wilmer.navarro.pintor@gmail.com', 'Wilmer Navarro Fruto', 'bancolombia', '91245873621'),  -- id 3
    ('luzmarina.arrieta@gmail.com', 'Luz Marina Arrieta Julio', 'nequi', '3205874123'),  -- id 4
    ('edinson.refrigeracion@gmail.com', 'Edinson Ballestas Mercado', 'bancolombia', '23687451290'),  -- id 5
    ('jesus.marquez.fletes@gmail.com', 'Jesus Alberto Marquez Sulbaran', 'nequi', '3229654781'),  -- id 6
    ('sandra.cervantes@gmail.com', 'Sandra Milena Cervantes Ortega', 'daviplata', '3114785236'),  -- id 7
    ('julian.salcedo.tech@gmail.com', 'Julian David Salcedo Montero', 'nequi', '3043256987'),  -- id 8
    ('andrea.padilla.tutora@gmail.com', 'Andrea Carolina Padilla Torres', 'nequi', '3157896412'),  -- id 9
    ('kevin.escorcia.elec@gmail.com', 'Kevin Escorcia Rada', 'bancolombia', '45812369874');  -- id 10

-- CUSTODIAS (20): una por cada contratacion de InWork
--   1 al 10:  contratacion finalizada -> dinero liberado al trabajador
--             (la 8 tuvo disputa y InWork decidio liberar el pago)
--   11 al 17: contratacion activa     -> pendiente de pago, asegurado o en disputa
--   18 al 20: contratacion cancelada  -> custodia cancelada (estado = FALSE)
INSERT INTO custodias (codigo, id_contratacion, correo_cliente, id_cuenta, monto, porcentaje_comision, estado_custodia, confirmado_cliente, confirmado_trabajador, motivo_disputa, estado) VALUES
    ('CUS-1790297200000-427', 1, 'valentina.mendoza93@gmail.com', 2, 110000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 1 - contratacion 1 - liberado
    ('CUS-1790484400000-624', 2, 'luisf.delahoz@gmail.com', 1, 170000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 2 - contratacion 2 - liberado
    ('CUS-1790578000000-328', 3, 'paola.charris@gmail.com', 4, 150000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 3 - contratacion 3 - liberado
    ('CUS-1790786800000-736', 4, 'hernan.polo@gmail.com', 3, 1150000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 4 - contratacion 4 - liberado
    ('CUS-1790984800000-530', 5, 'valentina.mendoza93@gmail.com', 5, 200000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 5 - contratacion 5 - liberado
    ('CUS-1791186400000-660', 6, 'ricardo.barrios@hotmail.com', 6, 250000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 6 - contratacion 6 - liberado
    ('CUS-1791370000000-869', 7, 'natalia.ospino@outlook.com', 8, 120000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 7 - contratacion 7 - liberado
    ('CUS-1791575200000-551', 8, 'camila.ariza@gmail.com', 3, 150000.00, 10.00, 'liberado', FALSE, TRUE, 'El cliente dice que la puerta del closet quedo rozando y no confirmo. InWork reviso las fotos y libero el pago.', TRUE),  -- id 8 - contratacion 8 - liberado
    ('CUS-1791701200000-102', 9, 'paola.charris@gmail.com', 7, 300000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 9 - contratacion 9 - liberado
    ('CUS-1791913600000-182', 10, 'daniela.orozcom@gmail.com', 9, 150000.00, 10.00, 'liberado', TRUE, TRUE, NULL, TRUE),  -- id 10 - contratacion 10 - liberado
    ('CUS-1792010800000-394', 11, 'hernan.polo@gmail.com', 10, 620000.00, 10.00, 'asegurado', FALSE, FALSE, NULL, TRUE),  -- id 11 - contratacion 11 - asegurado
    ('CUS-1792104400000-560', 12, 'luisf.delahoz@gmail.com', 2, 190000.00, 10.00, 'pendiente_pago', FALSE, FALSE, NULL, TRUE),  -- id 12 - contratacion 12 - pendiente_pago
    ('CUS-1792176400000-934', 13, 'daniela.orozcom@gmail.com', 6, 280000.00, 10.00, 'asegurado', FALSE, FALSE, NULL, TRUE),  -- id 13 - contratacion 13 - asegurado
    ('CUS-1792360000000-795', 14, 'valentina.mendoza93@gmail.com', 4, 90000.00, 10.00, 'asegurado', FALSE, FALSE, NULL, TRUE),  -- id 14 - contratacion 14 - asegurado
    ('CUS-1792504000000-315', 15, 'ricardo.barrios@hotmail.com', 5, 360000.00, 10.00, 'pendiente_pago', FALSE, FALSE, NULL, TRUE),  -- id 15 - contratacion 15 - pendiente_pago
    ('CUS-1792666000000-357', 16, 'natalia.ospino@outlook.com', 9, 220000.00, 10.00, 'asegurado', FALSE, FALSE, NULL, TRUE),  -- id 16 - contratacion 16 - asegurado
    ('CUS-1792817200000-465', 17, 'camila.ariza@gmail.com', 8, 500000.00, 10.00, 'en_disputa', FALSE, FALSE, 'El trabajador pidio un pago adicional por cableado que no estaba en la oferta.', TRUE),  -- id 17 - contratacion 17 - en_disputa
    ('CUS-1792975600000-863', 18, 'paola.charris@gmail.com', 4, 180000.00, 10.00, 'cancelado', FALSE, FALSE, NULL, FALSE),  -- id 18 - contratacion 18 - cancelado
    ('CUS-1793162800000-753', 19, 'ricardo.barrios@hotmail.com', 2, 480000.00, 10.00, 'cancelado', FALSE, FALSE, NULL, FALSE),  -- id 19 - contratacion 19 - cancelado
    ('CUS-1793249200000-840', 20, 'luisf.delahoz@gmail.com', 6, 420000.00, 10.00, 'cancelado', FALSE, FALSE, NULL, FALSE);  -- id 20 - contratacion 20 - cancelado

-- PAGOS: deposito del cliente; y cuando se libera, el pago al trabajador (90%) y la comision de InWork (10%)
INSERT INTO pagos (referencia, id_custodia, tipo_pago, monto, metodo_pago, descripcion) VALUES
    ('PAG-1790447600000-191', 1, 'deposito', 110000.00, 'bancolombia', 'Pago del cliente asegurado en InWork'),  -- custodia 1
    ('PAG-1790447605000-399', 1, 'liberacion', 99000.00, NULL, 'Pago enviado a Yesid Cantillo Barraza'),
    ('PAG-1790447608000-568', 1, 'comision', 11000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1790552008000-997', 2, 'deposito', 170000.00, 'bancolombia', 'Pago del cliente asegurado en InWork'),  -- custodia 2
    ('PAG-1790552011000-125', 2, 'liberacion', 153000.00, NULL, 'Pago enviado a Kevin Escorcia Rada'),
    ('PAG-1790552014000-472', 2, 'comision', 17000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1790728414000-532', 3, 'deposito', 150000.00, 'nequi', 'Pago del cliente asegurado en InWork'),  -- custodia 3
    ('PAG-1790728418000-699', 3, 'liberacion', 135000.00, NULL, 'Pago enviado a Luz Marina Arrieta Julio'),
    ('PAG-1790728423000-610', 3, 'comision', 15000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1790825623000-535', 4, 'deposito', 1150000.00, 'bancolombia', 'Pago del cliente asegurado en InWork'),  -- custodia 4
    ('PAG-1790825628000-996', 4, 'liberacion', 1035000.00, NULL, 'Pago enviado a Wilmer Navarro Fruto'),
    ('PAG-1790825632000-507', 4, 'comision', 115000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791016432000-364', 5, 'deposito', 200000.00, 'daviplata', 'Pago del cliente asegurado en InWork'),  -- custodia 5
    ('PAG-1791016437000-590', 5, 'liberacion', 180000.00, NULL, 'Pago enviado a Edinson Ballestas Mercado'),
    ('PAG-1791016442000-630', 5, 'comision', 20000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791092042000-689', 6, 'deposito', 250000.00, 'pse', 'Pago del cliente asegurado en InWork'),  -- custodia 6
    ('PAG-1791092044000-937', 6, 'liberacion', 225000.00, NULL, 'Pago enviado a Jesus Alberto Marquez Sulbaran'),
    ('PAG-1791092045000-821', 6, 'comision', 25000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791282845000-786', 7, 'deposito', 120000.00, 'nequi', 'Pago del cliente asegurado en InWork'),  -- custodia 7
    ('PAG-1791282850000-539', 7, 'liberacion', 108000.00, NULL, 'Pago enviado a Julian David Salcedo Montero'),
    ('PAG-1791282854000-245', 7, 'comision', 12000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791462854000-334', 8, 'deposito', 150000.00, 'nequi', 'Pago del cliente asegurado en InWork'),  -- custodia 8
    ('PAG-1791462858000-790', 8, 'liberacion', 135000.00, NULL, 'Pago enviado a Wilmer Navarro Fruto'),
    ('PAG-1791462862000-831', 8, 'comision', 15000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791657262000-357', 9, 'deposito', 300000.00, 'bancolombia', 'Pago del cliente asegurado en InWork'),  -- custodia 9
    ('PAG-1791657266000-785', 9, 'liberacion', 270000.00, NULL, 'Pago enviado a Sandra Milena Cervantes Ortega'),
    ('PAG-1791657269000-661', 9, 'comision', 30000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791844469000-815', 10, 'deposito', 150000.00, 'daviplata', 'Pago del cliente asegurado en InWork'),  -- custodia 10
    ('PAG-1791844473000-543', 10, 'liberacion', 135000.00, NULL, 'Pago enviado a Andrea Carolina Padilla Torres'),
    ('PAG-1791844475000-401', 10, 'comision', 15000.00, NULL, 'Comision de InWork (10%)'),
    ('PAG-1791977675000-109', 11, 'deposito', 620000.00, 'nequi', 'Pago del cliente asegurado en InWork'),  -- custodia 11
    ('PAG-1792082075000-771', 13, 'deposito', 280000.00, 'bancolombia', 'Pago del cliente asegurado en InWork'),  -- custodia 13
    ('PAG-1792258475000-922', 14, 'deposito', 90000.00, 'bancolombia', 'Pago del cliente asegurado en InWork'),  -- custodia 14
    ('PAG-1792442075000-468', 16, 'deposito', 220000.00, 'pse', 'Pago del cliente asegurado en InWork'),  -- custodia 16
    ('PAG-1792571675000-809', 17, 'deposito', 500000.00, 'daviplata', 'Pago del cliente asegurado en InWork');  -- custodia 17

