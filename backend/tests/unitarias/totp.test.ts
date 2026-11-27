import { aBase32, codigoTotp, deBase32, generarSecretoTotp, pasoActual, uriOtpauth, verificarTotp } from '../../src/seguridad/totp';

// Vectores oficiales del RFC 6238, Apéndice B (HMAC-SHA1, secreto ASCII "12345678901234567890", 8 dígitos)
const SECRETO_RFC = Buffer.from('12345678901234567890', 'ascii');
const vectores: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP (RFC 6238) para el segundo factor (#23)', () => {
  it.each(vectores)('reproduce el vector oficial del RFC en t=%i', (t, esperado) => {
    expect(codigoTotp(SECRETO_RFC, Math.floor(t / 30), 8)).toBe(esperado);
    // Con 6 dígitos (lo que usan las apps) son los últimos 6
    expect(codigoTotp(SECRETO_RFC, Math.floor(t / 30))).toBe(esperado.slice(-6));
  });

  it('codifica y decodifica Base32 sin pérdida (RFC 4648)', () => {
    expect(aBase32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(deBase32('MZXW6YTBOI').toString()).toBe('foobar');
    expect(deBase32('mzxw 6ytb oi======').toString()).toBe('foobar');
    expect(() => deBase32('MZXW1')).toThrow('formato inválido');
  });

  it('genera secretos de 160 bits distintos cada vez', () => {
    const a = generarSecretoTotp();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(deBase32(a)).toHaveLength(20);
    expect(generarSecretoTotp()).not.toBe(a);
  });

  it('acepta el código actual y el de ±1 periodo, y rechaza uno más lejano', () => {
    const secreto = generarSecretoTotp();
    const ahora = new Date('2026-11-26T20:00:10Z');
    const p = pasoActual(ahora);
    const codigo = (paso: number) => codigoTotp(deBase32(secreto), paso);
    expect(verificarTotp(secreto, codigo(p), null, ahora)).toBe(p);
    expect(verificarTotp(secreto, codigo(p - 1), null, ahora)).toBe(p - 1);
    expect(verificarTotp(secreto, codigo(p + 1), null, ahora)).toBe(p + 1);
    expect(verificarTotp(secreto, codigo(p - 2), null, ahora)).toBeNull();
  });

  it('no acepta un código ya usado ni uno anterior al último usado (anti-repetición)', () => {
    const secreto = generarSecretoTotp();
    const ahora = new Date('2026-11-26T20:00:10Z');
    const p = pasoActual(ahora);
    const codigo = (paso: number) => codigoTotp(deBase32(secreto), paso);
    expect(verificarTotp(secreto, codigo(p), p, ahora)).toBeNull();
    expect(verificarTotp(secreto, codigo(p - 1), p, ahora)).toBeNull();
    expect(verificarTotp(secreto, codigo(p + 1), p, ahora)).toBe(p + 1);
  });

  it('rechaza entradas que no son 6 dígitos', () => {
    const secreto = generarSecretoTotp();
    for (const malo of ['', '12345', '1234567', 'abcdef', '12 456']) expect(verificarTotp(secreto, malo, null)).toBeNull();
  });

  it('arma la URI otpauth que leen las apps de autenticación', () => {
    const uri = uriOtpauth('admin.central', 'JBSWY3DPEHPK3PXP');
    expect(uri).toMatch(/^otpauth:\/\/totp\/INPE%20Gestion%20Penitenciaria%3Aadmin\.central\?/);
    const q = new URLSearchParams(uri.split('?')[1]);
    expect(q.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(q.get('issuer')).toBe('INPE Gestion Penitenciaria');
    expect(q.get('digits')).toBe('6');
    expect(q.get('period')).toBe('30');
  });
});
