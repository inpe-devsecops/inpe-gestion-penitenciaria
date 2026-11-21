import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { CONDICIONES_ALERTA, SEVERIDADES, type Rol } from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { ruta } from '../../lib/errores';
import { booleanoQuery, idEstablecimiento, objectId, paginacion, validar } from '../../lib/validacion';
import { cambiarEstadoAlerta, evaluarAlertas, historialAlerta, listarAlertas } from './servicio';

const filtros = z.object({
  soloVigentes: booleanoQuery.default(true),
  severidad: z.enum(SEVERIDADES).optional(),
  condicion: z.enum(CONDICIONES_ALERTA).optional(),
  establecimientoId: idEstablecimiento.optional(),
  ...paginacion,
});

function requiereRolAlerta(...roles: Rol[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuario;
    if (!usuario) return res.status(401).json({ error: 'No autenticado', codigo: 'NO_AUTENTICADO' });
    if (roles.includes(usuario.rol)) return next();
    try {
      await auditar(req, {
        accion: 'ACCESO_ALERTAS', entidad: 'alertas', resultado: 'DENEGADO',
        detalle: `Rol ${usuario.rol} sin permiso para esta operación`,
      });
      return res.status(403).json({ error: 'Acceso denegado', codigo: 'SIN_PERMISO' });
    } catch (e) {
      return next(e);
    }
  };
}

export function rutasAlertas() {
  const r = Router();

  r.get('/', ruta(async (req, res) => {
    res.json(await listarAlertas(req, validar(filtros, req.query)));
  }));

  r.get('/:id/historial', ruta(async (req, res) => {
    res.json(await historialAlerta(req, validar(objectId, req.params.id)));
  }));

  // Fuerza la evaluación de umbrales (también corre sola cada ALERT_JOB_INTERVAL_MIN minutos)
  r.post('/evaluar', requiereRolAlerta('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const resumen = await evaluarAlertas(undefined, req.usuario!.id);
    await auditar(req, { accion: 'EVALUAR_ALERTAS', entidad: 'alertas', resultado: 'EXITO', valor_nuevo: resumen });
    res.json(resumen);
  }));

  r.patch('/:id', requiereRolAlerta('ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO'), ruta(async (req, res) => {
    const d = validar(z.object({ estado: z.literal('RECONOCIDA'), comentario: z.string().trim().max(500).optional() }).strict(), req.body);
    await cambiarEstadoAlerta(req, validar(objectId, req.params.id), d.estado, d.comentario);
    res.status(204).end();
  }));

  return r;
}
