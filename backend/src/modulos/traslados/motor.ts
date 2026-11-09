// Motor de recomendación de destinos (apartado 2.2.3 del informe). Determinista y explicable:
// la resolución de traslado debe expresar sus fundamentos (art. 163 del Reglamento), así que el motor
// conserva el aporte de cada factor y el motivo de cada descarte.
//
// Paso 1 - condiciones obligatorias: un destino que falla una se descarta y se registra el motivo.
// Paso 2 - puntaje S = Σ wᵢ · fᵢ sobre los elegibles, con cada factor fᵢ normalizado entre 0 y 1.
//
// Es una función pura (sin base de datos) para poder probarla de forma aislada.
import {
  NIVEL_CLASIFICACION, NIVEL_TECHO, ORDEN_FASE,
  type Clasificacion, type FaseTratamiento, type GeneroPoblacion, type Sexo, type TechoSeguridad,
} from '../../dominio/constantes';
import { distanciaKm, type Punto } from '../../lib/distancia';
import { ocupacion } from '../establecimientos/metricas';

export interface InternoMotor {
  codigo: string;
  sexo: Sexo;
  clasificacion: Clasificacion;
  fase: FaseTratamiento;
  regionProcedencia: string;
  sedeProcedencia: Punto | null;
  establecimientoId: string;
}

export interface DestinoMotor {
  id: string;
  nombre: string;
  ubicacion: Punto;
  capacidad: number;
  poblacion: number;
  techo: TechoSeguridad;
  regimenes: Clasificacion[];
  genero: GeneroPoblacion;
  fases: FaseTratamiento[];
  proporcionAltoRiesgo: number;
  activo: boolean;
}

export interface PesosMotor {
  cupo: number;
  hacinamiento: number;
  distancia: number;
  fase: number;
  riesgo: number;
}

export interface ConfigMotor {
  pesos: PesosMotor;
  cupoReferencia: number;
  distanciaMaxKm: number;
  riesgoMaxProporcion: number;
}

export interface Aporte {
  normalizado: number;
  peso: number;
  aporte: number;
  detalle: string;
}

export type Aportes = Record<keyof PesosMotor, Aporte>;

export interface ResultadoDestino {
  destinoId: string;
  nombre: string;
  elegible: boolean;
  motivoDescarte: string | null;
  posicion: number | null;
  puntaje: number | null;
  aportes: Aportes | null;
  metricas: { cupoLibre: number; hacinamientoPct: number; distanciaKm: number | null };
  explicacion: string;
}

const acotar = (v: number) => Math.max(0, Math.min(1, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pct = (v: number) => `${v.toFixed(1)} %`;

function aporte(normalizado: number, peso: number, detalle: string): Aporte {
  const n = acotar(normalizado);
  return { normalizado: r3(n), peso, aporte: r3(n * peso), detalle };
}

function generoAdmitido(sexo: Sexo, genero: GeneroPoblacion): boolean {
  return genero === 'MIXTO' || (genero === 'FEMENINO' ? sexo === 'F' : sexo === 'M');
}

// Paso 1. Devuelve el motivo del descarte o null si el destino es elegible.
export function motivoDescarte(interno: InternoMotor, d: DestinoMotor): string | null {
  if (!d.activo) return 'Establecimiento inactivo';
  if (d.id === interno.establecimientoId) return 'Es el establecimiento actual del interno';
  if (!generoAdmitido(interno.sexo, d.genero)) {
    return `El establecimiento alberga población ${d.genero === 'FEMENINO' ? 'femenina' : 'masculina'}`;
  }
  if (!d.regimenes.includes(interno.clasificacion)) {
    return `El régimen del interno (${interno.clasificacion}) no es admitido por el destino`;
  }
  if (NIVEL_TECHO[d.techo] < NIVEL_CLASIFICACION[interno.clasificacion]) {
    return `Techo de seguridad insuficiente: el interno requiere ${interno.clasificacion} y el destino alcanza ${d.techo}`;
  }
  const cupo = d.capacidad - d.poblacion;
  if (cupo <= 0) return `Sin cupo libre (${d.poblacion} internos para ${d.capacidad} plazas)`;
  return null;
}

// Paso 2. Factores de la Tabla 11 del informe.
export function calcularAportes(
  interno: InternoMotor,
  d: DestinoMotor,
  c: ConfigMotor,
  ctx: { hacOrigen: number; hacMax: number; hacMin: number; distancia: number | null },
): Aportes {
  const o = ocupacion(d.capacidad, d.poblacion);

  const cupo = aporte(o.cupoLibre / c.cupoReferencia, c.pesos.cupo,
    `${o.cupoLibre} plazas libres (referencia: ${c.cupoReferencia})`);

  const rango = ctx.hacMax - ctx.hacMin;
  const hacinamiento = aporte(rango > 0 ? (ctx.hacOrigen - o.hacinamientoPct) / rango : 0, c.pesos.hacinamiento,
    `Origen ${pct(ctx.hacOrigen)} → destino ${pct(o.hacinamientoPct)}`);

  const distancia = ctx.distancia === null
    // Sin coordenadas no se premia ni se castiga: punto medio para no introducir un sesgo arbitrario
    ? aporte(0.5, c.pesos.distancia, 'Sin coordenadas de procedencia')
    : aporte(1 - Math.min(1, ctx.distancia / c.distanciaMaxKm), c.pesos.distancia,
      `${Math.round(ctx.distancia)} km de la región de procedencia (${interno.regionProcedencia})`);

  let nFase = 0;
  let detalleFase = `Sin programa para la fase ${interno.fase}`;
  if (d.fases.includes(interno.fase)) {
    nFase = 1;
    detalleFase = `Ofrece programa para la fase ${interno.fase}`;
  } else if (d.fases.some((f) => Math.abs(ORDEN_FASE[f] - ORDEN_FASE[interno.fase]) === 1)) {
    nFase = 0.5;
    detalleFase = `Programa parcial: ofrece una fase contigua a ${interno.fase}`;
  }
  const fase = aporte(nFase, c.pesos.fase, detalleFase);

  const riesgo = aporte(1 - Math.min(1, d.proporcionAltoRiesgo / c.riesgoMaxProporcion), c.pesos.riesgo,
    `${Math.round(d.proporcionAltoRiesgo * 100)} % de perfiles de alto riesgo en el destino`);

  return { cupo, hacinamiento, distancia, fase, riesgo };
}

export function evaluarDestinos(interno: InternoMotor, destinos: DestinoMotor[], c: ConfigMotor): ResultadoDestino[] {
  const activos = destinos.filter((d) => d.activo);
  const indices = activos.map((d) => ocupacion(d.capacidad, d.poblacion).hacinamientoPct);
  const hacMax = indices.length ? Math.max(...indices) : 0;
  const hacMin = indices.length ? Math.min(...indices) : 0;
  const origen = destinos.find((d) => d.id === interno.establecimientoId);
  const hacOrigen = origen ? ocupacion(origen.capacidad, origen.poblacion).hacinamientoPct : 0;

  const elegibles: ResultadoDestino[] = [];
  const descartados: ResultadoDestino[] = [];

  for (const d of destinos) {
    const o = ocupacion(d.capacidad, d.poblacion);
    const motivo = motivoDescarte(interno, d);
    if (motivo) {
      descartados.push({
        destinoId: d.id, nombre: d.nombre, elegible: false, motivoDescarte: motivo, posicion: null, puntaje: null,
        aportes: null, metricas: { cupoLibre: o.cupoLibre, hacinamientoPct: o.hacinamientoPct, distanciaKm: null },
        explicacion: `Descartado: ${motivo}`,
      });
      continue;
    }
    const distancia = interno.sedeProcedencia ? Math.round(distanciaKm(interno.sedeProcedencia, d.ubicacion)) : null;
    const aportes = calcularAportes(interno, d, c, { hacOrigen, hacMax, hacMin, distancia });
    const puntaje = r3(Object.values(aportes).reduce((a, f) => a + f.aporte, 0));
    elegibles.push({
      destinoId: d.id, nombre: d.nombre, elegible: true, motivoDescarte: null, posicion: null, puntaje, aportes,
      metricas: { cupoLibre: o.cupoLibre, hacinamientoPct: o.hacinamientoPct, distanciaKm: distancia }, explicacion: '',
    });
  }

  elegibles.sort((a, b) => (b.puntaje! - a.puntaje!) || (b.metricas.cupoLibre - a.metricas.cupoLibre) || a.destinoId.localeCompare(b.destinoId));
  elegibles.forEach((r, i) => {
    r.posicion = i + 1;
    const partes = [
      `${r.metricas.cupoLibre} plazas libres`,
      `hacinamiento ${pct(r.metricas.hacinamientoPct)} (origen ${pct(hacOrigen)})`,
      r.metricas.distanciaKm === null ? 'distancia no disponible' : `${r.metricas.distanciaKm} km de ${interno.regionProcedencia}`,
      r.aportes!.fase.detalle.toLowerCase(),
    ];
    r.explicacion = `#${r.posicion} ${r.nombre}: ${partes.join(', ')}. Puntaje ${r.puntaje!.toFixed(3)}.`;
  });
  descartados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return [...elegibles, ...descartados];
}
