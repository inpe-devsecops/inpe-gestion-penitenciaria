import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, etiqueta, mensajeError } from '../api/cliente';
import type { Catalogos, Establecimiento } from '../tipos';
import { Campo, Mensaje, Modal } from './Comunes';

// Alta y edición del catálogo de establecimientos por el administrador central (RF-02, RF-03).
// La capacidad y la población de un establecimiento existente se cambian con "Actualizar ocupación".
export function FormEstablecimiento({ actual, alCerrar }: { actual?: Establecimiento; alCerrar: () => void }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const { data: cat } = useQuery({ queryKey: ['catalogos'], queryFn: () => api<Catalogos>('/api/catalogos'), staleTime: Infinity });
  const [d, setD] = useState({
    nombre: actual?.nombre ?? '', oficinaId: actual?.oficinaId ?? '', departamento: actual?.departamento ?? '',
    latitud: String(actual?.latitud ?? ''), longitud: String(actual?.longitud ?? ''),
    capacidad: String(actual?.capacidad ?? ''), poblacion: String(actual?.poblacion ?? '0'),
    techoSeguridad: actual?.techoSeguridad ?? 'MEDIANA', generoPoblacion: actual?.generoPoblacion ?? 'MASCULINO',
    regimenesAdmitidos: actual?.regimenesAdmitidos ?? ['MINIMA', 'MEDIANA'], fasesTratamiento: actual?.fasesTratamiento ?? ['ORDINARIO'],
    proporcionAltoRiesgo: String(actual?.proporcionAltoRiesgo ?? 0.1), activo: actual?.activo ?? true,
  });
  const fijar = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }));
  const alternar = (k: 'regimenesAdmitidos' | 'fasesTratamiento', v: string) =>
    fijar(k, d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v]);

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        nombre: d.nombre, oficinaId: d.oficinaId, departamento: d.departamento, latitud: Number(d.latitud), longitud: Number(d.longitud),
        techoSeguridad: d.techoSeguridad, generoPoblacion: d.generoPoblacion, regimenesAdmitidos: d.regimenesAdmitidos,
        fasesTratamiento: d.fasesTratamiento, proporcionAltoRiesgo: Number(d.proporcionAltoRiesgo), activo: d.activo,
      };
      return actual
        ? api<Establecimiento>(`/api/establecimientos/${actual.id}`, { metodo: 'PATCH', cuerpo })
        : api<Establecimiento>('/api/establecimientos', { metodo: 'POST', cuerpo: { ...cuerpo, capacidad: Number(d.capacidad), poblacion: Number(d.poblacion) } });
    },
    onSuccess: (e) => { void cliente.invalidateQueries(); alCerrar(); if (!actual) navegar(`/establecimientos/${e.id}`); },
  });

  return (
    <Modal titulo={actual ? `Editar ${actual.nombre}` : 'Registrar establecimiento'} ancho alCerrar={alCerrar} pie={<>
      <button type="button" className="boton" onClick={alCerrar}>Cancelar</button>
      <button type="button" className="boton boton--primario" disabled={guardar.isPending} onClick={() => guardar.mutate()}>Guardar</button>
    </>}>
      {guardar.error && <Mensaje tipo="error">{mensajeError(guardar.error)}</Mensaje>}
      <div className="rejilla rejilla--tres">
        <Campo id="f-nombre" etiqueta="Nombre"><input id="f-nombre" value={d.nombre} maxLength={80} onChange={(e) => fijar('nombre', e.target.value)} /></Campo>
        <Campo id="f-oficina" etiqueta="Oficina regional">
          <select id="f-oficina" value={d.oficinaId} onChange={(e) => fijar('oficinaId', e.target.value)}>
            <option value="">Seleccione…</option>{cat?.oficinas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </Campo>
        <Campo id="f-dep" etiqueta="Departamento"><input id="f-dep" value={d.departamento} maxLength={40} onChange={(e) => fijar('departamento', e.target.value)} /></Campo>
        <Campo id="f-lat" etiqueta="Latitud"><input id="f-lat" type="number" step="0.0001" value={d.latitud} onChange={(e) => fijar('latitud', e.target.value)} /></Campo>
        <Campo id="f-lon" etiqueta="Longitud"><input id="f-lon" type="number" step="0.0001" value={d.longitud} onChange={(e) => fijar('longitud', e.target.value)} /></Campo>
        {!actual && <>
          <Campo id="f-cap" etiqueta="Capacidad oficial"><input id="f-cap" type="number" min={1} value={d.capacidad} onChange={(e) => fijar('capacidad', e.target.value)} /></Campo>
          <Campo id="f-pob" etiqueta="Población inicial"><input id="f-pob" type="number" min={0} value={d.poblacion} onChange={(e) => fijar('poblacion', e.target.value)} /></Campo>
        </>}
        <Campo id="f-techo" etiqueta="Techo de seguridad">
          <select id="f-techo" value={d.techoSeguridad} onChange={(e) => fijar('techoSeguridad', e.target.value)}>{cat?.techos.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </Campo>
        <Campo id="f-genero" etiqueta="Población que alberga">
          <select id="f-genero" value={d.generoPoblacion} onChange={(e) => fijar('generoPoblacion', e.target.value)}>
            <option value="MASCULINO">Masculina</option><option value="FEMENINO">Femenina</option><option value="MIXTO">Mixta</option>
          </select>
        </Campo>
        <Campo id="f-riesgo" etiqueta="Proporción de alto riesgo (0 a 1)"><input id="f-riesgo" type="number" step="0.01" min={0} max={1} value={d.proporcionAltoRiesgo} onChange={(e) => fijar('proporcionAltoRiesgo', e.target.value)} /></Campo>
      </div>
      <div className="rejilla rejilla--dos" style={{ marginTop: '0.5rem' }}>
        <fieldset className="campo"><legend>Regímenes admitidos</legend>
          {cat?.clasificaciones.map((c) => (
            <label key={c} style={{ marginRight: '0.8rem', display: 'inline-flex', gap: '0.3rem' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={d.regimenesAdmitidos.includes(c)} onChange={() => alternar('regimenesAdmitidos', c)} />{etiqueta(c)}
            </label>
          ))}
        </fieldset>
        <fieldset className="campo"><legend>Programas por fase de tratamiento</legend>
          {cat?.fases.map((c) => (
            <label key={c} style={{ marginRight: '0.8rem', display: 'inline-flex', gap: '0.3rem' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={d.fasesTratamiento.includes(c)} onChange={() => alternar('fasesTratamiento', c)} />{etiqueta(c)}
            </label>
          ))}
        </fieldset>
      </div>
      {actual && (
        <label style={{ display: 'inline-flex', gap: '0.4rem', marginTop: '0.5rem' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={d.activo} onChange={(e) => fijar('activo', e.target.checked)} />
          Activo (un establecimiento inactivo no se ofrece como destino)
        </label>
      )}
    </Modal>
  );
}
