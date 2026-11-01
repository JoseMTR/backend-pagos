# API de Pagos en Custodia - InWork

Base de datos auxiliar y API con **Express** y **MySQL** para el proyecto InWork.

InWork tiene **dos APIs**, cada una con su propia base de datos:

| API | Tecnología | Base de datos | Se encarga de |
|---|---|---|---|
| API principal (InWork) | FastAPI (Python) | PostgreSQL (Neon) | Usuarios, trabajos, ofertas, contratos, chat, calificaciones... |
| **API de pagos (esta)** | Express (Node.js) | MySQL | **Todo lo que tiene que ver con dinero** |

Se comunican usando el **id del contrato** (`id_contratacion`).

## ¿Qué hace?

InWork funciona como **intermediario** entre el cliente y el trabajador para que los dos estén seguros:

1. El cliente acepta una oferta en la API principal y se crea el contrato. **En ese momento la API principal
   llama a esta API y se crea la custodia** del pago.
2. El cliente **le paga a InWork** (no directamente al trabajador). El dinero queda **guardado (en custodia)**
   y se le **avisa al trabajador** que ya puede empezar.
3. Cuando el trabajo termina, **el cliente y el trabajador confirman**.
4. Cuando **los dos** confirman, InWork **le paga al trabajador** descontando su comisión (10 %).
5. Si hay un problema, cualquiera de los dos abre una **disputa** y InWork decide si le paga al trabajador
   o le devuelve el dinero al cliente.

## Base de datos (`database.sql`)

| Tabla | Descripción | Llave primaria | Campos únicos |
|---|---|---|---|
| `cuentas_pago` | Cuentas donde los trabajadores reciben el dinero | `id_cuenta` | `tipo_cuenta` + `numero_cuenta` |
| `custodias` | El dinero de cada contrato que InWork guarda | `id_custodia` | `codigo`, `id_contratacion` |
| `pagos` | Cada pago: depósito del cliente, pago al trabajador, comisión y reembolsos | `id_pago` | `referencia` |

Todas las tablas tienen los campos **`estado`** (borrado lógico), **`created`** y **`updated`**.
`updated` se actualiza solo gracias a `ON UPDATE CURRENT_TIMESTAMP`.

**Relaciones:** una cuenta tiene muchas custodias, y una custodia tiene muchos pagos.

**Normalización:** el correo del trabajador no se repite en `custodias`, se obtiene de su cuenta (`id_cuenta`).

## Instalación

1. `npm install`
2. Ejecutar `database.sql` en MySQL (Workbench, phpMyAdmin o consola). Crea la base `inwork_pagos` con sus datos de prueba.
3. Copiar `.env.example` como `.env`, poner los datos de MySQL y la **misma `SECRET_KEY`** de la API principal.
4. `npm run dev` (con nodemon) o `npm start`.
5. Abrir `http://localhost:3000/api/prueba-db` para comprobar la conexión.

## Datos de prueba

`database.sql` trae 10 cuentas, 20 custodias y 35 pagos que **coinciden con la base de datos de la API principal**:
la custodia N es de la contratación N, con los mismos correos y montos.

| Contrataciones | Estado de la custodia |
|---|---|
| 1 a 10 (finalizadas) | `liberado` (la 8 pasó por una disputa) |
| 11 a 17 (activas) | `pendiente_pago`, `asegurado` o `en_disputa` |
| 18 a 20 (canceladas) | `cancelado` |

## Seguridad (token)

Todas las rutas `/api/...` piden el **mismo token** que entrega la API principal en `POST /auth/login`:

```
Authorization: Bearer <access_token>
```

Las dos APIs tienen la misma `SECRET_KEY`, así que esta API comprueba que el token es real
(`src/middlewares/auth.js`) sin preguntarle a la otra. Del token se saca el correo y el rol del usuario:

- **Administrador (1) y moderador (2):** pueden ver todo, crear custodias, resolver disputas y manejar los pagos.
- **Analista (3):** puede ver todas las custodias y pagos, pero no modificar nada.
- **Empleador (4) y empleado (5):** solo ven sus propias cuentas y custodias. Solo el cliente puede pagar, y el correo para
  confirmar o abrir una disputa **sale del token**, así nadie puede hacerlo a nombre de otro.
- **La API principal** se identifica con un token de `sistema` cuando crea, consulta o cancela custodias.

## Endpoints

### Cuentas de pago — `/api/cuentas`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/cuentas` | Listar cuentas (el usuario ve las suyas; el staff ve todas y puede filtrar `?correo=`) |
| GET | `/api/cuentas/:id` | Obtener una cuenta (solo el dueño o el staff) |
| POST | `/api/cuentas` | Registrar cuenta (queda a nombre del correo del token) |
| PUT | `/api/cuentas/:id` | Actualizar cuenta (solo el dueño o el staff) |
| DELETE | `/api/cuentas/:id` | Eliminar cuenta (no deja si tiene pagos pendientes) |

### Custodias — `/api/custodias`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/custodias` | Listar custodias, filtro opcional `?estado_custodia=` (staff) |
| GET | `/api/custodias/:id` | Obtener una custodia (cliente, trabajador o staff) |
| GET | `/api/custodias/contratacion/:id` | Custodia de un contrato de InWork (la usa la API principal) |
| POST | `/api/custodias` | Crear custodia (la llama la API principal al crear el contrato) |
| PUT | `/api/custodias/:id` | Actualizar, solo antes de pagar (staff) |
| DELETE | `/api/custodias/:id` | Eliminar, solo antes de pagar (staff o la API principal) |
| POST | `/api/custodias/:id/depositar` | El cliente paga y el dinero queda asegurado |
| GET | `/api/custodias/trabajador/:correo` | El trabajador ve el aviso de sus pagos |
| GET | `/api/custodias/cliente/:correo` | El cliente ve qué debe pagar y qué le falta confirmar |
| POST | `/api/custodias/:id/confirmar` | Cliente o trabajador confirman que terminó el trabajo |
| POST | `/api/custodias/:id/disputa` | Abrir una disputa |
| POST | `/api/custodias/:id/resolver` | InWork decide: `liberar` o `reembolsar` (staff) |

### Pagos — `/api/pagos` (solo administrador o moderador)
Cada pago trae también `codigo_custodia`, `id_contratacion` y `correo_cliente`.
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/pagos` | Listar pagos (filtro opcional `?id_custodia=`) |
| GET | `/api/pagos/:id` | Obtener un pago |
| POST | `/api/pagos` | Registrar un pago manual |
| PUT | `/api/pagos/:id` | Actualizar método de pago o descripción |
| DELETE | `/api/pagos/:id` | Eliminar pago |

### Ejemplos de body

Crear custodia (así la envía la API principal):
```json
{ "id_contratacion": 21, "correo_cliente": "camila.ariza@gmail.com", "correo_trabajador": "wilmer.navarro.pintor@gmail.com", "monto": 100000 }
```
Depositar (con el token del cliente):
```json
{ "metodo_pago": "nequi" }
```
Confirmar: no lleva body, el correo sale del token.

Abrir disputa:
```json
{ "motivo": "La limpieza no se hizo completa" }
```

**Importante:** el trabajador debe tener registrada su cuenta en `/api/cuentas` antes de que lo contraten.
Si no la tiene, la API principal crea el contrato pero avisa que no se pudo crear la custodia.

## Probar con Postman

Importar `postman_coleccion.json`. Con la API principal encendida (puerto 8000), ejecutar uno de los
**"Login como ..."** de la carpeta **"0. Inicio"**: el token se guarda solo en la variable `{{token}}`.
La carpeta **"3. Flujo del pago"** tiene las peticiones en orden y dice con qué usuario iniciar sesión.
La contraseña de todos los usuarios de prueba es `Inwork2026*`.

## Despliegue (Railway)

1. Subir el proyecto a GitHub (el `.env` no se sube).
2. En [railway.app](https://railway.app) crear un proyecto y agregar una base de datos **MySQL**.
3. Ejecutar `database.sql` en la base de Railway **sin las dos primeras líneas** (`CREATE DATABASE` y `USE`).
4. Agregar un servicio desde el repositorio de GitHub.
5. En las variables del servicio poner `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `SECRET_KEY`.
6. En *Settings → Networking* generar un dominio público y probar `https://tu-dominio/api/prueba-db`.
7. Poner esa URL en la variable `PAGOS_API_URL` de la API principal.

## Estructura

```
api-pagos-inwork/
├── database.sql
├── postman_coleccion.json
├── package.json
├── .env.example
└── src/
    ├── index.js              # servidor y rutas principales
    ├── config/db.js          # conexión a MySQL
    ├── controllers/          # lógica de cada tabla
    ├── middlewares/auth.js   # revisa el token de la API principal
    ├── routes/               # endpoints de cada tabla
    └── utils/                # manejo de errores y generación de códigos
```
