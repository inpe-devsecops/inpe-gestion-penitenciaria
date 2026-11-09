# inpe-devsecops – Gestión y análisis de la población penitenciaria

Proyecto del curso **1ACB0002 – Arquitectura de Aplicaciones** (UPC, 2026-20).

En enero de 2026 las cárceles del Perú tenían **103,717 internos para 41,764 plazas**: 61,953 personas sin cupo y un índice de hacinamiento de **148 %** (INPE, Informe Estadístico, Anexo 06). La capacidad no creció respecto de enero de 2025, mientras la población aumentó un 4 %. inpe-devsecops ayuda a redistribuir con criterio: calcula el hacinamiento de los 69 establecimientos en tiempo real, recomienda destinos de traslado con un motor explicable, gestiona el flujo de traslado con segregación de funciones, genera alertas por umbral y proyecta cuándo cada establecimiento alcanzará el nivel crítico. La seguridad es transversal en todo el ciclo de vida (Secure SDLC / DevSecOps).

## Stack (MERN + TypeScript)

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript, React Router, TanStack Query, Recharts |
| Backend | Node.js + Express + TypeScript, Mongoose, Zod |
| Base de datos | MongoDB (Atlas en la nube; validadores `$jsonSchema`, índices únicos parciales) |
| Seguridad | Argon2id, JWT de 15 min con sesiones revocables, AES-256-GCM, Helmet, rate limiting |
| CI/CD | GitHub Actions, Docker, Render |
| DevSecOps | Semgrep (SAST), ESLint security, Gitleaks, npm audit + Dependabot, OWASP ZAP (DAST) |

## Qué hace (requerimientos del Trabajo Parcial)

| Módulo | Requerimientos | Dónde |
|---|---|---|
| Ficha mínima del interno, catálogo de establecimientos | RF-01 a RF-03 | `backend/src/modulos/internos`, `.../establecimientos` |
| Ocupación, hacinamiento por establecimiento y por oficina regional, serie histórica | RF-04 a RF-06 | `.../establecimientos/metricas.ts`, `.../dashboard` |
| Alertas Atención / Severo / Crítico / Prospectiva, sin duplicados; proyección lineal | RF-07 a RF-10 | `.../alertas`, `.../proyeccion` |
| Solicitud con causal del art. 159 y fundamento obligatorio | RF-11 a RF-13 | `.../traslados` |
| Motor de recomendación: condiciones obligatorias + puntaje ponderado explicable | RF-14 a RF-19 | `.../traslados/motor.ts` |
| Decisión con segregación de funciones y ejecución que actualiza la ocupación | RF-20 a RF-24 | `.../traslados/servicio.ts` |
| Auditoría de solo inserción con valor anterior y nuevo | RF-25 | `backend/src/lib/auditoria.ts` |

Roles (Tabla 8 del informe): **administrador central** (nacional), **responsable regional** (su oficina regional), **director de establecimiento** (su establecimiento) y **auditor** (nacional, solo lectura). El servidor verifica rol y ámbito en cada petición; la interfaz solo oculta lo que el rol no puede usar.

## Estructura

```
backend/
  src/dominio/        catálogos (roles, clasificaciones, causales del art. 159, severidades)
  src/modelos/        esquemas de Mongoose (Tabla 15 del informe)
  src/modulos/        auth, establecimientos, internos, traslados (motor), alertas, proyeccion, dashboard, parametros
  src/seguridad/      autenticación y ámbito, cifrado, rechazo de operadores NoSQL
  src/db/             migraciones versionadas, seed y datos oficiales del INPE
  tests/              unitarias (motor, proyección, alertas, cifrado) e integración con MongoDB real
frontend/             SPA React con vistas por rol
docs/                 API, modelo de datos y datos de referencia del INPE
scripts/              arranque automático de la API en Windows (tarea programada)
.github/              pipeline, Dependabot y plantilla de pull request
```

## Ejecutar en local

Requisitos: Node.js 22 o superior y MongoDB 7 o superior (local o Atlas).

```bash
# 1. Backend
cd backend
cp .env.example .env        # completar JWT_SECRET, DATA_KEY y SEED_PASSWORD (ver comentarios)
npm install
npm run seed                # BORRA y recrea la base: migraciones + datos (solo desarrollo)
npm run dev                 # http://localhost:3000/health

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Usuarios de prueba (todos con la contraseña de `SEED_PASSWORD`): `admin.central` y `admin.central2` (dos centrales, para decidir solicitudes ajenas), `auditor`, `regional.<oficina>` (`regional.lima`, `regional.norte`, `regional.sur-oriente`…) y `director.<código>` (`director.ep-lurigancho`, `director.ep-tacna`…).

El token vive solo en memoria del navegador (no en `localStorage`): al recargar la página hay que volver a iniciar sesión. Es una decisión de seguridad frente a XSS.

## Datos

- **Reales**: capacidad y población de los 69 establecimientos en enero de 2025 y enero de 2026 (Anexo 06 del Informe Estadístico del INPE). El panel cuadra exactamente: 41,764 plazas, 103,717 internos, 148.34 %. Ver `docs/datos-inpe/`.
- **Interpolados**: los once cortes mensuales entre ambos informes (marcados `interpolado: true`), para que la proyección tenga una serie que ajustar.
- **Estimados**: techo de seguridad, regímenes admitidos, programas por fase y proporción de alto riesgo de cada establecimiento (el INPE no los publica; son editables por el administrador central).
- **Ficticios**: usuarios y fichas de internos (`dato_ficticio: true`). La ficha no tiene nombres, documentos, datos de salud ni de familiares (RNF-08); la colección rechaza esos campos incluso a nivel de base de datos.

## Pruebas

`npm test` en `backend/` ejecuta 64 pruebas (cobertura ≈ 84 % de líneas). Las de integración crean bases desechables `inpe_test_*` en `MONGODB_URI_TEST` (por defecto `mongodb://127.0.0.1:27017`); en el CI corre un servicio `mongo:7`.

| Caso del informe (Tablas 18 y 19) | Prueba |
|---|---|
| Exactitud frente al INPE y panel en menos de 2 s (RNF-14, RNF-15) | `tests/integracion/flujo.test.ts` |
| Motor: descartes con motivo, ranking y ejemplo de la Tabla 12 (0.770 / 0.720) | `tests/unitarias/motor.test.ts` |
| Alertas sin duplicados, cambio de severidad y prospectiva | `tests/unitarias/proyeccion-alertas.test.ts`, `flujo.test.ts` |
| Autoaprobación bloqueada en la API **y** en el validador de la colección | `flujo.test.ts` |
| Acceso fuera del ámbito (403 auditado), token alterado o revocado, bloqueo tras 5 intentos | `tests/integracion/seguridad.test.ts` |
| Inyección NoSQL y minimización de datos | `seguridad.test.ts` |
| Auditoría inalterable | `seguridad.test.ts` |

## Pipeline

Cada push ejecuta: lint, build y pruebas (con MongoDB) → Semgrep → Gitleaks → npm audit → imagen Docker. Al integrar en `main`, además: despliegue a DEV → smoke test → OWASP ZAP → despliegue a PROD. Los despliegues se activan al configurar en GitHub los secretos `RENDER_DEPLOY_HOOK_DEV` y `RENDER_DEPLOY_HOOK_PROD`, y la variable `DEV_URL`.

## Origen

Este repositorio fusiona dos líneas de trabajo del equipo: la base MERN con los controles de seguridad y el pipeline (TB1), y la plataforma de cupos y traslados desarrollada con DeepSeek sobre PostgreSQL (motor de recomendación, alertas, proyecciones e interfaz). Toda la funcionalidad de esta última se portó a MongoDB siguiendo el diseño del Trabajo Parcial.

## Equipo

Brandon Zevallos (líder) · Kelly · Matias · Mathias · Favio. Flujo de trabajo en [CONTRIBUTING.md](CONTRIBUTING.md) y política de seguridad en [SECURITY.md](SECURITY.md).

> Los usuarios y las fichas de internos de este repositorio son **ficticios**.
