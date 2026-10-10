import type { Request } from 'express';
import { ORDEN_SEVERIDAD, type CondicionAlerta, type EstadoAlerta, type Severidad } from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { noEncontrado, reglaDeNegocio, sinPermiso } from '../../lib/errores';
import { Alerta, Establecimiento, OcupacionHistorica, type EstablecimientoDoc } from '../../modelos';
import { establecimientosDelAmbito, puedeVerEstablecimiento } from '../../seguridad/auth';
import { ocupacion } from '../establecimientos/metricas';
import { obtenerParametros } from '../parametros/servicio';
import { proyectar, type PuntoSerie } from '../proyeccion/proyeccion';
import { decidirAlertas } from './evaluador';

// Reevalúa los umbrales (todos los establecimientos o los indicados). Es idempotente: repetirla sin cambios
// en los datos no crea nada, y el índice único parcial impide duplicados aunque dos evaluaciones coincidan.
export async function evaluarAlertas(ids?: string[], usuarioId: string | null = null) {
  const filtro = ids ? { _id: { $in: ids }, activo: true } : { activo: true };
  const [ests, p] = await Promise.all([Establecimiento.find(filtro).lean(), obtenerParametros()]);
  const idsEval = ests.map((e) => e._id);
  const [series, vigentes] = await Promise.all([
    OcupacionHistorica.find({ establecimiento_id: { $in: idsEval } }, { establecimiento_id: 1, corte: 1, poblacion: 1 }).lean(),
    Alerta.find({ establecimiento_id: { $in: idsEval }, vigente: true }).lean(),
  ]);
  const seriePor = new Map<string, PuntoSerie[]>();
  for (const s of series) seriePor.set(s.establecimiento_id, [...(seriePor.get(s.establecimiento_id) ?? []), { corte: s.corte, poblacion: s.poblacion }]);

  const resumen = { creadas: 0, actualizadas: 0, resueltas: 0 };
  const ahora = new Date();
  for (const e of ests as EstablecimientoDoc[]) {
    const o = ocupacion(e.capacidad_oficial, e.poblacion_actual);
    const proy = proyectar(seriePor.get(e._id) ?? [], o, p);
    const propias = vigentes.filter((a) => a.establecimiento_id === e._id)
      .map((a) => ({ condicion: a.condicion as CondicionAlerta, severidad: a.severidad as Severidad }));
    for (const acc of decidirAlertas(e.nombre, o.hacinamientoPct, proy, propias, p)) {
      const clave = { establecimiento_id: e._id, condicion: acc.condicion, vigente: true };
      if (acc.tipo === 'CREAR') {
        try {
          await Alerta.create({
            ...clave, severidad: acc.severidad, estado: 'ACTIVA', valor_observado: acc.valor, umbral: acc.umbral, mensaje: acc.mensaje,
            creada_en: ahora, actualizada_en: ahora, historial: [{ fecha: ahora, evento: 'CREADA', detalle: acc.mensaje, usuario_id: usuarioId }],
          });
          resumen.creadas++;
        } catch (err) {
          if ((err as { code?: number }).code !== 11000) throw err; // otra evaluación concurrente ya la creó
        }
      } else if (acc.tipo === 'CAMBIAR_SEVERIDAD') {
        await Alerta.updateOne(clave, {
          $set: { severidad: acc.severidad, estado: 'ACTIVA', valor_observado: acc.valor, umbral: acc.umbral, mensaje: acc.mensaje, actualizada_en: ahora },
          $push: { historial: { fecha: ahora, evento: 'CAMBIO_SEVERIDAD', detalle: acc.mensaje, usuario_id: usuarioId } },
        });
        resumen.actualizadas++;
      } else {
        await Alerta.updateOne(clave, {
          $set: { estado: 'RESUELTA', vigente: false, actualizada_en: ahora },
          $push: { historial: { fecha: ahora, evento: 'RESUELTA', detalle: acc.mensaje, usuario_id: usuarioId } },
        });
        resumen.resueltas++;
      }
    }
  }
  return resumen;
}

export interface FiltrosAlertas {
  soloVigentes: boolean;
  severidad?: Severidad;
  condicion?: CondicionAlerta;
  establecimientoId?: string;
  pagina: number;
  porPagina: number;
}

export async function listarAlertas(req: Request, f: FiltrosAlertas) {
  const ambito = await establecimientosDelAmbito(req.usuario!);
  const filtro: Record<string, unknown> = {};
  if (ambito) filtro.establecimiento_id = { $in: ambito };
  if (f.establecimientoId) {
    if (ambito && !ambito.includes(f.establecimientoId)) throw sinPermiso('El establecimiento no pertenece a su ámbito');
    filtro.establecimiento_id = f.establecimientoId;
  }
  if (f.soloVigentes) filtro.vigente = true;
  if (f.severidad) filtro.severidad = f.severidad;
  if (f.condicion) filtro.condicion = f.condicion;
  const [docs, ests] = await Promise.all([
    Alerta.find(filtro, { historial: 0 }).sort({ actualizada_en: -1 }).limit(2000).lean(),
    Establecimiento.find({}, { nombre: 1, oficina_id: 1 }).lean(),
  ]);
  const nombre = new Map(ests.map((e) => [e._id, e]));
  // Vigentes primero, luego por severidad y fecha
  docs.sort((a, b) => Number(b.vigente) - Number(a.vigente)
    || ORDEN_SEVERIDAD[b.severidad as Severidad] - ORDEN_SEVERIDAD[a.severidad as Severidad]
    || b.actualizada_en.getTime() - a.actualizada_en.getTime());
  const inicio = (f.pagina - 1) * f.porPagina;
  return {
    datos: docs.slice(inicio, inicio + f.porPagina).map((a) => ({
      id: String(a._id), establecimientoId: a.establecimiento_id, establecimiento: nombre.get(a.establecimiento_id)?.nombre ?? a.establecimiento_id,
      oficinaId: nombre.get(a.establecimiento_id)?.oficina_id ?? null, condicion: a.condicion, severidad: a.severidad, estado: a.estado,
      vigente: a.vigente, valorObservado: a.valor_observado, umbral: a.umbral, mensaje: a.mensaje, creadaEn: a.creada_en, actualizadaEn: a.actualizada_en,
    })),
    total: docs.length, pagina: f.pagina, porPagina: f.porPagina,
  };
}

async function alertaVisible(req: Request, id: string) {
  const a = await Alerta.findById(id).lean();
  if (!a) throw noEncontrado('Alerta');
  const e = await Establecimiento.findById(a.establecimiento_id, { oficina_id: 1 }).lean();
  if (!e || !puedeVerEstablecimiento(req.usuario!, e)) throw sinPermiso('La alerta no pertenece a su ámbito');
  return a;
}

export async function historialAlerta(req: Request, id: string) {
  const a = await alertaVisible(req, id);
  return a.historial.map((h) => ({ fecha: h.fecha, evento: h.evento, detalle: h.detalle, usuarioId: h.usuario_id }));
}

// Reconocer una alerta indica que alguien la está atendiendo; sigue vigente hasta que baje el indicador.
export async function cambiarEstadoAlerta(req: Request, id: string, estado: Extract<EstadoAlerta, 'RECONOCIDA'>, comentario: string | undefined) {
  const a = await alertaVisible(req, id);
  if (!a.vigente || a.estado !== 'ACTIVA') throw reglaDeNegocio('Solo se puede reconocer una alerta activa');
  const ahora = new Date();
  const r = await Alerta.updateOne({ _id: a._id, estado: 'ACTIVA', vigente: true }, {
    $set: { estado, actualizada_en: ahora },
    $push: { historial: { fecha: ahora, evento: estado, detalle: comentario ?? null, usuario_id: req.usuario!.id } },
  });
  if (r.modifiedCount !== 1) throw reglaDeNegocio('La alerta cambió mientras se procesaba la solicitud');
  await auditar(req, { accion: 'RECONOCER_ALERTA', entidad: 'alertas', entidad_id: id, resultado: 'EXITO',
    valor_anterior: { estado: a.estado }, valor_nuevo: { estado }, detalle: comentario ?? null });
}
