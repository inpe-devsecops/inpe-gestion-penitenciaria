import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, etiqueta, fecha } from '../api/cliente';
import { CabeceraPagina, Campo, Cargando, Mensaje, Paginacion, Tarjeta } from '../componentes/Comunes';
import type { Catalogos, Interno, Paginado } from '../tipos';

export function Internos() {
  const [params] = useSearchParams();
  const [pagina, setPagina] = useState(1);
  const [f, setF] = useState({ establecimientoId: params.get('establecimientoId') ?? '', clasificacion: '', fase: '', situacion: '', busqueda: '' });
  const cambiar = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setPagina(1); };
  const { data: cat } = useQuery({ queryKey: ['catalogos'], queryFn: () => api<Catalogos>('/api/catalogos'), staleTime: Infinity });
  const { data, isLoading, error } = useQuery({
    queryKey: ['internos', f, pagina],
    queryFn: () => api<Paginado<Interno>>('/api/internos', { params: { ...f, pagina, porPagina: 25 } }),
  });

  return (
    <>
      <CabeceraPagina titulo="Fichas de internos"
        descripcion="Ficha mínima (RNF-08): identificador anónimo, clasificación, fase de tratamiento, situación jurídica, nivel de riesgo y región de procedencia. No se registran nombres, documentos, datos de salud ni de familiares." />
      <Tarjeta titulo="Filtros">
        <div className="filtros">
          <Campo id="est" etiqueta="Establecimiento">
            <select id="est" value={f.establecimientoId} onChange={(e) => cambiar('establecimientoId', e.target.value)}>
              <option value="">Todos los de mi ámbito</option>
              {cat?.establecimientos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Campo>
          <Campo id="cla" etiqueta="Clasificación">
            <select id="cla" value={f.clasificacion} onChange={(e) => cambiar('clasificacion', e.target.value)}>
              <option value="">Todas</option>{cat?.clasificaciones.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
            </select>
          </Campo>
          <Campo id="fase" etiqueta="Fase">
            <select id="fase" value={f.fase} onChange={(e) => cambiar('fase', e.target.value)}>
              <option value="">Todas</option>{cat?.fases.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
            </select>
          </Campo>
          <Campo id="sit" etiqueta="Situación jurídica">
            <select id="sit" value={f.situacion} onChange={(e) => cambiar('situacion', e.target.value)}>
              <option value="">Todas</option>{cat?.situaciones.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
            </select>
          </Campo>
          <Campo id="bus" etiqueta="Código">
            <input id="bus" value={f.busqueda} maxLength={20} onChange={(e) => cambiar('busqueda', e.target.value)} placeholder="INT-000123" />
          </Campo>
        </div>
      </Tarjeta>
      <div style={{ marginTop: '1rem' }}>
        <Tarjeta>
          {isLoading ? <Cargando /> : error ? <Mensaje tipo="error">{(error as Error).message}</Mensaje> : data!.datos.length === 0 ? <div className="vacio">No hay fichas que coincidan.</div> : (
            <>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead><tr><th>Código</th><th>Establecimiento</th><th>Clasificación</th><th>Fase</th><th>Situación</th><th className="tabla__num">Riesgo</th><th>Procedencia</th><th>Ingreso</th></tr></thead>
                  <tbody>
                    {data!.datos.map((i) => (
                      <tr key={i.id}>
                        <td><Link to={`/internos/${i.id}`} className="tabla__nombre">{i.id}</Link><span className="tabla__sub">{i.sexo === 'F' ? 'Mujer' : 'Hombre'}</span></td>
                        <td>{i.establecimiento}</td>
                        <td>{etiqueta(i.clasificacion)}</td>
                        <td>{etiqueta(i.faseTratamiento)}</td>
                        <td>{etiqueta(i.situacionJuridica)}</td>
                        <td className="tabla__num">{i.nivelRiesgo}</td>
                        <td>{i.regionProcedencia}</td>
                        <td>{fecha(i.fechaIngreso)}</td>
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
