# Plan de trabajo · Tablero de CEDIS

Réplica del tablero de Cobranza para CEDIS: los mismos indicadores, la misma
interfaz, las mismas siete tablas del corte. Cambian las reglas de negocio y,
sobre todo, **de dónde sale el padrón**.

Este documento se escribió después de leer el repo completo (los 16 archivos de
Apps Script, los seis manuales y las seis herramientas de `pipeline/`), el PDF de
lógicas de las tres áreas, y **los seis archivos reales de CEDIS**, medidos uno
por uno. Todos los números que aparecen aquí salieron de esos archivos, no de una
estimación.

---

## 1. Lo primero: los archivos de CEDIS no estaban en el repo

`base_cedis/Archivos_alimentacion` era un archivo de texto de **2 bytes**. El .zip
original de 12.6 MB se subió bien en `512210b` y se destruyó al renombrarlo desde
la interfaz web de GitHub en `ac22297`.

Ya está recuperado del historial y guardado como
`base_cedis/Archivos_alimentacion.zip`, con su `README.md`. **Sin ese rescate no
había con qué trabajar.**

---

## 2. Los datos de CEDIS, medidos

### Lo que hay

| Archivo | Filas | Personas | Cursos |
|---|---:|---:|---:|
| `CEDIS P1.csv` (96 MB) | 257,918 | 15,124 | 12 |
| `CEDIS P3.csv` (6.4 MB) | 16,644 | 5,181 | 3 |
| `CEDIS P3(1).csv` | — | — | — |
| `PDT-operacion-adaptado.xlsx` | 4 pestañas | 46 puestos | 19 |
| `PDT-gerencial-adaptado.xlsx` | 4 pestañas | 57 puestos | 22 |
| `detalle_colaborador.xlsx` | 123,097 | toda la empresa | — |

`CEDIS P3(1).csv` es **idéntico byte a byte** a `CEDIS P3.csv`. Si los dos caen en
la carpeta de datos crudos, cada finalización de la especialización se cuenta dos
veces. `DEDUPLICAR_FINALIZACIONES = SI` lo neutraliza, pero no hay razón para
subir los dos.

P1 y P3 **no se traslapan**: 0 pares persona×curso en común. No son cortes
parciales del mismo universo como en Cobranza — son cursos distintos. P1 trae los
generales, P3 la especialización.

### El padrón: 15,128 personas, con el 100% de sus fechas

| | Cobranza | CEDIS |
|---|---|---|
| Padrón | Planta por Posiciones | **no existe** |
| Personas | 12,278 → 11,094 publicadas | 15,128 |
| Sin fecha de puesto | 1,139 (9.3%) — se excluyen | **0** |

Los CSV de CEDIS traen `Fecha Contratación` y `Fecha Asignación Puesto` en
**todas** sus filas, y además `Región RRHH`, `Centro Costos`, `Área`,
`Departamento`, `Puesto` y `Tipo Posición`. Es decir: el reporte de asignaciones
ya es, él mismo, el censo del área.

Eso hace desaparecer el problema que más costó en Cobranza. A cambio abre uno
nuevo, que es la decisión de fondo de este proyecto (§5, decisión 1).

Del padrón, el Detalle Colaborador encuentra a **14,919 de 15,128 (98.6%)** por
número de persona, y de esos las fechas de asignación de puesto coinciden en
**14,765 de 14,919 (99.0%)**. El Detalle sirve de contraste, no de fuente
principal.

Con corte al 2026-08-31: mediana de **473 días en el puesto**, y

| Umbral | Personas que lo alcanzan |
|---|---:|
| 0 meses | 14,895 |
| 1 mes | 13,666 |
| 3 meses | 12,391 |
| 4 meses | 11,918 |
| 12 meses | 8,777 |

Hay **76 fechas centinela** (`1 ene 1900`) y **157 fechas posteriores al corte**.
Las primeras hoy pasarían como una antigüedad de 46,000 días — el motor las
aceptaría sin decir nada. Hay que tratarlas (§6, etapa 3).

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

### Los puestos: 74 de 88 tienen plan

De los 88 puestos del padrón, **74 están en algún plan** (15,017 personas) y 14 no
(**111 personas, 0.7%**):

```
COORDINADOR DE TRANSPORTE 26 · GERENTE DE MOTOS 23 · AUXILIAR DE TRASLADO DE
IMPORTACION 19 · SURTIDOR DE CROSS DE IMPORTACION 17 · AUXILIAR GENERAL 9 ·
AUXILIAR DE PISO 4 · AUXILIAR ADMINISTRATIVO 4 · JEFE DE MODULO LINEA EXTENDIDA 2
· JEFE DE SURTIDO DE IMPORTACION 2 · JEFE DE MODULO TIENDA 1 · JEFE DE RESGUARDO 1
· JEFE DE RACK ALTO 1 · JEFE DE TRASLADO DE IMPORTACION 1 · VIGILANTE 1
```

`COORDINADOR DE TRANSPORTE` no es un puesto huérfano cualquiera: el plan gerencial
lo llama **`COORDINADOR`** a secas, y sus 26 personas **sí tienen la
especialización** en P3. Es un alias de puesto, y hoy no existe el catálogo para
resolverlo (§6, etapa 2).

En el otro sentido, 29 puestos del plan no tienen a nadie en los datos. Es normal
—corporativos, puestos vacantes— y no rompe nada.

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

### 3.6 El filtro de categoría Operación ya viene aplicado

El PDF lo pide explícitamente para CEDIS. En los datos, `Tipo Posición` vale
`OPERACION` en el 100% de P1 y en 16,631 de 16,644 filas de P3 (13 en `STAFF`).

Se enciende `FILTRAR_CATEGORIA_OPERACION = SI` de todas formas: es la regla escrita,
cuesta nada, y el día que el área exporte sin filtrar, el tablero no se mueve.

### 3.7 "Finalización omitida" cuenta como completado

`¿Lo Completó?` no es un reflejo de `Sub Estatus Aprendizaje`:

| `¿Lo Completó?` | `Sub Estatus` | Filas |
|---|---|---:|
| **Si** | Completado | 171,303 |
| **Si** | **Finalización omitida** | **33,776** |
| No | Exenta | 6,242 |
| No | el resto (No iniciado, En curso, Retirado…) | 63,241 |

**33,776 finalizaciones (16.5% de todas las "Si") son "Finalización omitida"**, y
**6,242 "Exenta" cuentan como NO completado**. Las dos lecturas son defendibles y
mueven el avance varios puntos. Es la decisión 3 de §5.

---

## 4. El bloqueo: falta `CEDIS P2.csv`

De los 26 cursos distintos del plan, **solo 12 aparecen en las finalizaciones**.
Los 14 restantes no tienen ni una sola fila:

```
Control Interno: protegiendo juntos a Grupo Coppel   Política Anticorrupción de Grupo Coppel
NOM-006-STPS-2023 Almacenamiento y manejo…           Manejo, Transporte y Almacenamiento de Sustancias Químicas
Cuidados en el Manejo de Mercancía                   Conociendo los Centros de Distribución Coppel
Competencias Coppel                                  Agilidad para Grupo Coppel
Cumplimiento: por qué y para qué                     Programa de Integridad Empresarial
Socialización del Código de Ética                    Construcción de un entorno laboral ético
VALORES I · VALORES II · Valores III
```

Los archivos entregados son **P1 y P3**. Falta P2, y su contenido es justo el
tamaño del hueco. Sin él, con `CURSO_SIN_FUENTE = PENDIENTE` esos 14 cursos entran
al denominador y **nadie los completa nunca**: el avance publicado saldría
artificialmente bajo, no por error del motor sino por una fuente incompleta.

También sobran tres cursos que están en las finalizaciones y en ningún plan
—`Visionarios temporada 1`, `Visionarios temporada 2`, `Conviértete en Colaborador
Digital`—. No estorban: el motor solo busca lo que el plan pide.

**El ensayo no puede cerrar sin P2.** Todo lo demás del plan sí avanza sin él.

---

## 5. Las cuatro decisiones que necesito que confirmes

Sin estas cuatro respuestas se puede construir igual —dejo sembrada una
recomendación en cada una y cambiar de opinión es cambiar un renglón del
catálogo—, pero el número publicado depende de ellas.

| # | Decisión | Recomendación | Qué cambia |
|---|---|---|---|
| **1** | **¿Quién es el padrón de CEDIS?** | `PADRON = FINALIZACIONES`: las 15,128 personas del reporte de asignaciones | La alternativa (`DETALLE` filtrado por puesto) arrastra gente de otras áreas con el mismo nombre de puesto —`ASISTENTE`, `SECRETARIA`, `COORDINADOR`—: es el hallazgo 5 de Cobranza otra vez. Y el Detalle no trae centro de costo ni departamento, así que el tablero perdería su eje de centro |
| **2** | **¿Falta `CEDIS P2.csv`?** | Sí, falta | Sin él, 14 de 26 cursos salen en 0% para siempre (§4) |
| **3** | **¿"Finalización omitida" cuenta como completado? ¿Y "Exenta"?** | Respetar `¿Lo Completó?` tal cual: omitida **sí**, exenta **no** | Es lo que ya hace el motor. Si el área lee distinto, son 33,776 y 6,242 finalizaciones que cambian de lado |
| **4** | **Los 76 `1 ene 1900` y las 157 fechas futuras** | Tratar ambas como "sin fecha" y aplicarles `SIN_FECHA_CONTRATACION` | Hoy el centinela pasaría como 46,000 días de antigüedad y recibiría el plan completo, sin aviso |

---

## 6. Las etapas

Siete etapas. Cada una deja algo verificable, y las tres primeras son las que
tienen trabajo de verdad.

### Etapa 0 · Preparar el repo · ½ día

- [x] Rescatar `Archivos_alimentacion.zip` del historial *(hecho)*
- [x] `base_cedis/README.md` con el inventario y la advertencia del renombrado *(hecho)*
- [x] Este documento *(hecho)*
- [ ] Descomprimir a `base_cedis/crudos/` (ignorado por git) para los ensayos
- [ ] `.gitignore` para `base_cedis/crudos/`

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
Cobranza. `20_Fuentes.gs` pasa de cinco fuentes a **tres**:

| Fuente | Patrón | Papel |
|---|---|---|
| `finalizaciones` | `cedis*p*.csv` | **Padrón + finalizaciones + fechas.** Todo |
| `pdt_operacion` | `*operaci?n*.xlsx` | Plan Colaborador |
| `pdt_gerencial` | `*gerencial*.xlsx` | Plan Gerencial |
| `detalle_colaborador` | `*detalle?colaborador*.xlsx` | **Opcional.** Contraste de fechas |

Se van `planta_posiciones`, `centros_tipocentros` y `planta_centro`, y con ellas
`filaDelEncabezado_()` y `pestanaMasReciente_()` (que existían solo para la
Planta). Eso simplifica la ingesta y **quita la fuente más lenta de convertir**.

Cinco piezas nuevas:

1. **`padronDesdeFinalizaciones_()`** — una persona por `Número Persona`, con
   nombre, región, centro de costo, área, departamento, puesto, tipo de posición y
   las dos fechas. Sustituye a `resolverPadron_()` sobre la Planta. La cascada de
   identificadores y el puente persona↔colaborador **se conservan tal cual**: en
   los datos de CEDIS `persona ≠ colaborador` en 101,578 de 274,562 filas, así que
   el puente sigue siendo necesario.

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
| `AliasCursos` | `Introducción a la Seguridad y Salud Laboral CEDIS` → `…Laboral **en** CEDIS`. El plan de operación y el gerencial escriben distinto el mismo curso, y la normalización no alcanza |
| `AliasPuestos` | `COORDINADOR DE TRANSPORTE` → `COORDINADOR` |
| `Agrupaciones` | `Formación de Conductores CEDIS 2026` = sus 3 cursos (OLC5745710, OLC5753661, OLC5753667) |
| `NivelesGerencial` | Los **57** puestos del plan gerencial contra los 6 niveles de la matriz. **Es el renglón de trabajo más largo y no se puede adivinar** |
| `CentrosPermitidos` | Los **34** centros de costo del PDF (reemplaza a `ExcepcionImpresion`) |
| `PuestosEspecializacion` | Los **8** puestos de la especialización, con su ID (§3.5) |
| `Fuentes` | Los 4 patrones de la etapa 2 |

Parámetros que cambian respecto a Cobranza:

```
PADRON                     = FINALIZACIONES     (nuevo valor; decisión 1)
FILTRAR_CATEGORIA_OPERACION = SI                 (el PDF lo pide)
FAMILIA_CENTRO_COSTOS      = (vacío)             (CEDIS tiene 34, no una)
FECHA_MINIMA_VALIDA        = 1950-01-01          (nuevo; decisión 4)
BASE_ANTIGUEDAD            = PUESTO              (igual)
DEDUPLICAR_FINALIZACIONES  = SI                  (igual, y aquí urge: P3(1))
```

`FECHA_MINIMA_VALIDA` es nuevo y toca `filtrarPadron_()` en `30_Motor.gs`: una
fecha anterior se trata como ausente, igual que hoy se trata una posterior al corte.

### Etapa 4 · El motor · 1 día

El motor es genérico y casi no se toca. Cuatro cambios, todos chicos:

| Dónde | Qué |
|---|---|
| `indiceCentros_()` | Se elimina. El centro ya viene resuelto en cada fila del padrón |
| `filtrarPadron_()` | `FECHA_MINIMA_VALIDA`; `soloOperacion` compara contra `Tipo Posición` |
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
- `reportesDisponibles_()` en `90_WebApp.gs`: aquí es donde CEDIS y Cobranza se
  enlazan, con la misma mecánica de salto entre despliegues del tablero de Tienda

**Verificación:** `node pipeline/montar_tablero.js` arma el HTML abrible con datos
reales de CEDIS, sin desplegar.

### Etapa 6 · El aligerado y el rendimiento · 1 día

`CEDIS P1.csv` pesa **96 MB**. El límite de conversión de Drive es 100 MB: pasa,
pero por 4 MB. `celda_aligerar_csv.py` deja de ser opcional y **pasa a ser
obligatoria**.

En Cobranza guardaba 7 columnas. CEDIS necesita **13**, porque el padrón sale del
propio CSV: `Número Persona`, `Número Colaborador`, `Nombre Colaborador`,
`Región RRHH`, `Centro Costos`, `Área`, `Departamento`, `Puesto`,
`Tipo Posición`, `Fecha Contratación`, `Fecha Asignación Puesto`, `Nombre Curso`,
`¿Lo Completó?`.

Medido sobre los archivos reales:

| | Filas | Peso |
|---|---:|---:|
| P1 + P3 originales | 274,562 | 103.4 MB |
| **13 columnas, sin repetir persona+curso** | **197,031** | **40.0 MB** |

El script tiene que **abortar** si alguna de las 13 columnas queda vacía — es
exactamente el error que costó horas en Cobranza, cuando el recorte tiró
`Fecha Contratación` y 1,281 personas se cayeron del corte sin explicación.

Sobre el tiempo: un corte de Cobranza tarda 15–25 min contra un límite de 1,800 s.
CEDIS tiene **más personas (15,128 vs 11,094) pero menos archivos (3 vs 5) y menos
cursos por persona**. La conversión de 40 MB debería ser más barata que la de los
cinco archivos de Cobranza. **Hay que medirlo, no suponerlo:** `ensayarCorte()` en
frío es la prueba, y si se acerca a 1,800 s la palanca ya está identificada en el
README —`Utilities.parseCsv()` sobre el blob, sin convertir a hoja.

### Etapa 7 · El ensayo · 2 días

El equivalente del ensayo de agosto de Cobranza, que es lo que dio confianza para
publicar. **Requiere `CEDIS P2.csv`.**

- [ ] `revisarFuentes()` reconoce los 3 archivos
- [ ] `ensayarCorte('2026-08')` completa y cuadra
- [ ] Los conteos de diagnóstico se revisan uno por uno contra §2 de este documento
- [ ] `cursosDelPlanSinFuente = 0` — **es el termómetro de si P2 llegó**
- [ ] `procesarCorte()` en frío, cronometrado
- [ ] Los números del ensayo se anotan en el README como referencia

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
  mediana en puesto es de 473 días

Y dos que son de CEDIS:

- **El encabezado corrido del PDT gerencial no truena: miente** (§3.3)
- **`CEDIS P3(1).csv` es una copia exacta.** No subir las dos

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| P2 nunca llega | media | **alto** — el avance sale bajo y falso | `CURSO_SIN_FUENTE = EXCLUIR` como paliativo, y decirlo en el tablero |
| El PDT gerencial cambia de forma el mes que viene | alta | medio | Detectar el corrimiento, no corregir el archivo a mano |
| `NivelesGerencial` mal armado | media | alto — sobreasigna cursos | Validar contra los datos: un puesto sin nivel recibe todo y el motor ya lo avisa |
| El corte se pasa de 1,800 s | baja | alto | Medir en la etapa 6; la palanca de `parseCsv` está identificada |
| Dos repos divergen | **alta** | medio | Portar a mano cada arreglo, y anotarlo en los dos README |

---

## 9. Calendario

| Etapa | Días | Depende de |
|---|---:|---|
| 0 · Preparar el repo | 0.5 | — |
| 1 · Identidad del reporte | 0.5 | 0 |
| 2 · Ingesta | 3 | 1 · **decisión 1** |
| 3 · Semillas y parámetros | 2 | 1 · **decisiones 3 y 4** |
| 4 · Motor | 1 | 2, 3 |
| 5 · Tablero | 1 | 4 |
| 6 · Aligerado y rendimiento | 1 | 2 |
| 7 · Ensayo | 2 | todas · **`CEDIS P2.csv`** |
| | **11 días** | |

Las etapas 2 y 3 son independientes entre sí y se pueden hacer en paralelo. Las
etapas 0 a 6 avanzan **sin P2**; solo la 7 lo necesita.

---

## 10. Criterios de aceptación

El tablero de CEDIS está terminado cuando:

1. `instalar()` levanta el almacén completo con nombres CED y siembra los catálogos
2. `revisarFuentes()` reconoce los tres archivos de CEDIS
3. `ensayarCorte('2026-08')` completa, cuadra el control algebraico y reporta
   `cursosDelPlanSinFuente = 0`
4. El padrón publicado es de **~15,000 colaboradores**, y las exclusiones están
   explicadas una por una en el diagnóstico
5. Las **26 regiones** aparecen en el ranking, ninguna como `Sin región`
6. La especialización de conductores le llega a las **~5,181 personas** que la
   tienen en P3, no a 0
7. `procesarCorte()` publica en menos de 1,800 s
8. El tablero muestra los **mismos indicadores** que el de Cobranza: avance total,
   pendientes, avance mensual, ranking regional, avance por curso, y el detalle de
   pendientes por colaborador
9. Los dos tableros se enlazan desde el selector de reportes
