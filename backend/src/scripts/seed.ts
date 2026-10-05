// Carga los datos SIMULADOS (carpeta /datos) en MongoDB cifrando los campos sensibles (RNF01, RNF02).
// Uso:  npm run seed -- ../datos      (requiere .env con MONGODB_URI, DATA_KEY, HMAC_KEY y SEED_PASSWORD)
import 'dotenv/config';
import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { cargarConfig } from '../config';
import { cifrar, indiceCiego } from '../seguridad/cripto';

type Doc = Record<string, unknown>;
const EJSON = mongoose.mongo.BSON.EJSON;

async function* leer(archivo: string): AsyncGenerator<Doc> {
  const rl = createInterface({ input: createReadStream(archivo, 'utf8'), crlfDelay: Infinity });
  for await (const linea of rl) if (linea.trim()) yield EJSON.parse(linea, { relaxed: true }) as Doc;
}

async function cargar(nombre: string, dir: string, transformar: (d: Doc) => Doc | Promise<Doc> = (d) => d) {
  const archivo = join(dir, `${nombre}.json`);
  if (!existsSync(archivo)) {
    console.warn(`(omitido) no existe ${archivo}`);
    return;
  }
  const col = mongoose.connection.collection(nombre);
  await col.deleteMany({});
  let lote: Doc[] = [];
  let total = 0;
  for await (const d of leer(archivo)) {
    lote.push(await transformar(d));
    if (lote.length === 2000) {
      await col.insertMany(lote, { ordered: false });
      total += lote.length;
      lote = [];
    }
  }
  if (lote.length) {
    await col.insertMany(lote, { ordered: false });
    total += lote.length;
  }
  console.log(`${nombre}: ${total} documentos`);
}

async function main() {
  const config = cargarConfig();
  if (config.nodeEnv === 'production') throw new Error('El seed de datos simulados no se ejecuta en producción.');
  const seedPassword = process.env.SEED_PASSWORD ?? '';
  if (seedPassword.length < 12) throw new Error('Defina SEED_PASSWORD (mínimo 12 caracteres) en el .env.');
  const dir = resolve(process.argv[2] ?? '../datos');

  await mongoose.connect(config.mongoUri);
  const k = config.dataKey;
  const texto = (v: unknown) => cifrar(String(v ?? ''), k);

  for (const c of ['penales', 'pabellones', 'delitos', 'traslados', 'alertas', 'auditoria']) await cargar(c, dir);

  const hash = await argon2.hash(seedPassword, { type: argon2.argon2id });
  await cargar('usuarios', dir, (u) => ({ ...u, password_hash: hash, estado: 'ACTIVO' }));

  await cargar('internos', dir, (d) => {
    const { nombres, apellido_paterno, apellido_materno, numero_documento, numero_expediente, delito, edad: _edad, ...resto } = d;
    return {
      ...resto,
      nombres_cifrado: texto(nombres),
      apellido_paterno_cifrado: texto(apellido_paterno),
      apellido_materno_cifrado: apellido_materno ? texto(apellido_materno) : '',
      numero_documento_cifrado: texto(numero_documento),
      numero_documento_hmac: indiceCiego(`${String(resto.tipo_documento)}:${String(numero_documento)}`, config.hmacKey),
      numero_expediente_cifrado: texto(numero_expediente),
      delito_cifrado: texto(JSON.stringify(delito)),
    };
  });

  const db = mongoose.connection;
  await db.collection('internos').createIndexes([
    { key: { codigo_interno: 1 }, unique: true },
    { key: { numero_documento_hmac: 1 }, unique: true },
    { key: { 'ubicacion.penal_id': 1, 'ubicacion.pabellon_id': 1 } },
    { key: { situacion_juridica: 1, 'prision_preventiva.fecha_vencimiento': 1 } },
    { key: { 'sentencia.fecha_liberacion_estimada': 1 } },
  ]);
  await db.collection('usuarios').createIndex({ username: 1 }, { unique: true });
  await db.collection('alertas').createIndex({ destinatario_id: 1, estado: 1 });
  await db.collection('auditoria').createIndex({ fecha: -1 });
  console.log('Carga terminada. Los usuarios simulados usan la contraseña definida en SEED_PASSWORD.');
  await mongoose.disconnect();
}

main().catch(async (e: Error) => {
  console.error(e.message);
  await mongoose.disconnect();
  process.exit(1);
});
