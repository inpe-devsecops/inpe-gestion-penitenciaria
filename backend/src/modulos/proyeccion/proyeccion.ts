// Proyección de saturación (apartado 2.2.4 del informe): recta por mínimos cuadrados sobre la serie
// mensual de población, t* = (U − P₀) ÷ m. Modelo lineal a propósito: las series son cortas y un supuesto
// explícito es más defendible ante quien decide. La respuesta siempre expone su horizonte y su supuesto.
import { poblacionParaIndice } from '../establecimientos/metricas';

export interface PuntoSerie {
  corte: string; // YYYY-MM
  poblacion: number;
}

export type Escenario = 'YA_CRITICO' | 'EN_RIESGO' | 'SIN_RIESGO' | 'SIN_DATOS';

export interface Proyeccion {
  escenario: Escenario;
  poblacionActual: number;
  poblacionCritica: number;
  pendienteMensual: number | null;
  mesesHastaCritico: number | null;
  corteEstimado: string | null;
  horizonte: { desde: string; hasta: string; cortes: number } | null;
  supuesto: string;
  serie: PuntoSerie[];
}

// Meses transcurridos desde el año 0: permite cortes con huecos (la recta usa la distancia real en meses).
export const indiceMes = (corte: string) => {
  const [a, m] = corte.split('-').map(Number);
  return a * 12 + (m - 1);
};
export const corteDesdeIndice = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

export function pendienteMinimosCuadrados(serie: PuntoSerie[]): number | null {
  if (serie.length < 2) return null;
  const xs = serie.map((p) => indiceMes(p.corte));
  const ys = serie.map((p) => p.poblacion);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export function proyectar(
  serieCompleta: PuntoSerie[],
  actual: { capacidad: number; poblacion: number },
  p: { umbral_critico: number; ventana_proyeccion_meses: number },
): Proyeccion {
  const serie = [...serieCompleta].sort((a, b) => a.corte.localeCompare(b.corte)).slice(-p.ventana_proyeccion_meses);
  const U = poblacionParaIndice(actual.capacidad, p.umbral_critico);
  const P0 = actual.poblacion;
  const horizonte = serie.length ? { desde: serie[0].corte, hasta: serie[serie.length - 1].corte, cortes: serie.length } : null;
  const base = { poblacionActual: P0, poblacionCritica: U, horizonte, serie };
  const m = pendienteMinimosCuadrados(serie);
  const ritmo = m === null ? '' : `${m >= 0 ? '+' : ''}${m.toFixed(1)} internos por mes`;

  if (P0 >= U) {
    return { ...base, escenario: 'YA_CRITICO', pendienteMensual: m, mesesHastaCritico: 0, corteEstimado: null,
      supuesto: `Ya supera el umbral crítico de ${p.umbral_critico} % (${U} internos).` };
  }
  if (m === null) {
    return { ...base, escenario: 'SIN_DATOS', pendienteMensual: null, mesesHastaCritico: null, corteEstimado: null,
      supuesto: 'Se necesitan al menos dos cortes mensuales para ajustar una tendencia.' };
  }
  const supuesto = `Crecimiento lineal de ${ritmo}, ajustado por mínimos cuadrados sobre ${serie.length} cortes (${horizonte!.desde} a ${horizonte!.hasta}).`;
  if (m <= 0) {
    // Con ritmo estable o decreciente no se proyecta una fecha (sería absurda)
    return { ...base, escenario: 'SIN_RIESGO', pendienteMensual: m, mesesHastaCritico: null, corteEstimado: null, supuesto };
  }
  const meses = Math.round(((U - P0) / m) * 10) / 10;
  return {
    ...base, escenario: 'EN_RIESGO', pendienteMensual: Math.round(m * 10) / 10, mesesHastaCritico: meses,
    corteEstimado: corteDesdeIndice(indiceMes(horizonte!.hasta) + Math.ceil(meses)), supuesto,
  };
}
