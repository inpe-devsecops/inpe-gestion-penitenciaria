import { numero } from '../api/cliente';
import type { ClaveFactor, Evaluacion } from '../tipos';
import { Distintivo, Tarjeta, tonoHacinamiento } from './Comunes';

export const NOMBRE_FACTOR: Record<ClaveFactor, string> = {
  cupo: 'Cupo', hacinamiento: 'Hacinamiento', distancia: 'Distancia', fase: 'Fase', riesgo: 'Riesgo',
};

// Ranking explicable del motor (RF-17, RF-18) y destinos descartados con su motivo (RF-15, RF-19).
export function RankingDestinos({ evaluaciones, seleccion, alSeleccionar, maximo = 10 }: {
  evaluaciones: Evaluacion[];
  seleccion?: string | null;
  alSeleccionar?: (destinoId: string) => void;
  maximo?: number;
}) {
  const elegibles = evaluaciones.filter((e) => e.elegible);
  const descartados = evaluaciones.filter((e) => !e.elegible);
  return (
    <>
      <Tarjeta titulo={`Destinos elegibles (${elegibles.length})`} nota="Puntaje S = Σ peso × factor normalizado (0 a 1). El aporte de cada factor sustenta la decisión.">
        {elegibles.length === 0 && <div className="vacio">Ningún establecimiento cumple las condiciones obligatorias para este interno.</div>}
        {elegibles.slice(0, maximo).map((e) => {
          const elegido = seleccion === e.destinoId;
          const contenido = (
            <>
              <div className="candidato__puesto">{e.posicion}</div>
              <div>
                <div className="candidato__nombre">
                  {e.destino} {e.posicion === 1 && <Distintivo tono="ok">Recomendado</Distintivo>}
                </div>
                <div className="candidato__meta">
                  {numero(e.metricas.cupoLibre)} plazas libres · <Distintivo tono={tonoHacinamiento(e.metricas.hacinamientoPct)}>{e.metricas.hacinamientoPct.toFixed(0)} %</Distintivo>
                  {e.metricas.distanciaKm !== null && <> · {numero(e.metricas.distanciaKm)} km</>}
                </div>
                {e.aportes && (
                  <div className="factores">
                    {(Object.keys(NOMBRE_FACTOR) as ClaveFactor[]).map((k) => (
                      <div className="factor" key={k} title={e.aportes![k].detalle}>
                        <div className="factor__nombre">{NOMBRE_FACTOR[k]} · {e.aportes![k].peso}</div>
                        <div className="factor__valor">{e.aportes![k].aporte.toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="candidato__explicacion">{e.explicacion}</div>
              </div>
              <div className="candidato__score">
                <div className="candidato__puntaje">{e.puntaje?.toFixed(3)}</div>
                <div className="candidato__puntaje-etiqueta">puntaje</div>
              </div>
            </>
          );
          return alSeleccionar ? (
            <label key={e.destinoId} className={`candidato ${elegido || (!seleccion && e.posicion === 1) ? 'candidato--primero' : ''}`} style={{ cursor: 'pointer' }}>
              <input type="radio" name="destino" checked={elegido} onChange={() => alSeleccionar(e.destinoId)} style={{ position: 'absolute', opacity: 0 }} />
              {contenido}
            </label>
          ) : (
            <div key={e.destinoId} className={`candidato ${e.posicion === 1 ? 'candidato--primero' : ''}`}>{contenido}</div>
          );
        })}
        {elegibles.length > maximo && <p className="campo__ayuda">Se muestran los {maximo} primeros de {elegibles.length} elegibles.</p>}
      </Tarjeta>
      {descartados.length > 0 && (
        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--texto-suave)' }}>
            Ver los {descartados.length} establecimientos descartados y el motivo de cada descarte
          </summary>
          <div className="tabla-envoltura" style={{ marginTop: '0.5rem' }}>
            <table className="tabla">
              <thead><tr><th>Establecimiento</th><th>Motivo del descarte</th></tr></thead>
              <tbody>
                {descartados.map((e) => (
                  <tr key={e.destinoId}><td>{e.destino}</td><td style={{ color: 'var(--texto-suave)' }}>{e.motivoDescarte}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
