import { calcularAportes, evaluarDestinos, motivoDescarte, type ConfigMotor, type DestinoMotor, type InternoMotor } from '../../src/modulos/traslados/motor';

const config: ConfigMotor = {
  pesos: { cupo: 0.3, hacinamiento: 0.25, distancia: 0.2, fase: 0.15, riesgo: 0.1 },
  cupoReferencia: 100, distanciaMaxKm: 1500, riesgoMaxProporcion: 0.5,
};

const lima = { latitud: -12.0464, longitud: -77.0428 };
const destino = (id: string, extra: Partial<DestinoMotor> = {}): DestinoMotor => ({
  id, nombre: `E.P. ${id}`, ubicacion: lima, capacidad: 1000, poblacion: 900, techo: 'MEDIANA',
  regimenes: ['MINIMA', 'MEDIANA'], genero: 'MASCULINO', fases: ['ORDINARIO'], proporcionAltoRiesgo: 0.1, activo: true, ...extra,
});
const interno: InternoMotor = {
  codigo: 'INT-000001', sexo: 'M', clasificacion: 'MEDIANA', fase: 'ORDINARIO', regionProcedencia: 'Lima',
  sedeProcedencia: lima, establecimientoId: 'EP-ORIGEN',
};

describe('Motor: condiciones obligatorias (RF-14, RF-15)', () => {
  it('descarta el establecimiento actual del interno', () => {
    expect(motivoDescarte(interno, destino('EP-ORIGEN'))).toMatch(/actual/);
  });
  it('descarta un destino que no admite el régimen del interno', () => {
    expect(motivoDescarte(interno, destino('EP-X', { regimenes: ['MINIMA'] }))).toMatch(/no es admitido/);
  });
  it('descarta un destino con techo de seguridad insuficiente', () => {
    expect(motivoDescarte({ ...interno, clasificacion: 'MAXIMA' }, destino('EP-X', { regimenes: ['MAXIMA'], techo: 'MEDIANA' }))).toMatch(/Techo de seguridad/);
  });
  it('descarta un destino sin cupo libre', () => {
    expect(motivoDescarte(interno, destino('EP-X', { poblacion: 1000 }))).toMatch(/Sin cupo/);
  });
  it('descarta un establecimiento de población femenina para un interno varón', () => {
    expect(motivoDescarte(interno, destino('EP-X', { genero: 'FEMENINO' }))).toMatch(/femenina/);
  });
  it('acepta un destino que cumple todas las condiciones', () => {
    expect(motivoDescarte(interno, destino('EP-X'))).toBeNull();
  });
});

describe('Motor: puntaje ponderado explicable (RF-16 a RF-18)', () => {
  // Reproduce la Tabla 12 del informe: A = 0.770 y B = 0.720
  it('reproduce el ejemplo de la Tabla 12', () => {
    const ctx = { hacMax: 400, hacMin: -100 };
    const a = calcularAportes(interno, destino('A', { capacidad: 1000, poblacion: 910, proporcionAltoRiesgo: 0.15 }), config,
      { ...ctx, hacOrigen: (-9 + 0.8 * 500), distancia: 900 });
    const b = calcularAportes(interno, destino('B', { capacidad: 1000, poblacion: 950, proporcionAltoRiesgo: 0.05 }), config,
      { ...ctx, hacOrigen: (-5 + 0.6 * 500), distancia: 150 });
    const total = (x: typeof a) => Math.round(Object.values(x).reduce((s, f) => s + f.aporte, 0) * 1000) / 1000;
    expect([a.cupo.normalizado, a.hacinamiento.normalizado, a.distancia.normalizado, a.fase.normalizado, a.riesgo.normalizado]).toEqual([0.9, 0.8, 0.4, 1, 0.7]);
    expect([b.cupo.normalizado, b.hacinamiento.normalizado, b.distancia.normalizado, b.fase.normalizado, b.riesgo.normalizado]).toEqual([0.5, 0.6, 0.9, 1, 0.9]);
    expect(total(a)).toBe(0.77);
    expect(total(b)).toBe(0.72);
  });

  it('valora con 0.5 la fase contigua y con 0 la ausencia de programa', () => {
    const ctx = { hacOrigen: 0, hacMax: 1, hacMin: 0, distancia: 0 };
    expect(calcularAportes(interno, destino('X', { fases: ['CONFIANZA'] }), config, ctx).fase.normalizado).toBe(0.5);
    expect(calcularAportes(interno, destino('X', { fases: ['PRE_LIBERACION'] }), config, ctx).fase.normalizado).toBe(0);
  });

  it('ordena los elegibles por puntaje, conserva los descartados con su motivo y explica cada posición', () => {
    const r = evaluarDestinos(interno, [
      destino('EP-ORIGEN', { poblacion: 3000 }),
      destino('EP-POCO', { poblacion: 990 }),
      destino('EP-MUCHO', { poblacion: 500 }),
      destino('EP-LLENO', { poblacion: 1200 }),
    ], config);
    expect(r.map((x) => x.destinoId)).toEqual(['EP-MUCHO', 'EP-POCO', 'EP-LLENO', 'EP-ORIGEN']);
    expect(r[0]).toMatchObject({ elegible: true, posicion: 1 });
    expect(r[0].puntaje).toBeGreaterThan(r[1].puntaje!);
    expect(r[0].explicacion).toMatch(/^#1 /);
    expect(r[2]).toMatchObject({ elegible: false, puntaje: null, motivoDescarte: expect.stringMatching(/Sin cupo/) });
    const suma = Object.values(r[0].aportes!).reduce((s, f) => s + f.aporte, 0);
    expect(r[0].puntaje).toBeCloseTo(suma, 3);
  });
});
