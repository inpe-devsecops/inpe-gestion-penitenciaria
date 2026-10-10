import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, etiqueta, fechaHora, mensajeError } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Distintivo, Kpi, Mensaje, Paginacion, Tarjeta, TONO_NIVEL, type Tono } from '../componentes/Comunes';
import type { Alerta, Paginado } from '../tipos';

const tono = (s: Alerta['severidad']): Tono => (s === 'PROSPECTIVA' ? 'info' : TONO_NIVEL[s]);

// Alertas por umbral (RF-07, RF-08) y prospectivas (≤ 6 meses al nivel crítico); una sola vigente por condición (RF-09)
export function Alertas() {
  const { tieneRol } = useAuth();
  const cliente = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [f, setF] = useState({ soloVigentes: 'true', severidad: '', condicion: '' });
  const { data, isLoading, error } = useQuery({
    queryKey: ['alertas', f, pagina],
    queryFn: () => api<Paginado<Alerta>>('/api/alertas', { params: { ...f, pagina, porPagina: 25 } }),
  });
  const evaluar = useMutation({
    mutationFn: () => api<{ creadas: number; actualizadas: number; resueltas: number }>('/api/alertas/evaluar', { metodo: 'POST' }),
    onSuccess: () => void cliente.invalidateQueries(),
  });
  const reconocer = useMutation({
    mutationFn: (id: string) => api(`/api/alertas/${id}`, { metodo: 'PATCH', cuerpo: { estado: 'RECONOCIDA' } }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['alertas'] }),
  });
  const puedeReconocer = tieneRol('ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO');

  return (
    <>
      <CabeceraPagina titulo="Alertas" descripcion="Se generan al superar un umbral configurable y se resuelven solas cuando el indicador baja. El evaluador corre cada 15 minutos y tras cada cambio de ocupación."
        acciones={tieneRol('ADMIN_CENTRAL') && <button type="button" className="boton" disabled={evaluar.isPending} onClick={() => evaluar.mutate()}>Evaluar umbrales ahora</button>} />
      {evaluar.data && <Mensaje tipo="ok">Evaluación terminada: {evaluar.data.creadas} creada(s), {evaluar.data.actualizadas} con cambio de severidad, {evaluar.data.resueltas} resuelta(s).</Mensaje>}
      {(evaluar.error || reconocer.error) && <Mensaje tipo="error">{mensajeError(evaluar.error ?? reconocer.error)}</Mensaje>}
      <div className="rejilla rejilla--kpis" style={{ marginBottom: '1rem' }}>
        <Kpi etiqueta="Alertas listadas" valor={data?.total ?? '-'} tono={(data?.total ?? 0) > 0 ? 'peligro' : 'ok'} />
      </div>
      <Tarjeta titulo="Filtros">
        <div className="filtros">
          <Campo id="vig" etiqueta="Estado">
            <select id="vig" value={f.soloVigentes} onChange={(e) => { setF({ ...f, soloVigentes: e.target.value }); setPagina(1); }}>
              <option value="true">Vigentes</option><option value="false">Todas (incluye resueltas)</option>
            </select>
          </Campo>
          <Campo id="sev" etiqueta="Severidad">
            <select id="sev" value={f.severidad} onChange={(e) => { setF({ ...f, severidad: e.target.value }); setPagina(1); }}>
              <option value="">Todas</option><option value="CRITICO">Crítico</option><option value="SEVERO">Severo</option><option value="ATENCION">Atención</option><option value="PROSPECTIVA">Prospectiva</option>
            </select>
          </Campo>
        </div>
      </Tarjeta>
      <div style={{ marginTop: '1rem' }}>
        <Tarjeta>
          {isLoading ? <Cargando /> : error ? <Mensaje tipo="error">{(error as Error).message}</Mensaje> : data!.datos.length === 0 ? <div className="vacio">Sin alertas con estos filtros.</div> : (
            <>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead><tr><th>Severidad</th><th>Establecimiento</th><th>Detalle</th><th>Estado</th><th>Actualizada</th>{puedeReconocer && <th />}</tr></thead>
                  <tbody>
                    {data!.datos.map((a) => (
                      <tr key={a.id}>
                        <td><Distintivo tono={tono(a.severidad)}>{etiqueta(a.severidad)}</Distintivo></td>
                        <td><Link to={`/establecimientos/${a.establecimientoId}`} className="tabla__nombre">{a.establecimiento}</Link></td>
                        <td>{a.mensaje}</td>
                        <td>{etiqueta(a.estado)}</td>
                        <td>{fechaHora(a.actualizadaEn)}</td>
                        {puedeReconocer && <td>{a.estado === 'ACTIVA' && <button type="button" className="boton boton--chico" disabled={reconocer.isPending} onClick={() => reconocer.mutate(a.id)}>Reconocer</button>}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion pagina={pagina} porPagina={25} total={data!.total} alCambiar={setPagina} />
            </>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
