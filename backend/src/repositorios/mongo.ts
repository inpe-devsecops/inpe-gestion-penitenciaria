import { Router } from 'express';
import mongoose, { Schema } from 'mongoose';
import type { Auditar, FichaInterno, RepositorioInternos, RepositorioUsuarios } from '../dominio';
import { descifrar } from '../seguridad/cripto';
import { esRol, requiereRol } from '../seguridad/auth';

// ----- Modelos (esquemas estrictos: un campo no declarado provoca error)
const internoSchema = new Schema(
  {
    codigo_interno: { type: String, required: true, unique: true },
    tipo_documento: { type: String, required: true },
    numero_documento_cifrado: { type: String, required: true },
    numero_documento_hmac: { type: String, required: true, unique: true },
    nombres_cifrado: { type: String, required: true },
    apellido_paterno_cifrado: { type: String, required: true },
    apellido_materno_cifrado: { type: String, default: '' },
    sexo: { type: String, enum: ['M', 'F'], required: true },
    fecha_nacimiento: Date,
    nacionalidad: String,
    estado_civil: String,
    grado_instruccion: String,
    ubicacion: { penal_id: { type: String, required: true, index: true }, pabellon_id: { type: String, required: true } },
    situacion_juridica: { type: String, enum: ['PROCESADO', 'SENTENCIADO'], required: true },
    delito_cifrado: { type: String, required: true },
    numero_expediente_cifrado: { type: String, required: true },
    numero_ingresos: Number,
    fecha_ingreso: { type: Date, required: true },
    prision_preventiva: { plazo_meses: Number, prolongada: Boolean, fecha_vencimiento: Date },
    sentencia: {
      fecha_sentencia: Date, cadena_perpetua: Boolean, pena_anios: Number, pena_meses: Number,
      fecha_liberacion_estimada: Date, fecha_revision_pena: Date,
    },
    dato_ficticio: Boolean,
  },
  { strict: 'throw', collection: 'internos', timestamps: true },
);
export const Interno = mongoose.model('Interno', internoSchema);

const usuarioSchema = new Schema(
  {
    _id: String,
    username: { type: String, required: true, unique: true },
    nombres: String, apellido_paterno: String, apellido_materno: String, correo: String,
    rol: { type: String, required: true },
    penal_id: { type: String, default: null },
    estado: { type: String, required: true },
    password_hash: { type: String, default: null },
    mfa: { habilitado: Boolean, secreto_cifrado: String },
    intentos_fallidos: { type: Number, default: 0 },
    bloqueado_hasta: { type: Date, default: null },
    fecha_creacion: Date, ultimo_acceso: Date, dato_ficticio: Boolean,
  },
  { strict: 'throw', collection: 'usuarios' },
);
export const Usuario = mongoose.model('Usuario', usuarioSchema);

// ----- Repositorios
export function repositorioInternos(dataKey: Buffer): RepositorioInternos {
  return {
    async buscarPorCodigo(codigo) {
      const d = await Interno.findOne({ codigo_interno: codigo }).lean();
      if (!d) return null;
      const x = (v: string) => descifrar(v, dataKey);
      const ficha: FichaInterno = {
        codigo_interno: d.codigo_interno,
        penal_id: d.ubicacion!.penal_id,
        pabellon_id: d.ubicacion!.pabellon_id,
        nombres: x(d.nombres_cifrado),
        apellido_paterno: x(d.apellido_paterno_cifrado),
        apellido_materno: d.apellido_materno_cifrado ? x(d.apellido_materno_cifrado) : '',
        tipo_documento: d.tipo_documento,
        numero_documento: x(d.numero_documento_cifrado),
        sexo: d.sexo as 'M' | 'F',
        situacion_juridica: d.situacion_juridica as 'PROCESADO' | 'SENTENCIADO',
        delito: (JSON.parse(x(d.delito_cifrado)) as { nombre: string }).nombre,
        numero_expediente: x(d.numero_expediente_cifrado),
        fecha_ingreso: d.fecha_ingreso,
      };
      return ficha;
    },
  };
}

export function repositorioUsuarios(): RepositorioUsuarios {
  return {
    async porUsername(username) {
      const u = await Usuario.findOne({ username }).lean();
      if (!u || !esRol(u.rol)) return null;
      return {
        id: String(u._id), rol: u.rol, penalId: u.penal_id ?? null, estado: u.estado,
        passwordHash: u.password_hash ?? null, intentosFallidos: u.intentos_fallidos ?? 0, bloqueadoHasta: u.bloqueado_hasta ?? null,
      };
    },
    async registrarFallo(id, intentos, bloqueadoHasta) {
      await Usuario.updateOne({ _id: id }, { $set: { intentos_fallidos: intentos, bloqueado_hasta: bloqueadoHasta } });
    },
    async registrarExito(id) {
      await Usuario.updateOne({ _id: id }, { $set: { intentos_fallidos: 0, bloqueado_hasta: null, ultimo_acceso: new Date() } });
    },
  };
}

// La colección auditoria se escribe con un usuario de MongoDB que solo tiene insert/find (RNF11).
export const auditarEnMongo: Auditar = async (e) => {
  await mongoose.connection.collection('auditoria').insertOne({ ...e, fecha: new Date() });
};

// Índice de hacinamiento por penal en tiempo real (datos agregados, sin datos personales).
export function rutasCapacidad() {
  const r = Router();
  r.get('/', requiereRol('DIRECTOR_PENAL', 'ADMIN_CENTRAL', 'AUDITOR'), async (req, res, next) => {
    try {
      const u = req.usuario!;
      const filtro: Record<string, unknown> = u.rol === 'DIRECTOR_PENAL' ? { _id: u.penalId } : {};
      const penales = await mongoose.connection.collection('penales')
        .find(filtro, { projection: { nombre: 1, oficina_regional: 1, capacidad_albergue: 1 } }).toArray();
      const poblacion = await Interno.aggregate<{ _id: string; total: number }>([
        { $match: u.rol === 'DIRECTOR_PENAL' ? { 'ubicacion.penal_id': u.penalId } : {} },
        { $group: { _id: '$ubicacion.penal_id', total: { $sum: 1 } } },
      ]);
      const porPenal = new Map(poblacion.map((p) => [p._id, p.total]));
      res.json(penales.map((p) => {
        const total = porPenal.get(String(p._id)) ?? 0;
        const cap = Number(p.capacidad_albergue);
        return { penal_id: p._id, nombre: p.nombre, oficina_regional: p.oficina_regional, capacidad: cap, poblacion: total,
          sobrepoblacion_pct: Math.round(((total - cap) * 100) / cap), hacinamiento: (total - cap) * 100 / cap >= 20 };
      }).sort((a, b) => b.sobrepoblacion_pct - a.sobrepoblacion_pct));
    } catch (e) {
      next(e);
    }
  });
  return r;
}
