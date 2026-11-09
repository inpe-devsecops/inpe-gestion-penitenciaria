// Validación de entradas en el borde (RNF-06): cada ruta declara su esquema y los datos inválidos
// se rechazan con 400 y el detalle por campo, antes de llegar a la lógica de negocio.
import { z, type ZodTypeAny } from 'zod';
import { ErrorApi, detallesZod } from './errores';

export function validar<S extends ZodTypeAny>(esquema: S, datos: unknown): z.infer<S> {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorApi(400, 'VALIDACION', 'Datos inválidos', detallesZod(r.error));
  return r.data;
}

export const idEstablecimiento = z.string().regex(/^EP-[A-Z0-9]{1,16}$/, 'Código de establecimiento inválido');
export const idInterno = z.string().regex(/^INT-\d{6}$/, 'Código de interno inválido');
export const idOficina = z.string().regex(/^[A-Z_]{3,20}$/, 'Oficina regional inválida');
export const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Identificador inválido');

// Los valores de query llegan como texto: se convierten y se acotan
export const paginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(25),
};
export const booleanoQuery = z.enum(['true', 'false']).transform((v) => v === 'true');
export const busqueda = z.string().trim().max(60).optional();

// Escapa una búsqueda de texto para usarla como expresión regular literal (evita ReDoS e inyección de patrones)
export function regexLiteral(texto: string): RegExp {
  // eslint-disable-next-line security/detect-non-literal-regexp -- el texto se escapa por completo: el patrón es literal
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
