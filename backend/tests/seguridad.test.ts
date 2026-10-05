import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { crearApp } from '../src/app';
import type { Config } from '../src/config';
import type { EventoAuditoria, FichaInterno, UsuarioCredenciales } from '../src/dominio';
import { emitirToken, type UsuarioToken } from '../src/seguridad/auth';
import { contieneOperador } from '../src/seguridad/sanitizar';

const config: Config = {
  nodeEnv: 'test', port: 0, mongoUri: 'mongodb://no-usado', jwtSecret: 'secreto-de-pruebas-con-mas-de-32-caracteres',
  dataKey: randomBytes(32), hmacKey: randomBytes(32), corsOrigin: ['http://localhost:5173'],
};

const ficha = (codigo: string, penal: string): FichaInterno => ({
  codigo_interno: codigo, penal_id: penal, pabellon_id: `${penal}-P01`, nombres: 'Interno', apellido_paterno: 'Ficticio',
  apellido_materno: 'Prueba', tipo_documento: 'DNI', numero_documento: '00000000', sexo: 'M', situacion_juridica: 'PROCESADO',
  delito: 'Robo agravado', numero_expediente: '00001-2025-0-1501-JR-PE-01', fecha_ingreso: new Date('2025-01-01'),
});
const INTERNOS = new Map([['INT-0000001', ficha('INT-0000001', 'EP01')], ['INT-0000002', ficha('INT-0000002', 'EP02')]]);
const PASSWORD = 'Correcta#2026';

function crear() {
  const auditoria: EventoAuditoria[] = [];
  const usuarios = new Map<string, UsuarioCredenciales>([
    ['operador1', { id: 'USR1', rol: 'OPERADOR_REGISTRO', penalId: 'EP01', estado: 'ACTIVO', passwordHash: 'hash', intentosFallidos: 0, bloqueadoHasta: null }],
  ]);
  const app = crearApp({
    config,
    internos: { buscarPorCodigo: async (c) => INTERNOS.get(c) ?? null },
    usuarios: {
      porUsername: async (u) => usuarios.get(u) ?? null,
      registrarFallo: async (id, intentos, bloqueadoHasta) => {
        const u = [...usuarios.values()].find((x) => x.id === id)!;
        u.intentosFallidos = intentos;
        u.bloqueadoHasta = bloqueadoHasta;
      },
      registrarExito: async () => undefined,
    },
    auditar: async (e) => { auditoria.push(e); },
    verificarPassword: async (_hash, p) => p === PASSWORD,
  });
  return { app, auditoria };
}

const token = (u: UsuarioToken) => `Bearer ${emitirToken(u, config.jwtSecret)}`;
const operadorEP01: UsuarioToken = { id: 'USR1', rol: 'OPERADOR_REGISTRO', penalId: 'EP01' };

describe('Disponibilidad', () => {
  it('GET /health responde 200', async () => {
    await request(crear().app).get('/health').expect(200, { status: 'ok' });
  });
});

describe('Autorización a nivel de objeto (RNF08 / REQ-SEC-02)', () => {
  it('un operador ve internos de su propio penal', async () => {
    const res = await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', token(operadorEP01)).expect(200);
    expect(res.body.codigo_interno).toBe('INT-0000001');
  });

  it('un operador recibe 403 al pedir un interno de otro penal y queda auditado', async () => {
    const { app, auditoria } = crear();
    await request(app).get('/api/internos/INT-0000002').set('Authorization', token(operadorEP01)).expect(403);
    expect(auditoria).toContainEqual(expect.objectContaining({ resultado: 'DENEGADO', recurso: 'INT-0000002', usuario_id: 'USR1' }));
  });

  it('el auditor no accede a datos personales (RNF09)', async () => {
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', token({ id: 'A1', rol: 'AUDITOR', penalId: null })).expect(403);
  });

  it('el administrador central accede a cualquier penal', async () => {
    await request(crear().app).get('/api/internos/INT-0000002').set('Authorization', token({ id: 'C1', rol: 'ADMIN_CENTRAL', penalId: null })).expect(200);
  });
});

describe('Autenticación con token (RNF07)', () => {
  it('sin token responde 401', async () => {
    await request(crear().app).get('/api/internos/INT-0000001').expect(401);
  });

  it('token firmado con otra clave responde 401', async () => {
    const falso = jwt.sign({ rol: 'ADMIN_CENTRAL', penal: null }, 'otra-clave-de-atacante-con-32-caracteres!', { subject: 'X' });
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', `Bearer ${falso}`).expect(401);
  });

  it('token expirado responde 401 (REQ-SEC-04)', async () => {
    const viejo = jwt.sign({ rol: 'OPERADOR_REGISTRO', penal: 'EP01', exp: Math.floor(Date.now() / 1000) - 10 }, config.jwtSecret, { subject: 'USR1' });
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', `Bearer ${viejo}`).expect(401);
  });
});

describe('Bloqueo por intentos fallidos (RNF06 / REQ-SEC-01)', () => {
  it('bloquea la cuenta al 5.º intento fallido y rechaza luego la contraseña correcta', async () => {
    const { app, auditoria } = crear();
    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({ username: 'operador1', password: 'mala' }).expect(401);
    await request(app).post('/api/auth/login').send({ username: 'operador1', password: 'mala' }).expect(423);
    await request(app).post('/api/auth/login').send({ username: 'operador1', password: PASSWORD }).expect(423);
    expect(auditoria.filter((e) => e.resultado === 'BLOQUEADO').length).toBeGreaterThanOrEqual(2);
  });

  it('con credenciales correctas emite un token de 15 minutos', async () => {
    const res = await request(crear().app).post('/api/auth/login').send({ username: 'operador1', password: PASSWORD }).expect(200);
    expect(res.body.expira_en).toBe(900);
    const p = jwt.verify(res.body.token, config.jwtSecret) as jwt.JwtPayload;
    expect(p.exp! - p.iat!).toBe(900);
  });

  it('usuario inexistente recibe el mismo mensaje genérico', async () => {
    const res = await request(crear().app).post('/api/auth/login').send({ username: 'noexiste', password: 'x' }).expect(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });
});

describe('Inyección NoSQL (RNF10 / REQ-SEC-06)', () => {
  it('rechaza operadores de MongoDB en el cuerpo', async () => {
    await request(crear().app).post('/api/auth/login').send({ username: { $ne: null }, password: { $ne: null } }).expect(400);
  });

  it('rechaza operadores de MongoDB en la query string', async () => {
    await request(crear().app).get('/api/internos/INT-0000001?numero_documento[$ne]=1').set('Authorization', token(operadorEP01)).expect(400);
  });

  it('rechaza un código de interno con formato inválido', async () => {
    await request(crear().app).get('/api/internos/abc').set('Authorization', token(operadorEP01)).expect(400);
  });

  it('detecta operadores anidados', () => {
    expect(contieneOperador({ a: [{ b: { $where: 'sleep(1000)' } }] })).toBe(true);
    expect(contieneOperador({ 'perfil.rol': 'ADMIN_CENTRAL' })).toBe(true);
    expect(contieneOperador({ username: 'operador1' })).toBe(false);
  });
});

describe('Manejo seguro de errores', () => {
  it('JSON malformado responde 400 sin detalles internos', async () => {
    const res = await request(crear().app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"username":').expect(400);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at /);
  });

  it('ruta inexistente responde 404 y oculta la tecnología del servidor', async () => {
    const res = await request(crear().app).get('/no-existe').expect(404);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
