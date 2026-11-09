import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import type { Panel, Rol } from '../tipos';

interface Enlace {
  a: string;
  texto: string;
  icono: string;
  roles?: Rol[];
  contador?: number;
}

// Marco de la aplicación: el menú muestra solo lo que el rol puede usar (RNF-22); la API valida igual cada petición.
export function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const { data: panel } = useQuery({ queryKey: ['panel'], queryFn: () => api<Panel>('/api/panel'), refetchInterval: 60_000 });

  const operacion: Enlace[] = [
    { a: '/panel', texto: 'Panel', icono: '▦' },
    { a: '/establecimientos', texto: 'Establecimientos', icono: '▤' },
    { a: '/internos', texto: 'Internos', icono: '☰' },
    { a: '/traslados', texto: 'Traslados', icono: '⇄',
      contador: usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? panel?.aprobadasPorEjecutar : panel?.solicitudesPendientes },
    { a: '/alertas', texto: 'Alertas', icono: '⚑', contador: panel?.alertasVigentes },
  ];
  const analisis: Enlace[] = [
    { a: '/proyecciones', texto: 'Proyecciones', icono: '◪' },
    { a: '/parametros', texto: 'Parámetros', icono: '⚙', roles: ['ADMIN_CENTRAL', 'AUDITOR'] },
    { a: '/auditoria', texto: 'Auditoría', icono: '⌕', roles: ['ADMIN_CENTRAL', 'AUDITOR'] },
  ];
  const visibles = (l: Enlace[]) => l.filter((e) => !e.roles || (usuario && e.roles.includes(usuario.rol)));

  const contexto = usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? `Establecimiento: ${usuario.establecimiento ?? '-'}`
    : usuario?.rol === 'RESPONSABLE_REGIONAL' ? `Oficina regional ${usuario.oficina ?? '-'}`
      : usuario?.rol === 'AUDITOR' ? 'Alcance nacional · solo lectura' : 'Alcance nacional · 69 establecimientos';

  const enlace = (e: Enlace) => (
    <NavLink key={e.a} to={e.a} className={({ isActive }) => `menu__enlace ${isActive ? 'menu__enlace--activo' : ''}`}>
      <span className="menu__icono" aria-hidden="true">{e.icono}</span>
      {e.texto}
      {e.contador !== undefined && e.contador > 0 && <span className="menu__contador">{e.contador}</span>}
    </NavLink>
  );

  return (
    <div className="aplicacion">
      <div className="marca">
        <span className="marca__sigla">INPE</span>
        <span>DevSecOps</span>
      </div>
      <header className="encabezado">
        <div className="encabezado__titulo">
          <strong>Gestión y análisis de la población penitenciaria</strong>
          <span className="encabezado__contexto">{contexto}{panel ? ` · corte ${panel.corte}` : ''}</span>
        </div>
        <div className="encabezado__usuario">
          <div className="usuario">
            <span className="usuario__nombre">{usuario?.nombreCompleto}</span>
            <span className="usuario__rol">{usuario?.rolLabel}</span>
          </div>
          <button type="button" className="boton boton--chico" onClick={() => void cerrarSesion().then(() => navegar('/login', { replace: true }))}>Salir</button>
        </div>
      </header>
      <nav className="menu">
        {visibles(operacion).map(enlace)}
        <div className="menu__separador">Análisis y control</div>
        {visibles(analisis).map(enlace)}
      </nav>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
