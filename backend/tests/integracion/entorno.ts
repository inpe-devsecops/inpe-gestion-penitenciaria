// Entorno de pruebas de integración: una base MongoDB real y desechable por archivo de pruebas,
// con las migraciones aplicadas y los datos del seed (ocupación real del INPE, usuarios y fichas ficticias).
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { crearApp } from '../../src/app';
import type { Config } from '../../src/config';
import { migrar } from '../../src/db/migrar';
import { sembrar } from '../../src/db/seed';
import { evaluarAlertas } from '../../src/modulos/alertas/servicio';

export const PASSWORD = 'Prueba#Segura2026';

export const config: Config = {
  nodeEnv: 'test', port: 0, mongoUri: '', jwtSecret: 'secreto-de-pruebas-con-mas-de-32-caracteres!!',
  dataKey: randomBytes(32), corsOrigin: ['http://localhost:5173'], intervaloAlertasMin: 0,
};

export async function prepararBase(nombre: string) {
  const base = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017';
  await mongoose.connect(`${base.replace(/\/$/, '')}/inpe_test_${nombre}`, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db!;
  await db.dropDatabase();
  await migrar(db);
  await sembrar({ dataKey: config.dataKey, password: PASSWORD });
  await evaluarAlertas();
}

export async function cerrarBase() {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
}

export function nuevaApp(limites: { limiteGeneral?: number; limiteLogin?: number } = {}) {
  return crearApp({ config, limiteGeneral: 10_000, limiteLogin: 10_000, ...limites });
}

export async function iniciarSesion(app: ReturnType<typeof nuevaApp>, username: string) {
  const r = await request(app).post('/api/auth/login').send({ username, password: PASSWORD });
  if (r.status !== 200) throw new Error(`No se pudo iniciar sesión como ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  return `Bearer ${r.body.token as string}`;
}
