// Capa de servicios: los componentes no llaman a fetch directamente.
// El token vive solo en memoria (no en localStorage ni sessionStorage): se pierde al recargar la página,
// a cambio de no quedar expuesto a un script inyectado (XSS). Dura 15 minutos y se revoca al salir.
const BASE = import.meta.env.VITE_API_URL ?? '';

let token: string | null = null;
export const fijarToken = (t: string | null) => { token = t; };
export const hayToken = () => token !== null;

export class ErrorHttp extends Error {
  constructor(readonly estado: number, mensaje: string, readonly codigo: string, readonly detalles?: { campo: string; mensaje: string }[]) {
    super(mensaje);
  }
}

let alNoAutorizado: (() => void) | null = null;
export const registrarManejadorNoAutorizado = (fn: () => void) => { alNoAutorizado = fn; };

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH';
  cuerpo?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function api<T>(ruta: string, o: Opciones = {}): Promise<T> {
  const url = new URL(`${BASE}${ruta}`, window.location.origin);
  for (const [k, v] of Object.entries(o.params ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      method: o.metodo ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(o.cuerpo !== undefined ? { body: JSON.stringify(o.cuerpo) } : {}),
    });
  } catch {
    throw new ErrorHttp(0, 'No se pudo contactar con el servidor. Verifique que la API esté en ejecución.', 'SIN_CONEXION');
  }
  if (res.status === 204) return undefined as T;
  const cuerpo = await res.json().catch(() => ({})) as { error?: string; codigo?: string; detalles?: { campo: string; mensaje: string }[] };
  if (!res.ok) {
    if (res.status === 401 && token) {
      token = null;
      alNoAutorizado?.();
    }
    throw new ErrorHttp(res.status, cuerpo.error ?? `Error ${res.status}`, cuerpo.codigo ?? 'ERROR', cuerpo.detalles);
  }
  return cuerpo as T;
}

// Mensaje legible de un error, incluido el detalle por campo de la validación (RNF-23)
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorHttp && e.detalles?.length) return `${e.message}: ${e.detalles.map((d) => d.mensaje).join('; ')}`;
  return e instanceof Error ? e.message : 'Error inesperado';
}

// ----- Formato
export const numero = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '-' : new Intl.NumberFormat('es-PE').format(v));
export const porcentaje = (v: number | null | undefined) => (v === null || v === undefined ? '-' : `${v.toFixed(1)} %`);
export const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-');
export const fechaHora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const etiqueta = (v: string | null | undefined) => (v ? (v.charAt(0) + v.slice(1).toLowerCase()).replace(/_/g, ' ') : '-');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const corte = (c: string | null | undefined) => {
  if (!c) return '-';
  const [a, m] = c.split('-');
  return `${MESES[Number(m) - 1]} ${a}`;
};
