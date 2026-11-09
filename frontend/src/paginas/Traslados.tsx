import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, fecha } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Distintivo, Mensaje, Paginacion, Tarjeta, type Tono } from '../componentes/Comunes';
import type { EstadoSolicitud, Paginado, SolicitudResumen } from '../tipos';

export const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  EVALUADA: 'Por decidir', APROBADA: 'Aprobada · por ejecutar', RECHAZADA: 'Rechazada', EJECUTADA: 'Ejecutada',
};
export const TONO_ESTADO: Record<EstadoSolicitud, Tono> = { EVALUADA: 'aviso', APROBADA: 'info', RECHAZADA: 'peligro', EJECUTADA: 'ok' };

export function Traslados() {
  const { usuario } = useAuth();
  const [pagina, setPagina] = useState(1);
  const inicial = usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? 'APROBADA' : usuario?.rol === 'ADMIN_CENTRAL' ? 'EVALUADA' : '';
  const [estado, setEstado] = useState(inicial);
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['traslados', estado, busqueda, pagina],
    queryFn: () => api<Paginado<SolicitudResumen>>('/api/traslados', { params: { estado, busqueda, pagina, porPagina: 20 } }),
  });
  const descripcion = {
    ADMIN_CENTRAL: 'Solicitudes evaluadas por el motor que esperan su decisión. No puede decidir las que usted registró.',
    RESPONSABLE_REGIONAL: 'Solicitudes de los establecimientos de su oficina regional. Para iniciar una, abra la ficha del interno.',
    DIRECTOR_ESTABLECIMIENTO: 'Traslados aprobados que involucran a su establecimiento: registre la ejecución cuando el interno sea trasladado.',
    AUDITOR: 'Consulta de todas las solicitudes y de su trazabilidad.',
  }[usuario!.rol];

  return (
    <>
      <CabeceraPagina titulo="Traslados" descripcion={descripcion} />
      <Tarjeta titulo="Filtros">
        <div className="filtros">
          <Campo id="estado" etiqueta="Estado">
            <select id="estado" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {(Object.keys(ETIQUETA_ESTADO) as EstadoSolicitud[]).map((k) => <option key={k} value={k}>{ETIQUETA_ESTADO[k]}</option>)}
            </select>
          </Campo>
          <Campo id="buscar" etiqueta="Código de solicitud o de interno">
            <input id="buscar" value={busqueda} maxLength={30} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} placeholder="TR-2026-0001 o INT-000123" />
          </Campo>
        </div>
      </Tarjeta>
      <div style={{ marginTop: '1rem' }}>
        <Tarjeta>
          {isLoading ? <Cargando /> : error ? <Mensaje tipo="error">{(error as Error).message}</Mensaje> : data!.datos.length === 0 ? <div className="vacio">No hay solicitudes con estos filtros.</div> : (
            <>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead><tr><th>Solicitud</th><th>Interno</th><th>Origen</th><th>Destino</th><th>Causal</th><th>Estado</th><th className="tabla__num">Puntaje</th><th>Solicitante</th></tr></thead>
                  <tbody>
                    {data!.datos.map((s) => (
                      <tr key={s.id}>
                        <td><Link to={`/traslados/${s.id}`} className="tabla__nombre">{s.codigo}</Link><span className="tabla__sub">{fecha(s.solicitadaEn)}</span></td>
                        <td><Link to={`/internos/${s.internoId}`}>{s.internoId}</Link></td>
                        <td>{s.origen}</td>
                        <td>{s.destino ?? <span style={{ color: 'var(--texto-tenue)' }}>Recomendado: {s.destinoRecomendado ?? 'sin elegibles'}</span>}</td>
                        <td>{s.causalLabel}</td>
                        <td><Distintivo tono={TONO_ESTADO[s.estado]}>{ETIQUETA_ESTADO[s.estado]}</Distintivo></td>
                        <td className="tabla__num">{s.puntajeRecomendado?.toFixed(3) ?? '-'}</td>
                        <td>{s.solicitante}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion pagina={pagina} porPagina={20} total={data!.total} alCambiar={setPagina} />
            </>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
