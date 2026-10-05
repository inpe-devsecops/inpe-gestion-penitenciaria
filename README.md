# inpe-devsecops – Gestión segura de la población penitenciaria

Proyecto del curso **1ACB0002 – Arquitectura de Aplicaciones** (UPC, 2026-20).

Al 31 de enero de 2026, las cárceles del Perú tenían **103,717 internos para 41,764 plazas**: 61,953 personas sin cupo, con un hacinamiento del 128 % (INPE, 2026). inpe-devsecops centraliza la información de internos, pabellones y situación jurídica para calcular el índice de hacinamiento en tiempo real, generar alertas (aforo crítico, liberaciones próximas, prisión preventiva por vencer) y recomendar traslados. La seguridad es transversal en todo el ciclo de vida (Secure SDLC / DevSecOps).

## Stack (MERN + TypeScript)

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript, Mongoose, Zod |
| Base de datos | MongoDB (Atlas) |
| Seguridad | AES-256-GCM, HMAC-SHA256, Argon2id, JWT, Helmet, rate limiting |
| CI/CD | GitHub Actions, Docker, Render |
| DevSecOps | Semgrep (SAST), Gitleaks, npm audit + Dependabot, OWASP ZAP (DAST) |

## Estructura

```
backend/           API REST (src/seguridad = controles, src/rutas, src/repositorios, tests/)
frontend/          SPA React
datos/             datos simulados (se generan, no se versionan)
tools/generador/   generador de la población simulada calibrada con el INPE
.github/           pipeline, Dependabot y plantilla de pull request
```

## Ejecutar en local

Requisitos: Node.js 22 y MongoDB (local o Atlas).

```bash
# 1. Datos simulados (Windows PowerShell)
powershell -ExecutionPolicy Bypass -File tools/generador/generar.ps1 -Salida datos

# 2. Backend
cd backend
cp .env.example .env        # completar claves (ver comentarios del archivo)
npm install
npm run seed -- ../datos    # carga los datos cifrando los campos sensibles
npm run dev                 # http://localhost:3000/health

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Los usuarios simulados están en `datos/usuarios.json` (por ejemplo, el primer director de penal) y entran con la contraseña que definas en `SEED_PASSWORD`.

## Pruebas de seguridad automatizadas

`npm test` en `backend/` verifica los requisitos del informe:

| Requisito | Prueba |
|---|---|
| REQ-SEC-01 Bloqueo tras 5 intentos | `tests/seguridad.test.ts` |
| REQ-SEC-02 Acceso solo a internos del propio penal | `tests/seguridad.test.ts` |
| REQ-SEC-03 Campos sensibles cifrados | `tests/cripto.test.ts` |
| REQ-SEC-04 Token expirado | `tests/seguridad.test.ts` |
| REQ-SEC-06 Inyección NoSQL | `tests/seguridad.test.ts` |

## Pipeline

Cada push ejecuta: lint, build y pruebas → Semgrep → Gitleaks → npm audit → imagen Docker. Al integrar en `main`, además: despliegue a DEV → smoke test → OWASP ZAP → despliegue a PROD. Los despliegues se activan al configurar en GitHub los secretos `RENDER_DEPLOY_HOOK_DEV` y `RENDER_DEPLOY_HOOK_PROD`, y la variable `DEV_URL`.

## Equipo

Brandon Zevallos (líder) · Kelly · Matias · Mathias · Favio. Flujo de trabajo en [CONTRIBUTING.md](CONTRIBUTING.md) y política de seguridad en [SECURITY.md](SECURITY.md).

> Todos los datos de este repositorio son **ficticios**.
