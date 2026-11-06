/**
 * Datos de origen del seed.
 *
 * PENALES: provienen del Anexo 06 del Informe Estadistico INPE Enero 2026
 * (docs/datos-inpe/anexo06-penales.csv) - SON DATOS REALES.
 *
 * Coordenadas: referenciales, de la localidad sede del establecimiento.
 * NO son georreferenciacion oficial del INPE; se usan unicamente para el
 * calculo de distancia del motor de recomendacion.
 *
 * Origen: plataforma de DeepSeek (plataforma-traslados-inpe), integrada en la fusion MERN.
 */

import type { TechoSeguridad as Seguridad } from '../dominio/constantes';

/* ------------------------------------------------------------------ */
/* Oficinas regionales (Anexo 07): sede y coordenada de referencia     */
/* ------------------------------------------------------------------ */
export interface RegionSeed {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
}

export const REGIONES: RegionSeed[] = [
  { id: 'NORTE', nombre: 'Norte', latitud: -6.7714, longitud: -79.8409 }, // sede Chiclayo
  { id: 'LIMA', nombre: 'Lima', latitud: -12.0464, longitud: -77.0428 }, // sede Lima
  { id: 'SUR', nombre: 'Sur', latitud: -16.409, longitud: -71.5375 }, // sede Arequipa
  { id: 'CENTRO', nombre: 'Centro', latitud: -12.0651, longitud: -75.2049 }, // sede Huancayo
  { id: 'ORIENTE', nombre: 'Oriente', latitud: -9.93, longitud: -76.2397 }, // sede Huanuco
  { id: 'SUR_ORIENTE', nombre: 'Sur Oriente', latitud: -13.5319, longitud: -71.9675 }, // sede Cusco
  { id: 'NOR_ORIENTE', nombre: 'Nor Oriente', latitud: -6.0341, longitud: -76.9717 }, // sede Moyobamba
  { id: 'ALTIPLANO', nombre: 'Altiplano', latitud: -15.8402, longitud: -70.0219 }, // sede Puno
];

/* ------------------------------------------------------------------ */
/* Penal: forma cruda + atributos derivados de la realidad penitenciaria */
/* ------------------------------------------------------------------ */
export interface PenalRaw {
  region: string;
  departamento: string;
  nombre: string;
  capacidad: number;
  poblacion: number;
  /** Clave de la localidad para la coordenada referencial. */
  localidad: string;
}

/**
 * Los 69 establecimientos del Anexo 06, con atributos derivados.
 * El codigo se genera a partir del nombre; el techo de seguridad, el genero
 * y los demas atributos derivados se asignan con las reglas de src/db/seed.ts
 * (estimaciones documentadas en docs/modelo-de-datos.md).
 */
export const PENALES_RAW: PenalRaw[] = [
  // --- Oficina Regional Norte ---
  { region: 'Norte', departamento: 'Tumbes', nombre: 'E.P. de Tumbes', capacidad: 576, poblacion: 1287, localidad: 'Tumbes' },
  { region: 'Norte', departamento: 'Piura', nombre: 'E.P. de Piura', capacidad: 1370, poblacion: 4444, localidad: 'Piura' },
  { region: 'Norte', departamento: 'Piura', nombre: 'E.P. de Sullana', capacidad: 194, poblacion: 228, localidad: 'Sullana' },
  { region: 'Norte', departamento: 'Lambayeque', nombre: 'E.P. de Chiclayo', capacidad: 1143, poblacion: 4119, localidad: 'Chiclayo' },
  { region: 'Norte', departamento: 'La Libertad', nombre: 'E.P. de Trujillo', capacidad: 1518, poblacion: 6308, localidad: 'Trujillo' },
  { region: 'Norte', departamento: 'La Libertad', nombre: 'E.P. de Mujeres de Trujillo', capacidad: 296, poblacion: 585, localidad: 'Trujillo' },
  { region: 'Norte', departamento: 'La Libertad', nombre: 'E.P. de Pacasmayo', capacidad: 72, poblacion: 107, localidad: 'Pacasmayo' },
  { region: 'Norte', departamento: 'Cajamarca', nombre: 'E.P. de Cajamarca', capacidad: 1512, poblacion: 2427, localidad: 'Cajamarca' },
  { region: 'Norte', departamento: 'Cajamarca', nombre: 'E.P. de Chota', capacidad: 65, poblacion: 147, localidad: 'Chota' },
  { region: 'Norte', departamento: 'Cajamarca', nombre: 'E.P. de Jaén', capacidad: 50, poblacion: 215, localidad: 'Jaen' },
  { region: 'Norte', departamento: 'Cajamarca', nombre: 'E.P. de San Ignacio', capacidad: 150, poblacion: 66, localidad: 'SanIgnacio' },

  // --- Oficina Regional Lima ---
  { region: 'Lima', departamento: 'Ancash', nombre: 'E.P de Huaraz', capacidad: 598, poblacion: 1266, localidad: 'Huaraz' },
  { region: 'Lima', departamento: 'Ancash', nombre: 'E.P. de Chimbote', capacidad: 1144, poblacion: 3327, localidad: 'Chimbote' },
  { region: 'Lima', departamento: 'Prov. Const. del Callao', nombre: 'E.P. del Callao', capacidad: 572, poblacion: 2989, localidad: 'Callao' },
  { region: 'Lima', departamento: 'Prov. Const. del Callao', nombre: 'CEREC - Base Naval', capacidad: 8, poblacion: 5, localidad: 'Callao' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Mujeres de Chorrillos', capacidad: 450, poblacion: 813, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. Anexo de Mujeres de Chorrillos', capacidad: 288, poblacion: 688, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Lurigancho', capacidad: 3204, poblacion: 10013, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. Miguel Castro Castro', capacidad: 1142, poblacion: 5432, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. Virgen de Fátima', capacidad: 548, poblacion: 381, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Ancón', capacidad: 1620, poblacion: 2450, localidad: 'Ancon' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Barbadillo', capacidad: 3, poblacion: 4, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. Modelo Ancon II - S.M.V.C.', capacidad: 2216, poblacion: 1998, localidad: 'Ancon' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. Virgen de la Merced', capacidad: 42, poblacion: 34, localidad: 'Lima' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Huacho', capacidad: 644, poblacion: 2216, localidad: 'Huacho' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Cañete', capacidad: 1024, poblacion: 3921, localidad: 'Canete' },
  { region: 'Lima', departamento: 'Lima', nombre: 'E.P. de Huaral', capacidad: 1029, poblacion: 3831, localidad: 'Huaral' },
  { region: 'Lima', departamento: 'Ica', nombre: 'E.P. de Ica', capacidad: 1924, poblacion: 5399, localidad: 'Ica' },
  { region: 'Lima', departamento: 'Ica', nombre: 'E.P. de Chincha', capacidad: 1152, poblacion: 3573, localidad: 'Chincha' },

  // --- Oficina Regional Sur ---
  { region: 'Sur', departamento: 'Arequipa', nombre: 'E.P. de Arequipa', capacidad: 667, poblacion: 2473, localidad: 'Arequipa' },
  { region: 'Sur', departamento: 'Arequipa', nombre: 'E.P. de Mujeres de Arequipa', capacidad: 67, poblacion: 170, localidad: 'Arequipa' },
  { region: 'Sur', departamento: 'Arequipa', nombre: 'E.P. de Camaná', capacidad: 78, poblacion: 392, localidad: 'Camana' },
  { region: 'Sur', departamento: 'Moquegua', nombre: 'E.P. de Moquegua', capacidad: 178, poblacion: 362, localidad: 'Moquegua' },
  { region: 'Sur', departamento: 'Tacna', nombre: 'E.P. de Tacna', capacidad: 222, poblacion: 1195, localidad: 'Tacna' },
  { region: 'Sur', departamento: 'Tacna', nombre: 'E.P de Mujeres de Tacna', capacidad: 40, poblacion: 116, localidad: 'Tacna' },

  // --- Oficina Regional Centro ---
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. de Huancayo', capacidad: 680, poblacion: 2386, localidad: 'Huancayo' },
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. Mujeres de Concepción', capacidad: 105, poblacion: 51, localidad: 'Concepcion' },
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. de Chanchamayo', capacidad: 120, poblacion: 552, localidad: 'Chanchamayo' },
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. de Jauja', capacidad: 373, poblacion: 200, localidad: 'Jauja' },
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. de Tarma', capacidad: 48, poblacion: 136, localidad: 'Tarma' },
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. de la Oroya', capacidad: 64, poblacion: 101, localidad: 'LaOroya' },
  { region: 'Centro', departamento: 'Junín', nombre: 'E.P. de Río Negro', capacidad: 216, poblacion: 858, localidad: 'RioNegro' },
  { region: 'Centro', departamento: 'Huancavelica', nombre: 'E.P. de Huancavelica', capacidad: 60, poblacion: 290, localidad: 'Huancavelica' },
  { region: 'Centro', departamento: 'Ayacucho', nombre: 'E.P. de Ayacucho', capacidad: 644, poblacion: 2641, localidad: 'Ayacucho' },
  { region: 'Centro', departamento: 'Ayacucho', nombre: 'E.P. de Huanta', capacidad: 42, poblacion: 146, localidad: 'Huanta' },

  // --- Oficina Regional Oriente ---
  { region: 'Oriente', departamento: 'Huánuco', nombre: 'E.P. de Huánuco', capacidad: 1344, poblacion: 3219, localidad: 'Huanuco' },
  { region: 'Oriente', departamento: 'Pasco', nombre: 'E.P. de Cerro de Pasco', capacidad: 96, poblacion: 73, localidad: 'CerroDePasco' },
  { region: 'Oriente', departamento: 'Pasco', nombre: 'E.P. de Cochamarca', capacidad: 1224, poblacion: 1054, localidad: 'Cochamarca' },
  { region: 'Oriente', departamento: 'Ucayali', nombre: 'E.P. de Pucallpa', capacidad: 576, poblacion: 2867, localidad: 'Pucallpa' },

  // --- Oficina Regional Sur Oriente ---
  { region: 'Sur Oriente', departamento: 'Apurímac', nombre: 'E.P. de Abancay', capacidad: 90, poblacion: 472, localidad: 'Abancay' },
  { region: 'Sur Oriente', departamento: 'Apurímac', nombre: 'E.P. de Andahuaylas', capacidad: 248, poblacion: 616, localidad: 'Andahuaylas' },
  { region: 'Sur Oriente', departamento: 'Cusco', nombre: 'E.P. de Cusco', capacidad: 1616, poblacion: 3602, localidad: 'Cusco' },
  { region: 'Sur Oriente', departamento: 'Cusco', nombre: 'E.P. de Mujeres de Cusco', capacidad: 198, poblacion: 218, localidad: 'Cusco' },
  { region: 'Sur Oriente', departamento: 'Cusco', nombre: 'E.P. de Sicuani', capacidad: 96, poblacion: 260, localidad: 'Sicuani' },
  { region: 'Sur Oriente', departamento: 'Cusco', nombre: 'E.P. de Quillabamba', capacidad: 80, poblacion: 352, localidad: 'Quillabamba' },
  { region: 'Sur Oriente', departamento: 'Madre de Dios', nombre: 'E.P. de Puerto Maldonado', capacidad: 590, poblacion: 1270, localidad: 'PuertoMaldonado' },

  // --- Oficina Regional Nor Oriente ---
  { region: 'Nor Oriente', departamento: 'San Martín', nombre: 'E.P. de Moyobamba', capacidad: 675, poblacion: 979, localidad: 'Moyobamba' },
  { region: 'Nor Oriente', departamento: 'San Martín', nombre: 'E.P. de Juanjui', capacidad: 970, poblacion: 980, localidad: 'Juanjui' },
  { region: 'Nor Oriente', departamento: 'San Martín', nombre: 'E.P. de Tarapoto', capacidad: 222, poblacion: 422, localidad: 'Tarapoto' },
  { region: 'Nor Oriente', departamento: 'San Martín', nombre: 'E.P. de Sananguillo', capacidad: 966, poblacion: 864, localidad: 'Sananguillo' },
  { region: 'Nor Oriente', departamento: 'Loreto', nombre: 'E.P. de Iquitos', capacidad: 1392, poblacion: 1379, localidad: 'Iquitos' },
  { region: 'Nor Oriente', departamento: 'Loreto', nombre: 'E.P. de Mujeres de Iquitos', capacidad: 78, poblacion: 81, localidad: 'Iquitos' },
  { region: 'Nor Oriente', departamento: 'Loreto', nombre: 'E.P. de Yurimaguas', capacidad: 406, poblacion: 419, localidad: 'Yurimaguas' },
  { region: 'Nor Oriente', departamento: 'Amazonas', nombre: 'E.P. de Chachapoyas', capacidad: 732, poblacion: 881, localidad: 'Chachapoyas' },
  { region: 'Nor Oriente', departamento: 'Amazonas', nombre: 'E.P. de Bagua Grande', capacidad: 119, poblacion: 422, localidad: 'BaguaGrande' },

  // --- Oficina Regional Altiplano ---
  { region: 'Altiplano', departamento: 'Puno', nombre: 'E.P. de Puno', capacidad: 1002, poblacion: 1218, localidad: 'Puno' },
  { region: 'Altiplano', departamento: 'Puno', nombre: 'E.P. de Lampa', capacidad: 252, poblacion: 217, localidad: 'Lampa' },
  { region: 'Altiplano', departamento: 'Puno', nombre: 'E.P. de Juliaca', capacidad: 420, poblacion: 1283, localidad: 'Juliaca' },
  { region: 'Altiplano', departamento: 'Tacna', nombre: 'E.P. de Challapalca', capacidad: 214, poblacion: 227, localidad: 'Challapalca' },
];

/* ------------------------------------------------------------------ */
/* Corte anterior: Anexo 06 del Informe Estadistico de enero 2025      */
/* ------------------------------------------------------------------ */
/**
 * Poblacion por establecimiento en el corte de enero de 2025.
 *
 * Se conserva por dos razones. La primera es documental: el informe del Hito 1
 * esta redactado contra este corte. La segunda es analitica: la comparacion
 * entre ambos anos sostiene uno de los argumentos centrales del proyecto, que
 * la capacidad de albergue no crecio en absoluto (41,764 plazas en los dos
 * cortes) mientras la poblacion aumento un 4%.
 *
 * Uso previsto: verificaciones historicas y el analisis comparativo de la
 * documentacion. NO alimenta el sistema operativo, que trabaja con el corte
 * vigente declarado en PENALES_RAW.
 */
export const PENALES_2025: { nombre: string; capacidad: number; poblacion: number }[] = [
  { nombre: "E.P. de Tumbes", capacidad: 576, poblacion: 1199 },
  { nombre: "E.P. de Piura", capacidad: 1370, poblacion: 4431 },
  { nombre: "E.P. de Sullana", capacidad: 194, poblacion: 213 },
  { nombre: "E.P. de Chiclayo", capacidad: 1143, poblacion: 3971 },
  { nombre: "E.P. de Trujillo", capacidad: 1518, poblacion: 6029 },
  { nombre: "E.P. de Mujeres de Trujillo", capacidad: 296, poblacion: 544 },
  { nombre: "E.P. de Pacasmayo", capacidad: 72, poblacion: 98 },
  { nombre: "E.P. de Cajamarca", capacidad: 1512, poblacion: 2315 },
  { nombre: "E.P. de Chota", capacidad: 65, poblacion: 160 },
  { nombre: "E.P. de Jaén", capacidad: 50, poblacion: 253 },
  { nombre: "E.P. de San Ignacio", capacidad: 150, poblacion: 62 },
  { nombre: "E.P de Huaraz", capacidad: 598, poblacion: 1209 },
  { nombre: "E.P. de Chimbote", capacidad: 1144, poblacion: 3162 },
  { nombre: "E.P. del Callao", capacidad: 572, poblacion: 3243 },
  { nombre: "CEREC - Base Naval", capacidad: 8, poblacion: 5 },
  { nombre: "E.P. de Mujeres de Chorrillos", capacidad: 450, poblacion: 812 },
  { nombre: "E.P. Anexo de Mujeres de Chorrillos", capacidad: 288, poblacion: 627 },
  { nombre: "E.P. de Lurigancho", capacidad: 3204, poblacion: 9581 },
  { nombre: "E.P. Miguel Castro Castro", capacidad: 1142, poblacion: 5367 },
  { nombre: "E.P. Virgen de Fátima", capacidad: 548, poblacion: 278 },
  { nombre: "E.P. de Ancón", capacidad: 1620, poblacion: 2272 },
  { nombre: "E.P. de Barbadillo", capacidad: 3, poblacion: 2 },
  { nombre: "E.P. Modelo Ancon II - S.M.V.C.", capacidad: 2216, poblacion: 1784 },
  { nombre: "E.P. Virgen de la Merced", capacidad: 42, poblacion: 32 },
  { nombre: "E.P. de Huacho", capacidad: 644, poblacion: 2126 },
  { nombre: "E.P. de Cañete", capacidad: 1024, poblacion: 3197 },
  { nombre: "E.P. de Huaral", capacidad: 1029, poblacion: 4085 },
  { nombre: "E.P. de Ica", capacidad: 1924, poblacion: 5192 },
  { nombre: "E.P. de Chincha", capacidad: 1152, poblacion: 3357 },
  { nombre: "E.P. de Arequipa", capacidad: 667, poblacion: 2310 },
  { nombre: "E.P. de Mujeres de Arequipa", capacidad: 67, poblacion: 170 },
  { nombre: "E.P. de Camaná", capacidad: 78, poblacion: 457 },
  { nombre: "E.P. de Moquegua", capacidad: 178, poblacion: 324 },
  { nombre: "E.P. de Tacna", capacidad: 222, poblacion: 1069 },
  { nombre: "E.P de Mujeres de Tacna", capacidad: 40, poblacion: 103 },
  { nombre: "E.P. de Huancayo", capacidad: 680, poblacion: 2170 },
  { nombre: "E.P. Mujeres de Concepción", capacidad: 105, poblacion: 43 },
  { nombre: "E.P. de Chanchamayo", capacidad: 120, poblacion: 635 },
  { nombre: "E.P. de Jauja", capacidad: 373, poblacion: 153 },
  { nombre: "E.P. de Tarma", capacidad: 48, poblacion: 125 },
  { nombre: "E.P. de la Oroya", capacidad: 64, poblacion: 98 },
  { nombre: "E.P. de Río Negro", capacidad: 216, poblacion: 815 },
  { nombre: "E.P. de Huancavelica", capacidad: 60, poblacion: 342 },
  { nombre: "E.P. de Ayacucho", capacidad: 644, poblacion: 2656 },
  { nombre: "E.P. de Huanta", capacidad: 42, poblacion: 158 },
  { nombre: "E.P. de Huánuco", capacidad: 1344, poblacion: 3200 },
  { nombre: "E.P. de Cerro de Pasco", capacidad: 96, poblacion: 26 },
  { nombre: "E.P. de Cochamarca", capacidad: 1224, poblacion: 1046 },
  { nombre: "E.P. de Pucallpa", capacidad: 576, poblacion: 2739 },
  { nombre: "E.P. de Abancay", capacidad: 90, poblacion: 506 },
  { nombre: "E.P. de Andahuaylas", capacidad: 248, poblacion: 575 },
  { nombre: "E.P. de Cusco", capacidad: 1616, poblacion: 3230 },
  { nombre: "E.P. de Mujeres de Cusco", capacidad: 198, poblacion: 207 },
  { nombre: "E.P. de Sicuani", capacidad: 96, poblacion: 234 },
  { nombre: "E.P. de Quillabamba", capacidad: 80, poblacion: 484 },
  { nombre: "E.P. de Puerto Maldonado", capacidad: 590, poblacion: 1237 },
  { nombre: "E.P. de Moyobamba", capacidad: 675, poblacion: 987 },
  { nombre: "E.P. de Juanjui", capacidad: 970, poblacion: 992 },
  { nombre: "E.P. de Tarapoto", capacidad: 222, poblacion: 495 },
  { nombre: "E.P. de Sananguillo", capacidad: 966, poblacion: 801 },
  { nombre: "E.P. de Iquitos", capacidad: 1392, poblacion: 1260 },
  { nombre: "E.P. de Mujeres de Iquitos", capacidad: 78, poblacion: 65 },
  { nombre: "E.P. de Yurimaguas", capacidad: 406, poblacion: 393 },
  { nombre: "E.P. de Chachapoyas", capacidad: 732, poblacion: 838 },
  { nombre: "E.P. de Bagua Grande", capacidad: 119, poblacion: 378 },
  { nombre: "E.P. de Puno", capacidad: 1002, poblacion: 811 },
  { nombre: "E.P. de Lampa", capacidad: 252, poblacion: 168 },
  { nombre: "E.P. de Juliaca", capacidad: 420, poblacion: 1611 },
  { nombre: "E.P. de Challapalca", capacidad: 214, poblacion: 180 },
];

/**
 * Corte de datos vigente del sistema.
 * Se declara de forma explicita para que la interfaz y los informes puedan
 * indicar a que fecha corresponden las cifras que muestran.
 */
export const CORTE_DATOS = '2026-01';

/** Anio del corte vigente, para los rotulos de la interfaz y la verificacion. */
export const CORTE_ANIO = 2026;

/** Coordenadas referenciales por localidad. */
export const LOCALIDADES: Record<string, [number, number]> = {
  Tumbes: [-3.5669, -80.4515],
  Piura: [-5.1945, -80.6328],
  Sullana: [-4.9039, -80.6853],
  Chiclayo: [-6.7714, -79.8409],
  Trujillo: [-8.1116, -79.0288],
  Pacasmayo: [-7.4006, -79.5711],
  Cajamarca: [-7.1638, -78.5003],
  Chota: [-6.5614, -78.6492],
  Jaen: [-5.7078, -78.8081],
  SanIgnacio: [-5.1458, -78.9953],
  Huaraz: [-9.53, -77.5286],
  Chimbote: [-9.0853, -78.5783],
  Callao: [-12.0566, -77.1181],
  Lima: [-12.0464, -77.0428],
  Ancon: [-11.7736, -77.1764],
  Huacho: [-11.1067, -77.605],
  Canete: [-13.0786, -76.3761],
  Huaral: [-11.495, -77.2078],
  Ica: [-14.0678, -75.7286],
  Chincha: [-13.4094, -76.1325],
  Arequipa: [-16.409, -71.5375],
  Camana: [-16.6225, -72.7119],
  Moquegua: [-17.1936, -70.9356],
  Tacna: [-18.0146, -70.2509],
  Huancayo: [-12.0651, -75.2049],
  Concepcion: [-11.9181, -75.3125],
  Chanchamayo: [-11.05, -75.3167],
  Jauja: [-11.7753, -75.4975],
  Tarma: [-11.4192, -75.6894],
  LaOroya: [-11.5219, -75.9058],
  RioNegro: [-11.2089, -74.8372],
  Huancavelica: [-12.7865, -74.9731],
  Ayacucho: [-13.1588, -74.2239],
  Huanta: [-12.9389, -74.2508],
  Huanuco: [-9.93, -76.2397],
  CerroDePasco: [-10.6867, -76.2586],
  Cochamarca: [-10.5667, -76.0333],
  Pucallpa: [-8.3791, -74.5539],
  Abancay: [-13.6339, -72.8814],
  Andahuaylas: [-13.6553, -73.3869],
  Cusco: [-13.5319, -71.9675],
  Sicuani: [-14.2703, -71.2264],
  Quillabamba: [-12.8631, -72.6931],
  PuertoMaldonado: [-12.5933, -69.1892],
  Moyobamba: [-6.0341, -76.9717],
  Juanjui: [-7.1769, -76.6475],
  Tarapoto: [-6.4869, -76.3653],
  Sananguillo: [-7.2167, -76.75],
  Iquitos: [-3.7491, -73.2538],
  Yurimaguas: [-5.9, -76.0833],
  Chachapoyas: [-6.2317, -77.8692],
  BaguaGrande: [-5.7556, -78.4444],
  Puno: [-15.8402, -70.0219],
  Lampa: [-15.3656, -70.3686],
  Juliaca: [-15.5, -70.1333],
  Challapalca: [-17.2333, -69.6667],
};



/* ------------------------------------------------------------------ */
/* Reglas de derivacion de atributos del penal                         */
/* ------------------------------------------------------------------ */

/** Un establecimiento es de poblacion femenina si su nombre lo indica. */
export function esPenalDeMujeres(nombre: string): boolean {
  return /mujeres/i.test(nombre);
}

/**
 * Techo de seguridad derivado del rol institucional del establecimiento.
 * Challapalca es el unico establecimiento de seguridad extrema del pais;
 * Lurigancho y Castro Castro son los grandes penales de maxima seguridad;
 * los establecimientos de mujeres y los muy pequenos son de menor regimen.
 */
export function seguridadDePenal(nombre: string, capacidad: number): Seguridad {
  if (/challapalca/i.test(nombre)) return 'ESPECIAL';
  if (/lurigancho|castro castro|cREC|base naval/i.test(nombre)) return 'MAXIMA';
  if (esPenalDeMujeres(nombre)) return capacidad >= 250 ? 'MEDIANA' : 'MINIMA';
  if (/virgen de la merced|barbadillo|cerro de pasco|jauja|concepci|virgen de f/i.test(nombre)) return 'MINIMA';
  if (capacidad >= 1000) return 'MAXIMA';
  if (capacidad >= 400) return 'MEDIANA';
  return 'MINIMA';
}

/**
 * Codigo estable y legible a partir del nombre: "E.P. de Mujeres de Trujillo" -> EP-MUJTRUJILLO.
 * Se omiten articulos y preposiciones; maximo 16 caracteres despues de "EP-".
 */
export function codigoDePenal(nombre: string, usados: Set<string>): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^E\.?\s*P\.?\s*/i, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !/^(de|del|la|las|los|y)$/i.test(w))
    .map((w) => w.toUpperCase().replace(/^MUJERES$/, 'MUJ'))
    .join('')
    .slice(0, 16) || 'X';
  let codigo = `EP-${base}`;
  for (let n = 2; usados.has(codigo); n++) codigo = `EP-${base.slice(0, 15)}${n}`;
  usados.add(codigo);
  return codigo;
}
