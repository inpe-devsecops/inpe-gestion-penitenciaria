import { Router } from 'express';
import { z } from 'zod';
import { CLASIFICACIONES, FASES_TRATAMIENTO, SEXOS, SITUACIONES_JURIDICAS } from '../../dominio/constantes';
import { ruta } from '../../lib/errores';
import { busqueda, idEstablecimiento, idInterno, idOficina, paginacion, validar } from '../../lib/validacion';
import { requiereRol } from '../../seguridad/auth';
import { actualizarInterno, crearInterno, listarInternos, obtenerInterno } from './servicio';

const filtros = z.object({
  establecimientoId: idEstablecimiento.optional(),
  clasificacion: z.enum(CLASIFICACIONES).optional(),
  fase: z.enum(FASES_TRATAMIENTO).optional(),
  situacion: z.enum(SITUACIONES_JURIDICAS).optional(),
  busqueda,
  ...paginacion,
});

// .strict(): un campo no previsto (p. ej. "nombres") se rechaza en lugar de ignorarse
const nuevoInterno = z.object({
  sexo: z.enum(SEXOS),
  clasificacion: z.enum(CLASIFICACIONES),
  faseTratamiento: z.enum(FASES_TRATAMIENTO),
  situacionJuridica: z.enum(SITUACIONES_JURIDICAS),
  nivelRiesgo: z.number().int().min(1).max(5),
  regionProcedenciaId: idOficina,
  establecimientoId: idEstablecimiento,
  fechaIngreso: z.coerce.date().refine((d) => d.getTime() <= Date.now(), 'La fecha de ingreso no puede ser futura'),
}).strict();

const cambioInterno = nuevoInterno.pick({ clasificacion: true, faseTratamiento: true, situacionJuridica: true, nivelRiesgo: true })
  .partial().strict();

export function rutasInternos() {
  const r = Router();
  r.get('/', ruta(async (req, res) => {
    res.json(await listarInternos(req, validar(filtros, req.query)));
  }));
  r.get('/:id', ruta(async (req, res) => {
    res.json(await obtenerInterno(req, validar(idInterno, req.params.id)));
  }));
  r.post('/', requiereRol('ADMIN_CENTRAL', 'DIRECTOR_ESTABLECIMIENTO'), ruta(async (req, res) => {
    res.status(201).json(await crearInterno(req, validar(nuevoInterno, req.body)));
  }));
  r.patch('/:id', requiereRol('ADMIN_CENTRAL', 'DIRECTOR_ESTABLECIMIENTO'), ruta(async (req, res) => {
    res.json(await actualizarInterno(req, validar(idInterno, req.params.id), validar(cambioInterno, req.body)));
  }));
  return r;
}
