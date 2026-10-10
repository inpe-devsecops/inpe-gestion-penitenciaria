import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ROLES, type Rol } from '../dominio/constantes';
import { Establecimiento, Sesion } from '../modelos';

export interface UsuarioToken {
  id: string;
  rol: Rol;
  oficinaId: string | null;
  establecimientoId: string | null;
  jti: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioToken;
  }
}

export const DURACION_TOKEN_SEG = 15 * 60; // vigencia limitada (RNF-04)

export function esRol(v: unknown): v is Rol {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export function emitirToken(u: Omit<UsuarioToken, 'jti'>, secreto: string) {
  const jti = randomUUID();
  const token = jwt.sign({ rol: u.rol, ofi: u.oficinaId, est: u.establecimientoId }, secreto, {
    algorithm: 'HS256', subject: u.id, jwtid: jti, expiresIn: DURACION_TOKEN_SEG,
  });
  return { token, jti, expira: new Date(Date.now() + DURACION_TOKEN_SEG * 1000) };
}

// La sesión debe existir y no estar revocada (cierre de sesión o bloqueo administrativo).
export type VerificarSesion = (jti: string, usuarioId: string) => Promise<boolean>;
export const sesionVigente: VerificarSesion = async (jti, usuarioId) =>
  Boolean(await Sesion.exists({ _id: jti, usuario_id: usuarioId, revocada: false, expira: { $gt: new Date() } }));

// Mediación completa: firma, vigencia y revocación se comprueban en CADA petición (RNF-01, RNF-04).
export function autenticar(secreto: string, verificarSesion: VerificarSesion = sesionVigente) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cabecera = req.headers.authorization;
    if (!cabecera?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado', codigo: 'NO_AUTENTICADO' });
    try {
      const p = jwt.verify(cabecera.slice(7), secreto, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (typeof p.sub !== 'string' || typeof p.jti !== 'string' || !esRol(p.rol)) throw new Error('Token sin identidad válida');
      if (!(await verificarSesion(p.jti, p.sub))) throw new Error('Sesión revocada');
      req.usuario = {
        id: p.sub, rol: p.rol, jti: p.jti,
        oficinaId: typeof p.ofi === 'string' ? p.ofi : null,
        establecimientoId: typeof p.est === 'string' ? p.est : null,
      };
      return next();
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o expirada', codigo: 'NO_AUTENTICADO' });
    }
  };
}

export function requiereRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) return res.status(403).json({ error: 'Acceso denegado', codigo: 'SIN_PERMISO' });
    return next();
  };
}

// ----- Ámbito territorial (RNF-02). Denegado por defecto ante un rol desconocido.

// Filtro de MongoDB sobre la colección de establecimientos que el usuario puede ver.
export function filtroEstablecimientos(u: UsuarioToken): Record<string, unknown> {
  switch (u.rol) {
    case 'ADMIN_CENTRAL':
    case 'AUDITOR':
      return {};
    case 'RESPONSABLE_REGIONAL':
      return { oficina_id: u.oficinaId ?? '__sin_ambito__' };
    case 'DIRECTOR_ESTABLECIMIENTO':
      return { _id: u.establecimientoId ?? '__sin_ambito__' };
    default:
      return { _id: '__sin_ambito__' };
  }
}

export function puedeVerEstablecimiento(u: UsuarioToken, est: { _id: string; oficina_id: string }): boolean {
  switch (u.rol) {
    case 'ADMIN_CENTRAL':
    case 'AUDITOR':
      return true;
    case 'RESPONSABLE_REGIONAL':
      return u.oficinaId !== null && u.oficinaId === est.oficina_id;
    case 'DIRECTOR_ESTABLECIMIENTO':
      return u.establecimientoId !== null && u.establecimientoId === est._id;
    default:
      return false;
  }
}

// Identificadores de los establecimientos del ámbito; null significa "todos" (alcance nacional).
export async function establecimientosDelAmbito(u: UsuarioToken): Promise<string[] | null> {
  if (u.rol === 'ADMIN_CENTRAL' || u.rol === 'AUDITOR') return null;
  if (u.rol === 'DIRECTOR_ESTABLECIMIENTO') return u.establecimientoId ? [u.establecimientoId] : [];
  const ids = await Establecimiento.find(filtroEstablecimientos(u), { _id: 1 }).lean();
  return ids.map((e) => e._id);
}
