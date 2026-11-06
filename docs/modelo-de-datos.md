# Modelo de datos (MongoDB)

Implementa la Tabla 15 del Trabajo Parcial. Las reglas que no deben depender solo de la aplicación viven en la base de datos (validadores `$jsonSchema`/`$expr` e índices), creadas por las migraciones versionadas de `backend/src/db/migrar.ts`.

| Colección | Contenido | Restricción en la base |
|---|---|---|
| `oficinas_regionales` | 8 oficinas del INPE con la coordenada de su sede | — |
| `establecimientos` | `_id` legible (`EP-TACNA`), oficina, capacidad oficial, población vigente, techo de seguridad, regímenes admitidos, género, programas por fase, proporción de alto riesgo, activo | `capacidad_oficial ≥ 1`, enums del catálogo |
| `ocupacion_historica` | Un documento por establecimiento y corte `YYYY-MM` (población, capacidad, `interpolado`) | Único `(establecimiento_id, corte)` |
| `internos` | Ficha mínima: `_id` anónimo (`INT-000123`), sexo, clasificación, fase, situación jurídica, riesgo 1-5, región de procedencia, establecimiento | `additionalProperties: false`: no admite nombres, documentos ni otros campos |
| `solicitudes_traslado` | Código `TR-AAAA-NNNN`, interno, origen, causal, fundamento cifrado, estado, solicitante, pesos usados, destino recomendado y definitivo, ejecución | Causal del art. 159; fundamento `v1:` cifrado; único parcial: un trámite abierto por interno |
| `evaluaciones_destino` | Un documento por destino evaluado: elegible, posición, puntaje, aportes por factor, motivo de descarte, métricas | Único `(solicitud_id, destino_id)` |
| `decisiones_traslado` | Resultado, decidido por, solicitante (copiado), destino, si se aparta de la recomendación, fundamento cifrado | `$expr: decidido_por ≠ solicitante_id` (segregación de funciones) |
| `alertas` | Condición (`HACINAMIENTO`, `PROSPECTIVA`), severidad, estado, valor observado, umbral, historial | Único parcial `(establecimiento_id, condicion)` mientras `vigente: true` |
| `parametros` | Umbrales, pesos y valores de normalización con quién y cuándo los cambió | Cambios auditados con valor anterior y nuevo |
| `usuarios` / `sesiones` | Rol, ámbito, hash Argon2id, bloqueo / `jti`, expiración, revocación | `username` único; TTL de sesiones expiradas |
| `auditoria` | Fecha, usuario, rol, IP, acción, entidad, resultado, valor anterior, valor nuevo, detalle | Solo inserción (rol de base de datos y modelo) |
| `contadores`, `migraciones` | Secuencias de códigos legibles / migraciones aplicadas | — |

## Indicadores

- **Índice de hacinamiento** = (población − capacidad) ÷ capacidad × 100, a nivel de establecimiento (el mismo cálculo y nivel del Anexo 06 del INPE).
- **Niveles** (Tabla 10, configurables): Atención ≥ 20 %, Severo ≥ 100 %, Crítico ≥ 300 %; Prospectiva cuando la proyección llega al crítico en 6 meses o menos.
- **Proyección**: recta por mínimos cuadrados sobre los últimos 12 cortes, t* = (U − P₀) ÷ m, con U = capacidad × (1 + umbral crítico).

## Motor de recomendación (Tabla 11)

1. **Condiciones obligatorias** (si falla una, el destino se descarta con su motivo): activo, distinto del origen, población compatible con el sexo del interno, régimen admitido, techo de seguridad ≥ nivel del interno, cupo libre > 0.
2. **Puntaje** S = Σ wᵢ · fᵢ con fᵢ ∈ [0, 1]:

| Factor | Normalización | Peso por defecto |
|---|---|---|
| Cupo | min(1, plazas libres ÷ `cupo_referencia`) | 0.30 |
| Hacinamiento relativo | (H origen − H destino) ÷ (H máx − H mín del corte) | 0.25 |
| Distancia | 1 − min(1, km a la sede de la región de procedencia ÷ `distancia_max_km`) | 0.20 |
| Fase de tratamiento | 1 si ofrece programa para la fase; 0.5 si ofrece una contigua; 0 si no | 0.15 |
| Concentración de alto riesgo | 1 − min(1, proporción de alto riesgo ÷ `riesgo_max_proporcion`) | 0.10 |

## Atributos estimados

El INPE no publica techo de seguridad, regímenes admitidos, programas por fase ni proporción de alto riesgo por establecimiento. El seed los deriva con reglas explícitas (`backend/src/db/seed.ts`): Challapalca es de régimen especial; Lurigancho, Castro Castro y los establecimientos de 1,000 plazas o más son de máxima seguridad; los de mujeres y los pequeños, de régimen mínimo o mediano. El administrador central puede corregirlos.
