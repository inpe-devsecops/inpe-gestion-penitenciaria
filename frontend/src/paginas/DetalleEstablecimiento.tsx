import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, corte, etiqueta, mensajeError, numero, porcentaje } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Definicion, Distintivo, ETIQUETA_NIVEL, Kpi, Mensaje, Modal, Tarjeta, TONO_NIVEL, tonoHacinamiento } from '../componentes/Comunes';
import type { Alerta, Establecimiento, Paginado, Proyeccion, PuntoSerie } from '../tipos';
import { FormEstablecimiento } from '../componentes/FormEstablecimiento';
import { ESTILO_TOOLTIP } from './Panel';
import { TextoProyeccion } from './Proyecciones';

export function DetalleEstablecimiento() {
  const { id = '' } = useParams();
  const { usuario } = useAuth();
  const [editando, setEditando] = useState(false);
  const [editandoAtributos, setEditandoAtributos] = useState(false);
  const est = useQuery({ queryKey: ['establecimiento', id], queryFn: () => api<Establecimiento>(`/api/establecimientos/${id}`) });
  const serie = useQuery({ queryKey: ['serie', id], queryFn: () => api<PuntoSerie[]>(`/api/establecimientos/${id}/serie`), enabled: est.isSuccess });
  const proy = useQuery({ queryKey: ['proyeccion', id], queryFn: () => api<Proyeccion>(`/api/establecimientos/${id}/proyeccion`), enabled: est.isSuccess });
  const alertas = useQuery({ queryKey: ['alertas', 'est', id], queryFn: () => api<Paginado<Alerta>>('/api/alertas', { params: { establecimientoId: id } }), enabled: est.isSuccess });

  if (est.isLoading) return <Cargando />;
  if (est.error || !est.data) return <Mensaje tipo="error">{mensajeError(est.error)}</Mensaje>;
  const e = est.data;
  const puedeEditar = usuario?.rol === 'ADMIN_CENTRAL' || (usuario?.rol === 'DIRECTOR_ESTABLECIMIENTO' && usuario.establecimientoId === e.id);
  const critico = proy.data?.poblacionCritica;

  return (
    <>
      <CabeceraPagina
        titulo={e.nombre}
        descripcion={<>{e.id} · Oficina regional {e.oficina} · {e.departamento} · <Link to={`/internos?establecimientoId=${e.id}`}>ver fichas de internos</Link></>}
        acciones={<>
          {usuario?.rol === 'ADMIN_CENTRAL' && <button type="button" className="boton" onClick={() => setEditandoAtributos(true)}>Editar atributos</button>}
          {puedeEditar && <button type="button" className="boton boton--primario" onClick={() => setEditando(true)}>Actualizar ocupación</button>}
        </>}
      />
      <div className="rejilla rejilla--kpis" style={{ marginBottom: '1rem' }}>
        <Kpi etiqueta="Hacinamiento" valor={porcentaje(e.hacinamientoPct)} detalle={e.nivel ? `Nivel ${ETIQUETA_NIVEL[e.nivel]}` : 'Bajo el umbral de atención'} tono={tonoHacinamiento(e.hacinamientoPct)} />
        <Kpi etiqueta="Población" valor={numero(e.poblacion)} detalle={`${numero(e.sobrepoblacion)} sobre la capacidad`} />
        <Kpi etiqueta="Capacidad oficial" valor={numero(e.capacidad)} detalle={`${numero(e.cupoLibre)} plazas libres`} />
        <Kpi etiqueta="Alertas vigentes" valor={numero(alertas.data?.total ?? 0)} tono={(alertas.data?.total ?? 0) > 0 ? 'peligro' : 'ok'} />
      </div>
      <div className="rejilla rejilla--dos" style={{ marginBottom: '1rem' }}>
        <Tarjeta titulo="Evolución de la población" nota={critico ? `La línea discontinua es el nivel crítico (${numero(critico)} internos)` : undefined}>
          {serie.data && (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={serie.data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                  <XAxis dataKey="corte" tickFormatter={corte} tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                  <YAxis domain={[0, (max: number) => Math.max(max, critico ?? 0) * 1.05]} tickFormatter={(v: number) => numero(Math.round(v))} tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                  <Tooltip {...ESTILO_TOOLTIP} labelFormatter={(c: string) => corte(c)} formatter={(v: number, n: string) => [numero(v), n === 'poblacion' ? 'Población' : 'Capacidad']} />
                  <Line type="monotone" dataKey="poblacion" stroke="#2f81f7" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="stepAfter" dataKey="capacidad" stroke="#3fb950" strokeWidth={1.5} dot={false} />
                  {critico && <ReferenceLine y={critico} stroke="#db61a2" strokeDasharray="6 4" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tarjeta>
        <Tarjeta titulo="Proyección de saturación" nota="Recta por mínimos cuadrados (RF-10)">
          {proy.data ? <TextoProyeccion p={proy.data} /> : <Cargando />}
        </Tarjeta>
      </div>
      <div className="rejilla rejilla--dos">
        <Tarjeta titulo="Atributos usados por el motor de recomendación">
          <div className="definiciones">
            <Definicion etiqueta="Techo de seguridad">{e.techoSeguridad}</Definicion>
            <Definicion etiqueta="Población que alberga">{etiqueta(e.generoPoblacion)}</Definicion>
            <Definicion etiqueta="Regímenes admitidos">{e.regimenesAdmitidos.map(etiqueta).join(', ')}</Definicion>
            <Definicion etiqueta="Programas por fase">{e.fasesTratamiento.map(etiqueta).join(', ')}</Definicion>
            <Definicion etiqueta="Perfiles de alto riesgo">{Math.round(e.proporcionAltoRiesgo * 100)} %</Definicion>
            <Definicion etiqueta="Coordenadas">{e.latitud.toFixed(3)}, {e.longitud.toFixed(3)}</Definicion>
          </div>
          <p className="campo__ayuda" style={{ marginTop: '0.75rem' }}>Capacidad y población son cifras oficiales del INPE; los demás atributos son estimaciones del equipo, editables por el administrador central.</p>
        </Tarjeta>
        <Tarjeta titulo="Alertas vigentes">
          {alertas.data?.datos.length ? alertas.data.datos.map((a) => (
            <div key={a.id} style={{ marginBottom: '0.5rem' }}>
              <Distintivo tono={a.severidad === 'PROSPECTIVA' ? 'info' : TONO_NIVEL[a.severidad]}>{etiqueta(a.severidad)}</Distintivo> {a.mensaje}
            </div>
          )) : <div className="vacio">Sin alertas vigentes.</div>}
        </Tarjeta>
      </div>
      {editando && <ModalOcupacion e={e} alCerrar={() => setEditando(false)} />}
      {editandoAtributos && <FormEstablecimiento actual={e} alCerrar={() => setEditandoAtributos(false)} />}
    </>
  );
}

function ModalOcupacion({ e, alCerrar }: { e: Establecimiento; alCerrar: () => void }) {
  const cliente = useQueryClient();
  const [poblacion, setPoblacion] = useState(String(e.poblacion));
  const [capacidad, setCapacidad] = useState(String(e.capacidad));
  const [motivo, setMotivo] = useState('');
  const guardar = useMutation({
    mutationFn: () => api(`/api/establecimientos/${e.id}/ocupacion`, { metodo: 'PATCH', cuerpo: { poblacion: Number(poblacion), capacidad: Number(capacidad), motivo } }),
    onSuccess: () => { void cliente.invalidateQueries(); alCerrar(); },
  });
  return (
    <Modal titulo={`Actualizar ocupación · ${e.nombre}`} alCerrar={alCerrar} pie={<>
      <button type="button" className="boton" onClick={alCerrar}>Cancelar</button>
      <button type="button" className="boton boton--primario" disabled={motivo.trim().length < 10 || guardar.isPending} onClick={() => guardar.mutate()}>Guardar</button>
    </>}>
      {guardar.error && <Mensaje tipo="error">{mensajeError(guardar.error)}</Mensaje>}
      <div className="rejilla rejilla--dos">
        <Campo id="pob" etiqueta="Población vigente"><input id="pob" type="number" min={0} value={poblacion} onChange={(x) => setPoblacion(x.target.value)} /></Campo>
        <Campo id="cap" etiqueta="Capacidad oficial"><input id="cap" type="number" min={1} value={capacidad} onChange={(x) => setCapacidad(x.target.value)} /></Campo>
      </div>
      <Campo id="motivo" etiqueta="Motivo (queda en la auditoría con el valor anterior y el nuevo)">
        <textarea id="motivo" value={motivo} onChange={(x) => setMotivo(x.target.value)} placeholder="Ej.: reporte mensual de población de octubre" />
      </Campo>
    </Modal>
  );
}
