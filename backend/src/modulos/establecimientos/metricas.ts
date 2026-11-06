// Indicadores de ocupación a nivel de establecimiento, el mismo nivel en que el INPE publica sus anexos (RNF-14).
// Índice de hacinamiento = sobrepoblación / capacidad × 100 (el INPE lo reporta así: 148 % en enero de 2026).
import type { Severidad } from '../../dominio/constantes';

export interface Umbrales {
  umbral_atencion: number;
  umbral_severo: number;
  umbral_critico: number;
}

export interface Ocupacion {
  capacidad: number;
  poblacion: number;
  cupoLibre: number;
  sobrepoblacion: number;
  hacinamientoPct: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function ocupacion(capacidad: number, poblacion: number): Ocupacion {
  return {
    capacidad,
    poblacion,
    cupoLibre: Math.max(0, capacidad - poblacion),
    sobrepoblacion: Math.max(0, poblacion - capacidad),
    hacinamientoPct: r2(((poblacion - capacidad) / capacidad) * 100),
  };
}

// Nivel de severidad de la Tabla 10; null si no supera el umbral de atención.
export function nivelHacinamiento(pct: number, u: Umbrales): Exclude<Severidad, 'PROSPECTIVA'> | null {
  if (pct >= u.umbral_critico) return 'CRITICO';
  if (pct >= u.umbral_severo) return 'SEVERO';
  if (pct >= u.umbral_atencion) return 'ATENCION';
  return null;
}

// Población a partir de la cual un establecimiento alcanza un índice dado.
export const poblacionParaIndice = (capacidad: number, pct: number) => Math.ceil(capacidad * (1 + pct / 100));
