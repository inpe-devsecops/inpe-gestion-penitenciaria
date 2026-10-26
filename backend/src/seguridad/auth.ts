import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// Roles del informe (Tabla 8): cada uno con permisos mínimos y un ámbito territorial.
export const ROLES = ['RESPONSABLE_REGIONAL', 'DIRECTOR_PENAL', 'ADMIN_CENTRAL', 'AUDITOR'] as const;
export type Rol = (typeof ROLES)[number];

export interface UsuarioToken {
  id: string;
  rol: Rol;
  penalId: string | null; // ámbito del director
  oficinaId: string | null; // ámbito del responsable regional
}

// Ámbito al que pertenece un interno: su penal y la oficina regional de ese penal.
export interface AmbitoInterno {
  penalId: string;
  oficinaId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioToken;
  }
}

const DURACION_TOKEN_SEG = 15 * 60; // RNF07

export function emitirToken(u: UsuarioToken, secreto: string): string {
  return jwt.sign({ rol: u.rol, penal: u.penalId, oficina: u.oficinaId }, secreto, {
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
      req.usuario = {
        id: p.sub, rol: p.rol,
        penalId: typeof p.penal === 'string' ? p.penal : null,
        oficinaId: typeof p.oficina === 'string' ? p.oficina : null,
      };
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

// Control de acceso a nivel de objeto por rol y ámbito (RNF-02, previene BOLA/IDOR). Denegado por defecto.
export function puedeVerDatosPersonales(u: UsuarioToken, ambito: AmbitoInterno): boolean {
  switch (u.rol) {
    case 'ADMIN_CENTRAL':
      return true;
    case 'DIRECTOR_PENAL':
      return u.penalId !== null && u.penalId === ambito.penalId;
    case 'RESPONSABLE_REGIONAL':
      return u.oficinaId !== null && u.oficinaId === ambito.oficinaId;
    default:
      return false; // AUDITOR y cualquier rol futuro: sin datos personales
  }
}

// Solo el director registra o modifica fichas, y solo las de su propio penal (informe, Tabla 8).
export function puedeEditarFicha(u: UsuarioToken, penalId: string): boolean {
  return u.rol === 'DIRECTOR_PENAL' && u.penalId !== null && u.penalId === penalId;
}
