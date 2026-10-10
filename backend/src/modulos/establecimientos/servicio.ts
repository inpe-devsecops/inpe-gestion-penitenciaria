import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import type { TechoSeguridad } from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { ErrorApi, noEncontrado, sinPermiso } from '../../lib/errores';
import { regexLiteral } from '../../lib/validacion';
import { Establecimiento, OcupacionHistorica, OficinaRegional, type EstablecimientoDoc } from '../../modelos';
import { filtroEstablecimientos, puedeVerEstablecimiento } from '../../seguridad/auth';
import { obtenerParametros } from '../parametros/servicio';
import { proyectar } from '../proyeccion/proyeccion';
import { nivelHacinamiento, ocupacion, type Umbrales } from './metricas';

export type Oficinas = Map<string, { nombre: string; sede: { latitud: number; longitud: number } }>;

export async function cargarOficinas(): Promise<Oficinas> {
  const docs = await OficinaRegional.find({}).lean();
  return new Map(docs.map((o) => [o._id, { nombre: o.nombre, sede: o.sede }]));
}

export function aDto(e: EstablecimientoDoc, oficinas: Oficinas, u: Umbrales) {
  const o = ocupacion(e.capacidad_oficial, e.poblacion_actual);
  return {
    id: e._id,
    nombre: e.nombre,
    oficinaId: e.oficina_id,
    oficina: oficinas.get(e.oficina_id)?.nombre ?? e.oficina_id,
    departamento: e.departamento,
    latitud: e.ubicacion.latitud,
    longitud: e.ubicacion.longitud,
    capacidad: o.capacidad,
    poblacion: o.poblacion,
    cupoLibre: o.cupoLibre,
    sobrepoblacion: o.sobrepoblacion,
    hacinamientoPct: o.hacinamientoPct,
    nivel: nivelHacinamiento(o.hacinamientoPct, u),
    techoSeguridad: e.techo_seguridad,
    regimenesAdmitidos: e.regimenes_admitidos,
    generoPoblacion: e.genero_poblacion,
    fasesTratamiento: e.fases_tratamiento,
    proporcionAltoRiesgo: e.proporcion_alto_riesgo,
    activo: e.activo,
  };
}
export type EstablecimientoDto = ReturnType<typeof aDto>;

export interface FiltrosEstablecimientos {
  oficinaId?: string;
  techo?: TechoSeguridad;
  nivel?: 'ATENCION' | 'SEVERO' | 'CRITICO' | 'SIN_HACINAMIENTO';
  conCupo?: boolean;
  busqueda?: string;
  orden: 'hacinamiento' | 'poblacion' | 'capacidad' | 'cupo' | 'nombre';
  direccion: 'asc' | 'desc';
  pagina: number;
  porPagina: number;
}

// 69 establecimientos: se filtran por ámbito en la base y se ordenan en memoria porque el índice es calculado.
export async function listarEstablecimientos(req: Request, f: FiltrosEstablecimientos) {
  const filtro: Record<string, unknown> = { ...filtroEstablecimientos(req.usuario!) };
  if (f.oficinaId) filtro.oficina_id = f.oficinaId;
  if (f.techo) filtro.techo_seguridad = f.techo;
  if (f.busqueda) filtro.nombre = regexLiteral(f.busqueda);
  const [docs, oficinas, p] = await Promise.all([Establecimiento.find(filtro).lean(), cargarOficinas(), obtenerParametros()]);
  let filas = docs.map((d) => aDto(d as EstablecimientoDoc, oficinas, p));
  if (f.nivel) filas = filas.filter((e) => (f.nivel === 'SIN_HACINAMIENTO' ? e.nivel === null : e.nivel === f.nivel));
  if (f.conCupo) filas = filas.filter((e) => e.cupoLibre > 0);
  const clave = { hacinamiento: 'hacinamientoPct', poblacion: 'poblacion', capacidad: 'capacidad', cupo: 'cupoLibre', nombre: 'nombre' } as const;
  const k = clave[f.orden];
  const signo = f.direccion === 'asc' ? 1 : -1;
  filas.sort((a, b) => signo * (k === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es') : (a[k] as number) - (b[k] as number)));
  const inicio = (f.pagina - 1) * f.porPagina;
  return { datos: filas.slice(inicio, inicio + f.porPagina), total: filas.length, pagina: f.pagina, porPagina: f.porPagina };
}

// Acceso a nivel de objeto: un intento fuera del ámbito se rechaza y queda auditado (Tabla 18, "Acceso fuera del ámbito").
export async function obtenerVisible(req: Request, id: string): Promise<EstablecimientoDoc> {
  const e = await Establecimiento.findById(id).lean();
  if (!e) throw noEncontrado('Establecimiento');
  if (!puedeVerEstablecimiento(req.usuario!, e)) {
    await auditar(req, { accion: 'CONSULTA_ESTABLECIMIENTO', entidad: 'establecimientos', entidad_id: id, resultado: 'DENEGADO', detalle: 'Fuera del ámbito del usuario' });
    throw sinPermiso('El establecimiento no pertenece a su ámbito');
  }
  return e as EstablecimientoDoc;
}

export async function corteVigente(): Promise<string> {
  const ultimo = await OcupacionHistorica.findOne({}, { corte: 1 }).sort({ corte: -1 }).lean();
  const hoy = new Date();
  return ultimo?.corte ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

export async function serieOcupacion(id: string) {
  const filas = await OcupacionHistorica.find({ establecimiento_id: id }).sort({ corte: 1 }).lean();
  return filas.map((f) => ({ corte: f.corte, poblacion: f.poblacion, capacidad: f.capacidad, interpolado: f.interpolado ?? false }));
}

export async function proyeccionDe(e: EstablecimientoDoc) {
  const [serie, p] = await Promise.all([serieOcupacion(e._id), obtenerParametros()]);
  return proyectar(serie, { capacidad: e.capacidad_oficial, poblacion: e.poblacion_actual }, p);
}

// Mantiene la serie histórica alineada con la ocupación vigente: el corte vigente refleja el último dato.
export async function registrarEnSerie(id: string, poblacion: number, capacidad: number, session?: ClientSession) {
  const corte = await corteVigente();
  await OcupacionHistorica.updateOne(
    { establecimiento_id: id, corte },
    { $set: { poblacion, capacidad, interpolado: false } },
    { upsert: true, session },
  );
}

// El director actualiza la ocupación de su establecimiento (carga del reporte mensual); el central, cualquiera.
export async function actualizarOcupacion(req: Request, id: string, cambios: { poblacion?: number; capacidad?: number }, motivo: string) {
  const e = await obtenerVisible(req, id);
  const u = req.usuario!;
  if (u.rol !== 'ADMIN_CENTRAL' && !(u.rol === 'DIRECTOR_ESTABLECIMIENTO' && u.establecimientoId === id)) {
    await auditar(req, { accion: 'ACTUALIZAR_OCUPACION', entidad: 'establecimientos', entidad_id: id, resultado: 'DENEGADO' });
    throw sinPermiso('Solo el director del establecimiento o el administrador central pueden actualizar la ocupación');
  }
  const anterior = { poblacion: e.poblacion_actual, capacidad: e.capacidad_oficial };
  const nuevo = { poblacion: cambios.poblacion ?? anterior.poblacion, capacidad: cambios.capacidad ?? anterior.capacidad };
  if (nuevo.capacidad < 1) throw new ErrorApi(422, 'REGLA_DE_NEGOCIO', 'La capacidad oficial debe ser mayor que cero');
  await Establecimiento.updateOne(
    { _id: id },
    { $set: { poblacion_actual: nuevo.poblacion, capacidad_oficial: nuevo.capacidad, actualizado_en: new Date() } },
    { runValidators: true },
  );
  await registrarEnSerie(id, nuevo.poblacion, nuevo.capacidad);
  await auditar(req, { accion: 'ACTUALIZAR_OCUPACION', entidad: 'establecimientos', entidad_id: id, resultado: 'EXITO',
    valor_anterior: anterior, valor_nuevo: nuevo, detalle: motivo });
  return nuevo;
}
