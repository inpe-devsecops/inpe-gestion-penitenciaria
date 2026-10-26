import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { crearApp } from '../src/app';
import type { Config } from '../src/config';
import { FichaDuplicada, type EventoAuditoria, type FichaInterno, type UsuarioCredenciales } from '../src/dominio';
import { emitirToken, type UsuarioToken } from '../src/seguridad/auth';
import { contieneOperador } from '../src/seguridad/sanitizar';

const config: Config = {
  nodeEnv: 'test', port: 0, mongoUri: 'mongodb://no-usado', jwtSecret: 'secreto-de-pruebas-con-mas-de-32-caracteres',
  dataKey: randomBytes(32), hmacKey: randomBytes(32), corsOrigin: ['http://localhost:5173'],
};

// EP01 pertenece a la oficina Norte y EP02 a la oficina Lima.
const OFICINA = new Map([['EP01', 'Norte'], ['EP02', 'Lima']]);
const ficha = (codigo: string, penal: string): FichaInterno => ({
  codigo_interno: codigo, penal_id: penal, oficina_regional: OFICINA.get(penal) ?? null, pabellon_id: `${penal}-P01`, nombres: 'Interno',
  apellido_paterno: 'Ficticio', apellido_materno: 'Prueba', tipo_documento: 'DNI', numero_documento: '00000000', sexo: 'M',
  situacion_juridica: 'PROCESADO', delito: 'Robo agravado', numero_expediente: '00001-2025-0-1501-JR-PE-01', fecha_ingreso: new Date('2025-01-01'),
});
const PASSWORD = 'Correcta#2026';

function crear() {
  const auditoria: EventoAuditoria[] = [];
  const internos = new Map([['INT-0000001', ficha('INT-0000001', 'EP01')], ['INT-0000002', ficha('INT-0000002', 'EP02')]]);
  const usuarios = new Map<string, UsuarioCredenciales>([
    ['director1', { id: 'USR1', rol: 'DIRECTOR_PENAL', penalId: 'EP01', oficinaId: null, estado: 'ACTIVO', passwordHash: 'hash', intentosFallidos: 0, bloqueadoHasta: null }],
  ]);
  const app = crearApp({
    config,
    // Repositorio en memoria: las rutas no conocen MongoDB, así que los controles se prueban sin base de datos.
    internos: {
      buscarPorCodigo: async (c) => internos.get(c) ?? null,
      crear: async (penalId, f) => {
        if (internos.has(f.codigo_interno)) throw new FichaDuplicada();
        const nueva: FichaInterno = { ...f, penal_id: penalId, oficina_regional: OFICINA.get(penalId) ?? null };
        internos.set(f.codigo_interno, nueva);
        return nueva;
      },
      actualizar: async (c, cambios) => {
        const actual = internos.get(c);
        if (!actual) return null;
        const nueva = { ...actual, ...cambios };
        internos.set(c, nueva);
        return nueva;
      },
    },
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
  return { app, auditoria, internos };
}

const token = (u: UsuarioToken) => `Bearer ${emitirToken(u, config.jwtSecret)}`;
const directorEP01: UsuarioToken = { id: 'USR1', rol: 'DIRECTOR_PENAL', penalId: 'EP01', oficinaId: null };
const responsableNorte: UsuarioToken = { id: 'USR2', rol: 'RESPONSABLE_REGIONAL', penalId: null, oficinaId: 'Norte' };
const adminCentral: UsuarioToken = { id: 'C1', rol: 'ADMIN_CENTRAL', penalId: null, oficinaId: null };
const nuevaFicha = {
  codigo_interno: 'INT-0000003', pabellon_id: 'EP01-P02', nombres: 'Nuevo', apellido_paterno: 'Ingreso', apellido_materno: 'Prueba',
  tipo_documento: 'DNI', numero_documento: '12345678', sexo: 'M', situacion_juridica: 'PROCESADO', delito: 'Hurto agravado',
  numero_expediente: '00002-2026-0-1501-JR-PE-01', fecha_ingreso: '2026-10-01',
};

describe('Disponibilidad', () => {
  it('GET /health responde 200', async () => {
    await request(crear().app).get('/health').expect(200, { status: 'ok' });
  });
});

describe('Autorización a nivel de objeto (RNF-02 / REQ-SEC-02)', () => {
  it('un director ve internos de su propio penal', async () => {
    const res = await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', token(directorEP01)).expect(200);
    expect(res.body.codigo_interno).toBe('INT-0000001');
  });

  it('un director recibe 404 al pedir un interno de otro penal y queda auditado', async () => {
    const { app, auditoria } = crear();
    await request(app).get('/api/internos/INT-0000002').set('Authorization', token(directorEP01)).expect(404);
    expect(auditoria).toContainEqual(expect.objectContaining({ resultado: 'DENEGADO', recurso: 'INT-0000002', usuario_id: 'USR1' }));
  });

  it('un interno ajeno y uno inexistente responden exactamente igual (anti-enumeración)', async () => {
    const app = crear().app;
    const ajeno = await request(app).get('/api/internos/INT-0000002').set('Authorization', token(directorEP01));
    const inexistente = await request(app).get('/api/internos/INT-9999999').set('Authorization', token(directorEP01));
    expect(ajeno.status).toBe(inexistente.status);
    expect(ajeno.body).toEqual(inexistente.body);
  });

  it('el auditor no accede a datos personales', async () => {
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', token({ id: 'A1', rol: 'AUDITOR', penalId: null, oficinaId: null })).expect(404);
  });

  it('el administrador central accede a cualquier penal', async () => {
    await request(crear().app).get('/api/internos/INT-0000002').set('Authorization', token(adminCentral)).expect(200);
  });
});

describe('Ámbito del responsable regional (roles del informe, #5)', () => {
  it('ve internos de los penales de su oficina regional', async () => {
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', token(responsableNorte)).expect(200);
  });

  it('recibe 404 al pedir un interno de otra oficina regional y queda auditado', async () => {
    const { app, auditoria } = crear();
    await request(app).get('/api/internos/INT-0000002').set('Authorization', token(responsableNorte)).expect(404);
    expect(auditoria).toContainEqual(expect.objectContaining({ resultado: 'DENEGADO', recurso: 'INT-0000002', usuario_id: 'USR2' }));
  });
});

describe('Registro y corrección de fichas por el director (#5)', () => {
  it('el director registra una ficha y queda en su propio penal (tomado del token)', async () => {
    const { app, auditoria } = crear();
    const res = await request(app).post('/api/internos').set('Authorization', token(directorEP01)).send(nuevaFicha).expect(201);
    expect(res.body.penal_id).toBe('EP01');
    expect(auditoria).toContainEqual(expect.objectContaining({ accion: 'REGISTRA_FICHA_INTERNO', recurso: 'INT-0000003', resultado: 'EXITO' }));
  });

  it('rechaza un campo no permitido, como penal_id, en el cuerpo (asignación masiva)', async () => {
    const res = await request(crear().app).post('/api/internos').set('Authorization', token(directorEP01))
      .send({ ...nuevaFicha, penal_id: 'EP02' }).expect(400);
    expect(res.body.campos).toBeDefined();
  });

  it('un responsable regional no puede registrar fichas y queda auditado', async () => {
    const { app, auditoria } = crear();
    await request(app).post('/api/internos').set('Authorization', token(responsableNorte)).send(nuevaFicha).expect(403);
    expect(auditoria).toContainEqual(expect.objectContaining({ accion: 'REGISTRA_FICHA_INTERNO', resultado: 'DENEGADO' }));
  });

  it('un código ya existente responde 409', async () => {
    await request(crear().app).post('/api/internos').set('Authorization', token(directorEP01))
      .send({ ...nuevaFicha, codigo_interno: 'INT-0000001' }).expect(409);
  });

  it('datos inválidos responden 400 indicando los campos a corregir, sin detalles técnicos', async () => {
    const res = await request(crear().app).post('/api/internos').set('Authorization', token(directorEP01))
      .send({ ...nuevaFicha, numero_documento: '12', sexo: 'X' }).expect(400);
    expect(res.body.campos).toEqual(expect.arrayContaining(['numero_documento', 'sexo']));
    expect(JSON.stringify(res.body)).not.toMatch(/stack|zod/i);
  });

  it('el director corrige la situación jurídica de un interno de su penal y se auditan solo los nombres de campos', async () => {
    const { app, auditoria } = crear();
    const res = await request(app).patch('/api/internos/INT-0000001').set('Authorization', token(directorEP01))
      .send({ situacion_juridica: 'SENTENCIADO' }).expect(200);
    expect(res.body.situacion_juridica).toBe('SENTENCIADO');
    expect(auditoria).toContainEqual(expect.objectContaining({ accion: 'ACTUALIZA_FICHA_INTERNO', detalle: 'Campos: situacion_juridica' }));
  });

  it('el director no puede corregir fichas de otro penal (404, como en la consulta)', async () => {
    const { app, internos } = crear();
    await request(app).patch('/api/internos/INT-0000002').set('Authorization', token(directorEP01)).send({ nombres: 'Cambiado' }).expect(404);
    expect(internos.get('INT-0000002')!.nombres).toBe('Interno');
  });

  it('no permite cambiar el penal ni el documento por esta vía', async () => {
    await request(crear().app).patch('/api/internos/INT-0000001').set('Authorization', token(directorEP01))
      .send({ numero_documento: '87654321' }).expect(400);
  });
});

describe('Autenticación con token (RNF-04)', () => {
  it('sin token responde 401', async () => {
    await request(crear().app).get('/api/internos/INT-0000001').expect(401);
  });

  it('token firmado con otra clave responde 401', async () => {
    const falso = jwt.sign({ rol: 'ADMIN_CENTRAL', penal: null }, 'otra-clave-de-atacante-con-32-caracteres!', { subject: 'X' });
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', `Bearer ${falso}`).expect(401);
  });

  it('token expirado responde 401 (REQ-SEC-04)', async () => {
    const viejo = jwt.sign({ rol: 'DIRECTOR_PENAL', penal: 'EP01', exp: Math.floor(Date.now() / 1000) - 10 }, config.jwtSecret, { subject: 'USR1' });
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', `Bearer ${viejo}`).expect(401);
  });

  it('un rol que ya no existe (OPERADOR_REGISTRO) es rechazado aunque el token esté bien firmado', async () => {
    const antiguo = jwt.sign({ rol: 'OPERADOR_REGISTRO', penal: 'EP01' }, config.jwtSecret, { subject: 'USR9', expiresIn: 60 });
    await request(crear().app).get('/api/internos/INT-0000001').set('Authorization', `Bearer ${antiguo}`).expect(401);
  });
});

describe('Bloqueo por intentos fallidos (RNF-01 / REQ-SEC-01)', () => {
  it('bloquea la cuenta al 5.º intento fallido y rechaza luego la contraseña correcta', async () => {
    const { app, auditoria } = crear();
    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({ username: 'director1', password: 'mala' }).expect(401);
    await request(app).post('/api/auth/login').send({ username: 'director1', password: 'mala' }).expect(423);
    await request(app).post('/api/auth/login').send({ username: 'director1', password: PASSWORD }).expect(423);
    expect(auditoria.filter((e) => e.resultado === 'BLOQUEADO').length).toBeGreaterThanOrEqual(2);
  });

  it('con credenciales correctas emite un token de 15 minutos con el ámbito del usuario', async () => {
    const res = await request(crear().app).post('/api/auth/login').send({ username: 'director1', password: PASSWORD }).expect(200);
    expect(res.body.expira_en).toBe(900);
    const p = jwt.verify(res.body.token, config.jwtSecret) as jwt.JwtPayload;
    expect(p.exp! - p.iat!).toBe(900);
    expect(p.penal).toBe('EP01');
  });

  it('usuario inexistente recibe el mismo mensaje genérico', async () => {
    const res = await request(crear().app).post('/api/auth/login').send({ username: 'noexiste', password: 'x' }).expect(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });
});

describe('Inyección NoSQL (RNF-07 / REQ-SEC-06)', () => {
  it('rechaza operadores de MongoDB en el cuerpo', async () => {
    await request(crear().app).post('/api/auth/login').send({ username: { $ne: null }, password: { $ne: null } }).expect(400);
  });

  it('rechaza operadores de MongoDB en la query string', async () => {
    await request(crear().app).get('/api/internos/INT-0000001?numero_documento[$ne]=1').set('Authorization', token(directorEP01)).expect(400);
  });

  it('rechaza un código de interno con formato inválido', async () => {
    await request(crear().app).get('/api/internos/abc').set('Authorization', token(directorEP01)).expect(400);
  });

  it('detecta operadores anidados', () => {
    expect(contieneOperador({ a: [{ b: { $where: 'sleep(1000)' } }] })).toBe(true);
    expect(contieneOperador({ 'perfil.rol': 'ADMIN_CENTRAL' })).toBe(true);
    expect(contieneOperador({ username: 'director1' })).toBe(false);
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
