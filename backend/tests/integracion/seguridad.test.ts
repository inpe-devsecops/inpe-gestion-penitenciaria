import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Auditoria, Establecimiento, Interno, Usuario } from '../../src/modelos';
import { cerrarBase, config, iniciarSesion, nuevaApp, PASSWORD, prepararBase } from './entorno';

const app = nuevaApp();
beforeAll(() => prepararBase('seguridad'));
afterAll(cerrarBase);

describe('Autenticación y sesiones (RNF-01, RNF-03, RNF-04)', () => {
  it('sin token responde 401', async () => {
    await request(app).get('/api/panel').expect(401);
  });

  it('emite un token de 15 minutos y no devuelve el hash de la contraseña', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'admin.central', password: PASSWORD }).expect(200);
    expect(r.body.expiraEn).toBe(900);
    expect(JSON.stringify(r.body)).not.toMatch(/argon2|password_hash/);
    const p = jwt.verify(r.body.token, config.jwtSecret) as jwt.JwtPayload;
    expect(p.exp! - p.iat!).toBe(900);
    const u = await Usuario.findOne({ username: 'admin.central' }).lean();
    expect(u!.password_hash).toMatch(/^\$argon2id\$/);
  });

  it('una sesión revocada (logout) ya no sirve aunque el token no haya expirado', async () => {
    const token = await iniciarSesion(app, 'auditor');
    await request(app).get('/api/auth/me').set('Authorization', token).expect(200);
    await request(app).post('/api/auth/logout').set('Authorization', token).expect(204);
    await request(app).get('/api/auth/me').set('Authorization', token).expect(401);
  });

  it('rechaza un token firmado con otra clave, uno expirado y uno sin sesión registrada', async () => {
    const falso = jwt.sign({ rol: 'ADMIN_CENTRAL' }, 'otra-clave-de-atacante-con-32-caracteres!', { subject: 'USR-0001', jwtid: 'x' });
    await request(app).get('/api/panel').set('Authorization', `Bearer ${falso}`).expect(401);
    const viejo = jwt.sign({ rol: 'ADMIN_CENTRAL', exp: Math.floor(Date.now() / 1000) - 10 }, config.jwtSecret, { subject: 'USR-0001', jwtid: 'y' });
    await request(app).get('/api/panel').set('Authorization', `Bearer ${viejo}`).expect(401);
    const inventado = jwt.sign({ rol: 'ADMIN_CENTRAL' }, config.jwtSecret, { subject: 'USR-0001', jwtid: 'no-existe', expiresIn: 60 });
    await request(app).get('/api/panel').set('Authorization', `Bearer ${inventado}`).expect(401);
  });

  it('usuario inexistente y contraseña errónea reciben el mismo mensaje', async () => {
    const a = await request(app).post('/api/auth/login').send({ username: 'no.existe', password: 'x' }).expect(401);
    const b = await request(app).post('/api/auth/login').send({ username: 'regional.sur', password: 'mala' }).expect(401);
    expect(a.body.error).toBe('Credenciales inválidas');
    expect(b.body.error).toBe(a.body.error);
  });

  it('bloquea la cuenta al 5.º intento fallido y rechaza luego la contraseña correcta', async () => {
    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({ username: 'regional.centro', password: 'mala' }).expect(401);
    await request(app).post('/api/auth/login').send({ username: 'regional.centro', password: 'mala' }).expect(423);
    await request(app).post('/api/auth/login').send({ username: 'regional.centro', password: PASSWORD }).expect(423);
    expect(await Auditoria.countDocuments({ accion: 'LOGIN', resultado: 'BLOQUEADO' })).toBeGreaterThanOrEqual(2);
  });

  it('aplica un límite de intentos de inicio de sesión por IP', async () => {
    const limitada = nuevaApp({ limiteLogin: 3 });
    for (let i = 0; i < 3; i++) await request(limitada).post('/api/auth/login').send({ username: 'x.y', password: 'x' });
    await request(limitada).post('/api/auth/login').send({ username: 'x.y', password: 'x' }).expect(429);
  });
});

describe('Autorización por rol y ámbito (RNF-02)', () => {
  it('un director ve su establecimiento y recibe 403 en otro, y el intento queda auditado', async () => {
    const token = await iniciarSesion(app, 'director.ep-tacna');
    await request(app).get('/api/establecimientos/EP-TACNA').set('Authorization', token).expect(200);
    await request(app).get('/api/establecimientos/EP-LURIGANCHO').set('Authorization', token).expect(403);
    expect(await Auditoria.exists({ accion: 'CONSULTA_ESTABLECIMIENTO', entidad_id: 'EP-LURIGANCHO', resultado: 'DENEGADO' })).toBeTruthy();
  });

  it('el responsable regional solo lista establecimientos de su oficina', async () => {
    const token = await iniciarSesion(app, 'regional.sur');
    const r = await request(app).get('/api/establecimientos').set('Authorization', token).expect(200);
    expect(r.body.total).toBe(6);
    expect(new Set(r.body.datos.map((e: { oficinaId: string }) => e.oficinaId))).toEqual(new Set(['SUR']));
  });

  it('un director no puede ver la ficha de un interno de otro establecimiento', async () => {
    const otro = await Interno.findOne({ establecimiento_id: 'EP-LURIGANCHO' }).lean();
    const token = await iniciarSesion(app, 'director.ep-tacna');
    await request(app).get(`/api/internos/${otro!._id}`).set('Authorization', token).expect(404);
  });

  it('el auditor consulta pero no modifica ni inicia traslados', async () => {
    const token = await iniciarSesion(app, 'auditor');
    await request(app).get('/api/panel').set('Authorization', token).expect(200);
    await request(app).get('/api/auditoria').set('Authorization', token).expect(200);
    await request(app).patch('/api/establecimientos/EP-TACNA/ocupacion').set('Authorization', token).send({ poblacion: 1, motivo: 'intento del auditor' }).expect(403);
    await request(app).patch('/api/parametros').set('Authorization', token).send({ cambios: { umbral_critico: 250 }, motivo: 'intento del auditor' }).expect(403);
    await request(app).post('/api/traslados').set('Authorization', token).send({}).expect(403);
  });

  it('solo el central y el auditor leen la auditoría', async () => {
    const token = await iniciarSesion(app, 'regional.lima');
    await request(app).get('/api/auditoria').set('Authorization', token).expect(403);
  });
});

describe('Validación de entradas e inyección NoSQL (RNF-06, RNF-07)', () => {
  it('rechaza operadores de MongoDB en el cuerpo y en la query', async () => {
    await request(app).post('/api/auth/login').send({ username: { $ne: null }, password: { $ne: null } }).expect(400);
    const token = await iniciarSesion(app, 'admin.central');
    await request(app).get('/api/internos?busqueda[$ne]=x').set('Authorization', token).expect(400);
    await request(app).get('/api/establecimientos?orden[$gt]=').set('Authorization', token).expect(400);
  });

  it('informa qué campo corregir sin revelar detalles técnicos (RNF-23)', async () => {
    const token = await iniciarSesion(app, 'admin.central');
    const r = await request(app).get('/api/establecimientos?orden=xyz').set('Authorization', token).expect(400);
    expect(r.body).toMatchObject({ codigo: 'VALIDACION', detalles: [expect.objectContaining({ campo: 'orden' })] });
    expect(JSON.stringify(r.body)).not.toMatch(/stack|node_modules|at /);
  });

  it('JSON malformado responde 400 y una ruta inexistente 404 sin exponer la tecnología', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"username":').expect(400);
    const r = await request(app).get('/no-existe').expect(404);
    expect(r.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Minimización de datos (RNF-08)', () => {
  it('la API rechaza campos personales en la ficha del interno', async () => {
    const token = await iniciarSesion(app, 'admin.central');
    await request(app).post('/api/internos').set('Authorization', token).send({
      sexo: 'M', clasificacion: 'MINIMA', faseTratamiento: 'ORDINARIO', situacionJuridica: 'PROCESADO', nivelRiesgo: 1,
      regionProcedenciaId: 'LIMA', establecimientoId: 'EP-LURIGANCHO', fechaIngreso: '2025-01-01', nombres: 'Juan Pérez',
    }).expect(400);
  });

  it('la base de datos rechaza un documento de interno con datos personales aunque la aplicación falle', async () => {
    const col = (await import('mongoose')).default.connection.collection('internos');
    await expect(col.insertOne({
      _id: 'INT-999999' as never, sexo: 'M', clasificacion: 'MINIMA', fase_tratamiento: 'ORDINARIO', situacion_juridica: 'PROCESADO',
      nivel_riesgo: 1, region_procedencia: 'LIMA', establecimiento_id: 'EP-LURIGANCHO', fecha_ingreso: new Date(), numero_documento: '12345678',
    })).rejects.toMatchObject({ code: 121 });
  });
});

describe('Auditoría de solo inserción (RNF-11)', () => {
  it('el modelo impide modificar o borrar registros', async () => {
    await expect(Auditoria.updateOne({}, { $set: { accion: 'X' } })).rejects.toThrow(/solo inserción/);
    await expect(Auditoria.deleteMany({})).rejects.toThrow(/solo inserción/);
    await expect(Auditoria.findOneAndDelete({})).rejects.toThrow(/solo inserción/);
  });

  it('la API no expone operaciones de modificación sobre la auditoría', async () => {
    const token = await iniciarSesion(app, 'admin.central');
    await request(app).delete('/api/auditoria').set('Authorization', token).expect(404);
    await request(app).patch('/api/auditoria').set('Authorization', token).send({}).expect(404);
  });
});


describe('Fichas de internos: ámbito y 404 (aportado por la rama de roles)', () => {
  const fichaNueva = {
    sexo: 'M', clasificacion: 'MINIMA', faseTratamiento: 'INGRESO', situacionJuridica: 'PROCESADO',
    nivelRiesgo: 1, regionProcedenciaId: 'LIMA', fechaIngreso: '2026-10-01',
  };

  it('un interno ajeno y uno inexistente responden igual, y el intento queda auditado', async () => {
    const ajeno = await Interno.findOne({ establecimiento_id: 'EP-LURIGANCHO' }).lean();
    const token = await iniciarSesion(app, 'director.ep-tacna');
    const a = await request(app).get(`/api/internos/${ajeno!._id}`).set('Authorization', token);
    const b = await request(app).get('/api/internos/INT-999998').set('Authorization', token);
    expect(a.status).toBe(404);
    expect(a.status).toBe(b.status);
    expect({ error: a.body.error, codigo: a.body.codigo }).toEqual({ error: b.body.error, codigo: b.body.codigo });
    expect(await Auditoria.exists({ accion: 'CONSULTA_INTERNO', entidad_id: String(ajeno!._id), resultado: 'DENEGADO' })).toBeTruthy();
  });

  it('el responsable regional ve internos de su oficina y recibe 404 en otra', async () => {
    const token = await iniciarSesion(app, 'regional.sur');
    const ids = (await Establecimiento.find({ oficina_id: 'SUR' }, { _id: 1 }).lean()).map((e) => e._id);
    const propio = await Interno.findOne({ establecimiento_id: { $in: ids } }).lean();
    const ajeno = await Interno.findOne({ establecimiento_id: 'EP-LURIGANCHO' }).lean();
    await request(app).get(`/api/internos/${propio!._id}`).set('Authorization', token).expect(200);
    await request(app).get(`/api/internos/${ajeno!._id}`).set('Authorization', token).expect(404);
  });

  it('el director registra y corrige fichas solo en su establecimiento', async () => {
    const token = await iniciarSesion(app, 'director.ep-tacna');
    const creada = await request(app).post('/api/internos').set('Authorization', token)
      .send({ ...fichaNueva, establecimientoId: 'EP-TACNA' }).expect(201);
    await request(app).post('/api/internos').set('Authorization', token)
      .send({ ...fichaNueva, establecimientoId: 'EP-LURIGANCHO' }).expect(403);
    expect(await Auditoria.exists({ accion: 'REGISTRAR_INTERNO', resultado: 'DENEGADO' })).toBeTruthy();

    const corregida = await request(app).patch(`/api/internos/${creada.body.id}`).set('Authorization', token)
      .send({ nivelRiesgo: 3 }).expect(200);
    expect(corregida.body.nivelRiesgo).toBe(3);
    await request(app).patch(`/api/internos/${creada.body.id}`).set('Authorization', token)
      .send({ establecimientoId: 'EP-LURIGANCHO' }).expect(400);

    const ajeno = await Interno.findOne({ establecimiento_id: 'EP-LURIGANCHO' }).lean();
    await request(app).patch(`/api/internos/${ajeno!._id}`).set('Authorization', token).send({ nivelRiesgo: 2 }).expect(404);
  });

  it('un responsable regional no registra fichas', async () => {
    const token = await iniciarSesion(app, 'regional.sur');
    await request(app).post('/api/internos').set('Authorization', token)
      .send({ ...fichaNueva, establecimientoId: 'EP-TACNA' }).expect(403);
  });
});