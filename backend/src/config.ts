import { z } from 'zod';

const clave32 = (nombre: string) =>
  z.string().refine((v) => Buffer.from(v, 'base64').length === 32, `${nombre} debe ser de 32 bytes codificados en base64`);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatorio'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  DATA_KEY: clave32('DATA_KEY'),
  HMAC_KEY: clave32('HMAC_KEY'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongoUri: string;
  jwtSecret: string;
  dataKey: Buffer;
  hmacKey: Buffer;
  corsOrigin: string[];
}

// Falla al iniciar si falta un secreto: valores por defecto seguros (fail-safe defaults).
export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = esquema.safeParse(env);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${detalle}`);
  }
  const e = r.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    mongoUri: e.MONGODB_URI,
    jwtSecret: e.JWT_SECRET,
    dataKey: Buffer.from(e.DATA_KEY, 'base64'),
    hmacKey: Buffer.from(e.HMAC_KEY, 'base64'),
    corsOrigin: e.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
  };
}
