import { randomBytes } from 'node:crypto';
import { validarConjunto, valoresPorDefecto } from '../../src/modulos/parametros/definicion';
import { cifrar, descifrar } from '../../src/seguridad/cripto';
import { contieneOperador } from '../../src/seguridad/sanitizar';

const clave = randomBytes(32);

describe('Cifrado del texto libre sensible (AES-256-GCM)', () => {
  it('cifra y descifra sin dejar el texto en claro', () => {
    const c = cifrar('Fundamento con información sensible del interno', clave);
    expect(c).not.toContain('sensible');
    expect(c.startsWith('v1:')).toBe(true);
    expect(descifrar(c, clave)).toBe('Fundamento con información sensible del interno');
  });
  it('usa un IV distinto en cada cifrado', () => {
    expect(cifrar('12345678', clave)).not.toBe(cifrar('12345678', clave));
  });
  it('detecta un dato alterado (integridad)', () => {
    const partes = cifrar('12345678', clave).split(':');
    const datos = Buffer.from(partes[3], 'base64');
    datos[0] = datos[0] ^ 0xff;
    partes[3] = datos.toString('base64');
    expect(() => descifrar(partes.join(':'), clave)).toThrow();
  });
  it('rechaza un tag truncado y una clave distinta', () => {
    const partes = cifrar('dato', clave).split(':');
    partes[2] = Buffer.from(partes[2], 'base64').subarray(0, 4).toString('base64');
    expect(() => descifrar(partes.join(':'), clave)).toThrow('Formato de dato cifrado inválido');
    expect(() => descifrar(cifrar('dato', clave), randomBytes(32))).toThrow();
  });
});

describe('Detección de operadores NoSQL (RNF-07)', () => {
  it('detecta operadores anidados y rutas con punto', () => {
    expect(contieneOperador({ a: [{ b: { $where: 'sleep(1000)' } }] })).toBe(true);
    expect(contieneOperador({ 'ambito.rol': 'ADMIN_CENTRAL' })).toBe(true);
    expect(contieneOperador({ username: 'admin.central' })).toBe(false);
  });
});

describe('Validación del conjunto de parámetros', () => {
  it('acepta los valores por defecto', () => {
    expect(validarConjunto(valoresPorDefecto())).toEqual([]);
  });
  it('exige que los pesos sumen 1 y que los umbrales estén ordenados', () => {
    const v = { ...valoresPorDefecto(), peso_cupo: 0.5, umbral_severo: 10 };
    const errores = validarConjunto(v);
    expect(errores).toContainEqual(expect.stringMatching(/sumar 1/));
    expect(errores).toContainEqual(expect.stringMatching(/atención < severo < crítico/));
  });
});
