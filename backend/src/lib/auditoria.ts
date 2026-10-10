import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import type { ResultadoAuditoria } from '../dominio/constantes';
import { Auditoria } from '../modelos';

export interface EventoAuditoria {
  accion: string;
  resultado: ResultadoAuditoria;
  entidad?: string | null;
  entidad_id?: string | null;
  valor_anterior?: unknown;
  valor_nuevo?: unknown;
  detalle?: string | null;
}

// Registra quién hizo qué, sobre qué entidad, con qué valores y cuándo (RNF-12, RNF-13).
// Nunca se guardan contraseñas, tokens ni texto cifrado en claro.
export async function auditar(req: Request, e: EventoAuditoria, session?: ClientSession, quien?: { id: string | null; rol: string | null }) {
  const u = quien ?? (req.usuario ? { id: req.usuario.id, rol: req.usuario.rol } : { id: null, rol: null });
  await Auditoria.create([{
    fecha: new Date(),
    usuario_id: u.id,
    rol: u.rol,
    ip: req.ip ?? null,
    accion: e.accion,
    entidad: e.entidad ?? null,
    entidad_id: e.entidad_id ?? null,
    resultado: e.resultado,
    valor_anterior: e.valor_anterior ?? null,
    valor_nuevo: e.valor_nuevo ?? null,
    detalle: e.detalle ?? null,
  }], { session });
}
