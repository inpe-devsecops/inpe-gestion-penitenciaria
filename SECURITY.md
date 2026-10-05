# Política de seguridad

inpe-devsecops maneja datos personales y judiciales de alta sensibilidad. Este repositorio **solo contiene datos ficticios**.

## Reportar una vulnerabilidad

No abras un *issue* público. Escribe a los mantenedores del equipo por el canal privado del proyecto o usa *Security → Report a vulnerability* en GitHub. Incluye los pasos para reproducirla y el impacto estimado.

## Controles aplicados

| Control | Dónde |
|---|---|
| Cifrado AES-256-GCM de nombre, documento, expediente y delito | `backend/src/seguridad/cripto.ts` |
| Índice ciego HMAC-SHA256 para buscar por documento | `backend/src/seguridad/cripto.ts` |
| JWT de 15 minutos validado en cada petición | `backend/src/seguridad/auth.ts` |
| Control de acceso por rol y por penal (anti-BOLA) | `backend/src/seguridad/auth.ts` |
| Bloqueo de cuenta tras 5 intentos fallidos | `backend/src/rutas/auth.ts` |
| Rechazo de operadores NoSQL en la entrada | `backend/src/seguridad/sanitizar.ts` |
| Cabeceras seguras, CORS restringido, rate limiting | `backend/src/app.ts` |
| Bitácora de auditoría de solo inserción | `backend/src/repositorios/mongo.ts` |
| Pipeline con pruebas, SAST, secretos, dependencias y DAST | `.github/workflows/ci.yml` |

## Rol de MongoDB para la aplicación (bitácora inalterable)

```js
use inpe-devsecops
db.createRole({
  role: "inpeDevsecopsApp",
  privileges: [
    { resource: { db: "inpe-devsecops", collection: "auditoria" }, actions: ["insert", "find"] },
    { resource: { db: "inpe-devsecops", collection: "internos" },  actions: ["insert", "find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "usuarios" },  actions: ["find", "update"] },
    { resource: { db: "inpe-devsecops", collection: "" },          actions: ["find"] }
  ],
  roles: []
})
```
