// Ficha mínima del interno (RF-01, RNF-08): solo lo que el motor necesita. No hay nombres, documentos,
// datos de salud ni de familiares; lo que el sistema no almacena no puede filtrarse.
import type { Request } from 'express';
import {
  NIVEL_CLASIFICACION, NIVEL_TECHO, type Clasificacion, type FaseTratamiento, type Sexo, type SituacionJuridica,
} from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { noEncontrado, reglaDeNegocio, sinPermiso } from '../../lib/errores';
import { regexLiteral } from '../../lib/validacion';
import { Establecimiento, Interno, SolicitudTraslado, siguienteNumero, type InternoDoc } from '../../modelos';
import { establecimientosDelAmbito, puedeVerEstablecimiento } from '../../seguridad/auth';
import { cargarOficinas } from '../establecimientos/servicio';

function aDto(i: InternoDoc, est: Map<string, string>, ofi: Map<string, { nombre: string }>) {
  return {
    id: i._id, sexo: i.sexo, clasificacion: i.clasificacion, faseTratamiento: i.fase_tratamiento,
    situacionJuridica: i.situacion_juridica, nivelRiesgo: i.nivel_riesgo,
    regionProcedenciaId: i.region_procedencia, regionProcedencia: ofi.get(i.region_procedencia)?.nombre ?? i.region_procedencia,
    establecimientoId: i.establecimiento_id, establecimiento: est.get(i.establecimiento_id) ?? i.establecimiento_id,
    fechaIngreso: i.fecha_ingreso, datoFicticio: i.dato_ficticio,
  };
}

async function mapas() {
  const [ests, ofi] = await Promise.all([Establecimiento.find({}, { nombre: 1 }).lean(), cargarOficinas()]);
  return { est: new Map(ests.map((e) => [e._id, e.nombre])), ofi };
}

export interface FiltrosInternos {
  establecimientoId?: string;
  clasificacion?: Clasificacion;
  fase?: FaseTratamiento;
  situacion?: SituacionJuridica;
  busqueda?: string;
  pagina: number;
  porPagina: number;
}

export async function listarInternos(req: Request, f: FiltrosInternos) {
  const ambito = await establecimientosDelAmbito(req.usuario!);
  const filtro: Record<string, unknown> = {};
  if (ambito) filtro.establecimiento_id = { $in: ambito };
  if (f.establecimientoId) {
    if (ambito && !ambito.includes(f.establecimientoId)) throw sinPermiso('El establecimiento no pertenece a su ámbito');
    filtro.establecimiento_id = f.establecimientoId;
  }
  if (f.clasificacion) filtro.clasificacion = f.clasificacion;
  if (f.fase) filtro.fase_tratamiento = f.fase;
  if (f.situacion) filtro.situacion_juridica = f.situacion;
  if (f.busqueda) filtro._id = regexLiteral(f.busqueda);
  const [docs, total, m] = await Promise.all([
    Interno.find(filtro).sort({ _id: 1 }).skip((f.pagina - 1) * f.porPagina).limit(f.porPagina).lean(),
    Interno.countDocuments(filtro),
    mapas(),
  ]);
  return { datos: docs.map((d) => aDto(d as InternoDoc, m.est, m.ofi)), total, pagina: f.pagina, porPagina: f.porPagina };
}

async function internoVisible(req: Request, id: string) {
  const i = await Interno.findById(id).lean() as InternoDoc | null;
  if (!i) throw noEncontrado('Interno');
  const est = await Establecimiento.findById(i.establecimiento_id, { oficina_id: 1 }).lean();
  if (!est || !puedeVerEstablecimiento(req.usuario!, est)) {
    await auditar(req, { accion: 'CONSULTA_INTERNO', entidad: 'internos', entidad_id: id, resultado: 'DENEGADO', detalle: 'Fuera del ámbito' });
    throw sinPermiso('El interno no pertenece a su ámbito');
  }
  return { interno: i, establecimiento: est };
}

export async function obtenerInterno(req: Request, id: string) {
  const { interno } = await internoVisible(req, id);
  const [m, solicitudes] = await Promise.all([
    mapas(),
    SolicitudTraslado.find({ interno_id: id }, { codigo: 1, estado: 1, causal: 1, origen_id: 1, destino_id: 1, solicitada_en: 1, ejecutada_en: 1 })
      .sort({ solicitada_en: -1 }).lean(),
  ]);
  return {
    ...aDto(interno, m.est, m.ofi),
    traslados: solicitudes.map((s) => ({
      id: String(s._id), codigo: s.codigo, estado: s.estado, causal: s.causal,
      origen: m.est.get(s.origen_id) ?? s.origen_id, destino: s.destino_id ? m.est.get(s.destino_id) ?? s.destino_id : null,
      solicitadaEn: s.solicitada_en, ejecutadaEn: s.ejecutada_en ?? null,
    })),
  };
}

function puedeEditarEn(req: Request, establecimientoId: string) {
  const u = req.usuario!;
  return u.rol === 'ADMIN_CENTRAL' || (u.rol === 'DIRECTOR_ESTABLECIMIENTO' && u.establecimientoId === establecimientoId);
}

export interface DatosInterno {
  sexo: Sexo;
  clasificacion: Clasificacion;
  faseTratamiento: FaseTratamiento;
  situacionJuridica: SituacionJuridica;
  nivelRiesgo: number;
  regionProcedenciaId: string;
  establecimientoId: string;
  fechaIngreso: Date;
}

// Registrar una ficha no cambia la ocupación agregada: la población vigente es la cifra oficial del
// establecimiento y se actualiza con el reporte del director o con la ejecución de un traslado.
export async function crearInterno(req: Request, d: DatosInterno) {
  if (!puedeEditarEn(req, d.establecimientoId)) {
    await auditar(req, { accion: 'REGISTRAR_INTERNO', entidad: 'internos', resultado: 'DENEGADO', detalle: `Establecimiento ${d.establecimientoId}` });
    throw sinPermiso('Solo puede registrar fichas en su establecimiento');
  }
  const [est, oficinas] = await Promise.all([Establecimiento.findById(d.establecimientoId).lean(), cargarOficinas()]);
  if (!est) throw noEncontrado('Establecimiento');
  if (!oficinas.has(d.regionProcedenciaId)) throw reglaDeNegocio('La región de procedencia no existe');
  if (est.genero_poblacion !== 'MIXTO' && (est.genero_poblacion === 'FEMENINO') !== (d.sexo === 'F')) {
    throw reglaDeNegocio('El establecimiento no alberga población de ese sexo');
  }
  if (NIVEL_TECHO[est.techo_seguridad] < NIVEL_CLASIFICACION[d.clasificacion]) {
    throw reglaDeNegocio(`El establecimiento (techo ${est.techo_seguridad}) no puede albergar la clasificación ${d.clasificacion}`);
  }
  const id = `INT-${String(await siguienteNumero('internos')).padStart(6, '0')}`;
  await Interno.create({
    _id: id, sexo: d.sexo, clasificacion: d.clasificacion, fase_tratamiento: d.faseTratamiento, situacion_juridica: d.situacionJuridica,
    nivel_riesgo: d.nivelRiesgo, region_procedencia: d.regionProcedenciaId, establecimiento_id: d.establecimientoId,
    fecha_ingreso: d.fechaIngreso, dato_ficticio: true,
  });
  await auditar(req, { accion: 'REGISTRAR_INTERNO', entidad: 'internos', entidad_id: id, resultado: 'EXITO', valor_nuevo: { ...d } });
  return obtenerInterno(req, id);
}

export async function actualizarInterno(
  req: Request, id: string,
  cambios: Partial<Pick<DatosInterno, 'clasificacion' | 'faseTratamiento' | 'situacionJuridica' | 'nivelRiesgo'>>,
) {
  const { interno } = await internoVisible(req, id);
  if (!puedeEditarEn(req, interno.establecimiento_id)) {
    await auditar(req, { accion: 'ACTUALIZAR_INTERNO', entidad: 'internos', entidad_id: id, resultado: 'DENEGADO' });
    throw sinPermiso('Solo el director del establecimiento o el administrador central actualizan la ficha');
  }
  const set: Record<string, unknown> = {};
  const anterior: Record<string, unknown> = {};
  const mapa = { clasificacion: 'clasificacion', faseTratamiento: 'fase_tratamiento', situacionJuridica: 'situacion_juridica', nivelRiesgo: 'nivel_riesgo' } as const;
  for (const [k, campo] of Object.entries(mapa) as [keyof typeof mapa, (typeof mapa)[keyof typeof mapa]][]) {
    if (cambios[k] !== undefined && cambios[k] !== interno[campo]) {
      set[campo] = cambios[k];
      anterior[campo] = interno[campo];
    }
  }
  if (!Object.keys(set).length) return obtenerInterno(req, id);
  await Interno.updateOne({ _id: id }, { $set: { ...set, actualizado_en: new Date() } }, { runValidators: true });
  await auditar(req, { accion: 'ACTUALIZAR_INTERNO', entidad: 'internos', entidad_id: id, resultado: 'EXITO', valor_anterior: anterior, valor_nuevo: set });
  return obtenerInterno(req, id);
}
