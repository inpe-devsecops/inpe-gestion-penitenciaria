// Espejo de las respuestas de la API (backend/src/modulos/*).

export type Rol = 'ADMIN_CENTRAL' | 'RESPONSABLE_REGIONAL' | 'DIRECTOR_ESTABLECIMIENTO' | 'AUDITOR';
export type Nivel = 'ATENCION' | 'SEVERO' | 'CRITICO';

export interface Sesion {
  id: string;
  username: string;
  nombreCompleto: string;
  rol: Rol;
  rolLabel: string;
  oficinaId: string | null;
  oficina: string | null;
  establecimientoId: string | null;
  establecimiento: string | null;
}

export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface Establecimiento {
  id: string;
  nombre: string;
  oficinaId: string;
  oficina: string;
  departamento: string;
  latitud: number;
  longitud: number;
  capacidad: number;
  poblacion: number;
  cupoLibre: number;
  sobrepoblacion: number;
  hacinamientoPct: number;
  nivel: Nivel | null;
  techoSeguridad: string;
  regimenesAdmitidos: string[];
  generoPoblacion: string;
  fasesTratamiento: string[];
  proporcionAltoRiesgo: number;
  activo: boolean;
}

export interface Totales {
  capacidad: number;
  poblacion: number;
  sobrepoblacion: number;
  hacinamientoPct: number;
  cupoLibre: number;
  establecimientos: number;
}

export interface Panel {
  corte: string;
  generadoEn: string;
  umbrales: { atencion: number; severo: number; critico: number };
  totales: Totales & { hacinados: number; porNivel: Record<Nivel | 'SIN_HACINAMIENTO', number> };
  porOficina: (Totales & { oficinaId: string; oficina: string; hacinados: number })[];
  masHacinados: Establecimiento[];
  conCupo: Establecimiento[];
  serie: { corte: string; poblacion: number; capacidad: number; hacinamientoPct: number }[];
  alertasVigentes: number;
  solicitudesPendientes: number;
  aprobadasPorEjecutar: number;
}

export interface PuntoSerie {
  corte: string;
  poblacion: number;
  capacidad: number;
  interpolado: boolean;
}

export type Escenario = 'YA_CRITICO' | 'EN_RIESGO' | 'SIN_RIESGO' | 'SIN_DATOS';

export interface Proyeccion {
  escenario: Escenario;
  poblacionActual: number;
  poblacionCritica: number;
  pendienteMensual: number | null;
  mesesHastaCritico: number | null;
  corteEstimado: string | null;
  horizonte: { desde: string; hasta: string; cortes: number } | null;
  supuesto: string;
}

export interface FilaProyeccion extends Proyeccion {
  establecimiento: Establecimiento;
}

export interface Interno {
  id: string;
  sexo: 'M' | 'F';
  clasificacion: string;
  faseTratamiento: string;
  situacionJuridica: string;
  nivelRiesgo: number;
  regionProcedenciaId: string;
  regionProcedencia: string;
  establecimientoId: string;
  establecimiento: string;
  fechaIngreso: string;
  datoFicticio: boolean;
}

export interface InternoDetalle extends Interno {
  traslados: { id: string; codigo: string; estado: EstadoSolicitud; causal: string; origen: string; destino: string | null; solicitadaEn: string; ejecutadaEn: string | null }[];
}

export interface Aporte {
  normalizado: number;
  peso: number;
  aporte: number;
  detalle: string;
}

export type ClaveFactor = 'cupo' | 'hacinamiento' | 'distancia' | 'fase' | 'riesgo';

export interface Evaluacion {
  destinoId: string;
  destino: string;
  elegible: boolean;
  posicion: number | null;
  puntaje: number | null;
  aportes: Record<ClaveFactor, Aporte> | null;
  motivoDescarte: string | null;
  metricas: { cupoLibre: number; hacinamientoPct: number; distanciaKm: number | null };
  explicacion: string;
}

export type EstadoSolicitud = 'EVALUADA' | 'APROBADA' | 'RECHAZADA' | 'EJECUTADA';

export interface SolicitudResumen {
  id: string;
  codigo: string;
  estado: EstadoSolicitud;
  causal: string;
  causalLabel: string;
  internoId: string;
  interno: { sexo: string; clasificacion: string; fase: string; nivelRiesgo: number; regionProcedencia: string } | null;
  origenId: string;
  origen: string;
  destinoRecomendadoId: string | null;
  destinoRecomendado: string | null;
  puntajeRecomendado: number | null;
  destinoId: string | null;
  destino: string | null;
  solicitanteId: string;
  solicitante: string;
  solicitadaEn: string;
  decididaEn: string | null;
  ejecutadoPorId: string | null;
  ejecutadoPor: string | null;
  ejecutadaEn: string | null;
}

export interface SolicitudDetalle extends SolicitudResumen {
  fundamento: string;
  pesos: Record<ClaveFactor, number>;
  evaluaciones: Evaluacion[];
  decision: {
    resultado: 'APROBADA' | 'RECHAZADA';
    decididoPorId: string;
    decididoPor: string;
    destinoId: string | null;
    destino: string | null;
    seApartaDeRecomendacion: boolean;
    fundamento: string;
    decididaEn: string;
  } | null;
  permisos: { puedeDecidir: boolean; motivoNoDecidir: string | null; puedeEjecutar: boolean; motivoNoEjecutar: string | null };
}

export interface Alerta {
  id: string;
  establecimientoId: string;
  establecimiento: string;
  oficinaId: string | null;
  condicion: 'HACINAMIENTO' | 'PROSPECTIVA';
  severidad: 'ATENCION' | 'SEVERO' | 'CRITICO' | 'PROSPECTIVA';
  estado: 'ACTIVA' | 'RECONOCIDA' | 'RESUELTA';
  vigente: boolean;
  valorObservado: number;
  umbral: number;
  mensaje: string;
  creadaEn: string;
  actualizadaEn: string;
}

export interface Parametro {
  clave: string;
  valor: number;
  descripcion: string;
  minimo: number;
  maximo: number;
  actualizadoPor: string | null;
  actualizadoEn: string | null;
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  usuarioId: string | null;
  usuario: string | null;
  rol: string | null;
  ip: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  resultado: 'EXITO' | 'FALLIDO' | 'DENEGADO' | 'BLOQUEADO';
  valorAnterior: unknown;
  valorNuevo: unknown;
  detalle: string | null;
}

export interface Catalogos {
  oficinas: { id: string; nombre: string }[];
  establecimientos: { id: string; nombre: string; oficinaId: string }[];
  clasificaciones: string[];
  techos: string[];
  fases: string[];
  situaciones: string[];
  causales: { valor: string; etiqueta: string }[];
  roles: Record<Rol, string>;
}
