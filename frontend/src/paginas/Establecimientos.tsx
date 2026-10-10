import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, numero } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Distintivo, ETIQUETA_NIVEL, Hacinamiento, Mensaje, Tarjeta, TONO_NIVEL } from '../componentes/Comunes';
import { FormEstablecimiento } from '../componentes/FormEstablecimiento';
import type { Catalogos, Establecimiento, Paginado } from '../tipos';

export function Establecimientos() {
  const { usuario } = useAuth();
  const [f, setF] = useState({ oficinaId: '', nivel: '', techo: '', conCupo: false, busqueda: '', orden: 'hacinamiento', direccion: 'desc' });
  const cambiar = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const { data: cat } = useQuery({ queryKey: ['catalogos'], queryFn: () => api<Catalogos>('/api/catalogos'), staleTime: Infinity });
  const { data, isLoading, error } = useQuery({
    queryKey: ['establecimientos', f],
    queryFn: () => api<Paginado<Establecimiento>>('/api/establecimientos', { params: { ...f, conCupo: f.conCupo || undefined } }),
  });
  const nacional = usuario?.rol === 'ADMIN_CENTRAL' || usuario?.rol === 'AUDITOR';
  const [registrando, setRegistrando] = useState(false);

  return (
    <>
      <CabeceraPagina titulo="Establecimientos penitenciarios" descripcion="Capacidad oficial, población vigente, techo de seguridad e índice de hacinamiento calculado en tiempo real (RF-02 a RF-04)."
        acciones={usuario?.rol === 'ADMIN_CENTRAL' && <button type="button" className="boton boton--primario" onClick={() => setRegistrando(true)}>Registrar establecimiento</button>} />
      {registrando && <FormEstablecimiento alCerrar={() => setRegistrando(false)} />}
      <Tarjeta titulo="Filtros">
        <div className="filtros">
          {nacional && (
            <Campo id="oficina" etiqueta="Oficina regional">
              <select id="oficina" value={f.oficinaId} onChange={(e) => cambiar('oficinaId', e.target.value)}>
                <option value="">Todas</option>
                {cat?.oficinas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </Campo>
          )}
          <Campo id="nivel" etiqueta="Nivel">
            <select id="nivel" value={f.nivel} onChange={(e) => cambiar('nivel', e.target.value)}>
              <option value="">Todos</option>
              <option value="CRITICO">Crítico</option><option value="SEVERO">Severo</option><option value="ATENCION">Atención</option>
              <option value="SIN_HACINAMIENTO">Sin hacinamiento</option>
            </select>
          </Campo>
          <Campo id="techo" etiqueta="Techo de seguridad">
            <select id="techo" value={f.techo} onChange={(e) => cambiar('techo', e.target.value)}>
              <option value="">Todos</option>
              {cat?.techos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo id="orden" etiqueta="Ordenar por">
            <select id="orden" value={`${f.orden}:${f.direccion}`} onChange={(e) => { const [o, d] = e.target.value.split(':'); setF((x) => ({ ...x, orden: o, direccion: d })); }}>
              <option value="hacinamiento:desc">Mayor hacinamiento</option><option value="hacinamiento:asc">Menor hacinamiento</option>
              <option value="cupo:desc">Más cupo libre</option><option value="poblacion:desc">Mayor población</option><option value="nombre:asc">Nombre</option>
            </select>
          </Campo>
          <Campo id="busqueda" etiqueta="Buscar">
            <input id="busqueda" value={f.busqueda} maxLength={60} onChange={(e) => cambiar('busqueda', e.target.value)} placeholder="Nombre" />
          </Campo>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.conCupo} onChange={(e) => cambiar('conCupo', e.target.checked)} style={{ width: 'auto' }} /> Solo con cupo libre
          </label>
        </div>
      </Tarjeta>
      <div style={{ marginTop: '1rem' }}>
        <Tarjeta titulo={data ? `${data.total} establecimiento(s)` : undefined}>
          {isLoading ? <Cargando /> : error ? <Mensaje tipo="error">{(error as Error).message}</Mensaje> : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead><tr><th>Establecimiento</th><th>Oficina</th><th>Techo</th><th className="tabla__num">Capacidad</th><th className="tabla__num">Población</th><th className="tabla__num">Cupo libre</th><th>Hacinamiento</th><th>Nivel</th></tr></thead>
                <tbody>
                  {data!.datos.map((e) => (
                    <tr key={e.id}>
                      <td><Link to={`/establecimientos/${e.id}`} className="tabla__nombre">{e.nombre}</Link><span className="tabla__sub">{e.id} · {e.departamento}</span></td>
                      <td>{e.oficina}</td>
                      <td>{e.techoSeguridad}</td>
                      <td className="tabla__num">{numero(e.capacidad)}</td>
                      <td className="tabla__num">{numero(e.poblacion)}</td>
                      <td className="tabla__num">{numero(e.cupoLibre)}</td>
                      <td><Hacinamiento pct={e.hacinamientoPct} /></td>
                      <td>{e.nivel ? <Distintivo tono={TONO_NIVEL[e.nivel]}>{ETIQUETA_NIVEL[e.nivel]}</Distintivo> : <Distintivo tono="ok">Sin hacinamiento</Distintivo>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
