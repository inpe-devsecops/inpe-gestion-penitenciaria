import { cifrar, descifrar, indiceCiego } from './cripto';

// Cifrado selectivo de la ficha del interno (RNF-26): solo los campos que identifican a la persona o
// revelan su situación judicial. Lo demás (sexo, penal, situación jurídica, fechas) se guarda en claro.
// Lo usan el repositorio de MongoDB y el script de carga, para no duplicar la regla (DRY).

export interface CamposIdentidad {
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  numero_expediente: string;
  delito: string;
}

export function cifrarIdentidad(d: Partial<CamposIdentidad>, dataKey: Buffer): Record<string, string> {
  const r: Record<string, string> = {};
  if (d.nombres !== undefined) r.nombres_cifrado = cifrar(d.nombres, dataKey);
  if (d.apellido_paterno !== undefined) r.apellido_paterno_cifrado = cifrar(d.apellido_paterno, dataKey);
  if (d.apellido_materno !== undefined) r.apellido_materno_cifrado = d.apellido_materno ? cifrar(d.apellido_materno, dataKey) : '';
  if (d.numero_expediente !== undefined) r.numero_expediente_cifrado = cifrar(d.numero_expediente, dataKey);
  // El delito se guarda como objeto { nombre } para que el formato coincida con los datos de carga.
  if (d.delito !== undefined) r.delito_cifrado = cifrar(JSON.stringify({ nombre: d.delito }), dataKey);
  return r;
}

// Documento cifrado + índice ciego HMAC (con otra clave) para buscar sin descifrar toda la colección.
export function cifrarDocumento(tipo: string, numero: string, dataKey: Buffer, hmacKey: Buffer) {
  return {
    numero_documento_cifrado: cifrar(numero, dataKey),
    numero_documento_hmac: indiceCiego(`${tipo}:${numero}`, hmacKey),
  };
}

export function descifrarDelito(valor: string, dataKey: Buffer): string {
  return (JSON.parse(descifrar(valor, dataKey)) as { nombre: string }).nombre;
}
