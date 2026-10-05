import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const ROLES = ['OPERADOR_REGISTRO', 'DIRECTOR_PENAL', 'ADMIN_CENTRAL', 'AUDITOR'] as const;
export type Rol = (typeof ROLES)[number];

export interface UsuarioToken {
  id: string;
  rol: Rol;
  penalId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioToken;
  }
}

const DURACION_TOKEN_SEG = 15 * 60; // RNF07

export function emitirToken(u: UsuarioToken, secreto: string): string {
  return jwt.sign({ rol: u.rol, penal: u.penalId }, secreto, {
    algorithm: 'HS256',
    subject: u.id,
    expiresIn: DURACION_TOKEN_SEG,
  });
}

export function esRol(v: unknown): v is Rol {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

// Mediación completa: el token se valida en CADA petición.
export function autenticar(secreto: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const cabecera = req.headers.authorization;
    if (!cabecera?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
    try {
      const p = jwt.verify(cabecera.slice(7), secreto, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (typeof p.sub !== 'string' || !esRol(p.rol)) throw new Error('Token sin identidad válida');
      req.usuario = { id: p.sub, rol: p.rol, penalId: typeof p.penal === 'string' ? p.penal : null };
      return next();
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
}

export function requiereRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) return res.status(403).json({ error: 'Acceso denegado' });
    return next();
  };
}

// Control de acceso a nivel de objeto (RNF08, previene BOLA/IDOR). Denegado por defecto.
export function puedeVerDatosPersonales(u: UsuarioToken, penalId: string): boolean {
  switch (u.rol) {
    case 'ADMIN_CENTRAL':
      return true;
    case 'OPERADOR_REGISTRO':
    case 'DIRECTOR_PENAL':
      return u.penalId !== null && u.penalId === penalId;
    default:
      return false; // AUDITOR y cualquier rol futuro: sin datos personales (RNF09)
  }
}
