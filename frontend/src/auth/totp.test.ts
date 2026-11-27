import { describe, expect, it } from 'vitest';
import { agruparClave, esCodigoTotp, limpiarCodigo } from './totp';

describe('segundo factor TOTP (presentación)', () => {
  it('solo acepta códigos de 6 dígitos', () => {
    expect(esCodigoTotp('123456')).toBe(true);
    for (const malo of ['', '12345', '1234567', 'abcdef', '12 456']) expect(esCodigoTotp(malo)).toBe(false);
  });

  it('limpia lo que el usuario pega o escribe', () => {
    expect(limpiarCodigo('123 456')).toBe('123456');
    expect(limpiarCodigo('12a3-45')).toBe('12345');
    expect(limpiarCodigo('12345678')).toBe('123456');
  });

  it('agrupa la clave de 4 en 4 para copiarla a mano', () => {
    expect(agruparClave('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(agruparClave('ABCDEF')).toBe('ABCD EF');
  });
});
