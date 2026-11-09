import type { NextFunction, Request, Response } from 'express';

// Detecta operadores de MongoDB ($ne, $gt, $where...) o rutas con punto en claves de la entrada.
export function contieneOperador(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.some(contieneOperador);
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).some(([clave, v]) => clave.startsWith('$') || clave.includes('.') || contieneOperador(v));
  }
  return false;
}

// RNF10 / REQ-SEC-06: rechaza la petición en lugar de "limpiarla" en silencio.
export function rechazarOperadoresNoSQL(req: Request, res: Response, next: NextFunction) {
  if ([req.body, req.query, req.params].some(contieneOperador)) {
    return res.status(400).json({ error: 'Entrada inválida' });
  }
  return next();
}
