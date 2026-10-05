import { Router } from 'express';
import { z } from 'zod';
import type { Auditar, RepositorioInternos } from '../dominio';
import { puedeVerDatosPersonales } from '../seguridad/auth';

const codigoInterno = z.string().regex(/^INT-\d{7}$/);

export function rutasInternos(internos: RepositorioInternos, auditar: Auditar) {
  const r = Router();

  r.get('/:codigo', async (req, res, next) => {
    try {
      const u = req.usuario;
      if (!u) return res.status(401).json({ error: 'No autenticado' });
      const codigo = codigoInterno.safeParse(req.params.codigo);
      if (!codigo.success) return res.status(400).json({ error: 'Código de interno inválido' });

      const base = { usuario_id: u.id, rol: u.rol, penal_usuario: u.penalId, ip: req.ip, accion: 'CONSULTA_FICHA_INTERNO', recurso: codigo.data };
      const ficha = await internos.buscarPorCodigo(codigo.data);
      if (!ficha) return res.status(404).json({ error: 'No encontrado' });

      if (!puedeVerDatosPersonales(u, ficha.penal_id)) {
        await auditar({ ...base, resultado: 'DENEGADO', detalle: 'El interno no pertenece al penal del usuario' });
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      await auditar({ ...base, resultado: 'EXITO' });
      return res.json(ficha);
    } catch (e) {
      return next(e);
    }
  });

  return r;
}
