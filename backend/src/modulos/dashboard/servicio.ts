// Panel de indicadores (RF-04, RF-05). Se calcula sobre el ámbito del usuario: nacional para el central y el
// auditor, su oficina regional para el responsable regional y su establecimiento para el director.
import type { Request } from 'express';
import { Alerta, Establecimiento, OcupacionHistorica, SolicitudTraslado, type EstablecimientoDoc } from '../../modelos';
import { filtroEstablecimientos } from '../../seguridad/auth';
import { aDto, cargarOficinas, corteVigente } from '../establecimientos/servicio';
import { ocupacion } from '../establecimientos/metricas';
import { obtenerParametros } from '../parametros/servicio';
import { proyectar, type Escenario, type PuntoSerie } from '../proyeccion/proyeccion';

function totales(filas: { capacidad: number; poblacion: number; cupoLibre: number }[]) {
  const capacidad = filas.reduce((a, f) => a + f.capacidad, 0);
  const poblacion = filas.reduce((a, f) => a + f.poblacion, 0);
  const o = capacidad > 0 ? ocupacion(capacidad, poblacion) : null;
  return {
    capacidad, poblacion, sobrepoblacion: Math.max(0, poblacion - capacidad),
    hacinamientoPct: o?.hacinamientoPct ?? 0, cupoLibre: filas.reduce((a, f) => a + f.cupoLibre, 0), establecimientos: filas.length,
  };
}

export async function panel(req: Request) {
  const filtro = filtroEstablecimientos(req.usuario!);
  const [docs, oficinas, p, corte] = await Promise.all([Establecimiento.find(filtro).lean(), cargarOficinas(), obtenerParametros(), corteVigente()]);
  const filas = docs.map((d) => aDto(d as EstablecimientoDoc, oficinas, p));
  const ids = filas.map((f) => f.id);

  const porOficina = [...new Set(filas.map((f) => f.oficinaId))].map((id) => {
    const propias = filas.filter((f) => f.oficinaId === id);
    return { oficinaId: id, oficina: oficinas.get(id)?.nombre ?? id, ...totales(propias), hacinados: propias.filter((f) => f.nivel).length };
  }).sort((a, b) => b.hacinamientoPct - a.hacinamientoPct);

  // Serie del ámbito: suma de la población por corte (evolución histórica, RF-06)
  const serie = await OcupacionHistorica.aggregate<{ _id: string; poblacion: number; capacidad: number }>([
    { $match: { establecimiento_id: { $in: ids } } },
    { $group: { _id: '$corte', poblacion: { $sum: '$poblacion' }, capacidad: { $sum: '$capacidad' } } },
    { $sort: { _id: 1 } },
  ]);

  const [alertasVigentes, pendientes, porEjecutar] = await Promise.all([
    Alerta.countDocuments({ establecimiento_id: { $in: ids }, vigente: true }),
    SolicitudTraslado.countDocuments({ estado: 'EVALUADA', origen_id: { $in: ids } }),
    SolicitudTraslado.countDocuments({ estado: 'APROBADA', $or: [{ origen_id: { $in: ids } }, { destino_id: { $in: ids } }] }),
  ]);

  const porNivel = { CRITICO: 0, SEVERO: 0, ATENCION: 0, SIN_HACINAMIENTO: 0 };
  for (const f of filas) porNivel[f.nivel ?? 'SIN_HACINAMIENTO']++;

  return {
    corte, generadoEn: new Date(),
    umbrales: { atencion: p.umbral_atencion, severo: p.umbral_severo, critico: p.umbral_critico },
    totales: { ...totales(filas), hacinados: filas.filter((f) => f.nivel).length, porNivel },
    porOficina,
    masHacinados: [...filas].sort((a, b) => b.hacinamientoPct - a.hacinamientoPct).slice(0, 10),
    conCupo: filas.filter((f) => f.cupoLibre > 0).sort((a, b) => b.cupoLibre - a.cupoLibre).slice(0, 10),
    serie: serie.map((s) => ({ corte: s._id, poblacion: s.poblacion, capacidad: s.capacidad, hacinamientoPct: ocupacion(s.capacidad, s.poblacion).hacinamientoPct })),
    alertasVigentes, solicitudesPendientes: pendientes, aprobadasPorEjecutar: porEjecutar,
  };
}

const ORDEN_ESCENARIO: Record<Escenario, number> = { YA_CRITICO: 0, EN_RIESGO: 1, SIN_RIESGO: 2, SIN_DATOS: 3 };

// Proyección de todos los establecimientos del ámbito, ordenada por urgencia (RF-10)
export async function proyecciones(req: Request) {
  const docs = await Establecimiento.find(filtroEstablecimientos(req.usuario!)).lean();
  const [oficinas, p, series] = await Promise.all([
    cargarOficinas(), obtenerParametros(),
    OcupacionHistorica.find({ establecimiento_id: { $in: docs.map((d) => d._id) } }, { establecimiento_id: 1, corte: 1, poblacion: 1 }).lean(),
  ]);
  const seriePor = new Map<string, PuntoSerie[]>();
  for (const s of series) seriePor.set(s.establecimiento_id, [...(seriePor.get(s.establecimiento_id) ?? []), { corte: s.corte, poblacion: s.poblacion }]);
  const filas = docs.map((d) => {
    const e = d as EstablecimientoDoc;
    const { serie: _serie, ...resumen } = proyectar(seriePor.get(e._id) ?? [], { capacidad: e.capacidad_oficial, poblacion: e.poblacion_actual }, p);
    return { establecimiento: aDto(e, oficinas, p), ...resumen };
  });
  return filas.sort((a, b) => ORDEN_ESCENARIO[a.escenario] - ORDEN_ESCENARIO[b.escenario]
    || (a.mesesHastaCritico ?? Infinity) - (b.mesesHastaCritico ?? Infinity)
    || b.establecimiento.hacinamientoPct - a.establecimiento.hacinamientoPct);
}
