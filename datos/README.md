# Datos simulados – inpe-devsecops

Población penitenciaria **ficticia** para el desarrollo y las pruebas del MVP. Está calibrada con el *Informe Estadístico del INPE – Enero 2026* y todos los totales coinciden exactamente con él (ver `validacion.md`).

> ⚠️ **Todas las personas son inventadas.** Los nombres se generaron combinando listas de nombres y apellidos comunes, y los números de documento son aleatorios. Cualquier coincidencia con una persona real es casual. Cada documento lleva `"dato_ficticio": true`.

## Archivos

| Archivo | Colección | Documentos | Descripción |
|---|---|---:|---|
| `penales.json` | `penales` | 69 | Establecimientos con capacidad de albergue y cifras de referencia del INPE |
| `pabellones.json` | `pabellones` | 246 | Pabellones por penal (**simulados**: el INPE no publica datos por pabellón) |
| `delitos.json` | `delitos` | 42 | Catálogo: 20 delitos del INPE + 22 subdelitos de "Otros delitos" |
| `internos.json` | `internos` | 103,717 | Un documento por interno (~89 MB) |
| `usuarios.json` | `usuarios` | 243 | 3 administradores centrales, 2 auditores, 69 directores (uno por penal) y 169 operadores de registro |
| `traslados.json` | `traslados` | 3,210 | 2,400 ejecutados en los últimos 12 meses, 420 pendientes, 160 aprobados por ejecutar y 230 rechazados |
| `alertas.json` | `alertas` | 3,503 | Alertas del motor al 31/01/2026: hacinamiento por penal (51), aforo de pabellón (213), liberación próxima (192) y prisión preventiva por vencer (3,047) |
| `auditoria.json` | `auditoria` | 44,659 | Bitácora de enero 2026 (inicios de sesión, consultas, actualizaciones, traslados, reportes) |
| `validacion.md` | — | — | Comparación simulado vs. INPE (0 diferencias) |
| `generador/` | — | — | Código para regenerar los datos |

Todos los archivos están en formato **NDJSON** (un documento por línea, Extended JSON v2), que es el formato por defecto de `mongoimport`. No usen `--jsonArray`: esa opción tiene un límite de 16 MB.

## Importar a MongoDB

Requiere [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) (`mongoimport`).

```bash
# Local
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection penales    --file penales.json    --drop
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection pabellones --file pabellones.json --drop
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection delitos    --file delitos.json    --drop
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection internos   --file internos.json   --drop --numInsertionWorkers 4
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection usuarios   --file usuarios.json   --drop
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection traslados  --file traslados.json  --drop
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection alertas    --file alertas.json    --drop
mongoimport --uri "mongodb://localhost:27017/inpe-devsecops" --collection auditoria  --file auditoria.json  --drop

# MongoDB Atlas (entorno DEV): reemplazar <usuario>, <clave> y <cluster>
mongoimport --uri "mongodb+srv://<usuario>:<clave>@<cluster>/inpe-devsecops_dev" --collection internos --file internos.json --drop
```

El volumen (~90 MB) entra en el plan gratuito M0 de Atlas (512 MB).

Índices recomendados (en `mongosh`):

```js
db.internos.createIndex({ codigo_interno: 1 }, { unique: true })
db.internos.createIndex({ "ubicacion.penal_id": 1, "ubicacion.pabellon_id": 1 })
db.internos.createIndex({ situacion_juridica: 1, "prision_preventiva.fecha_vencimiento": 1 })
db.internos.createIndex({ "sentencia.fecha_liberacion_estimada": 1 })
db.pabellones.createIndex({ penal_id: 1 })
db.usuarios.createIndex({ username: 1 }, { unique: true })
db.alertas.createIndex({ destinatario_id: 1, estado: 1 })
db.traslados.createIndex({ estado: 1, penal_origen_id: 1 })
db.auditoria.createIndex({ fecha: -1 })
db.auditoria.createIndex({ usuario_id: 1, fecha: -1 })
```

## Qué es exacto y qué es estimado

**Exacto (idéntico al INPE, enero 2026):**
- Capacidad y población de cada uno de los 69 penales, por sexo y situación jurídica (Anexos 04 y 06).
- Cruce delito × situación jurídica (p. 25) y delito × rango de edad (p. 26).
- Tiempo de sentencia de los sentenciados, incluidas las 2,699 cadenas perpetuas, las 4,607 penas menores de 4 años y las 664 menores de 1 año (p. 27).
- Número de ingresos al penal (p. 28).
- Estado civil por sexo (pp. 14-15).
- Instrucción primaria y secundaria (p. 15).
- 5,935 extranjeros (5,515 hombres y 420 mujeres), con las cifras publicadas para Lurigancho, Huaral, Chorrillos y Trujillo (p. 18).

**Estimado o simulado (el INPE no lo publica, o no con ese detalle):**
- Pabellones y la distribución de internos entre ellos. Los penales mixtos tienen un "Pabellón de Mujeres".
- Desglose de "Otros delitos" en subdelitos.
- Qué delitos se asignan a mujeres: se dio más peso a tráfico de drogas, robo y hurto.
- Relación entre gravedad del delito y duración de la pena.
- Instrucción superior / sin instrucción (8,800 / 2,225) y la nacionalidad de cada extranjero.
- Plazos de prisión preventiva (9, 18 o 36 meses), fechas de ingreso, de sentencia y de liberación.
- Formato del número de expediente.
- **Todas** las colecciones operativas: usuarios, traslados, alertas y auditoría. Las alertas se calculan a partir de los datos (aforos reales, fechas de liberación y vencimientos), y los traslados ejecutados son coherentes con la ubicación actual del interno.

### Casos de prueba incluidos en `auditoria.json`

- **Fuerza bruta:** el 18/01/2026 a las 03:12 hay 5 inicios de sesión fallidos contra un operador desde IP externas, seguidos del bloqueo de la cuenta (RNF06).
- **Uso indebido interno:** el 24/01/2026 a las 02:05, otro operador hace 40 consultas de fichas en 4 minutos y 6 intentos de ver internos de otro penal, que son denegados con 403 (RNF08).

Sirven para demostrar las alertas de seguridad de la sección 4.3.

### Usuarios

Los usuarios vienen con `password_hash: null` y `estado: "PENDIENTE_ACTIVACION"`. **A propósito no se incluyen contraseñas** (ni siquiera de prueba) en un archivo que podría compartirse. El script de carga del backend debe asignar una contraseña de desarrollo leída de una variable de entorno, guardarla con hash Argon2id y activar la cuenta. El MFA se enrola en el primer inicio de sesión. Los correos usan el dominio reservado `.test`, que no existe en internet.

La fecha de corte es el **31/01/2026**. Con la semilla `20260131` los datos salen idénticos cada vez que se generan. Para la demo de alertas hay 192 internos con liberación en los próximos 30 días y 3,047 procesados cuya prisión preventiva vence en los próximos 30 días.

## Seguridad: cómo usar estos datos

1. **No suban `internos.json` al repositorio de GitHub.** Pesa 89 MB y contiene datos personales en texto plano, aunque sean ficticios. Agreguen `datos/*.json` al `.gitignore` y versionen solo el generador.
2. **No carguen este archivo directamente en Producción.** En la aplicación real, nombre, documento, expediente y delito deben guardarse **cifrados** (RNF01). El script de carga (seed) del backend debe leer este archivo y pasar cada interno por el servicio criptográfico antes de insertarlo.
3. Úsenlo en los entornos **local y DEV**.

## Regenerar

Desde Windows PowerShell (no necesita instalar nada):

```powershell
cd generador
.\generar.ps1 -Salida ..\nuevo -Semilla 20260131
```
