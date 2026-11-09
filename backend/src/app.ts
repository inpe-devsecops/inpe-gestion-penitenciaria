import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { Config } from './config';
import { manejarErrores } from './lib/errores';
import { rutasAlertas } from './modulos/alertas/rutas';
import { rutasAuth } from './modulos/auth/rutas';
import { rutasAuditoria, rutasCatalogos, rutasPanel, rutasParametros, rutasProyecciones } from './modulos/dashboard/rutas';
import { rutasEstablecimientos } from './modulos/establecimientos/rutas';
import { rutasInternos } from './modulos/internos/rutas';
import { rutasTraslados } from './modulos/traslados/rutas';
import { autenticar } from './seguridad/auth';
import { rechazarOperadoresNoSQL } from './seguridad/sanitizar';

export interface Dependencias {
  config: Config;
  verificarPassword?: (hash: string, password: string) => Promise<boolean>;
  baseDeDatosLista?: () => boolean;
  // Peticiones por minuto y por IP (RNF-16 / denegación de servicio)
  limiteGeneral?: number;
  limiteLogin?: number;
}

export function crearApp(d: Dependencias) {
  const app = express();
  const logger = pino({
    level: d.config.nodeEnv === 'test' ? 'silent' : 'info',
    // Los logs nunca registran credenciales ni tokens (RNF-08, RNF-24)
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
  });
  app.locals.dataKey = d.config.dataKey;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: d.config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));
  app.use(rateLimit({ windowMs: 60_000, limit: d.limiteGeneral ?? 300, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Demasiadas peticiones, intente en un minuto', codigo: 'LIMITE_EXCEDIDO' } }));
  app.use(rechazarOperadoresNoSQL);

  app.get('/health', (_req, res) => {
    const db = d.baseDeDatosLista ? d.baseDeDatosLista() : true;
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degradado' });
  });

  app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: d.limiteLogin ?? 10, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Demasiados intentos, espere un minuto', codigo: 'DEMASIADOS_INTENTOS' } }),
  rutasAuth(d.config.jwtSecret, d.verificarPassword));

  // Toda ruta de negocio exige sesión válida; la autorización por rol y ámbito la aplica cada módulo
  const sesion = autenticar(d.config.jwtSecret);
  app.use('/api/panel', sesion, rutasPanel());
  app.use('/api/establecimientos', sesion, rutasEstablecimientos());
  app.use('/api/internos', sesion, rutasInternos());
  app.use('/api/traslados', sesion, rutasTraslados());
  app.use('/api/alertas', sesion, rutasAlertas());
  app.use('/api/proyecciones', sesion, rutasProyecciones());
  app.use('/api/parametros', sesion, rutasParametros());
  app.use('/api/auditoria', sesion, rutasAuditoria());
  app.use('/api/catalogos', sesion, rutasCatalogos());

  app.use((_req, res) => res.status(404).json({ error: 'No encontrado', codigo: 'NO_ENCONTRADO' }));
  app.use(manejarErrores);
  return app;
}
