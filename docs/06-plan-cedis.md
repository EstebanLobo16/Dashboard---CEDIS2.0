# Plan de trabajo · Tablero de CEDIS

Réplica del tablero de Cobranza para CEDIS: los mismos indicadores, la misma
interfaz, las mismas siete tablas del corte. Cambian las reglas de negocio y,
sobre todo, **de dónde sale el padrón**.

Este documento se escribió después de leer el repo completo (los 16 archivos de
Apps Script, los seis manuales y las seis herramientas de `pipeline/`), el PDF de
lógicas de las tres áreas, y **los seis archivos reales de CEDIS**, medidos uno
por uno. Todos los números que aparecen aquí salieron de esos archivos, no de una
estimación.

> **Revisión 2** — incorpora `CEDIS P2.csv`, que llegó después de la primera
> lectura, y las cuatro decisiones del área ya confirmadas (§5). Con P2, el
> hueco de 14 cursos sin fuente **queda cerrado**.

---

## 1. Cuidado con renombrar el .zip desde la web

`Archivos base/Archivos_alimentacion.zip` se ha subido dos veces al repo, y las
dos veces se destruyó al renombrarlo desde la interfaz web de GitHub: quedó un
archivo de texto de **2 bytes** en lugar de 12.6 MB (`ac22297`) y de 15.9 MB
(`715c24b`).

Las dos veces se recuperó del commit de subida —`512210b` y `b8725fc`— que
todavía lo tenía íntegro. **Si hay que moverlo otra vez, con `git mv` desde la
consola.** Desde la web, no.

---

## 2. Los datos de CEDIS, medidos

### Lo que hay

| Archivo | Filas | Personas | Cursos |
|---|---:|---:|---:|
| `CEDIS P1.csv` (96 MB) | 257,918 | 15,124 | 12 |
| `CEDIS P2.csv` (88 MB) | 243,053 | 15,252 | 15 |
| `CEDIS P3.csv` (6 MB) | 16,644 | 5,181 | 3 |
| `PDT-operacion-adaptado.xlsx` | 4 pestañas | 46 puestos | 19 |
| `PDT-gerencial-adaptado.xlsx` | 4 pestañas | 57 puestos | 22 |
| `detalle_colaborador.xlsx` | 123,097 | toda la empresa | — |

Los tres CSV **no se traslapan entre sí**: cada uno trae cursos distintos, 30 en
total. No son cortes parciales del mismo universo, como en Cobranza.

Pero **sí se repiten por dentro**: entre los tres hay 517,615 filas para 425,811
pares persona×curso, o sea **91,804 repeticiones (17.7%)**. La mayoría están
dentro de P1 (76,430). `DEDUPLICAR_FINALIZACIONES = SI` no es una preferencia:
sin él el avance se calcula sobre un denominador inflado en una sexta parte.

### El padrón: 15,252 personas, con el 100% de sus fechas

| | Cobranza | CEDIS |
|---|---|---|
| Padrón | Planta por Posiciones | **no existe** |
| Personas leídas | 12,278 | 15,252 |
| Sin fecha de puesto | 1,139 (9.3%) | **0** |
| Publicadas | 11,094 | **15,018** (−76 centinela, −158 futura) |

Los CSV de CEDIS traen `Fecha Contratación` y `Fecha Asignación Puesto` en
**todas** sus filas, y además `Región RRHH`, `Centro Costos`, `Área`,
`Departamento`, `Puesto` y `Tipo Posición`. Es decir: el reporte de asignaciones
ya es, él mismo, el censo del área.

Eso hace desaparecer el problema que más costó en Cobranza. A cambio abre uno
nuevo, que es la decisión de fondo de este proyecto (§5, decisión 1) —**ya
confirmada por el área**.

Del padrón, el Detalle Colaborador encuentra al **98.6%** por número de persona,
y de esos las fechas de asignación de puesto coinciden en el **99.0%**. El Detalle
sirve de contraste, no de fuente principal.

Con corte al 2026-08-31: mediana de **471 días en el puesto**, **76 fechas
centinela** (`1 ene 1900`) y **158 fechas posteriores al corte**.

### Los 30 cursos del plan cruzan, con dos alias

Con los tres CSV, solo **3 de los 30 cursos** del plan no encuentran fuente, y los
tres se explican sin tocar los datos:

| Curso del plan | Qué pasa | Remedio |
|---|---|---|
| `Formación de Conductores CEDIS 2026` | **No es un curso**: es el nombre de la especialización que forman los otros tres | `Agrupaciones` |
| `Introducción a la Seguridad y Salud Laboral CEDIS` | En las finalizaciones y en el plan gerencial se llama `…Laboral **en** CEDIS` | `AliasCursos` |
| `Socialización del Código de Ética` | En las finalizaciones se llama `…de Ética **Para Líderes**` | `AliasCursos` |

El tercero es, **palabra por palabra, el mismo alias que ya existe en Cobranza**.
Se hereda tal cual.

Con esos tres renglones de catálogo, **`cursosDelPlanSinFuente = 0`**.

Sobran cuatro cursos que están en las finalizaciones y en ningún plan
—`Visionarios temporada 1` y `2`, `Conviértete en Colaborador Digital`, y
`Socialización del Código de Ética Para Líderes` una vez resuelto el alias—. No
estorban: el motor solo busca lo que el plan pide.

### Las 26 regiones cuadran

El PDF pide las 26 regiones nacionales y los datos traen exactamente 26. **23
empatan solas** con la normalización que ya existe (`textoClave_`). Tres no:

| En los datos | En el PDF | Qué hacer |
|---|---|---|
| `Azcalpotzalco` | Azcapotzalco | Está mal escrito **en la fuente**. Va a `MapaRegiones` y se avisa al dueño |
| `Ciudad Juárez` | CD Juarez | El nombre bueno es el de los datos |
| `Cuautitlán Izcalli` | Cuautitlán Izca | El PDF viene truncado; el bueno es el de los datos |

### Los 34 centros de costo cuadran al 100%

Los 34 centros de costo que el PDF manda considerar aparecen todos en los datos,
y **no hay ninguno fuera de la lista**. La lista blanca del PDF es confirmatoria:
no saca a nadie. Se siembra igual, para que el día que aparezca uno nuevo el
tablero avise en vez de contarlo en silencio.

### Los puestos: 76 de 120 tienen plan

De los 120 puestos del padrón, **76 están en algún plan** (15,026 personas) y 44
no (**226 personas, 1.5%**).

P2 trajo 32 puestos nuevos, y casi todos son de una misma familia: **Importación y
Aduanas** — `ANALISTA DE LOGISTICA IMPORTACION`, `ASESOR DE SERVICIOS ADUANALES`,
`GERENTE DE DESPACHO ADUANAL`, `DOCUMENTADOR DE IMPORTACION`… Están dentro de los
centros de costo de CEDIS (064 Importación STAFF, 441, 443, 458, 093, 094) pero
ningún PDT los nombra. Es la pregunta abierta de §5.

`COORDINADOR DE TRANSPORTE` no es un huérfano cualquiera: el plan gerencial lo
llama **`COORDINADOR`** a secas, y sus 26 personas **sí tienen la especialización**
en P3. Es un alias de puesto, y hoy no existe el catálogo para resolverlo (§6,
etapa 2).

Nadie de estos 44 mueve el avance —aportan 0 asignados y 0 completados—, pero sí
aparecen en el tablero con "0 de 0 cursos", que es lo primero que va a preguntar
quien filtre por su centro.

---

## 3. Las siete diferencias de fondo con Cobranza

Ninguna es cosmética. Cada una toca código.

### 3.1 No hay Planta por Posiciones ni catálogo de centros

Cobranza tiene dos cosas que CEDIS no: un censo del área y un catálogo
`CENTROS-TIPOCENTROS` que traduce centro → región, nomenclatura y tipo. En CEDIS
el propio reporte de finalizaciones trae la región y el centro de costo por
persona. Se cae, entonces, media ingesta: `planta_posiciones`,
`centros_tipocentros` y `planta_centro` dejan de existir.

### 3.2 El "centro" de CEDIS es el Departamento

| Cobranza | CEDIS |
|---|---|
| `centro` = 6 dígitos (500306) | `centro` = **Departamento** (`07 CEDIS CROSS OAXC 02`) |
| `nomenclatura` = del catálogo | `nomenclatura` = **Centro Costos** (`045 - DISTRIBUCION FORANEA`) |
| `tipo_cobranza` = del catálogo | `tipo_centro` = **Área** (CEDIS / STAFF / TIENDAS / ZONA) |

Son **730 departamentos** repartidos en las 26 regiones (43 en Tecámac, 33 en
Monterrey…), con prefijos `07` (643), `05` (58), `06` (28) y `04` (1). La columna
`tipo_cobranza` del esquema se renombra a `tipo_centro` — es el único cambio de
contrato de datos en todo el proyecto.

### 3.3 El encabezado del PDT gerencial está corrido una columna

Éste es el hallazgo que más caro sale si no se atiende, porque **no truena: miente**.

En `PDT-gerencial-adaptado.xlsx`, pestaña `Cursos_asignados`, la fila 1 trae 12
encabezados pero los datos empiezan con una columna de numeración que el
encabezado no nombra:

| | A | B | C | D | … | G |
|---|---|---|---|---|---|---|
| **Encabezado** | Tipo | Rango de meses | Curso | Modalidad | … | Jefes y Coordinadores |
| **Dato real** | 1 | Institucional | 0-1 | Te damos la bienvenida… | … | TEC-C-3-99 |

`leerPestana_` mapea por nombre de encabezado. Tal como está, leería **"0-1" como
nombre del curso**, "Institucional" como rango de meses, y el ID del curso como la
marca de la matriz de niveles. Los 22 cursos del plan gerencial saldrían mal, y el
tablero publicaría un número que se ve razonable y no lo es.

`PDT-operacion-adaptado.xlsx` **sí está alineado**. El defecto es solo del gerencial.

Hay dos remedios y el plan toma el segundo: corregir el archivo a mano cada mes es
frágil; detectar el corrimiento en la ingesta lo resuelve para siempre (§6, etapa 2).

### 3.4 La columna de centros está invertida

| | Cobranza | CEDIS |
|---|---|---|
| Columna | `Centros que no aplican` | **`Centros que si aplican`** |
| Semántica | lista negra | **lista blanca** |

Cobranza excluye 12 centros del Centro de Impresión. CEDIS **incluye** 9 centros de
costo (157, 153, 152, 094, 073, 064, 045, 013, 006) y excluye todo lo demás.
`centrosExcluidos_()` y `alcanceDeCentros_()` tienen que aprender las dos formas.

Además, la columna `Centros de costos` del gerencial viene **vacía**, así que el
alcance sale enteramente de `Centros que si aplican`. Y ojo con el formato: los
valores son `"045 Distribución Foráneo"`, no `"045"` — `soloDigitos_()` ya los
resuelve.

### 3.5 `Colaboradores_especificos` del plan de operación está vacío

Solo tiene encabezados. Pero la especialización **sí llega a puestos de
operación**: en P3 aparecen 3,587 CHOFER DE DISTRIBUCION, 848 CHOFER DE MUDANZA
TIPO E, 411 CHOFER DE MUDANZA y 12 CHOFER — **4,858 personas** cuya especialización
el tablero no vería.

El PDF (página 3) sí los nombra: 44 CHOFER, 1047 CHOFER DE DISTRIBUCIÓN, 395 CHOFER
DE MUDANZA TIPO E, 45 CHOFER DE MUDANZA, más los cuatro gerenciales (1078
SUPERVISOR DE DISTRIBUCIÓN, 41 GERENTE DE DISTRIBUCIÓN, 1049 COORDINADOR, 1057
GERENTE DE TRANSPORTE). Los ocho coinciden exactamente con los ocho puestos que
tienen la especialización en los datos.

Es el mismo hallazgo 4 de Cobranza —una restricción que el archivo no dice y el
tablero tiene que saber— y se resuelve igual: sembrando el dato en el catálogo,
donde el área lo puede corregir sin tocar código.

### 3.6 El filtro de categoría Operación ya viene casi aplicado

El PDF lo pide explícitamente para CEDIS. En los datos, `Tipo Posición` vale
`OPERACION` en el 100% de P1 y en 241,107 de 243,053 filas de P2 (1,946 en
`STAFF`), más 13 filas de P3.

Se enciende `FILTRAR_CATEGORIA_OPERACION = SI`: es la regla escrita, cuesta nada, y
el día que el área exporte sin filtrar, el tablero no se mueve.

### 3.7 "Exenta" y "Finalización omitida" cuentan como completadas

`¿Lo Completó?` no es un reflejo de `Sub Estatus Aprendizaje`:

| `¿Lo Completó?` | `Sub Estatus` | Filas |
|---|---|---:|
| **Si** | Completado | 260,094 |
| **Si** | **Finalización omitida** | **42,315** |
| No | **Exenta** | **7,224** |
| No | el resto (No iniciado, En curso, Retirado, "-"…) | 207,982 |

El área confirmó que **las dos cuentan como completadas** (§5, decisión 3). Las
`Finalización omitida` ya venían del lado correcto porque `¿Lo Completó?` dice
`Si`; **las 7,224 `Exenta` no**, y por eso esta decisión sí cuesta código: el motor
tiene que dejar de mirar una sola columna.

Sobre los pares deduplicados: con la regla nueva, **229,760 de 425,811 (54.0%)**
quedan como completados.

---

## 4. El bloqueo de la revisión 1 · resuelto

En la primera lectura solo estaban P1 y P3, y **14 de los 30 cursos del plan no
tenían ni una finalización**: el avance habría salido artificialmente bajo, no por
error del motor sino por una fuente incompleta.

`CEDIS P2.csv` llegó con exactamente esos 14 cursos (más
`Socialización del Código de Ética Para Líderes`, que es el alias del quinceavo).
**Ya no hay bloqueo.** El ensayo de la etapa 7 puede correr.

---

## 5. Las decisiones del área

Las cuatro quedaron confirmadas. Se anotan aquí porque el número publicado depende
de ellas y porque cambiar de opinión debe ser cambiar un renglón del catálogo, no
volver a discutir.

| # | Decisión | Confirmado | Qué implica |
|---|---|---|---|
| **1** | ¿Quién es el padrón de CEDIS? | **Las 15,252 personas del reporte de asignaciones** | `PADRON = FINALIZACIONES`, un valor nuevo. La alternativa (`DETALLE` filtrado por puesto) arrastra gente de otras áreas con el mismo nombre de puesto —`ASISTENTE`, `SECRETARIA`, `COORDINADOR`—: es el hallazgo 5 de Cobranza otra vez |
| **2** | ¿Falta `CEDIS P2.csv`? | **Sí — y ya llegó** | Los 30 cursos del plan cruzan (§2) |
| **3** | ¿"Finalización omitida" y "Exenta" cuentan como completadas? | **Las dos, sí** | `esAfirmativo_()` deja de bastar: hay que leer `Sub Estatus Aprendizaje`. 7,224 finalizaciones cambian de lado (§6, etapa 4) |
| **4** | Los 76 `1 ene 1900` y las 158 fechas futuras | **Tratarlas como "sin fecha"** | Parámetro nuevo `FECHA_MINIMA_VALIDA`. Sin él el centinela pasa como 46,000 días de antigüedad y recibe el plan completo, sin aviso |

### Lo único que queda abierto

**Los 44 puestos sin plan (226 personas, 1.5%)**, casi todos de Importación y
Aduanas (§2). No bloquean nada —aportan 0 asignados y 0 completados, así que no
mueven el avance— pero van a aparecer en el tablero con "0 de 0 cursos".

Tres salidas, y la recomendación es la primera:

1. **Publicarlos y decirlo.** El diagnóstico ya cuenta `personasSinPlan`; basta con
   que el tablero lo muestre. Es honesto y es información: si a Importación le
   toca plan y no lo tiene, esto lo hace visible.
2. Sacarlos del padrón por centro de costo. Pierde visibilidad y hay que mantener
   una lista.
3. Pedirle al área el PDT de Importación, si existe.

No hace falta responder para empezar: afecta la etapa 5, no la 2 ni la 3.

---

## 6. Las etapas

Siete etapas. Cada una deja algo verificable, y las tres primeras son las que
tienen trabajo de verdad.

### Etapa 0 · Preparar el repo · ½ día

- [x] Rescatar `Archivos_alimentacion.zip` del historial, las dos veces *(hecho)*
- [x] `Archivos base/README.md` con el inventario y la advertencia del renombrado *(hecho)*
- [x] Este documento *(hecho)*
- [ ] Descomprimir a `Archivos base/crudos/` (ya ignorado por git) para los ensayos

### Etapa 1 · La identidad del reporte · ½ día

Mecánico y de bajo riesgo. `00_Config.gs` completo:

```js
reporte: 'cedis',
nombreReporte: 'CEDIS',
titulo: 'Plan de Capacitación · CEDIS',
archivos: { catalogos: 'CED · Catálogos', corte: 'CED · Corte vigente', historico: 'CED · Histórico' },
carpetas: { base: 'Tablero CEDIS', crudos: 'Datos crudos', archivo: 'Cortes archivados' },
props:    { catalogos: 'CED_ID_CATALOGOS', … },   // los nueve, con prefijo CED_
paquete:  { formato: 'cedis-report-package', version: 1 },
```

Y tres cosas que no están en `00_Config.gs` y hay que buscar a mano:

| Archivo | Qué | Por qué |
|---|---|---|
| `04_Catalogos.gs` | `cob_cat_` → `ced_cat_` | La llave de caché. Dos tableros en el mismo proyecto se pisarían |
| `60_Operacion.gs` | El menú *Cobranza* → *CEDIS* | Cuatro menciones |
| `Index.html`, `JavaScript.html`, `Stylesheet.html` | Los textos visibles | 13 menciones. Nada de estructura |

`01_Esquema.gs` cambia en **una** columna: `tipo_cobranza` → `tipo_centro`, en
`Centro`. Hay que tocarla también en `30_Motor.gs` (4 sitios) y en
`pipeline/celda_paquete_cobranza.py`.

**Verificación:** `instalar()` crea las tres hojas y las dos carpetas con nombres
CED, y `estado()` las reporta.

### Etapa 2 · La ingesta · 3 días

Es la etapa con más trabajo, porque las fuentes de CEDIS no se parecen a las de
Cobranza. `20_Fuentes.gs` pasa de cinco fuentes a **cuatro**:

| Fuente | Patrón | Papel |
|---|---|---|
| `padron` | `cedis?padron*.csv` | **El censo.** Una fila por persona (etapa 6) |
| `finalizaciones` | `cedis?finalizaciones*.csv` | Persona × curso × estatus |
| `pdt_operacion` | `*operaci?n*.xlsx` | Plan Colaborador |
| `pdt_gerencial` | `*gerencial*.xlsx` | Plan Gerencial |
| `detalle_colaborador` | `*detalle?colaborador*.xlsx` | **Opcional.** Contraste de fechas |

Se van `planta_posiciones`, `centros_tipocentros` y `planta_centro`, y con ellas
`filaDelEncabezado_()` y `pestanaMasReciente_()` (que existían solo para la
Planta). Eso simplifica la ingesta y **quita la fuente más lenta de convertir**.

Cinco piezas nuevas:

1. **`padronDesdeFinalizaciones_()`** — lee el archivo de padrón: nombre, región,
   centro de costo, área, departamento, puesto, tipo de posición y las dos fechas.
   Sustituye a `resolverPadron_()` sobre la Planta. La cascada de identificadores y
   el puente persona↔colaborador **se conservan tal cual**: en los datos de CEDIS
   `persona ≠ colaborador` en 202,707 de 517,615 filas, así que el puente sigue
   siendo necesario.

2. **`detectarCorrimiento_()`** — antes de mapear encabezados, comprobar si la fila
   de datos está corrida respecto a la fila 1 (§3.3). La prueba es barata: si la
   columna que dice llamarse `Curso` trae valores con forma de rango (`0-1`,
   `0-3`, una fecha) en más de la mitad de las filas, el encabezado está corrido
   una posición. Se corrige el mapeo y **se deja aviso en el diagnóstico**.
   Nunca en silencio.

3. **`Centros que si aplican` como lista blanca** — `alcanceDeCentros_()` recibe la
   lista de inclusión y `centrosExcluidos_()` sigue leyendo la de exclusión. Las
   dos columnas coexisten; gana la que traiga datos.

4. **`AliasPuestos`** — pestaña nueva del catálogo, con el esquema
   `['puesto_en_datos', 'puesto_en_plan', 'nota']`. Se siembra con
   `COORDINADOR DE TRANSPORTE → COORDINADOR` (§2).

5. **El centro de costo como eje** — `centro` = Departamento, `nomenclatura` =
   Centro Costos, `tipo_centro` = Área.

**Verificación:** `node pipeline/probar_ingesta.js — si` con las fuentes de CEDIS.
La segunda corrida tiene que hacer **0 conversiones y 0 duplicados**, igual que en
Cobranza. Correrlo antes y después de tocar `20_Fuentes.gs`, sin excepción.

### Etapa 3 · Las semillas y los parámetros · 2 días

Todo el contenido de `02_Semillas.gs` se reemplaza. Nada se inventa: cada renglón
sale del PDF o de los archivos medidos.

| Semilla | Contenido de CEDIS |
|---|---|
| `Regiones` | Las **26**, en el orden del PDF |
| `MapaRegiones` | Los **3** renglones de §2 |
| `AliasCursos` | **2**: `Introducción a la Seguridad y Salud Laboral CEDIS` → `…Laboral **en** CEDIS`, y `Socialización del Código de Ética` → `…**Para Líderes**` (heredado tal cual de Cobranza) |
| `AliasPuestos` | `COORDINADOR DE TRANSPORTE` → `COORDINADOR` |
| `Agrupaciones` | `Formación de Conductores CEDIS 2026` = sus 3 cursos (OLC5745710, OLC5753661, OLC5753667) |
| `NivelesGerencial` | Los **57** puestos del plan gerencial contra los 6 niveles de la matriz. **Es el renglón de trabajo más largo y no se puede adivinar** |
| `CentrosPermitidos` | Los **34** centros de costo del PDF (reemplaza a `ExcepcionImpresion`) |
| `PuestosEspecializacion` | Los **8** puestos de la especialización, con su ID (§3.5) |
| `Fuentes` | Los 5 patrones de la etapa 2 |

Parámetros que cambian respecto a Cobranza:

```
PADRON                      = FINALIZACIONES     (valor nuevo; decisión 1)
FILTRAR_CATEGORIA_OPERACION = SI                 (el PDF lo pide)
FAMILIA_CENTRO_COSTOS       = (vacío)            (CEDIS tiene 34, no una)
FECHA_MINIMA_VALIDA         = 1950-01-01         (nuevo; decisión 4)
SUBESTATUS_COMPLETADOS      = Exenta             (nuevo; decisión 3)
BASE_ANTIGUEDAD             = PUESTO             (igual)
DEDUPLICAR_FINALIZACIONES   = SI                 (igual, y aquí pesa más: 17.7%)
```

Los dos parámetros nuevos tocan `30_Motor.gs`; ver la etapa 4.

### Etapa 4 · El motor · 1 día

El motor es genérico y casi no se toca. Cinco cambios, todos chicos:

| Dónde | Qué |
|---|---|
| `indiceCentros_()` | Se elimina. El centro ya viene resuelto en cada fila del padrón |
| `filtrarPadron_()` | `FECHA_MINIMA_VALIDA` (decisión 4); `soloOperacion` compara contra `Tipo Posición` |
| `indiceFinalizaciones_()` | **Decisión 3.** Una finalización cuenta si `¿Lo Completó?` dice `Si` **o** si su `Sub Estatus` está en `SUBESTATUS_COMPLETADOS`. Hoy solo mira la primera columna |
| `normalizarCursos_()` | Sin cambios — la agrupación y los alias ya son catálogo |
| `acumular_()` / `armarTablas_()` | `tipoCobranza` → `tipoCentro` |

**Verificación:** `node pipeline/correr_motor.js fuentes.json` contra las fuentes
de CEDIS, sin desplegar nada. El control algebraico tiene que cuadrar:
Colaborador y Curso suman lo mismo que el Resumen.

### Etapa 5 · El tablero · 1 día

Estructura y CSS **sin cambios**. Solo textos y etiquetas:

- «Centro» sigue diciendo Centro, pero muestra el departamento
- La columna nueva `tipo_centro` en la vista de centros
- 26 regiones en el ranking en vez de 15 — el panel ya pagina con `regionsMore`
- **Los 44 puestos sin plan** (§5): mostrar `personasSinPlan` en el encabezado, para
  que "0 de 0 cursos" tenga explicación
- `reportesDisponibles_()` en `90_WebApp.gs`: aquí es donde CEDIS y Cobranza se
  enlazan, con la misma mecánica de salto entre despliegues del tablero de Tienda

**Verificación:** `node pipeline/montar_tablero.js` arma el HTML abrible con datos
reales de CEDIS, sin desplegar.

### Etapa 6 · El aligerado · 1 día

Los tres CSV suman **200 MB**. `CEDIS P1.csv` pesa 96 MB y `CEDIS P2.csv` 88 MB,
contra un límite de conversión de Drive de 100 MB: pasan, pero por poco.
`celda_aligerar_csv.py` deja de ser opcional y **pasa a ser obligatoria**.

Y cambia de forma. En Cobranza emitía **un** archivo de 7 columnas. Aquí eso no
alcanza: como el padrón sale del propio CSV, harían falta 14 columnas, y el
resultado son **90.3 MB en un solo archivo** — otra vez pegado al límite, y encima
repitiendo el nombre, el departamento y las dos fechas de cada persona en cada una
de sus 28 filas.

La salida es partirlo en dos, que es como el motor los consume de todas formas:

| | Filas | Columnas | Peso |
|---|---:|---:|---:|
| Los 3 originales | 517,615 | 25 | **199.7 MB** |
| Un solo archivo aligerado | 425,811 | 14 | 90.3 MB |
| **`cedis_padron.csv`** | **15,252** | **11** | **2.4 MB** |
| **`cedis_finalizaciones.csv`** | **425,811** | **5** | **30.5 MB** |
| | | | **32.9 MB** |

**Seis veces más chico que un solo archivo, y ninguno cerca del límite.**

`cedis_padron.csv` — `Número Persona`, `Número Colaborador`, `Nombre Colaborador`,
`Región RRHH`, `Centro Costos`, `Área`, `Departamento`, `Puesto`, `Tipo Posición`,
`Fecha Contratación`, `Fecha Asignación Puesto`.

`cedis_finalizaciones.csv` — `Número Persona`, `Número Colaborador`,
`Nombre Curso`, `¿Lo Completó?`, `Sub Estatus Aprendizaje`.

El script tiene que **abortar** si alguna columna queda vacía — es exactamente el
error que costó horas en Cobranza, cuando el recorte tiró `Fecha Contratación` y
1,281 personas se cayeron del corte sin explicación. Y tiene que verificar que el
padrón salga con las 15,252 personas y ninguna sin fecha.

### Etapa 7 · El ensayo · 2 días

El equivalente del ensayo de agosto de Cobranza, que es lo que dio confianza para
publicar.

- [ ] `revisarFuentes()` reconoce los cuatro archivos
- [ ] `ensayarCorte('2026-08')` completa y cuadra
- [ ] Los conteos de diagnóstico se revisan uno por uno contra §2 de este documento:
      **padrón 15,252 → 15,018 publicados**, 76 centinela, 158 futura,
      `cursosDelPlanSinFuente = 0`, `personasSinPlan = 226`
- [ ] La especialización le llega a las **5,181 personas** que la tienen en P3
- [ ] `procesarCorte()` en frío, **cronometrado** contra el límite de 1,800 s
- [ ] Los números del ensayo se anotan en el README como referencia

Sobre el tiempo: un corte de Cobranza tarda 15–25 min. CEDIS tiene más personas
(15,252 vs 11,094) y más pares persona×curso (425,811 vs 237,251), pero **menos
archivos que convertir** (4 vs 5) y, después del aligerado, **menos megas**
(32.9 vs 16.9 — el doble, no diez veces). **Hay que medirlo, no suponerlo.** Si se
acerca a 1,800 s, la palanca ya está identificada en el README:
`Utilities.parseCsv()` sobre el blob, sin convertir a hoja.

---

## 7. Lo que NO hay que volver a descubrir

Heredado de Cobranza. Ya costó horas allá; aquí va resuelto de origen:

- **La app web corre la versión desplegada, no la guardada.** Redesplegar cada vez
- **Drive le quita la extensión al convertir.** La caché busca con y sin. No lo "simplifiques"
- **Reemplazar un crudo con el mismo nombre reutiliza la conversión vieja** en
  silencio. El remedio es `limpiarConversiones()`
- **La barra de progreso del tablero es simulada.** La verdad está en *Ejecuciones*
- **El menú no existe sin `automatizar()`**
- **La vigencia se cuenta desde la asignación del puesto**, no desde la
  contratación. Para CEDIS aplica igual: los datos traen las dos fechas y la
  mediana en puesto es de 471 días

Y tres que son de CEDIS:

- **El encabezado corrido del PDT gerencial no truena: miente** (§3.3)
- **Las repeticiones están dentro de cada CSV, no entre ellos.** 17.7% de las filas
- **Renombrar el .zip desde la web lo destruye.** Ya pasó dos veces (§1)

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El PDT gerencial cambia de forma el mes que viene | alta | medio | Detectar el corrimiento, no corregir el archivo a mano |
| `NivelesGerencial` mal armado | media | alto — sobreasigna cursos | Validar contra los datos: un puesto sin nivel recibe todo y el motor ya lo avisa |
| El corte se pasa de 1,800 s | media | alto | Medir en la etapa 7; la palanca de `parseCsv` está identificada |
| Los CSV crecen y rozan los 100 MB | media | medio | El aligerado en dos archivos deja margen de 3× |
| Dos repos divergen | **alta** | medio | Portar a mano cada arreglo, y anotarlo en los dos README |

---

## 9. Calendario

| Etapa | Días | Depende de |
|---|---:|---|
| 0 · Preparar el repo | 0.5 | — |
| 1 · Identidad del reporte | 0.5 | 0 |
| 2 · Ingesta | 3 | 1, 6 |
| 3 · Semillas y parámetros | 2 | 1 |
| 4 · Motor | 1 | 2, 3 |
| 5 · Tablero | 1 | 4 |
| 6 · Aligerado | 1 | 0 |
| 7 · Ensayo | 2 | todas |
| | **11 días** | |

Las etapas 2, 3 y 6 son independientes entre sí y se pueden hacer en paralelo. **Ya
no hay nada esperando insumos del área:** las cuatro decisiones están tomadas y P2
llegó.

---

## 10. Criterios de aceptación

El tablero de CEDIS está terminado cuando:

1. `instalar()` levanta el almacén completo con nombres CED y siembra los catálogos
2. `revisarFuentes()` reconoce los cuatro archivos de CEDIS
3. `ensayarCorte('2026-08')` completa, cuadra el control algebraico y reporta
   `cursosDelPlanSinFuente = 0`
4. El padrón publicado es de **15,018 colaboradores** de 15,252 leídos, y las 234
   exclusiones están explicadas una por una en el diagnóstico
5. Las **26 regiones** aparecen en el ranking, ninguna como `Sin región`
6. La especialización de conductores le llega a las **5,181 personas** que la
   tienen en P3, no a 0
7. `procesarCorte()` publica en menos de 1,800 s
8. El tablero muestra los **mismos indicadores** que el de Cobranza: avance total,
   pendientes, avance mensual, ranking regional, avance por curso, y el detalle de
   pendientes por colaborador
9. Los dos tableros se enlazan desde el selector de reportes
