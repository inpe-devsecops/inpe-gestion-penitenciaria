import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Segundo factor TOTP (RFC 6238) para el administrador central (#23, Tabla 16: Suplantación, riesgo R3).
// Se implementa con node:crypto, sin librerías externas: son pocas líneas, verificables con los vectores
// del propio RFC, y así no se suma una dependencia más a la cadena de suministro.
// Compatible con Google Authenticator, Microsoft Authenticator, Authy, etc. (HMAC-SHA1, 6 dígitos, 30 s).

export const PERIODO_SEG = 30;
export const DIGITOS = 6;
// Tolerancia de ±1 periodo para relojes desfasados (lo que recomienda el RFC 6238, sección 5.2)
const VENTANA = 1;
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Base32 (RFC 4648), el formato en que las apps de autenticación reciben el secreto
export function aBase32(datos: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of datos) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function deBase32(texto: string): Buffer {
  const limpio = texto.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of limpio) {
    const i = ALFABETO.indexOf(c);
    if (i === -1) throw new Error('Secreto TOTP con formato inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// 160 bits aleatorios: el tamaño que recomienda el RFC 4226 para HMAC-SHA1
export function generarSecretoTotp(): string {
  return aBase32(randomBytes(20));
}

export function pasoActual(ahora: Date = new Date()): number {
  return Math.floor(ahora.getTime() / 1000 / PERIODO_SEG);
}

// HOTP (RFC 4226): HMAC-SHA1 del contador y truncamiento dinámico
export function codigoTotp(secreto: Buffer, paso: number, digitos: number = DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = createHmac('sha1', secreto).update(contador).digest();
  const desplazamiento = hmac[hmac.length - 1]! & 0x0f;
  const binario = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

// Devuelve el paso que coincide o null. Rechaza pasos ya usados (anti-repetición: un código
// interceptado no sirve dos veces) y compara en tiempo constante.
export function verificarTotp(secretoBase32: string, codigo: string, ultimoPaso: number | null, ahora: Date = new Date()): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const secreto = deBase32(secretoBase32);
  const actual = pasoActual(ahora);
  for (let paso = actual - VENTANA; paso <= actual + VENTANA; paso++) {
    if (ultimoPaso !== null && paso <= ultimoPaso) continue;
    if (timingSafeEqual(Buffer.from(codigoTotp(secreto, paso)), Buffer.from(codigo))) return paso;
  }
  return null;
}

// URI estándar que las apps convierten en la cuenta (se puede mostrar como QR o ingresar la clave a mano)
export function uriOtpauth(username: string, secretoBase32: string, emisor = 'INPE Gestion Penitenciaria'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${username}`);
  const q = new URLSearchParams({ secret: secretoBase32, issuer: emisor, algorithm: 'SHA1', digits: String(DIGITOS), period: String(PERIODO_SEG) });
  return `otpauth://totp/${etiqueta}?${q.toString()}`;
}
