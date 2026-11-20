import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { obtenerNavegacion, type EnlaceNavegacion } from '../auth/navegacion';
import { MarcaSistema } from './MarcaSistema';
import type { Panel } from '../tipos';

// Marco de la aplicación: el menú muestra solo lo que el rol puede usar (RNF-22); la API valida igual cada petición.
export function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const { data: panel } = useQuery({ queryKey: ['panel'], queryFn: () => api<Panel>('/api/panel'), refetchInterval: 60_000 });
  const navegacion = usuario ? obtenerNavegacion(usuario.rol) : { operacion: [], analisis: [] };

  const contexto = usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? `Establecimiento: ${usuario.establecimiento ?? '-'}`
    : usuario?.rol === 'RESPONSABLE_REGIONAL' ? `Oficina regional ${usuario.oficina ?? '-'}`
      : usuario?.rol === 'AUDITOR' ? 'Alcance nacional · solo lectura' : 'Alcance nacional · 69 establecimientos';

  const valorContador = (e: EnlaceNavegacion) => {
    if (e.contador === 'alertas') return panel?.alertasVigentes;
    if (e.contador === 'traslados') {
      return usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? panel?.aprobadasPorEjecutar : panel?.solicitudesPendientes;
    }
    return undefined;
  };

  const enlace = (e: EnlaceNavegacion) => {
    const contador = valorContador(e);
    return (
      <NavLink key={e.a} to={e.a} className={({ isActive }) => `menu__enlace ${isActive ? 'menu__enlace--activo' : ''}`}>
        <span className="menu__icono" aria-hidden="true">{e.icono}</span>
        {e.texto}
        {contador !== undefined && contador > 0 && <span className="menu__contador">{contador}</span>}
      </NavLink>
    );
  };

  return (
    <div className="aplicacion">
      <MarcaSistema />
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
      <nav className="menu" aria-label="Navegación principal">
        <div className="menu__separador">Operación</div>
        {navegacion.operacion.map(enlace)}
        <div className="menu__separador">Análisis y control</div>
        {navegacion.analisis.map(enlace)}
      </nav>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
