import { Router } from 'express';
import { z } from 'zod';
import type { Auditar, RepositorioUsuarios } from '../dominio';
import { emitirToken } from '../seguridad/auth';

export const MAX_INTENTOS = 5; // RNF06
export const BLOQUEO_MS = 15 * 60 * 1000;

const esquemaLogin = z.object({
  username: z.string().regex(/^[a-z0-9._-]{3,50}$/),
  password: z.string().min(1).max(128),
});

export function rutasAuth(
  usuarios: RepositorioUsuarios,
  auditar: Auditar,
  verificarPassword: (hash: string, password: string) => Promise<boolean>,
  jwtSecret: string,
  ahora: () => Date = () => new Date(),
) {
  const r = Router();

  r.post('/login', async (req, res, next) => {
    try {
      const datos = esquemaLogin.safeParse(req.body);
      if (!datos.success) return res.status(400).json({ error: 'Entrada inválida' });
      const base = { ip: req.ip, accion: 'LOGIN', recurso: null } as const;
      const u = await usuarios.porUsername(datos.data.username);

      // Mismo mensaje para usuario inexistente o contraseña errónea (no revela qué cuentas existen).
      if (!u || u.estado !== 'ACTIVO' || !u.passwordHash) {
        await auditar({ ...base, usuario_id: null, rol: null, penal_usuario: null, resultado: 'FALLIDO', detalle: 'Credenciales inválidas' });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      const quien = { usuario_id: u.id, rol: u.rol, penal_usuario: u.penalId };
      if (u.bloqueadoHasta && u.bloqueadoHasta > ahora()) {
        await auditar({ ...base, ...quien, resultado: 'BLOQUEADO', detalle: 'Intento sobre cuenta bloqueada' });
        return res.status(423).json({ error: 'Cuenta bloqueada temporalmente' });
      }
      if (!(await verificarPassword(u.passwordHash, datos.data.password))) {
        const intentos = u.intentosFallidos + 1;
        const bloqueo = intentos >= MAX_INTENTOS ? new Date(ahora().getTime() + BLOQUEO_MS) : null;
        await usuarios.registrarFallo(u.id, bloqueo ? 0 : intentos, bloqueo);
        await auditar({ ...base, ...quien, resultado: bloqueo ? 'BLOQUEADO' : 'FALLIDO', detalle: bloqueo ? 'Cuenta bloqueada 15 minutos' : 'Contraseña incorrecta' });
        return bloqueo ? res.status(423).json({ error: 'Cuenta bloqueada temporalmente' }) : res.status(401).json({ error: 'Credenciales inválidas' });
      }
      // TODO (sprint 2): segundo factor TOTP obligatorio antes de emitir el token (RNF05).
      await usuarios.registrarExito(u.id);
      await auditar({ ...base, ...quien, resultado: 'EXITO' });
      return res.json({ token: emitirToken({ id: u.id, rol: u.rol, penalId: u.penalId }, jwtSecret), expira_en: 900 });
    } catch (e) {
      return next(e);
    }
  });

  return r;
}
