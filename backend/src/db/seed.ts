// Carga los datos de desarrollo y pruebas. BORRA la base indicada en MONGODB_URI y la vuelve a crear.
//
// - Ocupación REAL: capacidad y población de los 69 establecimientos (Anexo 06 del INPE, enero 2026).
// - Serie mensual: cortes reales de enero 2025 y enero 2026; los once meses intermedios se interpolan
//   (marcados con interpolado: true) para que la proyección tenga una serie que ajustar.
// - Fichas mínimas de internos y usuarios: FICTICIOS (dato_ficticio: true). Las fichas son una muestra:
//   la ocupación agregada es la cifra oficial del establecimiento, no el conteo de fichas.
//
// Uso:  npm run seed      (requiere .env con MONGODB_URI, DATA_KEY y SEED_PASSWORD; nunca en producción)
import 'dotenv/config';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { cargarConfig } from '../config';
import {
  CLASIFICACIONES, NIVEL_CLASIFICACION, NIVEL_TECHO, type CausalTraslado, type Clasificacion, type FaseTratamiento,
  type TechoSeguridad,
} from '../dominio/constantes';
import {
  Auditoria, Contador, DecisionTraslado, Establecimiento, EvaluacionDestino, Interno, OcupacionHistorica, OficinaRegional,
  Parametro, SolicitudTraslado, Usuario,
} from '../modelos';
import { evaluarAlertas } from '../modulos/alertas/servicio';
import { PARAMETROS, CLAVES_PARAMETROS, valoresPorDefecto } from '../modulos/parametros/definicion';
import { configMotor } from '../modulos/parametros/servicio';
import { evaluarDestinos, type DestinoMotor } from '../modulos/traslados/motor';
import { filaEvaluacion } from '../modulos/traslados/servicio';
import { cifrar } from '../seguridad/cripto';
import { codigoDePenal, CORTE_DATOS, esPenalDeMujeres, LOCALIDADES, PENALES_2025, PENALES_RAW, REGIONES, seguridadDePenal } from './datos-inpe';
import { migrar } from './migrar';

// PRNG con semilla: los datos salen idénticos en cada ejecución
function crearRng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ----- Atributos derivados del establecimiento (estimaciones: el INPE no los publica)

function regimenesAdmitidos(techo: TechoSeguridad, capacidad: number): Clasificacion[] {
  if (techo === 'ESPECIAL') return ['MAXIMA', 'ESPECIAL_A', 'ESPECIAL_B', 'ESPECIAL_C', 'EXTREMA'];
  const hasta = CLASIFICACIONES.filter((c) => NIVEL_CLASIFICACION[c] <= NIVEL_TECHO[techo]);
  // Los grandes penales de máxima seguridad no reciben régimen mínimo (genera descartes por régimen)
  return techo === 'MAXIMA' && capacidad >= 2000 ? hasta.filter((c) => c !== 'MINIMA') : hasta;
}

function fasesOfrecidas(techo: TechoSeguridad, capacidad: number): FaseTratamiento[] {
  switch (techo) {
    case 'MINIMA': return ['ORDINARIO', 'CONFIANZA', 'PRE_LIBERACION'];
    case 'MEDIANA': return capacidad >= 400
      ? ['INGRESO', 'OBSERVACION', 'ORDINARIO', 'CONFIANZA', 'PRE_LIBERACION']
      : ['INGRESO', 'OBSERVACION', 'ORDINARIO', 'CONFIANZA'];
    case 'MAXIMA': return capacidad >= 1500 ? ['INGRESO', 'OBSERVACION', 'ORDINARIO', 'CONFIANZA'] : ['INGRESO', 'OBSERVACION', 'ORDINARIO'];
    default: return ['INGRESO', 'OBSERVACION'];
  }
}

const RIESGO_BASE: Record<TechoSeguridad, number> = { MINIMA: 0.05, MEDIANA: 0.15, MAXIMA: 0.35, ESPECIAL: 0.8 };

// ----- Personal ficticio
const NOMBRES = ['Rosa', 'Luis', 'Ana', 'Carlos', 'María', 'Jorge', 'Elena', 'Víctor', 'Patricia', 'Julio', 'Silvia', 'Raúl',
  'Carmen', 'Óscar', 'Gladys', 'Hernán', 'Milagros', 'César', 'Nancy', 'Iván'];
const APELLIDOS = ['Gutiérrez', 'Salazar', 'Rojas', 'Quispe', 'Torres', 'Mamani', 'Flores', 'Vargas', 'Castillo', 'Paredes',
  'Chávez', 'Ramos', 'Huamán', 'Espinoza', 'Cornejo', 'Palomino', 'Reátegui', 'Zegarra', 'Apaza', 'Ticona'];

export interface OpcionesSeed {
  dataKey: Buffer;
  password: string;
  /** Crea solicitudes de traslado de ejemplo (no ejecutadas, para no alterar las cifras del INPE). */
  conTraslados?: boolean;
}

export async function sembrar(o: OpcionesSeed) {
  const rng = crearRng(20260131);
  const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
  const nombre = () => `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
  const ahora = new Date();

  // 1. Oficinas regionales
  await OficinaRegional.insertMany(REGIONES.map((r) => ({ _id: r.id, nombre: r.nombre, sede: { latitud: r.latitud, longitud: r.longitud } })));
  const oficinaId = new Map(REGIONES.map((r) => [r.nombre, r.id]));

  // 2. Establecimientos con la ocupación oficial de enero 2026
  const usados = new Set<string>();
  const ests = PENALES_RAW.map((p, i) => {
    const techo = seguridadDePenal(p.nombre, p.capacidad);
    const [latitud, longitud] = LOCALIDADES[p.localidad];
    const variacion = ((i * 37) % 11 - 5) / 100; // ±5 puntos, determinista
    return {
      _id: codigoDePenal(p.nombre, usados), nombre: p.nombre, oficina_id: oficinaId.get(p.region)!, departamento: p.departamento,
      ubicacion: { latitud, longitud }, capacidad_oficial: p.capacidad, poblacion_actual: p.poblacion, techo_seguridad: techo,
      regimenes_admitidos: regimenesAdmitidos(techo, p.capacidad), genero_poblacion: esPenalDeMujeres(p.nombre) ? 'FEMENINO' : 'MASCULINO',
      fases_tratamiento: fasesOfrecidas(techo, p.capacidad),
      proporcion_alto_riesgo: Math.round(Math.max(0.01, Math.min(0.95, RIESGO_BASE[techo] + variacion)) * 100) / 100,
      activo: true, actualizado_en: ahora,
    };
  });
  await Establecimiento.insertMany(ests);

  // 3. Serie mensual 2025-01 … 2026-01 (13 cortes: los extremos son oficiales, el resto interpolado)
  const p2025 = new Map(PENALES_2025.map((p) => [p.nombre, p.poblacion]));
  const [anioFin, mesFin] = CORTE_DATOS.split('-').map(Number);
  const serie = ests.flatMap((e) => {
    const inicio = p2025.get(e.nombre) ?? e.poblacion_actual;
    return Array.from({ length: 13 }, (_, k) => {
      const fecha = new Date(Date.UTC(anioFin, mesFin - 1 - (12 - k), 1));
      const corte = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
      const extremo = k === 0 || k === 12;
      const lineal = inicio + ((e.poblacion_actual - inicio) * k) / 12;
      const ruido = extremo ? 0 : (rng() - 0.5) * 0.02 * lineal;
      return { establecimiento_id: e._id, corte, poblacion: extremo ? (k === 0 ? inicio : e.poblacion_actual) : Math.round(lineal + ruido),
        capacidad: e.capacidad_oficial, interpolado: !extremo };
    });
  });
  await OcupacionHistorica.insertMany(serie);

  // 4. Parámetros por defecto
  await Parametro.insertMany(CLAVES_PARAMETROS.map((k) => ({
    _id: k, valor: PARAMETROS[k].valor, descripcion: PARAMETROS[k].descripcion, minimo: PARAMETROS[k].minimo,
    maximo: PARAMETROS[k].maximo, actualizado_por: null, actualizado_en: ahora,
  })));

  // 5. Usuarios por rol (todos con la contraseña de SEED_PASSWORD, guardada con Argon2id)
  const hash = await argon2.hash(o.password, { type: argon2.argon2id });
  let n = 0;
  const usuario = (username: string, rol: string, ambito: { oficina_id?: string; establecimiento_id?: string } = {}) => ({
    _id: `USR-${String(++n).padStart(4, '0')}`, username, nombre_completo: nombre(), rol,
    ambito: { oficina_id: ambito.oficina_id ?? null, establecimiento_id: ambito.establecimiento_id ?? null },
    estado: 'ACTIVO', password_hash: hash, dato_ficticio: true,
  });
  const usuarios = [
    usuario('admin.central', 'ADMIN_CENTRAL'),
    usuario('admin.central2', 'ADMIN_CENTRAL'),
    usuario('auditor', 'AUDITOR'),
    ...REGIONES.map((r) => usuario(`regional.${r.id.toLowerCase().replace('_', '-')}`, 'RESPONSABLE_REGIONAL', { oficina_id: r.id })),
    ...ests.map((e) => usuario(`director.${e._id.toLowerCase()}`, 'DIRECTOR_ESTABLECIMIENTO', { oficina_id: e.oficina_id, establecimiento_id: e._id })),
  ];
  await Usuario.insertMany(usuarios);

  // 6. Fichas mínimas sintéticas: una muestra por establecimiento, coherente con su régimen y su población
  const internos = ests.flatMap((e) => {
    const cantidad = Math.max(2, Math.min(25, Math.round(e.poblacion_actual / 400)));
    return Array.from({ length: cantidad }, () => {
      const regimenes = e.regimenes_admitidos;
      const clasificacion = regimenes[Math.min(regimenes.length - 1, Math.floor(rng() ** 1.6 * regimenes.length))];
      const nivel = NIVEL_CLASIFICACION[clasificacion];
      return {
        sexo: e.genero_poblacion === 'FEMENINO' ? 'F' : 'M', clasificacion,
        fase_tratamiento: elegir(['INGRESO', 'OBSERVACION', 'ORDINARIO', 'ORDINARIO', 'CONFIANZA', 'PRE_LIBERACION'] as const),
        // Proporción nacional de enero 2026: 36.6 % procesados, 63.4 % sentenciados
        situacion_juridica: rng() < 0.366 ? 'PROCESADO' : 'SENTENCIADO',
        nivel_riesgo: Math.max(1, Math.min(5, nivel + Math.round(rng() * 2) - 1)),
        region_procedencia: rng() < 0.7 ? e.oficina_id : elegir(REGIONES).id,
        establecimiento_id: e._id,
        fecha_ingreso: new Date(Date.UTC(2026, 0, 31) - Math.floor(rng() * 6 * 365) * 86_400_000),
        dato_ficticio: true,
      };
    });
  }).map((d, i) => ({ _id: `INT-${String(i + 1).padStart(6, '0')}`, ...d }));
  await Interno.insertMany(internos);
  await Contador.create({ _id: 'internos', valor: internos.length });

  if (o.conTraslados) await trasladosDeEjemplo(o.dataKey, ests, internos, usuarios, ahora);
  return { establecimientos: ests.length, cortes: serie.length, usuarios: usuarios.length, internos: internos.length };
}

// Algunas solicitudes en distintos estados para que el flujo pueda recorrerse desde la interfaz.
async function trasladosDeEjemplo(
  dataKey: Buffer,
  ests: { _id: string; nombre: string; oficina_id: string; ubicacion: { latitud: number; longitud: number }; capacidad_oficial: number;
    poblacion_actual: number; techo_seguridad: TechoSeguridad; regimenes_admitidos: Clasificacion[]; genero_poblacion: string;
    fases_tratamiento: FaseTratamiento[]; proporcion_alto_riesgo: number }[],
  internos: { _id: string; sexo: string; clasificacion: Clasificacion; fase_tratamiento: FaseTratamiento; region_procedencia: string; establecimiento_id: string }[],
  usuarios: { _id: string; username: string; rol: string }[],
  ahora: Date,
) {
  const destinos: DestinoMotor[] = ests.map((e) => ({
    id: e._id, nombre: e.nombre, ubicacion: e.ubicacion, capacidad: e.capacidad_oficial, poblacion: e.poblacion_actual, techo: e.techo_seguridad,
    regimenes: e.regimenes_admitidos, genero: e.genero_poblacion as DestinoMotor['genero'], fases: e.fases_tratamiento,
    proporcionAltoRiesgo: e.proporcion_alto_riesgo, activo: true,
  }));
  const sede = new Map(REGIONES.map((r) => [r.id, { nombre: r.nombre, sede: { latitud: r.latitud, longitud: r.longitud } }]));
  const config = configMotor(valoresPorDefecto());
  const uid = (username: string) => usuarios.find((u) => u.username === username)!;

  const casos: { penal: RegExp; regional: string; causal: CausalTraslado; fundamento: string; decision?: { por: string; resultado: 'APROBADA' | 'RECHAZADA'; fundamento: string } }[] = [
    { penal: /de Lurigancho/, regional: 'regional.lima', causal: 'HACINAMIENTO',
      fundamento: 'El E.P. de Lurigancho supera el 200 % de hacinamiento; se solicita evaluar un destino con cupo libre en la región.' },
    { penal: /E\.P\. de Trujillo/, regional: 'regional.norte', causal: 'ACERCAMIENTO_FAMILIAR',
      fundamento: 'El interno solicita acercamiento a su entorno familiar; su región de procedencia es distinta a la del establecimiento.' },
    { penal: /E\.P\. de Tacna/, regional: 'regional.sur', causal: 'HACINAMIENTO',
      fundamento: 'Tacna es el establecimiento más hacinado del país (438 %); se prioriza la redistribución de internos aptos.',
      decision: { por: 'admin.central2', resultado: 'APROBADA', fundamento: 'Se aprueba el destino recomendado por el motor: tiene cupo libre y admite el régimen del interno.' } },
    { penal: /del Callao/, regional: 'regional.lima', causal: 'OTROS',
      fundamento: 'Solicitud registrada para demostrar el rechazo con fundamento obligatorio por parte del administrador central.',
      decision: { por: 'admin.central', resultado: 'RECHAZADA', fundamento: 'No se acredita una causal específica del art. 159 que justifique el traslado en este momento.' } },
  ];

  let k = 0;
  for (const c of casos) {
    const origen = ests.find((e) => c.penal.test(e.nombre));
    if (!origen) continue;
    // Primer interno del establecimiento con al menos un destino elegible
    const candidato = internos.filter((i) => i.establecimiento_id === origen._id).map((i) => {
      const s = sede.get(i.region_procedencia);
      return { i, r: evaluarDestinos({ codigo: i._id, sexo: i.sexo as 'M' | 'F', clasificacion: i.clasificacion, fase: i.fase_tratamiento,
        regionProcedencia: s?.nombre ?? i.region_procedencia, sedeProcedencia: s?.sede ?? null, establecimientoId: i.establecimiento_id }, destinos, config) };
    }).find((x) => x.r.some((r) => r.elegible));
    if (!candidato) continue;
    const mejor = candidato.r.find((r) => r.elegible)!;
    const solicitante = uid(c.regional);
    const solicitadaEn = new Date(ahora.getTime() - (6 - k) * 86_400_000);
    k++;
    const codigo = `TR-${ahora.getFullYear()}-${String(k).padStart(4, '0')}`;
    const decision = c.decision;
    const [s] = await SolicitudTraslado.create([{
      codigo, interno_id: candidato.i._id, origen_id: origen._id, causal: c.causal, fundamento_cifrado: cifrar(c.fundamento, dataKey),
      estado: decision ? decision.resultado : 'EVALUADA', en_tramite: !decision || decision.resultado === 'APROBADA',
      solicitante_id: solicitante._id, solicitada_en: solicitadaEn, pesos: config.pesos,
      destino_recomendado_id: mejor.destinoId, puntaje_recomendado: mejor.puntaje,
      destino_id: decision?.resultado === 'APROBADA' ? mejor.destinoId : null,
      decidida_en: decision ? new Date(solicitadaEn.getTime() + 86_400_000) : null,
    }]);
    await EvaluacionDestino.insertMany(candidato.r.map((r) => filaEvaluacion(s._id, r, solicitadaEn)));
    await Auditoria.create({ fecha: solicitadaEn, usuario_id: solicitante._id, rol: solicitante.rol, ip: null, accion: 'SOLICITAR_TRASLADO',
      entidad: 'solicitudes_traslado', entidad_id: String(s._id), resultado: 'EXITO',
      valor_nuevo: { codigo, interno: candidato.i._id, origen: origen._id, causal: c.causal, destino_recomendado: mejor.destinoId, puntaje: mejor.puntaje },
      detalle: 'Dato de ejemplo del seed' });
    if (decision) {
      const decisor = uid(decision.por);
      const decididaEn = new Date(solicitadaEn.getTime() + 86_400_000);
      await DecisionTraslado.create({ solicitud_id: s._id, solicitante_id: solicitante._id, decidido_por: decisor._id, resultado: decision.resultado,
        destino_id: decision.resultado === 'APROBADA' ? mejor.destinoId : null, se_aparta_de_recomendacion: false,
        fundamento_cifrado: cifrar(decision.fundamento, dataKey), decidida_en: decididaEn });
      await Auditoria.create({ fecha: decididaEn, usuario_id: decisor._id, rol: decisor.rol, ip: null,
        accion: decision.resultado === 'APROBADA' ? 'APROBAR_TRASLADO' : 'RECHAZAR_TRASLADO', entidad: 'solicitudes_traslado',
        entidad_id: String(s._id), resultado: 'EXITO', valor_anterior: { estado: 'EVALUADA' },
        valor_nuevo: { estado: decision.resultado, destino: decision.resultado === 'APROBADA' ? mejor.destinoId : null }, detalle: 'Dato de ejemplo del seed' });
    }
  }
  await Contador.create({ _id: `TR-${ahora.getFullYear()}`, valor: k });
}

async function main() {
  const config = cargarConfig();
  if (config.nodeEnv === 'production') throw new Error('El seed de datos de desarrollo no se ejecuta en producción.');
  const password = process.env.SEED_PASSWORD ?? '';
  if (password.length < 12) throw new Error('Defina SEED_PASSWORD (mínimo 12 caracteres) en el .env.');

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db!;
  console.log(`Recreando la base "${db.databaseName}"...`);
  await db.dropDatabase();
  await migrar(db);
  const r = await sembrar({ dataKey: config.dataKey, password, conTraslados: true });
  const alertas = await evaluarAlertas();
  const totales = await Establecimiento.aggregate<{ cap: number; pob: number }>([{ $group: { _id: null, cap: { $sum: '$capacidad_oficial' }, pob: { $sum: '$poblacion_actual' } } }]);
  console.log(`Establecimientos: ${r.establecimientos} | cortes mensuales: ${r.cortes} | usuarios: ${r.usuarios} | fichas de internos: ${r.internos}`);
  console.log(`Capacidad nacional: ${totales[0].cap} | población: ${totales[0].pob} | hacinamiento: ${Math.round(((totales[0].pob - totales[0].cap) / totales[0].cap) * 100)} %`);
  console.log(`Alertas creadas: ${alertas.creadas}`);
  console.log('Usuarios: admin.central, admin.central2, auditor, regional.<oficina>, director.<código> (contraseña: SEED_PASSWORD).');
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (e: Error) => {
    console.error(e.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}
