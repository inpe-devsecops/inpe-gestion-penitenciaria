import { randomBytes } from 'node:crypto';
import { cifrar, descifrar, indiceCiego } from '../src/seguridad/cripto';

const clave = randomBytes(32);

describe('Cifrado selectivo de campos (RNF01 / REQ-SEC-03)', () => {
  it('cifra y descifra un valor sin dejarlo en texto plano', () => {
    const c = cifrar('Violación sexual de menor de edad', clave);
    expect(c).not.toContain('Violación');
    expect(c.startsWith('v1:')).toBe(true);
    expect(descifrar(c, clave)).toBe('Violación sexual de menor de edad');
  });

  it('usa un IV distinto en cada cifrado (mismo dato, distinto resultado)', () => {
    expect(cifrar('12345678', clave)).not.toBe(cifrar('12345678', clave));
  });

  it('detecta un dato alterado (integridad con AES-GCM)', () => {
    const partes = cifrar('12345678', clave).split(':');
    const datos = Buffer.from(partes[3], 'base64');
    datos[0] = datos[0] ^ 0xff;
    partes[3] = datos.toString('base64');
    expect(() => descifrar(partes.join(':'), clave)).toThrow();
  });

  it('no descifra con otra clave', () => {
    expect(() => descifrar(cifrar('dato', clave), randomBytes(32))).toThrow();
  });
});

describe('Índice ciego (RNF02)', () => {
  it('es determinista y no revela el documento', () => {
    const k = randomBytes(32);
    const a = indiceCiego('DNI:12345678', k);
    expect(a).toBe(indiceCiego(' dni:12345678 ', k));
    expect(a).not.toContain('12345678');
    expect(a).toHaveLength(64);
  });
});
