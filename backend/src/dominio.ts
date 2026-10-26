// Contratos entre las rutas y la capa de datos. Las rutas no conocen MongoDB (capas + abstracción),
// lo que permite probar los controles de seguridad con repositorios en memoria.
import type { Rol } from './seguridad/auth';

export interface FichaInterno {
  codigo_interno: string;
  penal_id: string;
  oficina_regional: string | null; // oficina del penal: define el ámbito del responsable regional
  pabellon_id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  tipo_documento: string;
  numero_documento: string;
  sexo: 'M' | 'F';
  situacion_juridica: 'PROCESADO' | 'SENTENCIADO';
  delito: string;
  numero_expediente: string;
  fecha_ingreso: Date;
}

// Datos que el director puede registrar. El penal no viene del cliente: sale del token del director.
export interface NuevaFicha {
  codigo_interno: string;
  pabellon_id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  tipo_documento: string;
  numero_documento: string;
  sexo: 'M' | 'F';
  situacion_juridica: 'PROCESADO' | 'SENTENCIADO';
  delito: string;
  numero_expediente: string;
  fecha_ingreso: Date;
}

// Campos corregibles de una ficha. El código, el documento y el penal no cambian por esta vía
// (el cambio de penal ocurre solo por el flujo de traslados).
export type CambiosFicha = Partial<Pick<NuevaFicha,
  'pabellon_id' | 'nombres' | 'apellido_paterno' | 'apellido_materno' | 'situacion_juridica' | 'delito' | 'numero_expediente'>>;

export class FichaDuplicada extends Error {
  constructor() {
    super('Ya existe un interno con ese código o documento');
  }
}

export interface RepositorioInternos {
  buscarPorCodigo(codigo: string): Promise<FichaInterno | null>;
  crear(penalId: string, datos: NuevaFicha): Promise<FichaInterno>; // lanza FichaDuplicada
  actualizar(codigo: string, cambios: CambiosFicha): Promise<FichaInterno | null>;
}

export interface UsuarioCredenciales {
  id: string;
  rol: Rol;
  penalId: string | null;
  oficinaId: string | null;
  estado: string;
  passwordHash: string | null;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export interface RepositorioUsuarios {
  porUsername(username: string): Promise<UsuarioCredenciales | null>;
  registrarFallo(id: string, intentos: number, bloqueadoHasta: Date | null): Promise<void>;
  registrarExito(id: string): Promise<void>;
}

export interface EventoAuditoria {
  usuario_id: string | null;
  rol: string | null;
  penal_usuario: string | null;
  ip: string | undefined;
  accion: string;
  recurso: string | null;
  resultado: 'EXITO' | 'FALLIDO' | 'DENEGADO' | 'BLOQUEADO';
  detalle?: string;
}

export type Auditar = (e: EventoAuditoria) => Promise<void>;
