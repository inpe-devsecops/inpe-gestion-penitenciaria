// Modelos de MongoDB (Tabla 15 del informe). Esquemas estrictos: un campo no declarado provoca error.
// Las reglas que no deben depender solo de la aplicación (segregación de funciones, unicidad de alertas,
// capacidad > 0) se declaran además como validadores e índices en las migraciones (src/db/migraciones).
import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import {
  CAUSALES_TRASLADO, CLASIFICACIONES, CONDICIONES_ALERTA, ESTADOS_ALERTA, ESTADOS_SOLICITUD, FASES_TRATAMIENTO,
  GENEROS_POBLACION, RESULTADOS_AUDITORIA, ROLES, SEVERIDADES, SEXOS, SITUACIONES_JURIDICAS, TECHOS_SEGURIDAD,
} from '../dominio/constantes';

// La estructura (colecciones, validadores e índices) la crean solo las migraciones versionadas (RNF-20),
// no Mongoose de forma implícita al conectarse.
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

const opciones = (collection: string) => ({ strict: 'throw' as const, collection, versionKey: false as const });
const punto = { latitud: { type: Number, required: true }, longitud: { type: Number, required: true } };

// ----- Oficinas regionales (8, Anexo 07 del INPE)
const oficinaSchema = new Schema({
  _id: { type: String, required: true },
  nombre: { type: String, required: true },
  sede: { type: punto, required: true },
}, opciones('oficinas_regionales'));
export const OficinaRegional = mongoose.model('OficinaRegional', oficinaSchema);

// ----- Establecimientos penitenciarios
const establecimientoSchema = new Schema({
  _id: { type: String, required: true },
  nombre: { type: String, required: true },
  oficina_id: { type: String, required: true, index: true },
  departamento: { type: String, required: true },
  ubicacion: { type: punto, required: true },
  capacidad_oficial: { type: Number, required: true, min: 1 },
  poblacion_actual: { type: Number, required: true, min: 0 },
  techo_seguridad: { type: String, enum: TECHOS_SEGURIDAD, required: true },
  regimenes_admitidos: { type: [{ type: String, enum: CLASIFICACIONES }], required: true },
  genero_poblacion: { type: String, enum: GENEROS_POBLACION, required: true },
  // Fases de tratamiento para las que el establecimiento ofrece programa (factor "fase" del motor)
  fases_tratamiento: { type: [{ type: String, enum: FASES_TRATAMIENTO }], required: true },
  // Proporción estimada de perfiles de alto riesgo (factor "concentración de alto riesgo")
  proporcion_alto_riesgo: { type: Number, required: true, min: 0, max: 1 },
  activo: { type: Boolean, default: true },
  actualizado_en: { type: Date, default: () => new Date() },
}, opciones('establecimientos'));
export const Establecimiento = mongoose.model('Establecimiento', establecimientoSchema);
export type EstablecimientoDoc = InferSchemaType<typeof establecimientoSchema> & { _id: string };

// ----- Serie mensual de ocupación (alimenta la evolución histórica y la proyección)
const ocupacionSchema = new Schema({
  establecimiento_id: { type: String, required: true },
  corte: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  poblacion: { type: Number, required: true, min: 0 },
  capacidad: { type: Number, required: true, min: 1 },
  // true si el valor se interpoló entre dos cortes oficiales publicados por el INPE
  interpolado: { type: Boolean, default: false },
}, opciones('ocupacion_historica'));
ocupacionSchema.index({ establecimiento_id: 1, corte: 1 }, { unique: true });
export const OcupacionHistorica = mongoose.model('OcupacionHistorica', ocupacionSchema);

// ----- Ficha mínima del interno (RNF-08): identificador anónimo, sin nombres ni documentos
const internoSchema = new Schema({
  _id: { type: String, required: true },
  sexo: { type: String, enum: SEXOS, required: true },
  clasificacion: { type: String, enum: CLASIFICACIONES, required: true },
  fase_tratamiento: { type: String, enum: FASES_TRATAMIENTO, required: true },
  situacion_juridica: { type: String, enum: SITUACIONES_JURIDICAS, required: true },
  nivel_riesgo: { type: Number, required: true, min: 1, max: 5 },
  region_procedencia: { type: String, required: true },
  establecimiento_id: { type: String, required: true, index: true },
  fecha_ingreso: { type: Date, required: true },
  dato_ficticio: { type: Boolean, default: true },
  actualizado_en: { type: Date, default: () => new Date() },
}, opciones('internos'));
export const Interno = mongoose.model('Interno', internoSchema);
export type InternoDoc = InferSchemaType<typeof internoSchema> & { _id: string };

// ----- Solicitud de traslado
const solicitudSchema = new Schema({
  codigo: { type: String, required: true, unique: true },
  interno_id: { type: String, required: true, index: true },
  origen_id: { type: String, required: true, index: true },
  causal: { type: String, enum: CAUSALES_TRASLADO, required: true },
  fundamento_cifrado: { type: String, required: true },
  estado: { type: String, enum: ESTADOS_SOLICITUD, required: true, index: true },
  // true mientras está EVALUADA o APROBADA: índice único parcial = un solo trámite abierto por interno
  en_tramite: { type: Boolean, required: true },
  solicitante_id: { type: String, required: true },
  solicitada_en: { type: Date, required: true },
  pesos: { type: Schema.Types.Mixed, required: true },
  destino_recomendado_id: { type: String, default: null },
  puntaje_recomendado: { type: Number, default: null },
  destino_id: { type: String, default: null, index: true },
  decidida_en: { type: Date, default: null },
  ejecutado_por: { type: String, default: null },
  ejecutada_en: { type: Date, default: null },
}, opciones('solicitudes_traslado'));
export const SolicitudTraslado = mongoose.model('SolicitudTraslado', solicitudSchema);
export type SolicitudDoc = InferSchemaType<typeof solicitudSchema> & { _id: Types.ObjectId };

// ----- Evaluación de destinos (una por destino evaluado; conserva elegibles, descartes y aportes)
const aporteSchema = new Schema({
  normalizado: Number, peso: Number, aporte: Number, detalle: String,
}, { _id: false, strict: 'throw' });
const evaluacionSchema = new Schema({
  solicitud_id: { type: Schema.Types.ObjectId, required: true },
  destino_id: { type: String, required: true },
  elegible: { type: Boolean, required: true },
  posicion: { type: Number, default: null },
  puntaje: { type: Number, default: null },
  aportes: {
    type: new Schema({ cupo: aporteSchema, hacinamiento: aporteSchema, distancia: aporteSchema, fase: aporteSchema, riesgo: aporteSchema },
      { _id: false, strict: 'throw' }),
    default: null,
  },
  motivo_descarte: { type: String, default: null },
  metricas: { cupo_libre: Number, hacinamiento_pct: Number, distancia_km: { type: Number, default: null } },
  explicacion: { type: String, required: true },
  generada_en: { type: Date, required: true },
}, opciones('evaluaciones_destino'));
evaluacionSchema.index({ solicitud_id: 1, elegible: -1, puntaje: -1 });
evaluacionSchema.index({ solicitud_id: 1, destino_id: 1 }, { unique: true });
export const EvaluacionDestino = mongoose.model('EvaluacionDestino', evaluacionSchema);

// ----- Decisión: copia el solicitante para que la segregación sea una regla del validador ($expr)
const decisionSchema = new Schema({
  solicitud_id: { type: Schema.Types.ObjectId, required: true, unique: true },
  solicitante_id: { type: String, required: true },
  decidido_por: { type: String, required: true },
  resultado: { type: String, enum: ['APROBADA', 'RECHAZADA'], required: true },
  destino_id: { type: String, default: null },
  se_aparta_de_recomendacion: { type: Boolean, default: false },
  fundamento_cifrado: { type: String, required: true },
  decidida_en: { type: Date, required: true },
}, opciones('decisiones_traslado'));
export const DecisionTraslado = mongoose.model('DecisionTraslado', decisionSchema);

// ----- Alertas: única por (establecimiento, condición) mientras está vigente
const alertaSchema = new Schema({
  establecimiento_id: { type: String, required: true },
  condicion: { type: String, enum: CONDICIONES_ALERTA, required: true },
  severidad: { type: String, enum: SEVERIDADES, required: true },
  estado: { type: String, enum: ESTADOS_ALERTA, required: true },
  vigente: { type: Boolean, required: true },
  valor_observado: { type: Number, required: true },
  umbral: { type: Number, required: true },
  mensaje: { type: String, required: true },
  creada_en: { type: Date, required: true },
  actualizada_en: { type: Date, required: true },
  historial: [{
    _id: false, fecha: Date, evento: String, detalle: String, usuario_id: { type: String, default: null },
  }],
}, opciones('alertas'));
alertaSchema.index(
  { establecimiento_id: 1, condicion: 1 },
  { unique: true, partialFilterExpression: { vigente: true }, name: 'alerta_vigente_unica' },
);
alertaSchema.index({ vigente: -1, severidad: 1, actualizada_en: -1 });
export const Alerta = mongoose.model('Alerta', alertaSchema);

// ----- Contadores atómicos para códigos legibles (TR-2026-0001)
const contadorSchema = new Schema({ _id: { type: String, required: true }, valor: { type: Number, required: true } }, opciones('contadores'));
export const Contador = mongoose.model('Contador', contadorSchema);

export async function siguienteNumero(nombre: string): Promise<number> {
  const c = await Contador.findOneAndUpdate({ _id: nombre }, { $inc: { valor: 1 } }, { upsert: true, new: true }).lean();
  return c!.valor;
}

export async function siguienteCodigo(prefijo: string, anio: number): Promise<string> {
  return `${prefijo}-${anio}-${String(await siguienteNumero(`${prefijo}-${anio}`)).padStart(4, '0')}`;
}

// ----- Parámetros configurables (umbrales y pesos del motor)
const parametroSchema = new Schema({
  _id: { type: String, required: true },
  valor: { type: Number, required: true },
  descripcion: { type: String, required: true },
  minimo: { type: Number, required: true },
  maximo: { type: Number, required: true },
  actualizado_por: { type: String, default: null },
  actualizado_en: { type: Date, required: true },
}, opciones('parametros'));
export const Parametro = mongoose.model('Parametro', parametroSchema);

// ----- Usuarios y sesiones (JWT con jti revocable, RNF-04)
const usuarioSchema = new Schema({
  _id: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  nombre_completo: { type: String, required: true },
  rol: { type: String, enum: ROLES, required: true },
  ambito: {
    oficina_id: { type: String, default: null },
    establecimiento_id: { type: String, default: null },
  },
  estado: { type: String, enum: ['ACTIVO', 'INACTIVO'], required: true },
  password_hash: { type: String, required: true },
  intentos_fallidos: { type: Number, default: 0 },
  bloqueado_hasta: { type: Date, default: null },
  ultimo_acceso: { type: Date, default: null },
  dato_ficticio: { type: Boolean, default: true },
}, opciones('usuarios'));
export const Usuario = mongoose.model('Usuario', usuarioSchema);
export type UsuarioDoc = InferSchemaType<typeof usuarioSchema> & { _id: string };

const sesionSchema = new Schema({
  _id: { type: String, required: true }, // jti del token
  usuario_id: { type: String, required: true, index: true },
  emitida_en: { type: Date, required: true },
  expira: { type: Date, required: true },
  revocada: { type: Boolean, default: false },
  revocada_en: { type: Date, default: null },
}, opciones('sesiones'));
// MongoDB elimina la sesión un día después de expirar (el token ya no es válido de todas formas)
sesionSchema.index({ expira: 1 }, { expireAfterSeconds: 86_400 });
export const Sesion = mongoose.model('Sesion', sesionSchema);

// ----- Auditoría de solo inserción (RNF-11)
const auditoriaSchema = new Schema({
  fecha: { type: Date, required: true },
  usuario_id: { type: String, default: null },
  rol: { type: String, default: null },
  ip: { type: String, default: null },
  accion: { type: String, required: true },
  entidad: { type: String, default: null },
  entidad_id: { type: String, default: null },
  resultado: { type: String, enum: RESULTADOS_AUDITORIA, required: true },
  valor_anterior: { type: Schema.Types.Mixed, default: null },
  valor_nuevo: { type: Schema.Types.Mixed, default: null },
  detalle: { type: String, default: null },
}, opciones('auditoria'));
auditoriaSchema.index({ fecha: -1 });
auditoriaSchema.index({ entidad: 1, entidad_id: 1, fecha: -1 });
auditoriaSchema.index({ usuario_id: 1, fecha: -1 });

// Defensa en profundidad: aunque la base de datos ya lo impide con un rol de solo inserción,
// el modelo rechaza cualquier intento de modificar o borrar un registro.
const prohibido = () => { throw new Error('La auditoría es de solo inserción'); };
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  auditoriaSchema.pre(op, prohibido);
}
auditoriaSchema.pre('save', function () {
  if (!this.isNew) prohibido();
});
export const Auditoria = mongoose.model('Auditoria', auditoriaSchema);
