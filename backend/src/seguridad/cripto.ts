import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifrado de texto libre sensible en reposo: AES-256-GCM con IV aleatorio por valor.
// Se aplica a los fundamentos de solicitudes y decisiones, que pueden describir la situación del interno.
// Formato almacenado: v1:<iv base64>:<tag base64>:<texto cifrado base64>
const VERSION = 'v1';
// Etiqueta de autenticación fija de 128 bits: sin ella, Node acepta etiquetas truncadas (4-15 bytes)
// y se pueden falsificar textos cifrados (Semgrep gcm-no-tag-length, CWE-310).
const TAG_BYTES = 16;

export function cifrar(texto: string, clave: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave, iv, { authTagLength: TAG_BYTES });
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [VERSION, iv.toString('base64'), c.getAuthTag().toString('base64'), datos.toString('base64')].join(':');
}

// Lanza error si el valor fue alterado (GCM autentica el contenido: integridad).
export function descifrar(valor: string, clave: Buffer): string {
  const [version, iv, tag, datos] = valor.split(':');
  if (version !== VERSION || !iv || !tag || !datos) throw new Error('Formato de dato cifrado inválido');
  const tagBuf = Buffer.from(tag, 'base64');
  if (tagBuf.length !== TAG_BYTES) throw new Error('Formato de dato cifrado inválido');
  const d = createDecipheriv('aes-256-gcm', clave, Buffer.from(iv, 'base64'), { authTagLength: TAG_BYTES });
  d.setAuthTag(tagBuf);
  return Buffer.concat([d.update(Buffer.from(datos, 'base64')), d.final()]).toString('utf8');
}