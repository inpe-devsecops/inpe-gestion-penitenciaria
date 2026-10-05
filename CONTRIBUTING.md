# Cómo trabajamos

## Ramas

- `main` está protegida: no se permite *push* directo. Todo entra por pull request con **2 aprobaciones** y el pipeline en verde.
- Cada integrante trabaja en su rama: `desarrollo-<nombre>` (por ejemplo, `desarrollo-kelly`). Para una funcionalidad concreta, puedes crear `feature/<hu>-<descripcion>` desde tu rama.
- Integra seguido (al menos una vez por semana) para que `main` esté siempre lista para desplegar.
- Nadie aprueba su propio pull request (separación de responsabilidades).

## Mensajes de commit

`tipo(alcance): descripción`, por ejemplo `feat(internos): registrar egreso (HU07)`, `fix(auth): ...`, `test(seguridad): ...`, `docs: ...`.

## Antes de abrir un pull request

```bash
cd backend && npm run lint && npm test
cd ../frontend && npm run build
```

Completa la lista de verificación de seguridad de la plantilla del pull request.

## Tablero

Las historias de usuario (HU01–HU16 del informe) están como *issues* en GitHub Projects, con las columnas Pendiente → En progreso → En revisión → Hecho.
