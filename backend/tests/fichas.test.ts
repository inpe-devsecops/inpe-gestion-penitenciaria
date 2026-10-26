import { randomBytes } from 'node:crypto';
import { descifrar } from '../src/seguridad/cripto';
import { cifrarDocumento, cifrarIdentidad, descifrarDelito } from '../src/seguridad/fichas';

const dataKey = randomBytes(32);
const hmacKey = randomBytes(32);

describe('Cifrado selectivo de la ficha (RNF-26)', () => {
  const identidad = {
    nombres: 'Juan Carlos', apellido_paterno: 'Quispe', apellido_materno: 'Mamani',
    numero_expediente: '00002-2026-0-1501-JR-PE-01', delito: 'Violación sexual de menor de edad',
  };

  it('ningún campo identificatorio queda en texto plano y todos se recuperan con la clave', () => {
    const c = cifrarIdentidad(identidad, dataKey);
    expect(JSON.stringify(c)).not.toMatch(/Juan|Quispe|Mamani|00002|Violación/);
    expect(descifrar(c.nombres_cifrado, dataKey)).toBe('Juan Carlos');
    expect(descifrarDelito(c.delito_cifrado, dataKey)).toBe('Violación sexual de menor de edad');
  });

  it('solo cifra los campos recibidos (para correcciones parciales)', () => {
    expect(Object.keys(cifrarIdentidad({ nombres: 'Ana' }, dataKey))).toEqual(['nombres_cifrado']);
  });

  it('el documento se cifra y su índice ciego es estable, sin revelar el número', () => {
    const a = cifrarDocumento('DNI', '12345678', dataKey, hmacKey);
    const b = cifrarDocumento('DNI', '12345678', dataKey, hmacKey);
    expect(a.numero_documento_cifrado).not.toBe(b.numero_documento_cifrado); // IV aleatorio
    expect(a.numero_documento_hmac).toBe(b.numero_documento_hmac); // permite buscar
    expect(a.numero_documento_hmac).not.toContain('12345678');
  });
});
