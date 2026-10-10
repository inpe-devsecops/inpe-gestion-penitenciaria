import { Router } from 'express';
import { z } from 'zod';
import {
  CAUSAL_LABEL, CAUSALES_TRASLADO, CLASIFICACIONES, FASES_TRATAMIENTO, ROL_LABEL, SITUACIONES_JURIDICAS, TECHOS_SEGURIDAD,
} from '../../dominio/constantes';
import { ruta } from '../../lib/errores';
import { validar } from '../../lib/validacion';
import { Auditoria, Establecimiento, Usuario } from '../../modelos';
import { requiereRol } from '../../seguridad/auth';
import { cargarOficinas } from '../establecimientos/servicio';
import { CLAVES_PARAMETROS } from '../parametros/definicion';
import { actualizarParametros, listarParametros } from '../parametros/servicio';
import { panel, proyecciones } from './servicio';

export function rutasPanel() {
  const r = Router();
  r.get('/', ruta(async (req, res) => { res.json(await panel(req)); }));
  return r;
}

export function rutasProyecciones() {
  const r = Router();
  r.get('/', ruta(async (req, res) => { res.json(await proyecciones(req)); }));
  return r;
}

// Listas para poblar formularios sin duplicarlas en el cliente
export function rutasCatalogos() {
  const r = Router();
  r.get('/', ruta(async (_req, res) => {
    const [oficinas, ests] = await Promise.all([cargarOficinas(), Establecimiento.find({}, { nombre: 1, oficina_id: 1 }).sort({ nombre: 1 }).lean()]);
    res.json({
      oficinas: [...oficinas.entries()].map(([id, o]) => ({ id, nombre: o.nombre })),
      establecimientos: ests.map((e) => ({ id: e._id, nombre: e.nombre, oficinaId: e.oficina_id })),
      clasificaciones: CLASIFICACIONES, techos: TECHOS_SEGURIDAD, fases: FASES_TRATAMIENTO, situaciones: SITUACIONES_JURIDICAS,
      causales: CAUSALES_TRASLADO.map((c) => ({ valor: c, etiqueta: CAUSAL_LABEL[c] })),
      roles: ROL_LABEL,
    });
  }));
  return r;
}

const cambiosParametros = z.object({
  cambios: z.object(Object.fromEntries(CLAVES_PARAMETROS.map((k) => [k, z.number().finite().optional()]))).strict()
    .refine((c) => Object.values(c).some((v) => v !== undefined), 'Indique al menos un parámetro'),
  motivo: z.string().trim().min(10, 'Indique el motivo del cambio (mínimo 10 caracteres)').max(500),
}).strict();

export function rutasParametros() {
  const r = Router();
  r.get('/', ruta(async (_req, res) => { res.json(await listarParametros()); }));
  r.patch('/', requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const d = validar(cambiosParametros, req.body);
    res.json(await actualizarParametros(req, d.cambios, d.motivo));
  }));
  return r;
}

const filtrosAuditoria = z.object({
  accion: z.string().regex(/^[A-Z_]{3,40}$/).optional(),
  entidad: z.string().regex(/^[a-z_]{3,40}$/).optional(),
  entidadId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  usuarioId: z.string().regex(/^USR-\d{4}$/).optional(),
  resultado: z.enum(['EXITO', 'FALLIDO', 'DENEGADO', 'BLOQUEADO']).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(500).default(50),
});

// Solo lectura: la aplicación no expone ninguna operación que modifique la auditoría (RNF-11)
export function rutasAuditoria() {
  const r = Router();
  r.get('/', requiereRol('ADMIN_CENTRAL', 'AUDITOR'), ruta(async (req, res) => {
    const f = validar(filtrosAuditoria, req.query);
    const filtro: Record<string, unknown> = {};
    if (f.accion) filtro.accion = f.accion;
    if (f.entidad) filtro.entidad = f.entidad;
    if (f.entidadId) filtro.entidad_id = f.entidadId;
    if (f.usuarioId) filtro.usuario_id = f.usuarioId;
    if (f.resultado) filtro.resultado = f.resultado;
    if (f.desde || f.hasta) filtro.fecha = { ...(f.desde ? { $gte: f.desde } : {}), ...(f.hasta ? { $lte: f.hasta } : {}) };
    const [docs, total] = await Promise.all([
      Auditoria.find(filtro).sort({ fecha: -1 }).skip((f.pagina - 1) * f.porPagina).limit(f.porPagina).lean(),
      Auditoria.countDocuments(filtro),
    ]);
    const usuarios = new Map((await Usuario.find({ _id: { $in: docs.map((d) => d.usuario_id).filter(Boolean) } }, { nombre_completo: 1 }).lean())
      .map((u) => [u._id, u.nombre_completo]));
    res.json({
      datos: docs.map((d) => ({
        id: String(d._id), fecha: d.fecha, usuarioId: d.usuario_id, usuario: d.usuario_id ? usuarios.get(d.usuario_id) ?? d.usuario_id : null,
        rol: d.rol, ip: d.ip, accion: d.accion, entidad: d.entidad, entidadId: d.entidad_id, resultado: d.resultado,
        valorAnterior: d.valor_anterior, valorNuevo: d.valor_nuevo, detalle: d.detalle,
      })),
      total, pagina: f.pagina, porPagina: f.porPagina,
    });
  }));
  return r;
}
