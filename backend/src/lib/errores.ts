import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export interface DetalleCampo {
  campo: string;
  mensaje: string;
}

// Error de negocio con estado HTTP y código estable. Su mensaje se muestra al usuario (RNF-23):
// debe decir qué corregir sin revelar detalles técnicos.
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: DetalleCampo[],
  ) {
    super(mensaje);
  }
}

export const noEncontrado = (que = 'Recurso') => new ErrorApi(404, 'NO_ENCONTRADO', `${que} no encontrado`);
export const sinPermiso = (mensaje = 'Acceso denegado') => new ErrorApi(403, 'SIN_PERMISO', mensaje);
export const reglaDeNegocio = (mensaje: string) => new ErrorApi(422, 'REGLA_DE_NEGOCIO', mensaje);
export const conflicto = (mensaje: string) => new ErrorApi(409, 'CONFLICTO', mensaje);

export function detallesZod(e: ZodError): DetalleCampo[] {
  return e.issues.map((i) => ({ campo: i.path.join('.') || '(cuerpo)', mensaje: i.message }));
}

// Envuelve un handler async para que sus errores lleguen al manejador central.
export const ruta = <T extends Request>(fn: (req: T, res: Response) => Promise<unknown>) =>
  (req: T, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// Manejo seguro de errores: sin trazas ni detalles internos hacia el cliente.
export function manejarErrores(err: Error & { type?: string; code?: number }, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErrorApi) {
    return res.status(err.estado).json({ error: err.message, codigo: err.codigo, ...(err.detalles ? { detalles: err.detalles } : {}) });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', codigo: 'VALIDACION', detalles: detallesZod(err) });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido', codigo: 'SOLICITUD_INVALIDA' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo demasiado grande', codigo: 'SOLICITUD_INVALIDA' });
  // Violación de un índice único o del validador de la colección: la base de datos rechazó la operación
  if (err.code === 11000) return res.status(409).json({ error: 'La operación entra en conflicto con un registro existente', codigo: 'CONFLICTO' });
  if (err.code === 121) return res.status(422).json({ error: 'La base de datos rechazó la operación por una regla de integridad', codigo: 'REGLA_DE_NEGOCIO' });
  req.log?.error({ err }, 'Error no controlado');
  return res.status(500).json({ error: 'Error interno', codigo: 'ERROR_INTERNO' });
}
