import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// Cifrado selectivo de campos sensibles (RNF01): AES-256-GCM con IV aleatorio por valor.
// Formato almacenado: v1:<iv base64>:<tag base64>:<texto cifrado base64>
const VERSION = 'v1';

export function cifrar(texto: string, clave: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [VERSION, iv.toString('base64'), c.getAuthTag().toString('base64'), datos.toString('base64')].join(':');
}

// Lanza error si el valor fue alterado (GCM autentica el contenido: integridad).
export function descifrar(valor: string, clave: Buffer): string {
  const [version, iv, tag, datos] = valor.split(':');
  if (version !== VERSION || !iv || !tag || !datos) throw new Error('Formato de dato cifrado inválido');
  const d = createDecipheriv('aes-256-gcm', clave, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(datos, 'base64')), d.final()]).toString('utf8');
}

// Índice ciego (RNF02): permite buscar por documento sin descifrar toda la colección.
export function indiceCiego(valor: string, clave: Buffer): string {
  return createHmac('sha256', clave).update(valor.trim().toUpperCase()).digest('hex');
}
