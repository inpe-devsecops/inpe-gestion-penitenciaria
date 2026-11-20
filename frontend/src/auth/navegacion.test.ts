import { describe, expect, it } from 'vitest';
import { obtenerNavegacion } from './navegacion';
import type { Rol } from '../tipos';

const opcionesPorRol: [Rol, string[]][] = [
  ['ADMIN_CENTRAL', ['Panel', 'Establecimientos', 'Fichas', 'Traslados', 'Alertas', 'Proyecciones', 'Parámetros', 'Auditoría']],
  ['RESPONSABLE_REGIONAL', ['Panel', 'Establecimientos', 'Fichas', 'Traslados', 'Alertas', 'Proyecciones']],
  ['DIRECTOR_ESTABLECIMIENTO', ['Panel', 'Establecimientos', 'Fichas', 'Traslados', 'Alertas', 'Proyecciones']],
  ['AUDITOR', ['Panel', 'Establecimientos', 'Traslados', 'Alertas', 'Proyecciones', 'Parámetros', 'Auditoría']],
];

describe('navegación por rol', () => {
  it.each(opcionesPorRol)('%s ve solo sus opciones', (rol, esperadas) => {
    const { operacion, analisis } = obtenerNavegacion(rol);
    expect([...operacion, ...analisis].map((enlace) => enlace.texto)).toEqual(esperadas);
  });
});
