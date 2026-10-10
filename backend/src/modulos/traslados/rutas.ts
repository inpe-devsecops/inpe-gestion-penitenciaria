import { Router } from 'express';
import { z } from 'zod';
import { CAUSALES_TRASLADO, ESTADOS_SOLICITUD } from '../../dominio/constantes';
import { ruta } from '../../lib/errores';
import { booleanoQuery, busqueda, idEstablecimiento, idInterno, objectId, paginacion, validar } from '../../lib/validacion';
import { requiereRol } from '../../seguridad/auth';
import { evaluarAlertas } from '../alertas/servicio';
import { aprobar, crearSolicitud, ejecutar, listarSolicitudes, obtenerSolicitud, rechazar, vistaPrevia } from './servicio';

const fundamento = z.string().trim().min(20, 'El fundamento debe tener al menos 20 caracteres').max(2000);

const nuevaSolicitud = z.object({
  internoId: idInterno,
  causal: z.enum(CAUSALES_TRASLADO, { errorMap: () => ({ message: 'La causal debe pertenecer al catálogo del art. 159 del Reglamento' }) }),
  fundamento,
}).strict();

const filtros = z.object({
  estado: z.enum(ESTADOS_SOLICITUD).optional(),
  soloPendientes: booleanoQuery.optional(),
  establecimientoId: idEstablecimiento.optional(),
  busqueda,
  ...paginacion,
});

export function rutasTraslados() {
  const r = Router();

  r.get('/', ruta(async (req, res) => {
    res.json(await listarSolicitudes(req, validar(filtros, req.query)));
  }));

  // Ranking del motor sin registrar la solicitud
  r.get('/recomendacion/:internoId', requiereRol('ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL'), ruta(async (req, res) => {
    res.json(await vistaPrevia(req, validar(idInterno, req.params.internoId)));
  }));

  r.get('/:id', ruta(async (req, res) => {
    res.json(await obtenerSolicitud(req, validar(objectId, req.params.id)));
  }));

  r.post('/', requiereRol('RESPONSABLE_REGIONAL', 'ADMIN_CENTRAL'), ruta(async (req, res) => {
    res.status(201).json(await crearSolicitud(req, validar(nuevaSolicitud, req.body)));
  }));

  r.post('/:id/aprobar', requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const datos = validar(z.object({ destinoId: idEstablecimiento.optional(), fundamento }).strict(), req.body);
    res.json(await aprobar(req, validar(objectId, req.params.id), datos));
  }));

  r.post('/:id/rechazar', requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const datos = validar(z.object({ fundamento }).strict(), req.body);
    res.json(await rechazar(req, validar(objectId, req.params.id), datos));
  }));

  r.post('/:id/ejecutar', requiereRol('DIRECTOR_ESTABLECIMIENTO'), ruta(async (req, res) => {
    const { observacion } = validar(z.object({ observacion: z.string().trim().max(500).optional() }).strict(), req.body ?? {});
    const { solicitud, afectados } = await ejecutar(req, validar(objectId, req.params.id), observacion);
    await evaluarAlertas(afectados, req.usuario!.id);
    res.json(solicitud);
  }));

  return r;
}
