import { Router } from 'express';
import { z } from 'zod';
import { CONDICIONES_ALERTA, SEVERIDADES } from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { ruta } from '../../lib/errores';
import { booleanoQuery, idEstablecimiento, objectId, paginacion, validar } from '../../lib/validacion';
import { requiereRol } from '../../seguridad/auth';
import { cambiarEstadoAlerta, evaluarAlertas, historialAlerta, listarAlertas } from './servicio';

const filtros = z.object({
  soloVigentes: booleanoQuery.default('true'),
  severidad: z.enum(SEVERIDADES).optional(),
  condicion: z.enum(CONDICIONES_ALERTA).optional(),
  establecimientoId: idEstablecimiento.optional(),
  ...paginacion,
});

export function rutasAlertas() {
  const r = Router();

  r.get('/', ruta(async (req, res) => {
    res.json(await listarAlertas(req, validar(filtros, req.query)));
  }));

  r.get('/:id/historial', ruta(async (req, res) => {
    res.json(await historialAlerta(req, validar(objectId, req.params.id)));
  }));

  // Fuerza la evaluación de umbrales (también corre sola cada ALERT_JOB_INTERVAL_MIN minutos)
  r.post('/evaluar', requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const resumen = await evaluarAlertas(undefined, req.usuario!.id);
    await auditar(req, { accion: 'EVALUAR_ALERTAS', entidad: 'alertas', resultado: 'EXITO', valor_nuevo: resumen });
    res.json(resumen);
  }));

  r.patch('/:id', requiereRol('ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO'), ruta(async (req, res) => {
    const d = validar(z.object({ estado: z.literal('RECONOCIDA'), comentario: z.string().trim().max(500).optional() }).strict(), req.body);
    await cambiarEstadoAlerta(req, validar(objectId, req.params.id), d.estado, d.comentario);
    res.status(204).end();
  }));

  return r;
}
