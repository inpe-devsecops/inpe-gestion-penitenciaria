import { decidirAlertas } from '../../src/modulos/alertas/evaluador';
import { nivelHacinamiento, ocupacion } from '../../src/modulos/establecimientos/metricas';
import { pendienteMinimosCuadrados, proyectar } from '../../src/modulos/proyeccion/proyeccion';

const umbrales = { umbral_atencion: 20, umbral_severo: 100, umbral_critico: 300 };
const p = { ...umbrales, meses_prospectiva: 6, ventana_proyeccion_meses: 12 };
const serie = (desde: number, paso: number, n = 13) =>
  Array.from({ length: n }, (_, k) => ({ corte: `2025-${String(k + 1).padStart(2, '0')}`.replace('2025-13', '2026-01'), poblacion: desde + paso * k }));

describe('Indicadores de ocupación (RF-04)', () => {
  it('calcula el índice como lo publica el INPE (148 % nacional en enero 2026)', () => {
    expect(ocupacion(41_764, 103_717).hacinamientoPct).toBeCloseTo(148.34, 2);
    expect(ocupacion(222, 1_195)).toMatchObject({ hacinamientoPct: 438.29, sobrepoblacion: 973, cupoLibre: 0 });
  });
  it('clasifica los niveles de la Tabla 10', () => {
    expect(nivelHacinamiento(10, umbrales)).toBeNull();
    expect(nivelHacinamiento(20, umbrales)).toBe('ATENCION');
    expect(nivelHacinamiento(150, umbrales)).toBe('SEVERO');
    expect(nivelHacinamiento(438, umbrales)).toBe('CRITICO');
  });
});

describe('Proyección de saturación (RF-10)', () => {
  it('ajusta la pendiente por mínimos cuadrados', () => {
    expect(pendienteMinimosCuadrados(serie(100, 10))).toBeCloseTo(10, 6);
  });
  it('estima los meses hasta el umbral crítico con t* = (U − P₀) ÷ m', () => {
    // capacidad 100 → crítico (300 %) = 400 internos; P₀ = 340, m = 10 → 6 meses
    const r = proyectar(serie(220, 10), { capacidad: 100, poblacion: 340 }, p);
    expect(r).toMatchObject({ escenario: 'EN_RIESGO', poblacionCritica: 400, mesesHastaCritico: 6, corteEstimado: '2026-07' });
    expect(r.supuesto).toMatch(/lineal/);
    expect(r.horizonte).toEqual({ desde: '2025-02', hasta: '2026-01', cortes: 12 });
  });
  it('no proyecta fecha si la población no crece', () => {
    expect(proyectar(serie(300, -5), { capacidad: 100, poblacion: 240 }, p)).toMatchObject({ escenario: 'SIN_RIESGO', corteEstimado: null });
  });
  it('reconoce un establecimiento que ya es crítico y la falta de datos', () => {
    expect(proyectar(serie(500, 1), { capacidad: 100, poblacion: 512 }, p).escenario).toBe('YA_CRITICO');
    expect(proyectar([{ corte: '2026-01', poblacion: 10 }], { capacidad: 100, poblacion: 10 }, p).escenario).toBe('SIN_DATOS');
  });
});

describe('Reglas de alerta (RF-07 a RF-09)', () => {
  const proy = proyectar(serie(100, 0), { capacidad: 100, poblacion: 100 }, p);
  it('crea una alerta con la severidad del nivel alcanzado', () => {
    expect(decidirAlertas('E.P. X', 150, proy, [], p)).toEqual([expect.objectContaining({ tipo: 'CREAR', condicion: 'HACINAMIENTO', severidad: 'SEVERO', umbral: 100 })]);
  });
  it('no duplica una alerta vigente de la misma condición y nivel', () => {
    expect(decidirAlertas('E.P. X', 150, proy, [{ condicion: 'HACINAMIENTO', severidad: 'SEVERO' }], p)).toEqual([]);
  });
  it('cambia la severidad en el mismo registro y resuelve cuando baja del umbral', () => {
    expect(decidirAlertas('E.P. X', 350, proy, [{ condicion: 'HACINAMIENTO', severidad: 'SEVERO' }], p)[0]).toMatchObject({ tipo: 'CAMBIAR_SEVERIDAD', severidad: 'CRITICO' });
    expect(decidirAlertas('E.P. X', 5, proy, [{ condicion: 'HACINAMIENTO', severidad: 'ATENCION' }], p)[0]).toMatchObject({ tipo: 'RESOLVER' });
  });
  it('emite la alerta prospectiva cuando la proyección llega al nivel crítico en 6 meses o menos', () => {
    const riesgo = proyectar(serie(220, 10), { capacidad: 100, poblacion: 340 }, p);
    expect(decidirAlertas('E.P. X', 240, riesgo, [], p)).toContainEqual(expect.objectContaining({ tipo: 'CREAR', condicion: 'PROSPECTIVA' }));
  });
});
