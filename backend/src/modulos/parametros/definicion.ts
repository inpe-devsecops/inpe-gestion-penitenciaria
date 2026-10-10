// Parámetros configurables por el administrador central. Cada cambio se audita con valor anterior y nuevo.
export const PARAMETROS = {
  umbral_atencion: { valor: 20, minimo: 0, maximo: 1000, descripcion: 'Hacinamiento (%) que dispara la alerta de nivel Atención (criterio del INPE: sobrepoblación ≥ 20 %)' },
  umbral_severo: { valor: 100, minimo: 0, maximo: 1000, descripcion: 'Hacinamiento (%) de nivel Severo: priorizar evaluación de traslados' },
  umbral_critico: { valor: 300, minimo: 0, maximo: 1000, descripcion: 'Hacinamiento (%) de nivel Crítico: escalar y evaluar destinos de forma masiva' },
  meses_prospectiva: { valor: 6, minimo: 1, maximo: 60, descripcion: 'Meses de anticipación de la alerta prospectiva al nivel crítico' },
  ventana_proyeccion_meses: { valor: 12, minimo: 2, maximo: 60, descripcion: 'Cortes mensuales usados para ajustar la recta de la proyección' },
  peso_cupo: { valor: 0.3, minimo: 0, maximo: 1, descripcion: 'Peso del cupo disponible en el puntaje del motor' },
  peso_hacinamiento: { valor: 0.25, minimo: 0, maximo: 1, descripcion: 'Peso del hacinamiento relativo origen - destino' },
  peso_distancia: { valor: 0.2, minimo: 0, maximo: 1, descripcion: 'Peso de la cercanía al entorno de origen' },
  peso_fase: { valor: 0.15, minimo: 0, maximo: 1, descripcion: 'Peso de la disponibilidad de programa para la fase de tratamiento' },
  peso_riesgo: { valor: 0.1, minimo: 0, maximo: 1, descripcion: 'Peso de la baja concentración de perfiles de alto riesgo en el destino' },
  cupo_referencia: { valor: 100, minimo: 1, maximo: 5000, descripcion: 'Plazas libres a partir de las cuales el factor cupo vale 1' },
  distancia_max_km: { valor: 1500, minimo: 50, maximo: 5000, descripcion: 'Distancia a partir de la cual el factor distancia vale 0' },
  riesgo_max_proporcion: { valor: 0.5, minimo: 0.05, maximo: 1, descripcion: 'Proporción de alto riesgo a partir de la cual el factor riesgo vale 0' },
} as const;

export type ClaveParametro = keyof typeof PARAMETROS;
export type ValoresParametros = Record<ClaveParametro, number>;
export const CLAVES_PARAMETROS = Object.keys(PARAMETROS) as ClaveParametro[];

export const PESOS = ['peso_cupo', 'peso_hacinamiento', 'peso_distancia', 'peso_fase', 'peso_riesgo'] as const;

export function valoresPorDefecto(): ValoresParametros {
  return Object.fromEntries(CLAVES_PARAMETROS.map((k) => [k, PARAMETROS[k].valor])) as ValoresParametros;
}

// Reglas que relacionan parámetros entre sí; devuelve los errores encontrados (vacío = válido).
export function validarConjunto(v: ValoresParametros): string[] {
  const errores: string[] = [];
  for (const k of CLAVES_PARAMETROS) {
    const d = PARAMETROS[k];
    if (!Number.isFinite(v[k]) || v[k] < d.minimo || v[k] > d.maximo) errores.push(`${k} debe estar entre ${d.minimo} y ${d.maximo}`);
  }
  if (!(v.umbral_atencion < v.umbral_severo && v.umbral_severo < v.umbral_critico)) {
    errores.push('Los umbrales deben cumplir: atención < severo < crítico');
  }
  const suma = PESOS.reduce((a, k) => a + v[k], 0);
  if (Math.abs(suma - 1) > 0.001) errores.push(`Los cinco pesos deben sumar 1 (suman ${suma.toFixed(3)})`);
  return errores;
}
