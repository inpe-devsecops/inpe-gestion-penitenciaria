import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, corte, numero, porcentaje } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Cargando, ETIQUETA_NIVEL, Hacinamiento, Kpi, Mensaje, Tarjeta, tonoHacinamiento, type Tono } from '../componentes/Comunes';
import type { Establecimiento, Panel } from '../tipos';

export const COLOR_TONO: Record<Tono, string> = {
  ok: '#3fb950', aviso: '#d29922', peligro: '#f85149', critico: '#db61a2', info: '#58a6ff', neutro: '#8b949e',
};
export const ESTILO_TOOLTIP = { contentStyle: { background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 12 }, labelStyle: { color: '#e6edf3' } };
const EJE = { tick: { fill: '#8b949e', fontSize: 11 }, stroke: '#30363d' };

function TablaEstablecimientos({ filas, titulo, nota, vacio, umbrales }: { filas: Establecimiento[]; titulo: string; nota: string; vacio: string; umbrales: Panel['umbrales'] }) {
  return (
    <Tarjeta titulo={titulo} nota={nota}>
      {filas.length === 0 ? <div className="vacio">{vacio}</div> : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Establecimiento</th><th className="tabla__num">Población</th><th className="tabla__num">Capacidad</th><th className="tabla__num">Cupo</th><th>Hacinamiento</th></tr></thead>
            <tbody>
              {filas.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/establecimientos/${e.id}`} className="tabla__nombre">{e.nombre}</Link><span className="tabla__sub">{e.oficina} · techo {e.techoSeguridad}</span></td>
                  <td className="tabla__num">{numero(e.poblacion)}</td>
                  <td className="tabla__num">{numero(e.capacidad)}</td>
                  <td className="tabla__num">{numero(e.cupoLibre)}</td>
                  <td><Hacinamiento pct={e.hacinamientoPct} umbrales={umbrales} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

// Panel de indicadores (RF-04, RF-05, RF-06). Nacional para el central y el auditor, regional para el
// responsable regional y del propio establecimiento para el director: lo decide la API según el ámbito.
export function PanelPrincipal() {
  const { usuario } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['panel'], queryFn: () => api<Panel>('/api/panel') });
  if (isLoading) return <Cargando texto="Calculando indicadores de ocupación..." />;
  if (error || !data) return <Mensaje tipo="error">{(error as Error)?.message ?? 'Sin datos'}</Mensaje>;

  const { totales, umbrales } = data;
  const ambito = usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? usuario.establecimiento ?? 'su establecimiento'
    : usuario?.rol === 'RESPONSABLE_REGIONAL' ? `la oficina regional ${usuario.oficina}` : 'el país';
  const grafico = data.porOficina.map((o) => ({ oficina: o.oficina, hacinamiento: o.hacinamientoPct, tono: tonoHacinamiento(o.hacinamientoPct, umbrales) }));

  return (
    <>
      <CabeceraPagina
        titulo={usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? `Panel de ${ambito}` : `Ocupación penitenciaria de ${ambito}`}
        descripcion={`Corte vigente ${corte(data.corte)} (Informe Estadístico del INPE, Anexo 06). Hacinamiento = (población − capacidad) ÷ capacidad × 100. Niveles: Atención ≥ ${umbrales.atencion} %, Severo ≥ ${umbrales.severo} %, Crítico ≥ ${umbrales.critico} %.`}
      />
      <div className="rejilla rejilla--kpis" style={{ marginBottom: '1rem' }}>
        <Kpi etiqueta="Índice de hacinamiento" valor={porcentaje(totales.hacinamientoPct)} detalle={`${numero(totales.sobrepoblacion)} personas sin plaza`} tono={tonoHacinamiento(totales.hacinamientoPct, umbrales)} />
        <Kpi etiqueta="Población penitenciaria" valor={numero(totales.poblacion)} detalle={`${numero(totales.cupoLibre)} plazas libres`} />
        <Kpi etiqueta="Capacidad de albergue" valor={numero(totales.capacidad)} detalle={`${totales.establecimientos} establecimiento(s)`} />
        <Kpi etiqueta="Establecimientos hacinados" valor={`${totales.hacinados} de ${totales.establecimientos}`}
          detalle={`${totales.porNivel.CRITICO} crítico(s) · ${totales.porNivel.SEVERO} severo(s) · ${totales.porNivel.ATENCION} en atención`} tono={totales.hacinados > 0 ? 'peligro' : 'ok'} />
        <Kpi etiqueta="Alertas vigentes" valor={numero(data.alertasVigentes)} detalle="Por umbral y prospectivas" tono={data.alertasVigentes > 0 ? 'peligro' : 'ok'} />
        <Kpi etiqueta={usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? 'Traslados por ejecutar' : 'Solicitudes por decidir'}
          valor={numero(usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' ? data.aprobadasPorEjecutar : data.solicitudesPendientes)} tono="info" />
      </div>

      <div className="rejilla rejilla--dos" style={{ marginBottom: '1rem' }}>
        <Tarjeta titulo="Evolución del hacinamiento" nota="Cortes mensuales; enero 2025 y enero 2026 son oficiales, los intermedios se interpolan">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis dataKey="corte" tickFormatter={corte} {...EJE} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v} %`} {...EJE} />
                <Tooltip {...ESTILO_TOOLTIP} labelFormatter={(c: string) => corte(c)} formatter={(v: number) => [`${v.toFixed(1)} %`, 'Hacinamiento']} />
                <Line type="monotone" dataKey="hacinamientoPct" stroke="#2f81f7" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        {grafico.length > 1 ? (
          <Tarjeta titulo="Hacinamiento por oficina regional" nota="Comparable con el Anexo 07 del INPE">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={grafico} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                  <XAxis dataKey="oficina" {...EJE} />
                  <YAxis tickFormatter={(v: number) => `${v} %`} {...EJE} />
                  <Tooltip {...ESTILO_TOOLTIP} formatter={(v: number) => [`${v.toFixed(1)} %`, 'Hacinamiento']} />
                  <Bar dataKey="hacinamiento" radius={[4, 4, 0, 0]}>
                    {grafico.map((d) => <Cell key={d.oficina} fill={COLOR_TONO[d.tono]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Distribución por nivel">
            <div className="definiciones">
              {(['CRITICO', 'SEVERO', 'ATENCION'] as const).map((n) => (
                <div key={n}><div className="definicion__etiqueta">{ETIQUETA_NIVEL[n]}</div><div className="definicion__valor">{totales.porNivel[n]}</div></div>
              ))}
              <div><div className="definicion__etiqueta">Sin hacinamiento</div><div className="definicion__valor">{totales.porNivel.SIN_HACINAMIENTO}</div></div>
            </div>
          </Tarjeta>
        )}
      </div>

      <div className="rejilla rejilla--dos" style={{ marginBottom: '1rem' }}>
        <TablaEstablecimientos filas={data.masHacinados} titulo="Establecimientos más hacinados" nota="Prioridad para evaluar traslados" vacio="Sin establecimientos en el ámbito." umbrales={umbrales} />
        <TablaEstablecimientos filas={data.conCupo} titulo="Establecimientos con cupo libre" nota="Destinos posibles para el motor" vacio="No hay plazas libres en el ámbito." umbrales={umbrales} />
      </div>

      {data.porOficina.length > 1 && (
        <Tarjeta titulo="Detalle por oficina regional">
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Oficina regional</th><th className="tabla__num">Establecimientos</th><th className="tabla__num">Hacinados</th><th className="tabla__num">Capacidad</th><th className="tabla__num">Población</th><th className="tabla__num">Sobrepoblación</th><th>Hacinamiento</th></tr></thead>
              <tbody>
                {data.porOficina.map((o) => (
                  <tr key={o.oficinaId}>
                    <td className="tabla__nombre">{o.oficina}</td>
                    <td className="tabla__num">{o.establecimientos}</td>
                    <td className="tabla__num">{o.hacinados}</td>
                    <td className="tabla__num">{numero(o.capacidad)}</td>
                    <td className="tabla__num">{numero(o.poblacion)}</td>
                    <td className="tabla__num">{numero(o.sobrepoblacion)}</td>
                    <td><Hacinamiento pct={o.hacinamientoPct} umbrales={umbrales} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td>Total</td><td className="tabla__num">{totales.establecimientos}</td><td className="tabla__num">{totales.hacinados}</td>
                  <td className="tabla__num">{numero(totales.capacidad)}</td><td className="tabla__num">{numero(totales.poblacion)}</td>
                  <td className="tabla__num">{numero(totales.sobrepoblacion)}</td><td><Hacinamiento pct={totales.hacinamientoPct} umbrales={umbrales} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="campo__ayuda" style={{ marginTop: '0.75rem' }}>Panel generado el {new Date(data.generadoEn).toLocaleString('es-PE')}.</p>
        </Tarjeta>
      )}
    </>
  );
}
