import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, etiqueta, fecha, mensajeError } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Definicion, Distintivo, Mensaje, Modal, Tarjeta } from '../componentes/Comunes';
import { RankingDestinos } from '../componentes/Evaluacion';
import type { Catalogos, Evaluacion, InternoDetalle, SolicitudDetalle } from '../tipos';
import { TONO_ESTADO, ETIQUETA_ESTADO } from './Traslados';

export function DetalleInterno() {
  const { id = '' } = useParams();
  const { tieneRol } = useAuth();
  const [solicitando, setSolicitando] = useState(false);
  const { data: i, isLoading, error } = useQuery({ queryKey: ['interno', id], queryFn: () => api<InternoDetalle>(`/api/internos/${id}`) });
  if (isLoading) return <Cargando />;
  if (error || !i) return <Mensaje tipo="error">{mensajeError(error)}</Mensaje>;
  const enTramite = i.traslados.find((t) => t.estado === 'EVALUADA' || t.estado === 'APROBADA');
  const puedeSolicitar = tieneRol('ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL') && !enTramite;

  return (
    <>
      <CabeceraPagina titulo={`Ficha ${i.id}`} descripcion={<>Ubicado en <Link to={`/establecimientos/${i.establecimientoId}`}>{i.establecimiento}</Link>. Dato ficticio.</>}
        acciones={puedeSolicitar && <button type="button" className="boton boton--primario" onClick={() => setSolicitando(true)}>Solicitar traslado</button>} />
      {enTramite && <Mensaje tipo="info">Tiene un traslado en trámite: <Link to={`/traslados/${enTramite.id}`}>{enTramite.codigo}</Link>.</Mensaje>}
      <div className="rejilla rejilla--dos">
        <Tarjeta titulo="Ficha mínima">
          <div className="definiciones">
            <Definicion etiqueta="Sexo">{i.sexo === 'F' ? 'Mujer' : 'Hombre'}</Definicion>
            <Definicion etiqueta="Clasificación">{etiqueta(i.clasificacion)}</Definicion>
            <Definicion etiqueta="Fase de tratamiento">{etiqueta(i.faseTratamiento)}</Definicion>
            <Definicion etiqueta="Situación jurídica">{etiqueta(i.situacionJuridica)}</Definicion>
            <Definicion etiqueta="Nivel de riesgo">{i.nivelRiesgo} de 5</Definicion>
            <Definicion etiqueta="Región de procedencia">{i.regionProcedencia}</Definicion>
            <Definicion etiqueta="Fecha de ingreso">{fecha(i.fechaIngreso)}</Definicion>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Historial de traslados">
          {i.traslados.length === 0 ? <div className="vacio">Sin solicitudes registradas.</div> : (
            <div className="tabla-envoltura">
            <table className="tabla">
              <tbody>
                {i.traslados.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/traslados/${t.id}`}>{t.codigo}</Link><span className="tabla__sub">{fecha(t.solicitadaEn)}</span></td>
                    <td>{t.origen} → {t.destino ?? 'por decidir'}</td>
                    <td><Distintivo tono={TONO_ESTADO[t.estado]}>{ETIQUETA_ESTADO[t.estado]}</Distintivo></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Tarjeta>
      </div>
      {solicitando && <ModalSolicitud internoId={i.id} alCerrar={() => setSolicitando(false)} />}
    </>
  );
}

// Registro de la solicitud (RF-11 a RF-13) con vista previa del ranking del motor
function ModalSolicitud({ internoId, alCerrar }: { internoId: string; alCerrar: () => void }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const [causal, setCausal] = useState('');
  const [fundamento, setFundamento] = useState('');
  const { data: cat } = useQuery({ queryKey: ['catalogos'], queryFn: () => api<Catalogos>('/api/catalogos'), staleTime: Infinity });
  const previa = useQuery({ queryKey: ['recomendacion', internoId], queryFn: () => api<{ evaluaciones: Evaluacion[] }>(`/api/traslados/recomendacion/${internoId}`) });
  const crear = useMutation({
    mutationFn: () => api<SolicitudDetalle>('/api/traslados', { metodo: 'POST', cuerpo: { internoId, causal, fundamento } }),
    onSuccess: (s) => { void cliente.invalidateQueries(); navegar(`/traslados/${s.id}`); },
  });
  const valido = causal && fundamento.trim().length >= 20;
  return (
    <Modal titulo={`Solicitar traslado · ${internoId}`} ancho alCerrar={alCerrar} pie={<>
      <button type="button" className="boton" onClick={alCerrar}>Cancelar</button>
      <button type="button" className="boton boton--primario" disabled={!valido || crear.isPending} onClick={() => crear.mutate()}>
        {crear.isPending ? 'Registrando...' : 'Registrar solicitud'}
      </button>
    </>}>
      {crear.error && <Mensaje tipo="error">{mensajeError(crear.error)}</Mensaje>}
      <div className="rejilla rejilla--dos">
        <Campo id="causal" etiqueta="Causal (art. 159 del Reglamento)">
          <select id="causal" value={causal} onChange={(e) => setCausal(e.target.value)}>
            <option value="">Seleccione…</option>
            {cat?.causales.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
          </select>
        </Campo>
        <Campo id="fundamento" etiqueta="Fundamento (obligatorio, mínimo 20 caracteres)" ayuda="Se guarda cifrado. No incluya diagnósticos ni datos de terceros.">
          <textarea id="fundamento" value={fundamento} maxLength={2000} onChange={(e) => setFundamento(e.target.value)} />
        </Campo>
      </div>
      <h3 style={{ margin: '1rem 0 0.5rem' }}>Vista previa del motor</h3>
      {previa.isLoading ? <Cargando texto="Evaluando los 69 establecimientos..." /> : previa.error ? <Mensaje tipo="error">{mensajeError(previa.error)}</Mensaje>
        : <RankingDestinos evaluaciones={previa.data!.evaluaciones} maximo={5} />}
    </Modal>
  );
}
