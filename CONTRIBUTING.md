# Cómo trabajamos

## Ramas

- `main` está protegida: no se permite *push* directo. Todo entra por pull request con **2 aprobaciones** y el pipeline en verde.
- Cada integrante trabaja en su rama: `desarrollo-<nombre>` (por ejemplo, `desarrollo-kelly`). Para una funcionalidad concreta, puedes crear `feature/<hu>-<descripcion>` desde tu rama.
- Integra seguido (al menos una vez por semana) para que `main` esté siempre lista para desplegar.
- Nadie aprueba su propio pull request (separación de responsabilidades).

## Mensajes de commit

`tipo(alcance): descripción`, por ejemplo `feat(traslados): ejecutar traslado (RF-24)`, `fix(auth): ...`, `test(seguridad): ...`, `docs: ...`.

## Antes de abrir un pull request

```bash
cd backend && npm run lint && npm test      # requiere MongoDB local (MONGODB_URI_TEST)
cd ../frontend && npm run build
```

Completa la lista de verificación de seguridad de la plantilla del pull request.

## Tablero

Los requerimientos (RF-01 a RF-25, RNF-01 a RNF-25) y las historias de usuario por rol del Trabajo Parcial (Anexo D) están como *issues* en GitHub Projects, con las columnas Pendiente → En progreso → En revisión → Hecho.
