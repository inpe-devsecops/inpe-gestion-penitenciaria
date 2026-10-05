// Contratos entre las rutas y la capa de datos. Las rutas no conocen MongoDB (capas + abstracción),
// lo que permite probar los controles de seguridad con repositorios en memoria.
import type { Rol } from './seguridad/auth';

export interface FichaInterno {
  codigo_interno: string;
  penal_id: string;
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

export interface RepositorioInternos {
  buscarPorCodigo(codigo: string): Promise<FichaInterno | null>;
}

export interface UsuarioCredenciales {
  id: string;
  rol: Rol;
  penalId: string | null;
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
