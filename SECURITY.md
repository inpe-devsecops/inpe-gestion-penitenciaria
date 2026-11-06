# Política de seguridad

inpe-devsecops trata información de la población penitenciaria. Por diseño **minimiza los datos personales** (la ficha del interno no tiene nombres, documentos, datos de salud ni de familiares) y este repositorio solo contiene usuarios y fichas **ficticios**.

## Reportar una vulnerabilidad

No abras un *issue* público. Escribe a los mantenedores del equipo por el canal privado del proyecto o usa *Security → Report a vulnerability* en GitHub. Incluye los pasos para reproducirla y el impacto estimado.

## Controles aplicados

| Control | Requerimiento | Dónde |
|---|---|---|
| Autenticación obligatoria; JWT de 15 min con `jti` comprobado en cada petición y revocado al cerrar sesión | RNF-01, RNF-04 | `backend/src/seguridad/auth.ts`, `backend/src/modulos/auth/rutas.ts` |
| Autorización por rol **y** ámbito territorial; los accesos fuera de ámbito se rechazan y se auditan; un interno ajeno responde 404 (anti-enumeración) | RNF-02 | `backend/src/seguridad/auth.ts` y cada módulo |
| Contraseñas con Argon2id; bloqueo de 15 min tras 5 intentos; mismo mensaje y tiempo para usuario inexistente | RNF-03 | `backend/src/modulos/auth/rutas.ts` |
| Validación de entradas con Zod (`.strict()`), errores con detalle por campo y sin información técnica | RNF-06, RNF-23 | `backend/src/lib/validacion.ts`, `backend/src/lib/errores.ts` |
| Rechazo de operadores NoSQL (`$ne`, `$where`, claves con punto) en cuerpo, query y parámetros | RNF-07 | `backend/src/seguridad/sanitizar.ts` |
| Minimización de datos: la colección `internos` rechaza campos no previstos (`additionalProperties: false`) | RNF-08 | `backend/src/db/migrar.ts` |
| Segregación de funciones en la API y en el validador `$expr` de `decisiones_traslado` | RNF-09 | `backend/src/modulos/traslados/servicio.ts`, `backend/src/db/migrar.ts` |
| Secretos solo en variables de entorno; Gitleaks en el pipeline | RNF-10 | `backend/src/config.ts`, `.github/workflows/ci.yml` |
| Auditoría de solo inserción (modelo que bloquea update/delete + rol de base de datos) con valor anterior y nuevo | RNF-11 a RNF-13 | `backend/src/modelos/index.ts`, `backend/src/lib/auditoria.ts` |
| Cifrado AES-256-GCM de los fundamentos de solicitudes y decisiones (texto libre que puede describir al interno) | Defensa en profundidad | `backend/src/seguridad/cripto.ts` |
| Cabeceras seguras (Helmet), CORS restringido, límite de peticiones general y de login | Tabla 16 | `backend/src/app.ts` |
| Logs JSON sin contraseñas ni tokens | RNF-24 | `backend/src/app.ts` |
| Pipeline con pruebas, SAST, secretos, dependencias y DAST | Apartado 3 | `.github/workflows/ci.yml` |

## Usuarios de MongoDB con mínimo privilegio

En producción (Atlas) la API usa un usuario que **no** puede modificar ni borrar la auditoría ni alterar la estructura. Las migraciones las aplica otro usuario, en el paso de despliegue y después de un `mongodump`:

```bash
MONGODB_URI="<uri del usuario administrador>" npm run migrate   # antes, respaldar con mongodump
```

y la API arranca con `MIGRAR_AL_INICIAR=false`. Rol de la aplicación (en Atlas: *Database Access → Custom Roles*):

```js
use inpe-devsecops
db.createRole({
  role: "inpeDevsecopsApp",
  privileges: [
    { resource: { db: "inpe-devsecops", collection: "auditoria" }, actions: ["insert", "find"] },
    { resource: { db: "inpe-devsecops", collection: "evaluaciones_destino" }, actions: ["insert", "find"] },
    { resource: { db: "inpe-devsecops", collection: "decisiones_traslado" }, actions: ["insert", "find"] },
    { resource: { db: "inpe-devsecops", collection: "solicitudes_traslado" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "establecimientos" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "ocupacion_historica" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "internos" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "alertas" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "parametros" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "usuarios" }, actions: ["find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "sesiones" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "contadores" }, actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "" }, actions: ["find"] }
  ],
  roles: []
})
```

Ninguna colección concede `remove` a la aplicación, y la de auditoría tampoco concede `update`.
