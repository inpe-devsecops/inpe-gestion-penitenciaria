# Comparación de cortes: Anexo 06 de enero 2025 vs enero 2026

Documento de trabajo. **No modifica nada del sistema ni del documento del Hito 1.**

Fuente: Instituto Nacional Penitenciario, *Informe estadístico: enero 2026*, Anexo 06
(páginas 78 a 82 del PDF) y Anexo 07 (página 83). El corte de 2025 proviene del
*Informe estadístico: enero 2025*, Anexos 06 y 07.

## 1. Totales nacionales

| Indicador | Enero 2025 | Enero 2026 | Variación |
|---|---:|---:|---:|
| Capacidad de albergue | 41,764 | 41,764 | **0 (0,0%)** |
| Población penitenciaria | 99,697 | 103,717 | **+4,020 (+4,0%)** |
| Sobrepoblación | 57,933 | 61,953 | **+4,020 (+6,9%)** |
| Índice de hacinamiento | 139% | **148%** | **+9 puntos** |
| Establecimientos | 69 | 69 | 0 |

**Cuadre verificado:** la suma de los 69 establecimientos coincide exactamente con los
totales publicados en el Anexo 07 de cada informe (41,764 de capacidad en ambos cortes;
99,697 y 103,717 de población respectivamente).

## 2. Variación por oficina regional

| Oficina regional | Capacidad | Población 2025 | Población 2026 | Hacin. 2025 | Hacin. 2026 | Variación |
|---|---:|---:|---:|---:|---:|---:|
| Sur | 1,252 | 4,433 | 4,708 | 254% | 276% | +22 pp |
| Lima | 17,608 | 46,331 | 48,340 | 163% | 175% | +12 pp |
| Sur Oriente | 2,918 | 6,473 | 6,790 | 122% | 133% | +11 pp |
| Norte | 6,946 | 19,275 | 19,933 | 177% | 187% | +10 pp |
| Altiplano | 1,888 | 2,770 | 2,945 | 47% | 56% | +9 pp |
| Centro | 2,352 | 7,195 | 7,361 | 206% | 213% | +7 pp |
| Oriente | 3,240 | 7,011 | 7,213 | 116% | 123% | +7 pp |
| Nor Oriente | 5,560 | 6,209 | 6,427 | 12% | 16% | +4 pp |

La capacidad no varió en ninguna región. El hacinamiento empeoró en las ocho.

## 3. Hallazgo principal

**En un año no se incorporó ni una sola plaza.** La capacidad nacional es idéntica
(41,764) y los 69 establecimientos son los mismos, sin altas ni bajas. Todo el
deterioro proviene del crecimiento de la población: 4,020 personas más.

Esto valida con datos la hipótesis que sostiene el proyecto: el problema no se
resuelve construyendo infraestructura, porque la infraestructura no creció y la
población sí. La redistribución de la capacidad existente es la única palanca
disponible en el corto plazo.

## 4. Cambios en los extremos

### Los más hacinados

| Enero 2025 | Enero 2026 |
|---|---|
| E.P. de Quillabamba 505% | E.P. de Tacna 438% |
| E.P. de Camaná 486% | E.P. de Abancay 424% |
| E.P. de Huancavelica 470% | E.P. del Callao 423% |
| E.P. del Callao 467% | E.P. de Camaná 403% |
| E.P. de Abancay 462% | E.P. de Pucallpa 398% |
| E.P. de Chanchamayo 429% | E.P. de Huancavelica 383% |
| E.P. de Jaén 406% | E.P. Miguel Castro Castro 376% |
| E.P. de Tacna 382% | E.P. de Chanchamayo 360% |

El ranking se reorganizó por completo. Quillabamba, que era el caso extremo del país,
salió de la lista de los ocho primeros.

### Mayores mejoras

| Establecimiento | 2025 | 2026 | Variación |
|---|---:|---:|---:|
| E.P. de Quillabamba | 505% | 340% | −165 pp |
| E.P. de Huancavelica | 470% | 383% | −87 pp |
| E.P. de Camaná | 486% | 403% | −83 pp |
| E.P. de Juliaca | 284% | 205% | −79 pp |
| E.P. de Jaén | 406% | 330% | −76 pp |

### Mayores deterioros

| Establecimiento | 2025 | 2026 | Variación |
|---|---:|---:|---:|
| E.P. de Cañete | 212% | 283% | +71 pp |
| E.P. de Tacna | 382% | 438% | +56 pp |
| E.P. de Puno | −19% | 22% | +41 pp (dejó de tener holgura) |
| E.P. de Bagua Grande | 218% | 255% | +37 pp |

Tacna es el caso más ilustrativo: pasó de ser el octavo más hacinado a encabezar la
lista nacional.

## 5. Observaciones sobre el informe de 2026

- La estructura del Anexo 06 es idéntica a la de 2025: mismos 69 establecimientos,
  mismas columnas y mismos totales regionales. El proceso de carga del sistema no
  requiere cambios: solo se reemplazan las cifras de población.
- **Ninguna capacidad cambió**, de modo que la migración no toca la columna
  `capacidad_albergue` de la tabla `penal`.
- Los anexos 08 y 09 del informe de 2026 tienen las columnas de capacidad y población
  desordenadas en varias filas (por ejemplo, en el Anexo 08 la fila de Yurimaguas
  muestra 214 / 227, que corresponden a Challapalca). Es un defecto de composición del
  PDF, no de los datos: el Anexo 06, que es la fuente que usa el sistema, está correcto
  y cuadra con el Anexo 07.
