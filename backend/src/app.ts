import cors from 'cors';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { Config } from './config';
import type { Auditar, RepositorioInternos, RepositorioUsuarios } from './dominio';
import { rutasAuth } from './rutas/auth';
import { rutasInternos } from './rutas/internos';
import { autenticar } from './seguridad/auth';
import { rechazarOperadoresNoSQL } from './seguridad/sanitizar';

export interface Dependencias {
  config: Config;
  internos: RepositorioInternos;
  usuarios: RepositorioUsuarios;
  auditar: Auditar;
  verificarPassword: (hash: string, password: string) => Promise<boolean>;
  rutasCapacidad?: Router;
  baseDeDatosLista?: () => boolean;
}

export function crearApp(d: Dependencias) {
  const app = express();
  const logger = pino({
    level: d.config.nodeEnv === 'test' ? 'silent' : 'info',
    // Los logs nunca registran credenciales ni tokens (R10).
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
  });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: d.config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false })); // RNF14
  app.use(rechazarOperadoresNoSQL);

  app.get('/health', (_req, res) => {
    const db = d.baseDeDatosLista ? d.baseDeDatosLista() : true;
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degradado' });
  });

  app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }),
    rutasAuth(d.usuarios, d.auditar, d.verificarPassword, d.config.jwtSecret));
  app.use('/api/internos', autenticar(d.config.jwtSecret), rutasInternos(d.internos, d.auditar));
  if (d.rutasCapacidad) app.use('/api/capacidad', autenticar(d.config.jwtSecret), d.rutasCapacidad);

  app.use((_req, res) => res.status(404).json({ error: 'No encontrado' }));
  // Manejo seguro de errores: sin trazas ni detalles internos hacia el cliente (RNF18).
  app.use((err: Error & { type?: string }, req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    req.log?.error({ err }, 'Error no controlado');
    return res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
