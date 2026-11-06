import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, etiqueta, fechaHora, mensajeError } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Definicion, Distintivo, Mensaje, Tarjeta } from '../componentes/Comunes';
import { NOMBRE_FACTOR, RankingDestinos } from '../componentes/Evaluacion';
import type { ClaveFactor, Paginado, RegistroAuditoria, SolicitudDetalle } from '../tipos';
import { ETIQUETA_ESTADO, TONO_ESTADO } from './Traslados';

export function DetalleTraslado() {
  const { id = '' } = useParams();
  const { tieneRol } = useAuth();
  const { data: s, isLoading, error } = useQuery({ queryKey: ['traslado', id], queryFn: () => api<SolicitudDetalle>(`/api/traslados/${id}`) });
  const traza = useQuery({
    queryKey: ['trazabilidad', id],
    queryFn: () => api<Paginado<RegistroAuditoria>>('/api/auditoria', { params: { entidad: 'solicitudes_traslado', entidadId: id, porPagina: 50 } }),
    enabled: tieneRol('ADMIN_CENTRAL', 'AUDITOR'),
  });
  if (isLoading) return <Cargando />;
  if (error || !s) return <Mensaje tipo="error">{mensajeError(error)}</Mensaje>;

  return (
    <>
      <CabeceraPagina titulo={`Solicitud ${s.codigo}`} descripcion={<>Interno <Link to={`/internos/${s.internoId}`}>{s.internoId}</Link> · {s.origen} · <Distintivo tono={TONO_ESTADO[s.estado]}>{ETIQUETA_ESTADO[s.estado]}</Distintivo></>} />
      <div className="rejilla rejilla--dos" style={{ marginBottom: '1rem' }}>
        <Tarjeta titulo="1. Solicitud">
          <div className="definiciones">
            <Definicion etiqueta="Causal (art. 159)">{s.causalLabel}</Definicion>
            <Definicion etiqueta="Solicitada por">{s.solicitante}</Definicion>
            <Definicion etiqueta="Fecha">{fechaHora(s.solicitadaEn)}</Definicion>
            {s.interno && <Definicion etiqueta="Interno">{etiqueta(s.interno.clasificacion)} · fase {etiqueta(s.interno.fase)} · riesgo {s.interno.nivelRiesgo}</Definicion>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem', marginBottom: 0 }}><strong>Fundamento:</strong> {s.fundamento}</p>
        </Tarjeta>
        <Tarjeta titulo="3 y 4. Decisión y ejecución">
          {s.decision ? (
            <>
              <div className="definiciones">
                <Definicion etiqueta="Resultado"><Distintivo tono={s.decision.resultado === 'APROBADA' ? 'ok' : 'peligro'}>{etiqueta(s.decision.resultado)}</Distintivo></Definicion>
                <Definicion etiqueta="Decidida por">{s.decision.decididoPor}</Definicion>
                <Definicion etiqueta="Fecha">{fechaHora(s.decision.decididaEn)}</Definicion>
                {s.decision.destino && <Definicion etiqueta="Destino">{s.decision.destino}{s.decision.seApartaDeRecomendacion && ' (distinto al recomendado)'}</Definicion>}
              </div>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}><strong>Fundamento de la decisión:</strong> {s.decision.fundamento}</p>
            </>
          ) : <p className="campo__ayuda">Pendiente de decisión del administrador central.</p>}
          {s.ejecutadaEn && <Mensaje tipo="ok">Ejecutada por {s.ejecutadoPor} el {fechaHora(s.ejecutadaEn)}: el interno está en {s.destino}.</Mensaje>}
        </Tarjeta>
      </div>

      <Decidir s={s} />
      <Ejecutar s={s} />

      <h2 style={{ margin: '1.25rem 0 0.5rem' }}>2. Evaluación del motor</h2>
      <p className="campo__ayuda">
        Pesos vigentes al evaluar: {(Object.keys(NOMBRE_FACTOR) as ClaveFactor[]).map((k) => `${NOMBRE_FACTOR[k]} ${s.pesos[k]}`).join(' · ')}.
        Se conserva el resultado completo, incluidos los descartes (RF-19).
      </p>
      <RankingDestinos evaluaciones={s.evaluaciones} />

      {traza.data && (
        <div style={{ marginTop: '1rem' }}>
          <Tarjeta titulo="Trazabilidad" nota="Registro de auditoría de solo inserción: quién solicitó, decidió y ejecutó, y con qué valores">
            <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Resultado</th><th>Valores</th></tr></thead>
              <tbody>
                {traza.data.datos.map((r) => (
                  <tr key={r.id}>
                    <td>{fechaHora(r.fecha)}</td><td>{r.usuario ?? '-'}<span className="tabla__sub">{r.rol}</span></td><td>{etiqueta(r.accion)}</td>
                    <td><Distintivo tono={r.resultado === 'EXITO' ? 'ok' : 'peligro'}>{etiqueta(r.resultado)}</Distintivo></td>
                    <td style={{ maxWidth: 360 }}><code style={{ fontSize: '0.72rem', wordBreak: 'break-word' }}>{r.valorNuevo ? JSON.stringify(r.valorNuevo) : r.detalle}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  );
}

// Decisión del administrador central (RF-20 a RF-23)
function Decidir({ s }: { s: SolicitudDetalle }) {
  const { tieneRol } = useAuth();
  const cliente = useQueryClient();
  const [destinoId, setDestinoId] = useState<string | null>(s.destinoRecomendadoId);
  const [fundamento, setFundamento] = useState('');
  const decidir = useMutation({
    mutationFn: (accion: 'aprobar' | 'rechazar') => api(`/api/traslados/${s.id}/${accion}`, {
      metodo: 'POST', cuerpo: accion === 'aprobar' ? { destinoId: destinoId ?? undefined, fundamento } : { fundamento },
    }),
    onSuccess: () => void cliente.invalidateQueries(),
  });
  if (!tieneRol('ADMIN_CENTRAL') || s.estado !== 'EVALUADA') return null;
  if (!s.permisos.puedeDecidir) return <Mensaje tipo="info">{s.permisos.motivoNoDecidir}</Mensaje>;
  const seAparta = destinoId !== s.destinoRecomendadoId;
  const minimo = seAparta ? 40 : 20;
  return (
    <Tarjeta titulo="Decidir la solicitud" nota="Puede apartarse de la recomendación si lo fundamenta">
      {decidir.error && <Mensaje tipo="error">{mensajeError(decidir.error)}</Mensaje>}
      <div className="rejilla rejilla--dos">
        <Campo id="destino" etiqueta="Destino definitivo (solo elegibles)">
          <select id="destino" value={destinoId ?? ''} onChange={(e) => setDestinoId(e.target.value || null)}>
            {s.evaluaciones.filter((e) => e.elegible).map((e) => <option key={e.destinoId} value={e.destinoId}>#{e.posicion} {e.destino} · {e.puntaje?.toFixed(3)}</option>)}
          </select>
        </Campo>
        <Campo id="fund-decision" etiqueta={`Fundamento (mínimo ${minimo} caracteres${seAparta ? ': se aparta de la recomendación' : ''})`}>
          <textarea id="fund-decision" value={fundamento} maxLength={2000} onChange={(e) => setFundamento(e.target.value)} />
        </Campo>
      </div>
      <div className="fila-botones">
        <button type="button" className="boton boton--exito" disabled={!destinoId || fundamento.trim().length < minimo || decidir.isPending} onClick={() => decidir.mutate('aprobar')}>Aprobar</button>
        <button type="button" className="boton boton--peligro" disabled={fundamento.trim().length < 20 || decidir.isPending} onClick={() => decidir.mutate('rechazar')}>Rechazar</button>
      </div>
    </Tarjeta>
  );
}

// Ejecución por el director del establecimiento de origen o destino (RF-24)
function Ejecutar({ s }: { s: SolicitudDetalle }) {
  const { tieneRol } = useAuth();
  const cliente = useQueryClient();
  const [observacion, setObservacion] = useState('');
  const ejecutar = useMutation({
    mutationFn: () => api(`/api/traslados/${s.id}/ejecutar`, { metodo: 'POST', cuerpo: { observacion: observacion || undefined } }),
    onSuccess: () => void cliente.invalidateQueries(),
  });
  if (!tieneRol('DIRECTOR_ESTABLECIMIENTO') || s.estado !== 'APROBADA') return null;
  if (!s.permisos.puedeEjecutar) return <Mensaje tipo="info">{s.permisos.motivoNoEjecutar}</Mensaje>;
  return (
    <Tarjeta titulo="Registrar la ejecución" nota={`${s.origen} → ${s.destino}. Actualiza la ocupación de ambos establecimientos.`}>
      {ejecutar.error && <Mensaje tipo="error">{mensajeError(ejecutar.error)}</Mensaje>}
      <Campo id="obs" etiqueta="Observación (opcional)"><input id="obs" value={observacion} maxLength={500} onChange={(e) => setObservacion(e.target.value)} /></Campo>
      <button type="button" className="boton boton--primario" disabled={ejecutar.isPending} onClick={() => ejecutar.mutate()}>Confirmar ejecución</button>
    </Tarjeta>
  );
}
