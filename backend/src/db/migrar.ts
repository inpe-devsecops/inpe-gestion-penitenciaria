// Migraciones versionadas (RNF-20): cada una se aplica una sola vez y queda registrada en la colección
// "migraciones". Se ejecutan al iniciar la API y con `npm run migrate` (antes, respaldar con mongodump).
import 'dotenv/config';
import mongoose from 'mongoose';
import { CAUSALES_TRASLADO, CLASIFICACIONES, CONDICIONES_ALERTA, ESTADOS_ALERTA, ESTADOS_SOLICITUD, FASES_TRATAMIENTO,
  GENEROS_POBLACION, RESULTADOS_AUDITORIA, SEVERIDADES, SEXOS, SITUACIONES_JURIDICAS, TECHOS_SEGURIDAD } from '../dominio/constantes';
import '../modelos'; // registra los modelos (y sus índices) en mongoose

type Db = mongoose.mongo.Db;
type Validador = Record<string, unknown>;

async function asegurarColeccion(db: Db, nombre: string, validator: Validador) {
  const existe = (await db.listCollections({ name: nombre }).toArray()).length > 0;
  if (existe) await db.command({ collMod: nombre, validator, validationLevel: 'strict', validationAction: 'error' });
  else await db.createCollection(nombre, { validator, validationLevel: 'strict', validationAction: 'error' });
}

const numero = { bsonType: 'number' };
const texto = { bsonType: 'string' };
const fecha = { bsonType: 'date' };
const cifrado = { bsonType: 'string', pattern: '^v1:' };

interface Migracion {
  id: string;
  aplicar: (db: Db) => Promise<void>;
}

export const MIGRACIONES: Migracion[] = [
  {
    id: '001_validadores',
    async aplicar(db) {
      // Capacidad oficial > 0 y techo de seguridad del catálogo (Tabla 15)
      await asegurarColeccion(db, 'establecimientos', { $jsonSchema: {
        bsonType: 'object',
        required: ['nombre', 'oficina_id', 'capacidad_oficial', 'poblacion_actual', 'techo_seguridad', 'regimenes_admitidos', 'genero_poblacion'],
        properties: {
          capacidad_oficial: { ...numero, minimum: 1 },
          poblacion_actual: { ...numero, minimum: 0 },
          techo_seguridad: { enum: [...TECHOS_SEGURIDAD] },
          regimenes_admitidos: { bsonType: 'array', items: { enum: [...CLASIFICACIONES] } },
          genero_poblacion: { enum: [...GENEROS_POBLACION] },
          proporcion_alto_riesgo: { ...numero, minimum: 0, maximum: 1 },
        },
      } });

      // Minimización de datos (RNF-08) a nivel de base de datos: la ficha no admite campos adicionales,
      // así que nadie puede guardar nombres, documentos o datos de salud aunque la aplicación falle.
      await asegurarColeccion(db, 'internos', { $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'sexo', 'clasificacion', 'fase_tratamiento', 'situacion_juridica', 'nivel_riesgo', 'region_procedencia', 'establecimiento_id', 'fecha_ingreso'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'string', pattern: '^INT-[0-9]{6}$' },
          sexo: { enum: [...SEXOS] },
          clasificacion: { enum: [...CLASIFICACIONES] },
          fase_tratamiento: { enum: [...FASES_TRATAMIENTO] },
          situacion_juridica: { enum: [...SITUACIONES_JURIDICAS] },
          nivel_riesgo: { ...numero, minimum: 1, maximum: 5 },
          region_procedencia: texto,
          establecimiento_id: texto,
          fecha_ingreso: fecha,
          dato_ficticio: { bsonType: 'bool' },
          actualizado_en: fecha,
        },
      } });

      // Causal del catálogo del art. 159 y fundamento obligatorio y cifrado (RF-12, RF-13)
      await asegurarColeccion(db, 'solicitudes_traslado', { $jsonSchema: {
        bsonType: 'object',
        required: ['codigo', 'interno_id', 'origen_id', 'causal', 'fundamento_cifrado', 'estado', 'en_tramite', 'solicitante_id', 'solicitada_en'],
        properties: {
          causal: { enum: [...CAUSALES_TRASLADO] },
          estado: { enum: [...ESTADOS_SOLICITUD] },
          en_tramite: { bsonType: 'bool' },
          fundamento_cifrado: cifrado,
        },
      } });

      // Segregación de funciones (RNF-09): quien decide no puede ser quien solicitó.
      // La regla vive en la base de datos, no solo en la aplicación.
      await asegurarColeccion(db, 'decisiones_traslado', {
        $jsonSchema: {
          bsonType: 'object',
          required: ['solicitud_id', 'solicitante_id', 'decidido_por', 'resultado', 'fundamento_cifrado', 'decidida_en'],
          properties: {
            solicitante_id: texto,
            decidido_por: texto,
            resultado: { enum: ['APROBADA', 'RECHAZADA'] },
            fundamento_cifrado: cifrado,
          },
        },
        $expr: { $ne: ['$decidido_por', '$solicitante_id'] },
      });

      await asegurarColeccion(db, 'alertas', { $jsonSchema: {
        bsonType: 'object',
        required: ['establecimiento_id', 'condicion', 'severidad', 'estado', 'vigente', 'creada_en'],
        properties: {
          condicion: { enum: [...CONDICIONES_ALERTA] },
          severidad: { enum: [...SEVERIDADES] },
          estado: { enum: [...ESTADOS_ALERTA] },
          vigente: { bsonType: 'bool' },
        },
      } });

      await asegurarColeccion(db, 'auditoria', { $jsonSchema: {
        bsonType: 'object',
        required: ['fecha', 'accion', 'resultado'],
        properties: { fecha, accion: texto, resultado: { enum: [...RESULTADOS_AUDITORIA] } },
      } });
    },
  },
  {
    id: '002_indices',
    async aplicar() {
      // Índices declarados en los modelos: únicos, el único parcial de alertas vigentes y el TTL de sesiones
      for (const modelo of Object.values(mongoose.models)) await modelo.createIndexes();
      // Un solo trámite abierto por interno (refuerza la regla de negocio)
      await mongoose.connection.collection('solicitudes_traslado').createIndex(
        { interno_id: 1 }, { unique: true, partialFilterExpression: { en_tramite: true }, name: 'tramite_abierto_unico' },
      );
    },
  },
];

export async function migrar(db: Db): Promise<string[]> {
  const registro = db.collection<{ _id: string; aplicada_en: Date }>('migraciones');
  const aplicadas = new Set((await registro.find({}).toArray()).map((m) => m._id));
  const nuevas: string[] = [];
  for (const m of MIGRACIONES) {
    if (aplicadas.has(m.id)) continue;
    await m.aplicar(db);
    await registro.insertOne({ _id: m.id, aplicada_en: new Date() });
    nuevas.push(m.id);
  }
  return nuevas;
}

// Uso directo:  npm run migrate
if (require.main === module) {
  (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('Defina MONGODB_URI');
    await mongoose.connect(uri);
    const nuevas = await migrar(mongoose.connection.db!);
    console.log(nuevas.length ? `Aplicadas: ${nuevas.join(', ')}` : 'Sin migraciones pendientes');
    await mongoose.disconnect();
  })().catch(async (e: Error) => {
    console.error(e.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}
