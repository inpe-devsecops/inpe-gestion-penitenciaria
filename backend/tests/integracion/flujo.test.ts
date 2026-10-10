import mongoose from 'mongoose';
import request from 'supertest';
import { Alerta, Auditoria, DecisionTraslado, Establecimiento, EvaluacionDestino, Interno } from '../../src/modelos';
import { cerrarBase, iniciarSesion, nuevaApp, prepararBase } from './entorno';

const app = nuevaApp();
let central: string;
let central2: string;
let regionalLima: string;
let auditor: string;

beforeAll(async () => {
  await prepararBase('flujo');
  [central, central2, regionalLima, auditor] = await Promise.all(
    ['admin.central', 'admin.central2', 'regional.lima', 'auditor'].map((u) => iniciarSesion(app, u)),
  );
});
afterAll(cerrarBase);

describe('Panel e indicadores (RF-04, RF-05, RNF-14, RNF-15)', () => {
  it('coincide exactamente con el Informe Estadístico del INPE de enero 2026', async () => {
    const r = await request(app).get('/api/panel').set('Authorization', central).expect(200);
    expect(r.body.totales).toMatchObject({ capacidad: 41_764, poblacion: 103_717, sobrepoblacion: 61_953, hacinamientoPct: 148.34, establecimientos: 69 });
    expect(r.body.masHacinados[0]).toMatchObject({ id: 'EP-TACNA', hacinamientoPct: 438.29, nivel: 'CRITICO' });
    expect(r.body.porOficina).toHaveLength(8);
    expect(r.body.serie).toHaveLength(13);
  });

  it('calcula el panel nacional en menos de dos segundos', async () => {
    const inicio = Date.now();
    await request(app).get('/api/panel').set('Authorization', central).expect(200);
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it('el responsable regional ve solo los indicadores de su oficina', async () => {
    const r = await request(app).get('/api/panel').set('Authorization', regionalLima).expect(200);
    expect(r.body.porOficina).toEqual([expect.objectContaining({ oficinaId: 'LIMA' })]);
    expect(r.body.totales.establecimientos).toBe(18);
  });

  it('expone la serie histórica y la proyección con horizonte y supuesto (RF-06, RF-10)', async () => {
    const serie = await request(app).get('/api/establecimientos/EP-LURIGANCHO/serie').set('Authorization', central).expect(200);
    expect(serie.body).toHaveLength(13);
    expect(serie.body[0]).toMatchObject({ corte: '2025-01', poblacion: 9581, interpolado: false });
    const p = await request(app).get('/api/establecimientos/EP-LURIGANCHO/proyeccion').set('Authorization', central).expect(200);
    expect(p.body).toMatchObject({ escenario: 'EN_RIESGO', horizonte: { cortes: 12 } });
    expect(p.body.supuesto).toMatch(/mínimos cuadrados/);
  });
});

describe('Alertas (RF-07 a RF-09)', () => {
  it('genera alertas al cargar los datos y no las duplica al reevaluar', async () => {
    const antes = await Alerta.countDocuments({ vigente: true });
    expect(antes).toBeGreaterThan(40);
    const r = await request(app).post('/api/alertas/evaluar').set('Authorization', central).expect(200);
    expect(r.body).toEqual({ creadas: 0, actualizadas: 0, resueltas: 0 });
    expect(await Alerta.countDocuments({ vigente: true })).toBe(antes);
  });

  it('el índice único parcial impide una segunda alerta vigente para la misma condición', async () => {
    const a = await Alerta.findOne({ establecimiento_id: 'EP-TACNA', condicion: 'HACINAMIENTO', vigente: true }).lean();
    expect(a!.severidad).toBe('CRITICO');
    const { _id: _ignorado, ...copia } = a!;
    await expect(Alerta.create(copia)).rejects.toMatchObject({ code: 11000 });
  });

  it('cambiar un umbral queda auditado con valor anterior y nuevo, y reclasifica las alertas (RNF-13)', async () => {
    await request(app).patch('/api/parametros').set('Authorization', central)
      .send({ cambios: { umbral_critico: 450 }, motivo: 'Prueba de reclasificación de severidad' }).expect(200);
    const reg = await Auditoria.findOne({ accion: 'ACTUALIZAR_PARAMETRO', entidad_id: 'umbral_critico' }).lean();
    expect(reg).toMatchObject({ valor_anterior: 300, valor_nuevo: 450, usuario_id: 'USR-0001' });
    const r = await request(app).post('/api/alertas/evaluar').set('Authorization', central).expect(200);
    expect(r.body.actualizadas).toBeGreaterThan(0);
    expect((await Alerta.findOne({ establecimiento_id: 'EP-TACNA', condicion: 'HACINAMIENTO', vigente: true }).lean())!.severidad).toBe('SEVERO');
    await request(app).patch('/api/parametros').set('Authorization', central)
      .send({ cambios: { umbral_critico: 300 }, motivo: 'Restablece el valor por defecto' }).expect(200);
    await request(app).post('/api/alertas/evaluar').set('Authorization', central).expect(200);
  });

  it('rechaza pesos que no suman 1', async () => {
    const r = await request(app).patch('/api/parametros').set('Authorization', central)
      .send({ cambios: { peso_cupo: 0.9 }, motivo: 'Intento de favorecer el cupo' }).expect(422);
    expect(r.body.error).toMatch(/sumar 1/);
  });
});

describe('Catálogo de establecimientos (RF-02, RF-03, RNF-19)', () => {
  const nuevo = {
    nombre: 'E.P. de Prueba de Ica', oficinaId: 'LIMA', departamento: 'Ica', latitud: -14.07, longitud: -75.73,
    capacidad: 500, poblacion: 120, techoSeguridad: 'MEDIANA', regimenesAdmitidos: ['MINIMA', 'MEDIANA'],
    generoPoblacion: 'MASCULINO', fasesTratamiento: ['ORDINARIO', 'CONFIANZA'], proporcionAltoRiesgo: 0.1,
  };

  it('el central registra un establecimiento nuevo sin cambiar la estructura y queda en su serie', async () => {
    const r = await request(app).post('/api/establecimientos').set('Authorization', central).send(nuevo).expect(201);
    expect(r.body).toMatchObject({ id: 'EP-PRUEBAICA', cupoLibre: 380, nivel: null });
    const serie = await request(app).get(`/api/establecimientos/${r.body.id}/serie`).set('Authorization', central).expect(200);
    expect(serie.body).toEqual([expect.objectContaining({ poblacion: 120, capacidad: 500 })]);
    await request(app).post('/api/establecimientos').set('Authorization', regionalLima).send(nuevo).expect(403);
  });

  it('rechaza regímenes por encima del techo de seguridad y audita los cambios con valor anterior', async () => {
    await request(app).patch('/api/establecimientos/EP-PRUEBAICA').set('Authorization', central)
      .send({ regimenesAdmitidos: ['MAXIMA'] }).expect(422);
    await request(app).patch('/api/establecimientos/EP-PRUEBAICA').set('Authorization', central).send({ activo: false }).expect(200);
    const reg = await Auditoria.findOne({ accion: 'ACTUALIZAR_ESTABLECIMIENTO', entidad_id: 'EP-PRUEBAICA' }).lean();
    expect(reg).toMatchObject({ valor_anterior: { activo: true }, valor_nuevo: { activo: false } });
  });
});

describe('Flujo del traslado con segregación de funciones (RF-11 a RF-24)', () => {
  let internoLima: string;
  let solicitudId: string;

  beforeAll(async () => {
    internoLima = (await Interno.findOne({ establecimiento_id: 'EP-LURIGANCHO' }).sort({ _id: 1 }).lean())!._id;
  });

  it('valida la causal del art. 159 y exige el fundamento (RF-12, RF-13)', async () => {
    const r1 = await request(app).post('/api/traslados').set('Authorization', regionalLima)
      .send({ internoId: internoLima, causal: 'CAPRICHO', fundamento: 'Fundamento suficientemente largo para la prueba' }).expect(400);
    expect(r1.body.detalles[0].mensaje).toMatch(/art\. 159/);
    await request(app).post('/api/traslados').set('Authorization', regionalLima).send({ internoId: internoLima, causal: 'HACINAMIENTO' }).expect(400);
  });

  it('el responsable regional no solicita traslados de internos de otra oficina', async () => {
    const otro = await Interno.findOne({ establecimiento_id: 'EP-TACNA' }).lean();
    await request(app).post('/api/traslados').set('Authorization', regionalLima)
      .send({ internoId: otro!._id, causal: 'HACINAMIENTO', fundamento: 'Intento fuera del ámbito regional asignado' }).expect(403);
  });

  it('registra la solicitud y conserva la evaluación de todos los establecimientos (RF-11, RF-19)', async () => {
    const r = await request(app).post('/api/traslados').set('Authorization', regionalLima)
      .send({ internoId: internoLima, causal: 'HACINAMIENTO', fundamento: 'Lurigancho supera el 200 % de hacinamiento según el panel.' }).expect(201);
    solicitudId = r.body.id;
    expect(r.body).toMatchObject({ estado: 'EVALUADA', origenId: 'EP-LURIGANCHO', fundamento: expect.stringMatching(/Lurigancho/) });
    const total = await Establecimiento.countDocuments();
    expect(r.body.evaluaciones).toHaveLength(total);
    const elegibles = r.body.evaluaciones.filter((e: { elegible: boolean }) => e.elegible);
    expect(elegibles.length).toBeGreaterThan(0);
    expect(elegibles[0]).toMatchObject({ posicion: 1, destinoId: r.body.destinoRecomendadoId });
    expect(Object.keys(elegibles[0].aportes)).toEqual(['cupo', 'hacinamiento', 'distancia', 'fase', 'riesgo']);
    const descartado = r.body.evaluaciones.find((e: { elegible: boolean }) => !e.elegible);
    expect(descartado.motivoDescarte).toBeTruthy();
    expect(await EvaluacionDestino.countDocuments({ solicitud_id: solicitudId })).toBe(total);
    // El fundamento se guarda cifrado
    const crudo = await mongoose.connection.collection('solicitudes_traslado').findOne({ _id: new mongoose.Types.ObjectId(solicitudId) });
    expect(crudo!.fundamento_cifrado).toMatch(/^v1:/);
    expect(JSON.stringify(crudo)).not.toMatch(/Lurigancho supera/);
  });

  it('no admite un segundo trámite abierto para el mismo interno', async () => {
    await request(app).post('/api/traslados').set('Authorization', regionalLima)
      .send({ internoId: internoLima, causal: 'OTROS', fundamento: 'Segundo intento mientras el primero sigue abierto' }).expect(409);
  });

  it('bloquea la autoaprobación en la aplicación y en la base de datos (RF-23, RNF-09)', async () => {
    const otro = await Interno.findOne({ establecimiento_id: 'EP-CALLAO' }).sort({ _id: -1 }).lean();
    const propia = await request(app).post('/api/traslados').set('Authorization', central)
      .send({ internoId: otro!._id, causal: 'HACINAMIENTO', fundamento: 'Solicitud registrada por el propio administrador central' }).expect(201);
    const r = await request(app).post(`/api/traslados/${propia.body.id}/aprobar`).set('Authorization', central)
      .send({ fundamento: 'Intento de aprobar mi propia solicitud de traslado' }).expect(403);
    expect(r.body.error).toMatch(/segregación/);
    expect(await Auditoria.exists({ accion: 'APROBAR_TRASLADO', resultado: 'DENEGADO', entidad_id: propia.body.id })).toBeTruthy();
    // Aunque alguien salte la aplicación, el validador de la colección lo rechaza
    await expect(DecisionTraslado.collection.insertOne({
      solicitud_id: new mongoose.Types.ObjectId(propia.body.id), solicitante_id: 'USR-0001', decidido_por: 'USR-0001',
      resultado: 'APROBADA', fundamento_cifrado: 'v1:x:y:z', decidida_en: new Date(),
    })).rejects.toMatchObject({ code: 121 });
  });

  it('el administrador central (distinto del solicitante) aprueba con fundamento (RF-20, RF-21)', async () => {
    const det = await request(app).get(`/api/traslados/${solicitudId}`).set('Authorization', central2).expect(200);
    expect(det.body.permisos.puedeDecidir).toBe(true);
    const r = await request(app).post(`/api/traslados/${solicitudId}/aprobar`).set('Authorization', central2)
      .send({ fundamento: 'Se acoge el destino recomendado: cupo libre y régimen admitido.' }).expect(200);
    expect(r.body).toMatchObject({ estado: 'APROBADA', destinoId: det.body.destinoRecomendadoId, decision: { resultado: 'APROBADA', decididoPorId: 'USR-0002' } });
  });

  it('solo el director del establecimiento involucrado registra la ejecución y la ocupación se actualiza (RF-24)', async () => {
    const det = await request(app).get(`/api/traslados/${solicitudId}`).set('Authorization', central).expect(200);
    const destinoId: string = det.body.destinoId;
    const [origenAntes, destinoAntes] = await Promise.all([Establecimiento.findById('EP-LURIGANCHO').lean(), Establecimiento.findById(destinoId).lean()]);

    const ajeno = await iniciarSesion(app, 'director.ep-tacna');
    await request(app).post(`/api/traslados/${solicitudId}/ejecutar`).set('Authorization', ajeno).send({}).expect(403);
    await request(app).post(`/api/traslados/${solicitudId}/ejecutar`).set('Authorization', central).send({}).expect(403);

    const director = await iniciarSesion(app, 'director.ep-lurigancho');
    const r = await request(app).post(`/api/traslados/${solicitudId}/ejecutar`).set('Authorization', director).send({ observacion: 'Traslado realizado' }).expect(200);
    expect(r.body.estado).toBe('EJECUTADA');
    const [origen, destino, interno] = await Promise.all([
      Establecimiento.findById('EP-LURIGANCHO').lean(), Establecimiento.findById(destinoId).lean(), Interno.findById(internoLima).lean(),
    ]);
    expect(origen!.poblacion_actual).toBe(origenAntes!.poblacion_actual - 1);
    expect(destino!.poblacion_actual).toBe(destinoAntes!.poblacion_actual + 1);
    expect(interno!.establecimiento_id).toBe(destinoId);
    await request(app).post(`/api/traslados/${solicitudId}/ejecutar`).set('Authorization', director).send({}).expect(422);
  });

  it('el auditor reconstruye quién solicitó, decidió y ejecutó y con qué valores', async () => {
    const r = await request(app).get(`/api/auditoria?entidad=solicitudes_traslado&entidadId=${solicitudId}`).set('Authorization', auditor).expect(200);
    const acciones = r.body.datos.map((d: { accion: string }) => d.accion);
    expect(acciones).toEqual(expect.arrayContaining(['SOLICITAR_TRASLADO', 'APROBAR_TRASLADO', 'EJECUTAR_TRASLADO']));
    const ejec = r.body.datos.find((d: { accion: string }) => d.accion === 'EJECUTAR_TRASLADO');
    expect(ejec.valorAnterior.interno_en).toBe('EP-LURIGANCHO');
    expect(ejec.usuario).toBeTruthy();
  });

  it('rechaza con motivo obligatorio (RF-22)', async () => {
    const otro = await Interno.findOne({ establecimiento_id: 'EP-HUARAL' }).lean();
    const s = await request(app).post('/api/traslados').set('Authorization', regionalLima)
      .send({ internoId: otro!._id, causal: 'ACERCAMIENTO_FAMILIAR', fundamento: 'Solicitud de acercamiento a la familia del interno' }).expect(201);
    await request(app).post(`/api/traslados/${s.body.id}/rechazar`).set('Authorization', central).send({ fundamento: 'corto' }).expect(400);
    const r = await request(app).post(`/api/traslados/${s.body.id}/rechazar`).set('Authorization', central)
      .send({ fundamento: 'No se acredita el vínculo familiar en la región de destino.' }).expect(200);
    expect(r.body).toMatchObject({ estado: 'RECHAZADA', decision: { resultado: 'RECHAZADA' } });
  });
});
