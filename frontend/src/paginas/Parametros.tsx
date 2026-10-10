import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fechaHora, mensajeError } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { CabeceraPagina, Campo, Cargando, Mensaje, Tarjeta } from '../componentes/Comunes';
import type { Parametro } from '../tipos';

const GRUPOS: { titulo: string; nota: string; claves: string[] }[] = [
  { titulo: 'Umbrales de alerta (Tabla 10)', nota: 'Deben cumplir atención < severo < crítico', claves: ['umbral_atencion', 'umbral_severo', 'umbral_critico', 'meses_prospectiva', 'ventana_proyeccion_meses'] },
  { titulo: 'Pesos del motor (Tabla 11)', nota: 'Los cinco pesos deben sumar 1', claves: ['peso_cupo', 'peso_hacinamiento', 'peso_distancia', 'peso_fase', 'peso_riesgo'] },
  { titulo: 'Normalización de factores', nota: 'Valores de referencia para llevar cada factor a la escala 0-1', claves: ['cupo_referencia', 'distancia_max_km', 'riesgo_max_proporcion'] },
];

// Configuración del administrador central; cada cambio se audita con valor anterior y nuevo (RNF-13)
export function Parametros() {
  const { tieneRol } = useAuth();
  const editable = tieneRol('ADMIN_CENTRAL');
  const cliente = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['parametros'], queryFn: () => api<Parametro[]>('/api/parametros') });
  const [cambios, setCambios] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const guardar = useMutation({
    mutationFn: () => api<{ modificados: string[] }>('/api/parametros', {
      metodo: 'PATCH', cuerpo: { cambios: Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, Number(v)])), motivo },
    }),
    onSuccess: () => { setCambios({}); setMotivo(''); void cliente.invalidateQueries(); },
  });
  if (isLoading) return <Cargando />;
  if (error || !data) return <Mensaje tipo="error">{(error as Error)?.message}</Mensaje>;
  const valor = (p: Parametro) => cambios[p.clave] ?? String(p.valor);
  const sumaPesos = GRUPOS[1].claves.reduce((s, k) => s + Number(valor(data.find((p) => p.clave === k)!)), 0);

  return (
    <>
      <CabeceraPagina titulo="Parámetros del sistema" descripcion={editable ? 'Los cambios se validan en conjunto, se auditan y reclasifican las alertas en la siguiente evaluación.' : 'Consulta de solo lectura.'} />
      {guardar.error && <Mensaje tipo="error">{mensajeError(guardar.error)}</Mensaje>}
      {guardar.data && <Mensaje tipo="ok">Guardado: {guardar.data.modificados.join(', ') || 'sin cambios'}.</Mensaje>}
      <div className="rejilla rejilla--tres">
        {GRUPOS.map((g) => (
          <Tarjeta key={g.titulo} titulo={g.titulo} nota={g.titulo.startsWith('Pesos') ? `${g.nota} (suman ${sumaPesos.toFixed(2)})` : g.nota}>
            {g.claves.map((k) => {
              const p = data.find((x) => x.clave === k)!;
              return (
                <Campo key={k} id={k} etiqueta={k} ayuda={`${p.descripcion}${p.actualizadoEn && p.actualizadoPor ? ` · modificado el ${fechaHora(p.actualizadoEn)}` : ''}`}>
                  <input id={k} type="number" step="any" min={p.minimo} max={p.maximo} disabled={!editable} value={valor(p)} onChange={(e) => setCambios({ ...cambios, [k]: e.target.value })} />
                </Campo>
              );
            })}
          </Tarjeta>
        ))}
      </div>
      {editable && Object.keys(cambios).length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <Tarjeta titulo="Confirmar cambios">
            <Campo id="motivo-param" etiqueta="Motivo del cambio (mínimo 10 caracteres, queda en la auditoría)">
              <input id="motivo-param" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>
            <div className="fila-botones">
              <button type="button" className="boton" onClick={() => setCambios({})}>Descartar</button>
              <button type="button" className="boton boton--primario" disabled={motivo.trim().length < 10 || guardar.isPending} onClick={() => guardar.mutate()}>Guardar cambios</button>
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
