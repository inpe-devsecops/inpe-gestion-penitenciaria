// Distancia entre la sede de la región de procedencia del interno y el establecimiento de destino.
// Fórmula del semiverseno sobre coordenadas referenciales: aproxima la cercanía al entorno familiar,
// no una ruta carretera real.
const RADIO_TIERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

export interface Punto {
  latitud: number;
  longitud: number;
}

export function distanciaKm(a: Punto, b: Punto): number {
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
