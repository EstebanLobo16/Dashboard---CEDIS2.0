# Reglas de negocio, cruces y resultados — Tratado de datos Cobranza

Este documento es la referencia de negocio de `cobranza_pipeline.ipynb`: qué archivos
lee, qué campos usa de cada uno, cómo los cruza, y qué columnas trae cada salida.
Para dudas de **implementación** (nombres de función, manejo de casos raros de
formato) el propio notebook trae comentarios en cada celda; aquí solo está el
**qué** y el **por qué** de negocio.

Todo lo que sigue corresponde a la familia de puesto **Cobranza**. El notebook
ignora cualquier sección de CEDIS/CATD que traiga el PDF de referencia.

## 1 · Archivos de entrada

### 1.1 Detalle Colaborador

Patrón de búsqueda: `*Detalle Colaborador*.xlsx`. Un `.xlsx`, primera pestaña.
Es el **universo de personas activas**: de aquí sale quién existe, su puesto y su
antigüedad. Columnas usadas:

| Columna | Uso |
|---|---|
| `Número de persona` | identificador único de la persona; llave de todos los cruces |
| `Nombre` | nombre completo, se usa también para el respaldo de Centro por nombre único |
| `Fecha de contratación de la empresa` | calcula antigüedad (días laborados) |
| `Código de puesto` | se muestra en el resultado, no participa en el cruce |
| `Nombre de puesto` | se normaliza (`texto_clave`) y es la llave para encontrar los cursos del plan |
| `Región` | **no se usa** — la Región Cobranza real sale del cruce de Centro (sección 1.2), no de esta columna cruda |
| `Nombre del departamento` | respaldo de Centro cuando no se puede resolver por persona ni por nombre |

### 1.2 Planta de Cobranza por Posiciones

Patrón: `Planta de Cobranza por Posiciones*.xlsx`. Trae **dos pestañas** relevantes:

**a) Pestaña de fecha** (ej. `01 AGO 26`) — se elige automáticamente la más
reciente. Es la fuente real de a qué **Centro** pertenece cada persona:

| Columna | Uso |
|---|---|
| `Número de trabajador` | llave para el cruce por persona (nivel 1 de la cascada de Centro) |
| `Nombre del colaborador` | llave para el cruce por nombre único (nivel 2) |
| `Departamento` | llave para el cruce por departamento único (nivel 3) |
| `Centro` | el Centro de Cobranza asignado |

Algunos meses (Abril/Junio/Julio en la fuente original) traen una tabla resumen de
8 columnas **arriba** de esta tabla nominal; el notebook detecta sola la fila real
de encabezado buscando `Número de trabajador`, no asume que está en la fila 0.

**b) Pestaña `CENTROS-TIPOCENTROS`** — el catálogo que traduce Centro → Región
Cobranza oficial:

| Columna | Uso |
|---|---|
| `# Centro` | llave para cruzar contra el Centro resuelto en Detalle Colaborador |
| `REGION COBRANZA` | una de las 15 regiones oficiales (ver sección 2.3) |

### 1.3 Planta de Cobranza por Centro Autorizada/Activa

Patrón: `Planta de Cobranza por Centro*.xlsx`. Se carga (misma lógica de pestaña
más reciente que 1.2) **solo como referencia/auditoría** — hoy no participa en
ningún cruce ni en las salidas finales.

### 1.4 Plan de capacitación — Colaborador/Operación y Gerencial

Dos archivos con **la misma estructura de 4 pestañas**, uno por cada plan
(`PDT-operacion-adaptado` y `PDT-gerencial-adaptado`). Cada uno puede llegar como
un solo `.xlsx` con las 4 pestañas, o como 4 `.csv` sueltos (uno por pestaña) — el
notebook prueba ambos formatos solo. Los nombres de pestaña/columna toleran
variantes con/sin acento y con espacio o guion_bajo (`Cursos asignados` /
`Cursos_asignados`).

**Cursos asignados** (regla *general*, aplica a todo el puesto sin importar el centro):

| Columna | Uso |
|---|---|
| `Rango de meses para cursar` | ej. `0-3`; se toma el **mínimo** del rango como el umbral de antigüedad en meses a partir del cual el curso aplica |
| `Curso` | nombre del curso; llave para cruzar contra las finalizaciones |
| `ID Curso` | se conserva, no participa en ningún cruce |
| `Tipo`, `Modalidad`, `Duracion` | no se usan |

**Colaboradores asignados** (regla general): `ID` (código de puesto, no se usa
directamente) y `Puesto` (se normaliza y cruza contra `Nombre de puesto` de
Detalle Colaborador — cada puesto aquí recibe **todos** los cursos de la pestaña
anterior).

**Cursos específicos**: mismas columnas que "Cursos asignados".

**Colaboradores específicos** (regla *específica*, solo aplica en ciertos
centros): `ID`, `Puesto` y `Centros de costos` — puede traer varios centros en
una sola celda (separados por coma, `;` o salto de línea), el notebook los separa
en filas independientes automáticamente.

### 1.5 Finalizaciones (`Cobranza P*.csv` / `Cobranza_P*.csv`)

Puede haber uno o varios archivos (uno por corte parcial del mes, `P1`, `P2`,
`P3`, ...); se concentran todos sin límite fijo.

| Columna | Uso |
|---|---|
| `Número Persona` | llave del cruce contra las asignaciones que aplican |
| `Nombre Curso` | llave del cruce (debe calzar **exacto** contra `Curso` del plan) |
| `¿Lo Completó?` | `Si`/`No` → determina si esa fila cuenta como completada |
| `Fecha Finalizado` | se conserva pero no participa en ningún cálculo |

## 2 · Reglas de negocio y cruces

### 2.1 Puesto → cursos que aplican

- **General**: producto cartesiano — cada puesto de "Colaboradores asignados" ×
  cada curso de "Cursos asignados" (sin restricción de centro).
- **Específico**: producto cartesiano por combinación puesto+centro — cada fila de
  "Colaboradores específicos" (ya explotada por centro) × cada curso de "Cursos
  específicos". Un curso específico **solo** aplica si la persona está en el
  centro indicado.
- El emparejamiento puesto↔puesto es por `texto_clave` (sin acentos, mayúsculas,
  un solo espacio) sobre `Nombre de puesto` (Detalle) vs. `Puesto` (Plan) — no por
  el código numérico de puesto.

### 2.2 Los dos planes se suman

El plan final es la **unión** de Colaborador y Gerencial — nunca un reemplazo. Un
puesto que exista en ambos (p. ej. 721 Gerente de Operación Cobranza o 743 Jefe de
Operación Cobranza, presentes tanto en la especialización de conductores del plan
de Colaborador como en la malla del plan Gerencial) recibe los cursos de **los
dos** planes. La validación `personas_ambos_planes` (sección 7 del notebook)
existe justo para confirmar que esto está pasando como se espera, no por error.

### 2.3 Centro y Región de Cobranza (cascada de 3 niveles)

El Centro de cada persona se resuelve en este orden, usando la Planta por
Posiciones más reciente:

1. **Por número de persona** (`Número de trabajador` == `Número de persona`) — el
   más confiable.
2. Si no se encontró: **por nombre único** — solo si ese nombre normalizado
   apunta a un único Centro en toda la Planta.
3. Si tampoco: **por departamento único y sin contradicciones** — solo si ese
   departamento apunta a un único Centro, Y ese Centro no contradice el que ya se
   le conoce a alguna persona individual de ese mismo departamento (si contradice,
   el departamento completo se descarta como fuente confiable).
4. Si ninguno de los tres resuelve, el Centro queda como `"Pendiente"`.

La **Región Cobranza** nunca sale de la columna `Región` cruda de Detalle
Colaborador — sale de cruzar el Centro ya resuelto contra `CENTROS-TIPOCENTROS`
(columna `REGION COBRANZA`). Las 15 regiones oficiales son:

```
TORREON, CULIACAN, HERMOSILLO, MEXICALI, LEON, MONTERREY, TOLUCA, GUADALAJARA,
QUERETARO, CUAUTITLAN IZCALLI, PUEBLA, VERACRUZ, IXTAPALUCA, VILLAHERMOSA, MERIDA
```

Cualquier región resuelta que no esté en esta lista se imprime como aviso en la
sección 7 (posible Centro mal catalogado en `CENTROS-TIPOCENTROS`).

### 2.4 Antigüedad y vigencia del curso

`dias_laborados = fecha_corte − fecha_contratacion`. Personas con fecha de
contratación posterior al corte se descartan (dato inconsistente). Un curso solo
aplica a una persona si `dias_laborados >= mínimo_del_rango × 30`.

### 2.5 Excepción "Centro de Impresión de Cobranza"

Los puestos **743** y **721**, en 12 centros de costos específicos catalogados
como "Centro de Impresión de Cobranza", están exceptuados de la especialización
de conductores. El notebook **no programa la exclusión a mano**: confía en que la
pestaña "Colaboradores específicos" del plan de Colaborador ya la refleje. Lo que
sí hace es **validar** (sección 7): avisa si alguna persona con puesto 743/721 en
esos 12 centros terminó recibiendo la especialización de todas formas — señal de
que la fuente no aplicó bien la excepción. Esta excepción es exclusiva del plan de
**Colaborador**: el plan Gerencial es una malla aparte que sí les toca a 721/743
sin importar el centro.

### 2.6 Cruce con finalizaciones (sin deduplicar)

Cada asignación que aplica (persona + curso) se cruza contra las finalizaciones
por **nombre exacto** de curso (`Curso` del plan == `Nombre Curso` del CSV) y por
`Número de persona`. Si el nombre no calza exactamente entre ambos archivos, el
curso queda siempre como pendiente — la sección 7 imprime la lista de cursos del
plan que nunca encontraron ninguna coincidencia, para detectar desajustes de
nombre rápido.

Los duplicados persona+curso **no se eliminan**: si una persona aparece dos veces
completando el mismo curso (por ejemplo repetida en dos archivos `P1`/`P2`), cada
duplicado suma tanto a `Total` como a `Completados` — mismo comportamiento que
tenía el SQL legado (`Tuberia/Cobranza.sql`).

### 2.7 Control de calidad (sección 7 del notebook)

Antes de exportar, el notebook corre 3 validaciones y las imprime:

1. Excepción de Impresión (2.5) — debería dar 0 personas.
2. Personas con cursos de ambos planes (2.2) — informativo, confirma que la suma
   de planes está funcionando.
3. Control algebraico — el total de asignaciones y completados debe coincidir
   exactamente entre las dos salidas finales (Detalle Colaborador y Avance por
   curso/región/centro); si no coinciden, algo se perdió en el camino.

## 3 · Resultados / salidas

### 3.1 `Detalle Colaborador Cobranza {Mes Año}.csv`

Una fila por persona (agrupado desde las asignaciones que aplican):

| Columna | Contenido |
|---|---|
| `Número de persona` | identificador de la persona |
| `Nombre` | nombre completo |
| `Fecha de contratación de la empresa` | tal como viene en Detalle Colaborador |
| `Código de puesto` | código numérico de puesto |
| `Nombre de puesto` | nombre de puesto |
| `Región` | Región Cobranza resuelta (2.3), no la región cruda |
| `Nombre del departamento` | tal como viene en Detalle Colaborador |
| `Centro` | Centro resuelto (2.3), o `"Pendiente"` si no se pudo resolver |
| `Fecha corte` | la fecha de corte configurada en la sección 0 |
| `Dias laborados` | antigüedad en días al corte |
| `Total` | cantidad de cursos asignados (Colaborador + Gerencial, general + específico) |
| `Completados` | cuántos de esos cursos están marcados como completados |
| `Pendientes` | nombres de los cursos pendientes, separados por coma, en el orden en que se armó el plan |

### 3.2 `Avance Curso Región Centro Cobranza {Mes Año}.csv`

Una fila por combinación curso + región + departamento + centro:

| Columna | Contenido |
|---|---|
| `Curso` | nombre del curso |
| `Región` | Región Cobranza resuelta |
| `Nombre del departamento` | departamento crudo de Detalle Colaborador |
| `Centro` | Centro resuelto, o `"Pendiente"` |
| `Total` | asignaciones de ese curso en esa combinación |
| `Completados` | cuántas de esas asignaciones están completadas |

`Total`/`Completados` de este archivo deben sumar exactamente lo mismo que los de
3.1 (es el control algebraico de la sección 7).

### 3.3 `cobranza.macintosh.json` (paquete para el tablero)

No es para lectura humana — se sube directo al tablero (Apps Script) con el botón
**"Actualizar datos"**. Trae 5 hojas, todas derivadas de los mismos DataFrames de
3.1/3.2 (no vuelve a leer los CSV):

| Hoja | Una fila por... | Columnas (en orden) |
|---|---|---|
| `Resumen` | el reporte completo (una sola fila) | reporte, etiqueta del mes, fecha de corte, colaboradores, asignados, completados, pendientes, avance |
| `Regiones` | Región Cobranza | región, colaboradores (personas únicas), asignados, completados, pendientes, avance |
| `Cursos` | curso | curso, curso_clave (vacío, el tablero lo calcula solo), asignados, completados, avance |
| `Puestos` | puesto distinto | puesto |
| `Colaboradores` | persona | nombre, número de empleado, centro, puesto, región, total asignados, total completados, cursos pendientes (` \| `-separados), cursos asignados (` \| `-separados) |

El esquema completo (tipos, ejemplo de payload) está documentado también al
inicio de `src/DataService.gs`, del lado del tablero.
