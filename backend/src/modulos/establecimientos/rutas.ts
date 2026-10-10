import { Router } from 'express';
import { z } from 'zod';
import { TECHOS_SEGURIDAD } from '../../dominio/constantes';
import { ruta } from '../../lib/errores';
import { booleanoQuery, busqueda, idEstablecimiento, idOficina, paginacion, validar } from '../../lib/validacion';
import { requiereRol } from '../../seguridad/auth';
import { evaluarAlertas } from '../alertas/servicio';
import { obtenerParametros } from '../parametros/servicio';
import {
  actualizarOcupacion, aDto, cargarOficinas, listarEstablecimientos, obtenerVisible, proyeccionDe, serieOcupacion,
} from './servicio';

const filtros = z.object({
  oficinaId: idOficina.optional(),
  techo: z.enum(TECHOS_SEGURIDAD).optional(),
  nivel: z.enum(['ATENCION', 'SEVERO', 'CRITICO', 'SIN_HACINAMIENTO']).optional(),
  conCupo: booleanoQuery.optional(),
  busqueda,
  orden: z.enum(['hacinamiento', 'poblacion', 'capacidad', 'cupo', 'nombre']).default('hacinamiento'),
  direccion: z.enum(['asc', 'desc']).default('desc'),
  ...paginacion,
  porPagina: z.coerce.number().int().min(1).max(100).default(100),
});

const cambioOcupacion = z.object({
  poblacion: z.number().int().min(0).max(100_000).optional(),
  capacidad: z.number().int().min(1).max(100_000).optional(),
  motivo: z.string().trim().min(10, 'Indique el motivo (mínimo 10 caracteres)').max(500),
}).strict().refine((d) => d.poblacion !== undefined || d.capacidad !== undefined, 'Indique la población o la capacidad');

export function rutasEstablecimientos() {
  const r = Router();

  r.get('/', ruta(async (req, res) => {
    res.json(await listarEstablecimientos(req, validar(filtros, req.query)));
  }));

  r.get('/:id', ruta(async (req, res) => {
    const id = validar(idEstablecimiento, req.params.id);
    const e = await obtenerVisible(req, id);
    const [oficinas, p] = await Promise.all([cargarOficinas(), obtenerParametros()]);
    res.json(aDto(e, oficinas, p));
  }));

  // Evolución histórica de la ocupación (RF-06)
  r.get('/:id/serie', ruta(async (req, res) => {
    const id = validar(idEstablecimiento, req.params.id);
    await obtenerVisible(req, id);
    res.json(await serieOcupacion(id));
  }));

  // Proyección de saturación con horizonte y supuesto (RF-10)
  r.get('/:id/proyeccion', ruta(async (req, res) => {
    const id = validar(idEstablecimiento, req.params.id);
    res.json(await proyeccionDe(await obtenerVisible(req, id)));
  }));

  r.patch('/:id/ocupacion', requiereRol('DIRECTOR_ESTABLECIMIENTO', 'ADMIN_CENTRAL'), ruta(async (req, res) => {
    const id = validar(idEstablecimiento, req.params.id);
    const { motivo, ...cambios } = validar(cambioOcupacion, req.body);
    const nuevo = await actualizarOcupacion(req, id, cambios, motivo);
    await evaluarAlertas([id], req.usuario!.id);
    res.json(nuevo);
  }));

  return r;
}
