import { Router } from 'express';
import { z } from 'zod';
import { CLASIFICACIONES, FASES_TRATAMIENTO, GENEROS_POBLACION, TECHOS_SEGURIDAD } from '../../dominio/constantes';
import { ruta } from '../../lib/errores';
import { booleanoQuery, busqueda, idEstablecimiento, idOficina, paginacion, validar } from '../../lib/validacion';
import { requiereRol } from '../../seguridad/auth';
import { evaluarAlertas } from '../alertas/servicio';
import { obtenerParametros } from '../parametros/servicio';
import {
  actualizarAtributos, actualizarOcupacion, aDto, cargarOficinas, crearEstablecimiento, listarEstablecimientos, obtenerVisible,
  proyeccionDe, serieOcupacion,
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

const atributos = z.object({
  nombre: z.string().trim().min(5).max(80),
  oficinaId: idOficina,
  departamento: z.string().trim().min(2).max(40),
  latitud: z.number().min(-19).max(1),
  longitud: z.number().min(-82).max(-68),
  techoSeguridad: z.enum(TECHOS_SEGURIDAD),
  regimenesAdmitidos: z.array(z.enum(CLASIFICACIONES)).min(1).max(7),
  generoPoblacion: z.enum(GENEROS_POBLACION),
  fasesTratamiento: z.array(z.enum(FASES_TRATAMIENTO)).min(1).max(5),
  proporcionAltoRiesgo: z.number().min(0).max(1),
  activo: z.boolean(),
});
const nuevoEstablecimiento = atributos.extend({
  capacidad: z.number().int().min(1).max(100_000),
  poblacion: z.number().int().min(0).max(100_000),
  activo: z.boolean().default(true),
}).strict();
const cambioAtributos = atributos.partial().strict()
  .refine((d) => (d.latitud === undefined) === (d.longitud === undefined), 'Indique latitud y longitud juntas');

export function rutasEstablecimientos() {
  const r = Router();

  // Catálogo: solo el administrador central registra o edita establecimientos (RF-02, RF-03)
  r.post('/', requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const id = await crearEstablecimiento(req, validar(nuevoEstablecimiento, req.body));
    await evaluarAlertas([id], req.usuario!.id);
    const [e, oficinas, p] = await Promise.all([obtenerVisible(req, id), cargarOficinas(), obtenerParametros()]);
    res.status(201).json(aDto(e, oficinas, p));
  }));

  r.patch('/:id', requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const id = validar(idEstablecimiento, req.params.id);
    await actualizarAtributos(req, id, validar(cambioAtributos, req.body));
    const [e, oficinas, p] = await Promise.all([obtenerVisible(req, id), cargarOficinas(), obtenerParametros()]);
    res.json(aDto(e, oficinas, p));
  }));

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
