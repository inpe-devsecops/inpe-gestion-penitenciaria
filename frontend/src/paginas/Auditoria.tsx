import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, etiqueta, fechaHora } from '../api/cliente';
import { CabeceraPagina, Campo, Cargando, Distintivo, Mensaje, Paginacion, Tarjeta } from '../componentes/Comunes';
import type { Paginado, RegistroAuditoria } from '../tipos';

const TONO = { EXITO: 'ok', FALLIDO: 'aviso', DENEGADO: 'peligro', BLOQUEADO: 'critico' } as const;
const ACCIONES = ['LOGIN', 'LOGOUT', 'SOLICITAR_TRASLADO', 'APROBAR_TRASLADO', 'RECHAZAR_TRASLADO', 'EJECUTAR_TRASLADO', 'ACTUALIZAR_OCUPACION',
  'ACTUALIZAR_PARAMETRO', 'REGISTRAR_INTERNO', 'ACTUALIZAR_INTERNO', 'RECONOCER_ALERTA', 'EVALUAR_ALERTAS', 'CONSULTA_ESTABLECIMIENTO', 'CONSULTA_INTERNO'];

const valores = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

// Bitácora de solo inserción (RNF-11 a RNF-13): la interfaz no ofrece ninguna operación de edición
export function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const [f, setF] = useState({ accion: '', resultado: '', entidadId: '' });
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditoria', f, pagina],
    queryFn: () => api<Paginado<RegistroAuditoria>>('/api/auditoria', { params: { ...f, pagina, porPagina: 50 } }),
  });
  const cambiar = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPagina(1); };
  return (
    <>
      <CabeceraPagina titulo="Auditoría" descripcion="Registro inalterable: la colección solo admite inserciones (rol de base de datos y modelo de la aplicación). Incluye los accesos denegados fuera de ámbito y los cambios de configuración con su valor anterior." />
      <Tarjeta titulo="Filtros">
        <div className="filtros">
          <Campo id="accion" etiqueta="Acción">
            <select id="accion" value={f.accion} onChange={(e) => cambiar('accion', e.target.value)}>
              <option value="">Todas</option>{ACCIONES.map((a) => <option key={a} value={a}>{etiqueta(a)}</option>)}
            </select>
          </Campo>
          <Campo id="res" etiqueta="Resultado">
            <select id="res" value={f.resultado} onChange={(e) => cambiar('resultado', e.target.value)}>
              <option value="">Todos</option>{Object.keys(TONO).map((r) => <option key={r} value={r}>{etiqueta(r)}</option>)}
            </select>
          </Campo>
          <Campo id="ent" etiqueta="Entidad (id)">
            <input id="ent" value={f.entidadId} maxLength={40} onChange={(e) => cambiar('entidadId', e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} placeholder="EP-TACNA, umbral_critico…" />
          </Campo>
        </div>
      </Tarjeta>
      <div style={{ marginTop: '1rem' }}>
        <Tarjeta>
          {isLoading ? <Cargando /> : error ? <Mensaje tipo="error">{(error as Error).message}</Mensaje> : (
            <>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Resultado</th><th>Valor anterior → nuevo</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {data!.datos.map((r) => (
                      <tr key={r.id}>
                        <td>{fechaHora(r.fecha)}<span className="tabla__sub">{r.ip ?? ''}</span></td>
                        <td>{r.usuario ?? 'anónimo'}<span className="tabla__sub">{r.rol ? etiqueta(r.rol) : ''}</span></td>
                        <td>{etiqueta(r.accion)}</td>
                        <td>{r.entidad ?? '-'}<span className="tabla__sub">{r.entidadId ?? ''}</span></td>
                        <td><Distintivo tono={TONO[r.resultado]}>{etiqueta(r.resultado)}</Distintivo></td>
                        <td><code style={{ fontSize: '0.72rem' }}>{valores(r.valorAnterior)}{r.valorAnterior !== null && r.valorNuevo !== null ? ' → ' : ''}{valores(r.valorNuevo)}</code></td>
                        <td style={{ fontSize: '0.8rem' }}>{r.detalle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion pagina={pagina} porPagina={50} total={data!.total} alCambiar={setPagina} />
            </>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
