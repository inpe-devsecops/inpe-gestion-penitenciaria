import type { Rol } from '../tipos';

export interface EnlaceNavegacion {
  a: string;
  texto: string;
  icono: string;
  roles: readonly Rol[];
  contador?: 'alertas' | 'traslados';
}

const TODOS_LOS_ROLES: readonly Rol[] = ['ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO', 'AUDITOR'];

const OPERACION: readonly EnlaceNavegacion[] = [
  { a: '/panel', texto: 'Panel', icono: '▦', roles: TODOS_LOS_ROLES },
  { a: '/establecimientos', texto: 'Establecimientos', icono: '▤', roles: TODOS_LOS_ROLES },
  { a: '/internos', texto: 'Fichas', icono: '☰', roles: ['ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO'] },
  { a: '/traslados', texto: 'Traslados', icono: '⇄', roles: TODOS_LOS_ROLES, contador: 'traslados' },
  { a: '/alertas', texto: 'Alertas', icono: '⚑', roles: TODOS_LOS_ROLES, contador: 'alertas' },
];

const ANALISIS: readonly EnlaceNavegacion[] = [
  { a: '/proyecciones', texto: 'Proyecciones', icono: '◪', roles: TODOS_LOS_ROLES },
  { a: '/parametros', texto: 'Parámetros', icono: '⚙', roles: ['ADMIN_CENTRAL', 'AUDITOR'] },
  { a: '/auditoria', texto: 'Auditoría', icono: '⌕', roles: ['ADMIN_CENTRAL', 'AUDITOR'] },
  // Segundo factor TOTP (#23): solo el rol de mayor privilegio lo configura
  { a: '/seguridad', texto: 'Seguridad', icono: '⚿', roles: ['ADMIN_CENTRAL'] },
];

export function obtenerNavegacion(rol: Rol) {
  return {
    operacion: OPERACION.filter((enlace) => enlace.roles.includes(rol)),
    analisis: ANALISIS.filter((enlace) => enlace.roles.includes(rol)),
  };
}
