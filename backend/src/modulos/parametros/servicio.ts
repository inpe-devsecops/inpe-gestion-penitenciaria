import type { Request } from 'express';
import { auditar } from '../../lib/auditoria';
import { ErrorApi } from '../../lib/errores';
import { Parametro } from '../../modelos';
import type { ConfigMotor } from '../traslados/motor';
import { CLAVES_PARAMETROS, PARAMETROS, validarConjunto, valoresPorDefecto, type ClaveParametro, type ValoresParametros } from './definicion';

// Valores vigentes: los de la base de datos; si falta alguno (base recién creada) se usa su valor por defecto.
export async function obtenerParametros(): Promise<ValoresParametros> {
  const v = valoresPorDefecto();
  for (const p of await Parametro.find({}).lean()) {
    if ((CLAVES_PARAMETROS as string[]).includes(p._id)) v[p._id as ClaveParametro] = p.valor;
  }
  return v;
}

export function configMotor(v: ValoresParametros): ConfigMotor {
  return {
    pesos: { cupo: v.peso_cupo, hacinamiento: v.peso_hacinamiento, distancia: v.peso_distancia, fase: v.peso_fase, riesgo: v.peso_riesgo },
    cupoReferencia: v.cupo_referencia,
    distanciaMaxKm: v.distancia_max_km,
    riesgoMaxProporcion: v.riesgo_max_proporcion,
  };
}

export async function listarParametros() {
  const docs = new Map((await Parametro.find({}).lean()).map((p) => [p._id, p]));
  return CLAVES_PARAMETROS.map((clave) => {
    const d = docs.get(clave);
    return {
      clave, valor: d?.valor ?? PARAMETROS[clave].valor, descripcion: PARAMETROS[clave].descripcion,
      minimo: PARAMETROS[clave].minimo, maximo: PARAMETROS[clave].maximo,
      actualizadoPor: d?.actualizado_por ?? null, actualizadoEn: d?.actualizado_en ?? null,
    };
  });
}

// Se valida el conjunto resultante completo (p. ej. que los pesos sigan sumando 1) antes de guardar nada.
// Cada clave modificada deja un registro de auditoría con su valor anterior y el nuevo (RNF-13).
export async function actualizarParametros(req: Request, cambios: Partial<ValoresParametros>, motivo: string) {
  const anteriores = await obtenerParametros();
  const nuevos = { ...anteriores, ...cambios };
  const errores = validarConjunto(nuevos);
  if (errores.length) {
    await auditar(req, { accion: 'ACTUALIZAR_PARAMETROS', entidad: 'parametros', resultado: 'FALLIDO', valor_nuevo: cambios, detalle: errores.join('; ') });
    throw new ErrorApi(422, 'REGLA_DE_NEGOCIO', errores.join('. '), errores.map((m) => ({ campo: 'parametros', mensaje: m })));
  }
  const ahora = new Date();
  const modificados = (Object.keys(cambios) as ClaveParametro[]).filter((k) => cambios[k] !== anteriores[k]);
  for (const clave of modificados) {
    await Parametro.updateOne(
      { _id: clave },
      { $set: { valor: nuevos[clave], descripcion: PARAMETROS[clave].descripcion, minimo: PARAMETROS[clave].minimo,
        maximo: PARAMETROS[clave].maximo, actualizado_por: req.usuario!.id, actualizado_en: ahora } },
      { upsert: true },
    );
    await auditar(req, {
      accion: 'ACTUALIZAR_PARAMETRO', entidad: 'parametros', entidad_id: clave, resultado: 'EXITO',
      valor_anterior: anteriores[clave], valor_nuevo: nuevos[clave], detalle: motivo,
    });
  }
  return { modificados, valores: nuevos };
}
