// Reglas de alerta (apartado 2.1.6 y Tabla 10 del informe). Función pura: decide qué hacer con cada
// condición a partir de los indicadores y de la alerta vigente; el servicio aplica la decisión.
import type { CondicionAlerta, Severidad } from '../../dominio/constantes';
import { nivelHacinamiento, type Umbrales } from '../establecimientos/metricas';
import type { Proyeccion } from '../proyeccion/proyeccion';

export interface AlertaVigente {
  condicion: CondicionAlerta;
  severidad: Severidad;
}

export type Accion =
  | { tipo: 'CREAR'; condicion: CondicionAlerta; severidad: Severidad; valor: number; umbral: number; mensaje: string }
  | { tipo: 'CAMBIAR_SEVERIDAD'; condicion: CondicionAlerta; severidad: Severidad; valor: number; umbral: number; mensaje: string }
  | { tipo: 'RESOLVER'; condicion: CondicionAlerta; mensaje: string };

const ETIQUETA: Record<Severidad, string> = { ATENCION: 'Atención', SEVERO: 'Severo', CRITICO: 'Crítico', PROSPECTIVA: 'Prospectiva' };

export function decidirAlertas(
  nombre: string,
  hacinamientoPct: number,
  proyeccion: Proyeccion,
  vigentes: AlertaVigente[],
  p: Umbrales & { meses_prospectiva: number },
): Accion[] {
  const acciones: Accion[] = [];
  const actual = (c: CondicionAlerta) => vigentes.find((a) => a.condicion === c);

  // 1. Hacinamiento: una alerta por establecimiento que sube o baja de severidad en el mismo registro
  const nivel = nivelHacinamiento(hacinamientoPct, p);
  const vigenteHac = actual('HACINAMIENTO');
  if (nivel) {
    const umbral = nivel === 'CRITICO' ? p.umbral_critico : nivel === 'SEVERO' ? p.umbral_severo : p.umbral_atencion;
    const mensaje = `${nombre}: hacinamiento de ${hacinamientoPct.toFixed(1)} % (nivel ${ETIQUETA[nivel]}, umbral ${umbral} %)`;
    if (!vigenteHac) acciones.push({ tipo: 'CREAR', condicion: 'HACINAMIENTO', severidad: nivel, valor: hacinamientoPct, umbral, mensaje });
    else if (vigenteHac.severidad !== nivel) {
      acciones.push({ tipo: 'CAMBIAR_SEVERIDAD', condicion: 'HACINAMIENTO', severidad: nivel, valor: hacinamientoPct, umbral, mensaje });
    }
  } else if (vigenteHac) {
    acciones.push({ tipo: 'RESOLVER', condicion: 'HACINAMIENTO', mensaje: `Hacinamiento bajó a ${hacinamientoPct.toFixed(1)} %, por debajo del umbral de atención` });
  }

  // 2. Prospectiva: la proyección alcanza el nivel crítico en el horizonte configurado
  const enRiesgo = proyeccion.escenario === 'EN_RIESGO' && proyeccion.mesesHastaCritico !== null
    && proyeccion.mesesHastaCritico <= p.meses_prospectiva;
  const vigenteProsp = actual('PROSPECTIVA');
  if (enRiesgo && !vigenteProsp) {
    acciones.push({
      tipo: 'CREAR', condicion: 'PROSPECTIVA', severidad: 'PROSPECTIVA', valor: proyeccion.mesesHastaCritico!, umbral: p.meses_prospectiva,
      mensaje: `${nombre}: alcanzaría el nivel crítico (${p.umbral_critico} %) en ${proyeccion.mesesHastaCritico} meses, hacia ${proyeccion.corteEstimado}`,
    });
  } else if (!enRiesgo && vigenteProsp) {
    acciones.push({ tipo: 'RESOLVER', condicion: 'PROSPECTIVA', mensaje: 'La proyección ya no alcanza el nivel crítico dentro del horizonte' });
  }
  return acciones;
}
