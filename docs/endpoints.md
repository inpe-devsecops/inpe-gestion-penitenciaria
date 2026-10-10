# API REST

Base: `http://localhost:3000/api` · JSON · todas las rutas salvo `/health` y `POST /auth/login` exigen `Authorization: Bearer <token>`.

Errores uniformes: `{ "error": "mensaje para el usuario", "codigo": "...", "detalles"?: [{ "campo", "mensaje" }] }`

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `VALIDACION` / `SOLICITUD_INVALIDA` | Entrada inválida, campos no previstos u operadores NoSQL |
| 401 | `NO_AUTENTICADO` | Sin token, token alterado, expirado o sesión revocada |
| 403 | `SIN_PERMISO` | Rol insuficiente, fuera del ámbito o segregación de funciones (queda auditado) |
| 404 | `NO_ENCONTRADO` | El recurso no existe |
| 409 | `CONFLICTO` | Unicidad o flujo (p. ej. el interno ya tiene un traslado en trámite) |
| 422 | `REGLA_DE_NEGOCIO` | Regla del dominio o validador de la base de datos |
| 423 | `BLOQUEADO` | Cuenta bloqueada 15 minutos tras 5 intentos fallidos |
| 429 | `LIMITE_EXCEDIDO` / `DEMASIADOS_INTENTOS` | Límite de peticiones |

## Autenticación

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público | `{ username, password }` → `{ token, expiraEn: 900, usuario }` |
| GET | `/auth/me` | autenticado | Usuario, rol y ámbito |
| POST | `/auth/logout` | autenticado | Revoca el token actual (204) |

## Panel y análisis

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/panel` | todos (según ámbito) | Totales, niveles, por oficina regional, más hacinados, con cupo, serie mensual, contadores |
| GET | `/proyecciones` | todos (según ámbito) | Proyección de cada establecimiento ordenada por urgencia |
| GET | `/parametros` | autenticado | Umbrales, pesos y normalización vigentes |
| PATCH | `/parametros` | central | `{ cambios: { clave: valor }, motivo }`; valida el conjunto (pesos suman 1, umbrales ordenados) y audita cada clave |
| GET | `/auditoria` | central, auditor | Filtros `accion`, `entidad`, `entidadId`, `usuarioId`, `resultado`, `desde`, `hasta` |
| GET | `/catalogos` | autenticado | Oficinas, establecimientos, clasificaciones, fases, causales del art. 159 |

## Establecimientos

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/establecimientos` | todos (según ámbito) | Filtros `oficinaId`, `nivel`, `techo`, `conCupo`, `busqueda`, `orden`, `direccion` |
| GET | `/establecimientos/:id` | ámbito | Ficha con ocupación, nivel y atributos del motor |
| GET | `/establecimientos/:id/serie` | ámbito | Cortes mensuales (`interpolado` indica si no es un dato oficial) |
| GET | `/establecimientos/:id/proyeccion` | ámbito | Escenario, meses al nivel crítico, horizonte y supuesto |
| POST | `/establecimientos` | central | Registra un establecimiento (RNF-19) |
| PATCH | `/establecimientos/:id` | central | Atributos: techo, regímenes, género, programas por fase, riesgo, activo |
| PATCH | `/establecimientos/:id/ocupacion` | director (el suyo), central | `{ poblacion?, capacidad?, motivo }`; reevalúa alertas |

## Internos (ficha mínima)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/internos` | todos (según ámbito) | Filtros `establecimientoId`, `clasificacion`, `fase`, `situacion`, `busqueda` |
| GET | `/internos/:id` | ámbito | Ficha e historial de traslados |
| POST | `/internos` | director (el suyo), central | Rechaza campos no previstos (nombres, documentos…) |
| PATCH | `/internos/:id` | director (el suyo), central | Clasificación, fase, situación jurídica, riesgo |

## Traslados

```
registra (regional/central) → EVALUADA ──┬─ aprueba (central ≠ solicitante) → APROBADA → ejecuta (director) → EJECUTADA
                                          └─ rechaza (central ≠ solicitante) → RECHAZADA
```

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/traslados` | todos (según ámbito) | Filtros `estado`, `soloPendientes`, `establecimientoId`, `busqueda` |
| GET | `/traslados/recomendacion/:internoId` | regional, central | Ranking del motor sin registrar nada |
| POST | `/traslados` | regional (su oficina), central | `{ internoId, causal, fundamento }`; ejecuta el motor y guarda la evaluación de todos los destinos |
| GET | `/traslados/:id` | ámbito | Solicitud, evaluación, decisión y permisos del usuario actual |
| POST | `/traslados/:id/aprobar` | central (≠ solicitante) | `{ destinoId?, fundamento }`; apartarse de la recomendación exige ≥ 40 caracteres |
| POST | `/traslados/:id/rechazar` | central (≠ solicitante) | `{ fundamento }` |
| POST | `/traslados/:id/ejecutar` | director de origen o destino | Mueve al interno y actualiza la ocupación de ambos |

## Alertas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/alertas` | todos (según ámbito) | `soloVigentes` (por defecto `true`), `severidad`, `condicion`, `establecimientoId` |
| GET | `/alertas/:id/historial` | ámbito | Creación, cambios de severidad, reconocimiento y resolución |
| POST | `/alertas/evaluar` | central | Fuerza la evaluación (idempotente; también corre cada `ALERT_JOB_INTERVAL_MIN`) |
| PATCH | `/alertas/:id` | central, regional, director | `{ estado: "RECONOCIDA", comentario? }` |
