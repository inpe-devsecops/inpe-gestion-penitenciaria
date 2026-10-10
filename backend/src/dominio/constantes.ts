// Catálogos del dominio penitenciario. Fuente única para validación (Zod), modelos y respuestas de la API.

// ----- Roles (Tabla 8 del informe): permisos mínimos con ámbito territorial
export const ROLES = ['ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO', 'AUDITOR'] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN_CENTRAL: 'Administrador central',
  RESPONSABLE_REGIONAL: 'Responsable regional',
  DIRECTOR_ESTABLECIMIENTO: 'Director de establecimiento',
  AUDITOR: 'Auditor',
};

// ----- Clasificación del interno (régimen penitenciario) y techo de seguridad del establecimiento
export const CLASIFICACIONES = ['MINIMA', 'MEDIANA', 'MAXIMA', 'ESPECIAL_A', 'ESPECIAL_B', 'ESPECIAL_C', 'EXTREMA'] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];

export const TECHOS_SEGURIDAD = ['MINIMA', 'MEDIANA', 'MAXIMA', 'ESPECIAL'] as const;
export type TechoSeguridad = (typeof TECHOS_SEGURIDAD)[number];

// Nivel de exigencia (mayor = más restrictivo). Un destino es apto si su techo >= nivel del interno.
export const NIVEL_CLASIFICACION: Record<Clasificacion, number> = {
  MINIMA: 1, MEDIANA: 2, MAXIMA: 3, ESPECIAL_A: 4, ESPECIAL_B: 5, ESPECIAL_C: 6, EXTREMA: 7,
};
export const NIVEL_TECHO: Record<TechoSeguridad, number> = { MINIMA: 1, MEDIANA: 2, MAXIMA: 3, ESPECIAL: 7 };

export const GENEROS_POBLACION = ['MASCULINO', 'FEMENINO', 'MIXTO'] as const;
export type GeneroPoblacion = (typeof GENEROS_POBLACION)[number];

// ----- Ficha mínima del interno (RNF-08: sin nombres, documentos, salud ni familiares)
export const FASES_TRATAMIENTO = ['INGRESO', 'OBSERVACION', 'ORDINARIO', 'CONFIANZA', 'PRE_LIBERACION'] as const;
export type FaseTratamiento = (typeof FASES_TRATAMIENTO)[number];
export const ORDEN_FASE: Record<FaseTratamiento, number> = {
  INGRESO: 1, OBSERVACION: 2, ORDINARIO: 3, CONFIANZA: 4, PRE_LIBERACION: 5,
};

export const SITUACIONES_JURIDICAS = ['PROCESADO', 'SENTENCIADO'] as const;
export type SituacionJuridica = (typeof SITUACIONES_JURIDICAS)[number];

export const SEXOS = ['M', 'F'] as const;
export type Sexo = (typeof SEXOS)[number];

// ----- Traslados: causales del art. 159 del Reglamento del Código de Ejecución Penal (D.S. 015-2003-JUS)
export const CAUSALES_TRASLADO = [
  'ORDEN_JUDICIAL', 'PROGRESION_TRATAMIENTO', 'REGRESION_TRATAMIENTO', 'INTENTO_FUGA', 'APERTURA_ESTABLECIMIENTO',
  'HACINAMIENTO', 'ACERCAMIENTO_FAMILIAR', 'RAZONES_SALUD', 'OTROS',
] as const;
export type CausalTraslado = (typeof CAUSALES_TRASLADO)[number];

export const CAUSAL_LABEL: Record<CausalTraslado, string> = {
  ORDEN_JUDICIAL: 'Orden judicial',
  PROGRESION_TRATAMIENTO: 'Progresión en el tratamiento',
  REGRESION_TRATAMIENTO: 'Regresión en el tratamiento',
  INTENTO_FUGA: 'Intento de fuga comprobado',
  APERTURA_ESTABLECIMIENTO: 'Apertura de nuevo establecimiento',
  HACINAMIENTO: 'Hacinamiento del establecimiento',
  ACERCAMIENTO_FAMILIAR: 'Acercamiento al entorno familiar',
  RAZONES_SALUD: 'Razones de salud',
  OTROS: 'Otras causales justificadas',
};

// Flujo con segregación de funciones: registra (regional) → evalúa (motor) → decide (central) → ejecuta (director)
export const ESTADOS_SOLICITUD = ['EVALUADA', 'APROBADA', 'RECHAZADA', 'EJECUTADA'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];
export const ESTADOS_EN_TRAMITE: EstadoSolicitud[] = ['EVALUADA', 'APROBADA'];

// ----- Alertas (Tabla 10 del informe)
export const CONDICIONES_ALERTA = ['HACINAMIENTO', 'PROSPECTIVA'] as const;
export type CondicionAlerta = (typeof CONDICIONES_ALERTA)[number];

export const SEVERIDADES = ['ATENCION', 'SEVERO', 'CRITICO', 'PROSPECTIVA'] as const;
export type Severidad = (typeof SEVERIDADES)[number];
export const ORDEN_SEVERIDAD: Record<Severidad, number> = { CRITICO: 4, SEVERO: 3, PROSPECTIVA: 2, ATENCION: 1 };

export const ESTADOS_ALERTA = ['ACTIVA', 'RECONOCIDA', 'RESUELTA'] as const;
export type EstadoAlerta = (typeof ESTADOS_ALERTA)[number];

// ----- Auditoría
export const RESULTADOS_AUDITORIA = ['EXITO', 'FALLIDO', 'DENEGADO', 'BLOQUEADO'] as const;
export type ResultadoAuditoria = (typeof RESULTADOS_AUDITORIA)[number];
