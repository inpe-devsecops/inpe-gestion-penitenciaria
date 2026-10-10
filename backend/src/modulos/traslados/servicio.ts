// Flujo del traslado con segregación de funciones (Figura 3 del informe):
//   responsable regional registra → el motor evalúa → el administrador central (distinto del solicitante)
//   aprueba o rechaza → el director del establecimiento registra la ejecución.
// Cada etapa deja una entrada en la auditoría.
import type { Request } from 'express';
import type { ClientSession, Types } from 'mongoose';
import { CAUSAL_LABEL, type CausalTraslado, type EstadoSolicitud } from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { conflicto, ErrorApi, noEncontrado, reglaDeNegocio, sinPermiso } from '../../lib/errores';
import { conTransaccion } from '../../lib/transaccion';
import { regexLiteral } from '../../lib/validacion';
import {
  DecisionTraslado, Establecimiento, EvaluacionDestino, Interno, SolicitudTraslado, Usuario, siguienteCodigo,
  type EstablecimientoDoc, type InternoDoc, type SolicitudDoc,
} from '../../modelos';
import { establecimientosDelAmbito, puedeVerEstablecimiento } from '../../seguridad/auth';
import { cifrar, descifrar } from '../../seguridad/cripto';
import { cargarOficinas, registrarEnSerie, type Oficinas } from '../establecimientos/servicio';
import { configMotor, obtenerParametros } from '../parametros/servicio';
import { evaluarDestinos, type DestinoMotor, type InternoMotor, type ResultadoDestino } from './motor';

const clave = (req: Request): Buffer => req.app.locals.dataKey as Buffer;

// ----- Entradas del motor

function aDestino(e: EstablecimientoDoc): DestinoMotor {
  return {
    id: e._id, nombre: e.nombre, ubicacion: e.ubicacion, capacidad: e.capacidad_oficial, poblacion: e.poblacion_actual,
    techo: e.techo_seguridad, regimenes: e.regimenes_admitidos, genero: e.genero_poblacion, fases: e.fases_tratamiento,
    proporcionAltoRiesgo: e.proporcion_alto_riesgo, activo: e.activo ?? true,
  };
}

function aInternoMotor(i: InternoDoc, oficinas: Oficinas): InternoMotor {
  return {
    codigo: i._id, sexo: i.sexo, clasificacion: i.clasificacion, fase: i.fase_tratamiento,
    regionProcedencia: oficinas.get(i.region_procedencia)?.nombre ?? i.region_procedencia,
    sedeProcedencia: oficinas.get(i.region_procedencia)?.sede ?? null, establecimientoId: i.establecimiento_id,
  };
}

async function ejecutarMotor(interno: InternoDoc) {
  const [ests, oficinas, p] = await Promise.all([Establecimiento.find({}).lean(), cargarOficinas(), obtenerParametros()]);
  const config = configMotor(p);
  const resultados = evaluarDestinos(aInternoMotor(interno, oficinas), (ests as EstablecimientoDoc[]).map(aDestino), config);
  return { resultados, pesos: config.pesos };
}

// El solicitante debe poder operar sobre el establecimiento actual del interno.
async function internoParaSolicitar(req: Request, internoId: string) {
  const u = req.usuario!;
  const interno = await Interno.findById(internoId).lean() as InternoDoc | null;
  if (!interno) throw noEncontrado('Interno');
  const origen = await Establecimiento.findById(interno.establecimiento_id).lean();
  if (!origen) throw noEncontrado('Establecimiento de origen');
  const permitido = u.rol === 'ADMIN_CENTRAL' || (u.rol === 'RESPONSABLE_REGIONAL' && puedeVerEstablecimiento(u, origen));
  if (!permitido) {
    await auditar(req, { accion: 'SOLICITAR_TRASLADO', entidad: 'internos', entidad_id: internoId, resultado: 'DENEGADO', detalle: 'Interno fuera del ámbito' });
    throw sinPermiso('El interno no pertenece a su ámbito');
  }
  return { interno, origen: origen as EstablecimientoDoc };
}

// Ranking del motor sin registrar la solicitud (para revisar antes de iniciar el trámite)
export async function vistaPrevia(req: Request, internoId: string) {
  const { interno } = await internoParaSolicitar(req, internoId);
  const { resultados, pesos } = await ejecutarMotor(interno);
  const evaluaciones = resultados.map(({ nombre, ...r }) => ({ ...r, destino: nombre }));
  return { internoId, pesos, evaluaciones, generadaEn: new Date() };
}

// ----- Registro (RF-11 a RF-19)

// Documento de evaluación de un destino tal como se conserva en la base (RF-19)
export function filaEvaluacion(solicitudId: Types.ObjectId, r: ResultadoDestino, fecha: Date) {
  return {
    solicitud_id: solicitudId, destino_id: r.destinoId, elegible: r.elegible, posicion: r.posicion, puntaje: r.puntaje,
    aportes: r.aportes, motivo_descarte: r.motivoDescarte, explicacion: r.explicacion, generada_en: fecha,
    metricas: { cupo_libre: r.metricas.cupoLibre, hacinamiento_pct: r.metricas.hacinamientoPct, distancia_km: r.metricas.distanciaKm },
  };
}

export async function crearSolicitud(req: Request, datos: { internoId: string; causal: CausalTraslado; fundamento: string }) {
  const { interno, origen } = await internoParaSolicitar(req, datos.internoId);
  const abierta = await SolicitudTraslado.findOne({ interno_id: interno._id, en_tramite: true }, { codigo: 1 }).lean();
  if (abierta) throw conflicto(`El interno ya tiene un traslado en trámite (${abierta.codigo})`);

  const { resultados, pesos } = await ejecutarMotor(interno);
  const mejor = resultados.find((r) => r.elegible) ?? null;
  const ahora = new Date();
  const codigo = await siguienteCodigo('TR', ahora.getFullYear());

  const id = await conTransaccion(async (session) => {
    const [s] = await SolicitudTraslado.create([{
      codigo, interno_id: interno._id, origen_id: origen._id, causal: datos.causal, fundamento_cifrado: cifrar(datos.fundamento, clave(req)),
      estado: 'EVALUADA', en_tramite: true, solicitante_id: req.usuario!.id, solicitada_en: ahora, pesos,
      destino_recomendado_id: mejor?.destinoId ?? null, puntaje_recomendado: mejor?.puntaje ?? null,
    }], { session });
    await EvaluacionDestino.insertMany(resultados.map((r) => filaEvaluacion(s._id, r, ahora)), { session });
    await auditar(req, {
      accion: 'SOLICITAR_TRASLADO', entidad: 'solicitudes_traslado', entidad_id: String(s._id), resultado: 'EXITO',
      valor_nuevo: { codigo, interno: interno._id, origen: origen._id, causal: datos.causal, destino_recomendado: mejor?.destinoId ?? null, puntaje: mejor?.puntaje ?? null },
    }, session);
    return String(s._id);
  });
  return obtenerSolicitud(req, id);
}

// ----- Consulta

async function ambitoSolicitudes(req: Request): Promise<Record<string, unknown>> {
  const ids = await establecimientosDelAmbito(req.usuario!);
  return ids ? { $or: [{ origen_id: { $in: ids } }, { destino_id: { $in: ids } }, { destino_recomendado_id: { $in: ids } }] } : {};
}

async function nombres(solicitudes: SolicitudDoc[], extraUsuarios: string[] = []) {
  const estIds = new Set<string>();
  const usrIds = new Set<string>(extraUsuarios);
  for (const s of solicitudes) {
    [s.origen_id, s.destino_id, s.destino_recomendado_id].forEach((x) => x && estIds.add(x));
    [s.solicitante_id, s.ejecutado_por].forEach((x) => x && usrIds.add(x));
  }
  const [ests, usrs] = await Promise.all([
    Establecimiento.find({ _id: { $in: [...estIds] } }, { nombre: 1 }).lean(),
    Usuario.find({ _id: { $in: [...usrIds] } }, { nombre_completo: 1 }).lean(),
  ]);
  return { est: new Map(ests.map((e) => [e._id, e.nombre])), usr: new Map(usrs.map((u) => [u._id, u.nombre_completo])) };
}

function aResumen(s: SolicitudDoc, n: Awaited<ReturnType<typeof nombres>>, interno?: InternoDoc | null) {
  const est = (id: string | null | undefined) => (id ? n.est.get(id) ?? id : null);
  return {
    id: String(s._id), codigo: s.codigo, estado: s.estado as EstadoSolicitud, causal: s.causal, causalLabel: CAUSAL_LABEL[s.causal as CausalTraslado],
    internoId: s.interno_id,
    interno: interno ? { sexo: interno.sexo, clasificacion: interno.clasificacion, fase: interno.fase_tratamiento, nivelRiesgo: interno.nivel_riesgo, regionProcedencia: interno.region_procedencia } : null,
    origenId: s.origen_id, origen: est(s.origen_id),
    destinoRecomendadoId: s.destino_recomendado_id ?? null, destinoRecomendado: est(s.destino_recomendado_id), puntajeRecomendado: s.puntaje_recomendado ?? null,
    destinoId: s.destino_id ?? null, destino: est(s.destino_id),
    solicitanteId: s.solicitante_id, solicitante: n.usr.get(s.solicitante_id) ?? s.solicitante_id, solicitadaEn: s.solicitada_en,
    decididaEn: s.decidida_en ?? null,
    ejecutadoPorId: s.ejecutado_por ?? null, ejecutadoPor: s.ejecutado_por ? n.usr.get(s.ejecutado_por) ?? s.ejecutado_por : null, ejecutadaEn: s.ejecutada_en ?? null,
  };
}

export interface FiltrosSolicitudes {
  estado?: EstadoSolicitud;
  soloPendientes?: boolean;
  establecimientoId?: string;
  busqueda?: string;
  pagina: number;
  porPagina: number;
}

export async function listarSolicitudes(req: Request, f: FiltrosSolicitudes) {
  const condiciones: Record<string, unknown>[] = [await ambitoSolicitudes(req)];
  if (f.estado) condiciones.push({ estado: f.estado });
  if (f.soloPendientes) condiciones.push({ estado: 'EVALUADA' });
  if (f.establecimientoId) condiciones.push({ $or: [{ origen_id: f.establecimientoId }, { destino_id: f.establecimientoId }] });
  if (f.busqueda) condiciones.push({ $or: [{ codigo: regexLiteral(f.busqueda) }, { interno_id: regexLiteral(f.busqueda) }] });
  const filtro = { $and: condiciones };
  const [docs, total] = await Promise.all([
    SolicitudTraslado.find(filtro).sort({ solicitada_en: -1 }).skip((f.pagina - 1) * f.porPagina).limit(f.porPagina).lean(),
    SolicitudTraslado.countDocuments(filtro),
  ]);
  const n = await nombres(docs as SolicitudDoc[]);
  return { datos: docs.map((d) => aResumen(d as SolicitudDoc, n)), total, pagina: f.pagina, porPagina: f.porPagina };
}

async function solicitudVisible(req: Request, id: string) {
  const s = await SolicitudTraslado.findById(id).lean();
  if (!s) throw noEncontrado('Solicitud de traslado');
  const ids = await establecimientosDelAmbito(req.usuario!);
  const relacionados = [s.origen_id, s.destino_id, s.destino_recomendado_id].filter(Boolean) as string[];
  if (ids && !relacionados.some((x) => ids.includes(x))) {
    await auditar(req, { accion: 'CONSULTA_TRASLADO', entidad: 'solicitudes_traslado', entidad_id: id, resultado: 'DENEGADO', detalle: 'Fuera del ámbito' });
    throw sinPermiso('La solicitud no pertenece a su ámbito');
  }
  return s as SolicitudDoc;
}

function permisos(req: Request, s: SolicitudDoc) {
  const u = req.usuario!;
  let decidir: string | null = null;
  if (u.rol !== 'ADMIN_CENTRAL') decidir = 'Solo el administrador central decide los traslados';
  else if (s.estado !== 'EVALUADA') decidir = 'La solicitud ya fue resuelta';
  else if (s.solicitante_id === u.id) decidir = 'No puede decidir una solicitud que usted registró (segregación de funciones)';
  let ejecutar: string | null = null;
  if (u.rol !== 'DIRECTOR_ESTABLECIMIENTO') ejecutar = 'Solo el director del establecimiento registra la ejecución';
  else if (s.estado !== 'APROBADA') ejecutar = 'Solo se ejecutan solicitudes aprobadas';
  else if (u.establecimientoId !== s.origen_id && u.establecimientoId !== s.destino_id) ejecutar = 'El traslado no involucra a su establecimiento';
  return { puedeDecidir: decidir === null, motivoNoDecidir: decidir, puedeEjecutar: ejecutar === null, motivoNoEjecutar: ejecutar };
}

export async function obtenerSolicitud(req: Request, id: string) {
  const s = await solicitudVisible(req, id);
  const [interno, evals, decision] = await Promise.all([
    Interno.findById(s.interno_id).lean() as Promise<InternoDoc | null>,
    EvaluacionDestino.find({ solicitud_id: s._id }).lean(),
    DecisionTraslado.findOne({ solicitud_id: s._id }).lean(),
  ]);
  const n = await nombres([s], decision ? [decision.decidido_por] : []);
  const estNombres = new Map((await Establecimiento.find({}, { nombre: 1 }).lean()).map((e) => [e._id, e.nombre]));
  evals.sort((a, b) => Number(b.elegible) - Number(a.elegible) || (a.posicion ?? 999) - (b.posicion ?? 999)
    || (estNombres.get(a.destino_id) ?? '').localeCompare(estNombres.get(b.destino_id) ?? '', 'es'));
  return {
    ...aResumen(s, n, interno),
    fundamento: descifrar(s.fundamento_cifrado, clave(req)),
    pesos: s.pesos,
    evaluaciones: evals.map((e) => ({
      destinoId: e.destino_id, destino: estNombres.get(e.destino_id) ?? e.destino_id, elegible: e.elegible, posicion: e.posicion ?? null,
      puntaje: e.puntaje ?? null, aportes: e.aportes ?? null, motivoDescarte: e.motivo_descarte ?? null, explicacion: e.explicacion,
      metricas: { cupoLibre: e.metricas?.cupo_libre ?? 0, hacinamientoPct: e.metricas?.hacinamiento_pct ?? 0, distanciaKm: e.metricas?.distancia_km ?? null },
    })),
    decision: decision ? {
      resultado: decision.resultado, decididoPorId: decision.decidido_por, decididoPor: n.usr.get(decision.decidido_por) ?? decision.decidido_por,
      destinoId: decision.destino_id ?? null, destino: decision.destino_id ? estNombres.get(decision.destino_id) ?? decision.destino_id : null,
      seApartaDeRecomendacion: decision.se_aparta_de_recomendacion, fundamento: descifrar(decision.fundamento_cifrado, clave(req)),
      decididaEn: decision.decidida_en,
    } : null,
    permisos: permisos(req, s),
  };
}

// ----- Decisión (RF-20 a RF-23)

async function solicitudParaDecidir(req: Request, id: string, accion: string) {
  const s = await solicitudVisible(req, id);
  if (s.estado !== 'EVALUADA') throw reglaDeNegocio('La solicitud ya fue resuelta');
  if (s.solicitante_id === req.usuario!.id) {
    await auditar(req, { accion, entidad: 'solicitudes_traslado', entidad_id: id, resultado: 'DENEGADO', detalle: 'Autoaprobación bloqueada: el usuario registró la solicitud' });
    throw sinPermiso('No puede decidir una solicitud que usted registró (segregación de funciones)');
  }
  return s;
}

async function registrarDecision(
  req: Request, s: SolicitudDoc, resultado: 'APROBADA' | 'RECHAZADA', destinoId: string | null, fundamento: string, session?: ClientSession,
) {
  const ahora = new Date();
  await DecisionTraslado.create([{
    solicitud_id: s._id, solicitante_id: s.solicitante_id, decidido_por: req.usuario!.id, resultado, destino_id: destinoId,
    se_aparta_de_recomendacion: resultado === 'APROBADA' && destinoId !== s.destino_recomendado_id,
    fundamento_cifrado: cifrar(fundamento, clave(req)), decidida_en: ahora,
  }], { session });
  const r = await SolicitudTraslado.updateOne(
    { _id: s._id, estado: 'EVALUADA' },
    { $set: { estado: resultado, en_tramite: resultado === 'APROBADA', destino_id: destinoId, decidida_en: ahora } },
    { session },
  );
  if (r.modifiedCount !== 1) throw conflicto('La solicitud cambió mientras se procesaba la decisión');
}

export async function aprobar(req: Request, id: string, datos: { destinoId?: string; fundamento: string }) {
  const s = await solicitudParaDecidir(req, id, 'APROBAR_TRASLADO');
  const destinoId = datos.destinoId ?? s.destino_recomendado_id;
  if (!destinoId) throw reglaDeNegocio('El motor no encontró destinos elegibles: la solicitud solo puede rechazarse');
  const evaluacion = await EvaluacionDestino.findOne({ solicitud_id: s._id, destino_id: destinoId }).lean();
  if (!evaluacion?.elegible) throw reglaDeNegocio(`El destino no fue elegible en la evaluación${evaluacion?.motivo_descarte ? `: ${evaluacion.motivo_descarte}` : ''}`);
  const destino = await Establecimiento.findById(destinoId).lean();
  if (!destino || destino.capacidad_oficial - destino.poblacion_actual <= 0) throw reglaDeNegocio('El destino ya no tiene cupo libre');
  if (destinoId !== s.destino_recomendado_id && datos.fundamento.length < 40) {
    throw new ErrorApi(400, 'VALIDACION', 'Para apartarse de la recomendación el fundamento debe tener al menos 40 caracteres',
      [{ campo: 'fundamento', mensaje: 'Explique por qué elige un destino distinto al recomendado' }]);
  }
  await conTransaccion(async (session) => {
    await registrarDecision(req, s, 'APROBADA', destinoId, datos.fundamento, session);
    await auditar(req, {
      accion: 'APROBAR_TRASLADO', entidad: 'solicitudes_traslado', entidad_id: id, resultado: 'EXITO',
      valor_anterior: { estado: 'EVALUADA' }, valor_nuevo: { estado: 'APROBADA', destino: destinoId, recomendado: s.destino_recomendado_id },
    }, session);
  });
  return obtenerSolicitud(req, id);
}

export async function rechazar(req: Request, id: string, datos: { fundamento: string }) {
  const s = await solicitudParaDecidir(req, id, 'RECHAZAR_TRASLADO');
  await conTransaccion(async (session) => {
    await registrarDecision(req, s, 'RECHAZADA', null, datos.fundamento, session);
    await auditar(req, {
      accion: 'RECHAZAR_TRASLADO', entidad: 'solicitudes_traslado', entidad_id: id, resultado: 'EXITO',
      valor_anterior: { estado: 'EVALUADA' }, valor_nuevo: { estado: 'RECHAZADA' },
    }, session);
  });
  return obtenerSolicitud(req, id);
}

// ----- Ejecución (RF-24): mueve al interno y actualiza la ocupación de origen y destino

export async function ejecutar(req: Request, id: string, observacion: string | undefined) {
  const u = req.usuario!;
  const s = await solicitudVisible(req, id);
  if (u.establecimientoId !== s.origen_id && u.establecimientoId !== s.destino_id) {
    await auditar(req, { accion: 'EJECUTAR_TRASLADO', entidad: 'solicitudes_traslado', entidad_id: id, resultado: 'DENEGADO', detalle: 'El traslado no involucra a su establecimiento' });
    throw sinPermiso('El traslado no involucra a su establecimiento');
  }
  if (s.estado !== 'APROBADA' || !s.destino_id) throw reglaDeNegocio('Solo se ejecutan solicitudes aprobadas');
  const [origen, destino] = await Promise.all([Establecimiento.findById(s.origen_id).lean(), Establecimiento.findById(s.destino_id).lean()]);
  if (!origen || !destino) throw noEncontrado('Establecimiento');
  if (destino.capacidad_oficial - destino.poblacion_actual <= 0) throw reglaDeNegocio('El destino ya no tiene cupo libre: la decisión debe revisarse');

  await conTransaccion(async (session) => {
    const ahora = new Date();
    const r = await SolicitudTraslado.updateOne(
      { _id: s._id, estado: 'APROBADA' },
      { $set: { estado: 'EJECUTADA', en_tramite: false, ejecutado_por: u.id, ejecutada_en: ahora } },
      { session },
    );
    if (r.modifiedCount !== 1) throw conflicto('La solicitud cambió mientras se registraba la ejecución');
    const mov = await Interno.updateOne({ _id: s.interno_id, establecimiento_id: s.origen_id },
      { $set: { establecimiento_id: s.destino_id, actualizado_en: ahora } }, { session });
    if (mov.modifiedCount !== 1) throw conflicto('El interno ya no se encuentra en el establecimiento de origen');
    await Establecimiento.updateOne({ _id: origen._id, poblacion_actual: { $gt: 0 } }, { $inc: { poblacion_actual: -1 }, $set: { actualizado_en: ahora } }, { session });
    await Establecimiento.updateOne({ _id: destino._id }, { $inc: { poblacion_actual: 1 }, $set: { actualizado_en: ahora } }, { session });
    await registrarEnSerie(origen._id, origen.poblacion_actual - 1, origen.capacidad_oficial, session);
    await registrarEnSerie(destino._id, destino.poblacion_actual + 1, destino.capacidad_oficial, session);
    await auditar(req, {
      accion: 'EJECUTAR_TRASLADO', entidad: 'solicitudes_traslado', entidad_id: id, resultado: 'EXITO',
      valor_anterior: { interno_en: s.origen_id, poblacion_origen: origen.poblacion_actual, poblacion_destino: destino.poblacion_actual },
      valor_nuevo: { interno_en: s.destino_id, poblacion_origen: origen.poblacion_actual - 1, poblacion_destino: destino.poblacion_actual + 1 },
      detalle: observacion ?? null,
    }, session);
  });
  return { solicitud: await obtenerSolicitud(req, id), afectados: [s.origen_id, s.destino_id] };
}

