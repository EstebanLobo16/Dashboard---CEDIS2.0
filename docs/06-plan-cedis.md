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

Las cinco quedaron confirmadas. Se anotan aquí porque el número publicado depende
de ellas y porque cambiar de opinión debe ser cambiar un renglón del catálogo, no
volver a discutir.

| # | Decisión | Confirmado | Qué implica |
|---|---|---|---|
| **1** | ¿Quién es el padrón de CEDIS? | **Las 15,252 personas del reporte de asignaciones** | Es la única fuente de censo, así que el parámetro `PADRON` desaparece: una opción con un solo valor no es una opción. La alternativa (`DETALLE` filtrado por puesto) arrastra gente de otras áreas con el mismo nombre de puesto —`ASISTENTE`, `SECRETARIA`, `COORDINADOR`—: es el hallazgo 5 de Cobranza otra vez |
| **2** | ¿Falta `CEDIS P2.csv`? | **Sí — y ya llegó** | Los 30 cursos del plan cruzan (§2) |
| **3** | ¿"Finalización omitida" y "Exenta" cuentan como completadas? | **Las dos, sí** | `esAfirmativo_()` deja de bastar: hay que leer `Sub Estatus Aprendizaje`. 7,224 finalizaciones cambian de lado (§6, etapa 4) |
| **4** | Los 76 `1 ene 1900` y las 158 fechas futuras | **Tratarlas como "sin fecha"** | Parámetro nuevo `FECHA_MINIMA_VALIDA`. Sin él el centinela pasa como 46,000 días de antigüedad y recibe el plan completo, sin aviso |

### Decisión 5 · el universo son los puestos del PDT

Sobre los 44 puestos que ningún PDT nombra —casi todos de Importación y Aduanas
(§2)—, el área resolvió: **basarse solamente en los puestos del PDT.**

Quien ocupa un puesto que no está en ninguno de los dos planes **no entra al
tablero**. No se le inventa un plan, no se le busca uno en otra parte, y no
aparece con "0 de 0 cursos".

Es un parámetro, no código: `PUESTOS_FUERA_DEL_PLAN = EXCLUIR`. El día que
Importación tenga su propio PDT, se agrega la fuente y esas personas entran
solas. Y como toda exclusión en este tablero, **queda contada y con nombre** en el
diagnóstico: `personasSinPlan` dice cuántas fueron y `puestosSinPlan` con qué
puestos, para que "faltan 200 personas" tenga siempre una respuesta.

El padrón publicado queda así:

```
  leídos                        15,252
  − puesto fuera del PDT           200
  − fecha centinela (<1950)         76
  − fecha posterior al corte       157
  = PUBLICADOS                  14,819
```

Son 200 y no 226 porque `COORDINADOR DE TRANSPORTE` sí entra: el plan gerencial lo
llama `COORDINADOR` y el alias de puesto lo resuelve (§6, etapa 2).

---

## 6. Las etapas

Siete etapas. Cada una deja algo verificable, y las tres primeras son las que
tienen trabajo de verdad.

### Etapa 0 · Preparar el repo · ½ día

- [x] Rescatar `Archivos_alimentacion.zip` del historial, las dos veces *(hecho)*
- [x] `Archivos base/README.md` con el inventario y la advertencia del renombrado *(hecho)*
- [x] Este documento *(hecho)*
- [ ] Descomprimir a `Archivos base/crudos/` (ya ignorado por git) para los ensayos

### Etapa 1 · La identidad del reporte · ½ día · **HECHA**

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
`pipeline/celda_paquete.py`.

Se hizo un poco más de lo escrito, y a propósito. En vez de cambiar «Cobranza»
por «CEDIS» en cada archivo, **la identidad se movió a `CONFIG`**: el prefijo de
la caché, el nombre del menú, el asunto de los correos, el nombre de los detalles
archivados y el formato del paquete salen ahora de `CONFIG.reporte` y
`CONFIG.nombreReporte`. El navegador recibe el formato del servidor
(`packageFormat`) en vez de llevarlo escrito.

Cuesta lo mismo hoy y **la tercera réplica —CATd— es un solo archivo**. También
evita el riesgo real de estos dos repos: un arreglo portado a medias que deja una
cadena vieja mintiendo en una pantalla.

`01_Esquema.gs` cambia en **una** columna: `tipo_cobranza` → `tipo_centro`, en
`Centro`. Se tocó también en `30_Motor.gs` (4 sitios) y en
`pipeline/celda_paquete.py`.

De paso, `pipeline/validar_paquete.js` apuntaba con ruta absoluta al repo de
Cobranza (`/home/user/Dashboard---cobranza-2.0/src`): en este repo no corría. Ya
apunta a `../src`.

**Verificación:** `node pipeline/probar_identidad.js` — **17 revisiones, todas
pasan.** Corre sin Apps Script: revisa `CONFIG` y el esquema, prueba que el
validador acepte el paquete de CEDIS y rechace el de Cobranza, y **peina el código
buscando el nombre del área escrito duro** en cualquier cadena (se exceptúan
`00_Config.gs`, `02_Semillas.gs` y el marcado de `Index.html`, que initialize()
sobrescribe). Se verificó que la revisión falla si se reintroduce una cadena vieja.

Falta lo que necesita Apps Script: correr `instalar()` para que cree las tres
hojas y las dos carpetas con nombres CED. **No hacerlo todavía** — `02_Semillas.gs`
sigue trayendo los catálogos de Cobranza y sembraría las reglas equivocadas. Va
después de la etapa 3.

### Etapa 2 · La ingesta · 3 días · **HECHA**

Es la etapa con más trabajo, porque las fuentes de CEDIS no se parecen a las de
Cobranza. `20_Fuentes.gs` pasa de cinco fuentes a **cuatro**:

| Fuente | Patrón | Papel |
|---|---|---|
| `padron` | `cedis?padron*.csv` | **El censo.** Una fila por persona (etapa 6) |
| `finalizaciones` | `cedis?finalizaciones*.csv` | Persona × curso × estatus |
| `pdt_operacion` | `*operaci?n*.xlsx` | Plan Colaborador |
| `pdt_gerencial` | `*gerencial*.xlsx` | Plan Gerencial |
| `detalle_colaborador` | `*detalle?colaborador*.xlsx` | **Opcional.** Contraste de fechas |

El catálogo `Fuentes` se sembró aquí y no en la etapa 3: es el contrato de esta
ingesta, no contenido del área.

Se van `planta_posiciones`, `centros_tipocentros` y `planta_centro`, y con ellas
`filaDelEncabezado_()` y `pestanaMasReciente_()` (que existían solo para la
Planta). Eso simplifica la ingesta y **quita la fuente más lenta de convertir**.

Cinco piezas nuevas:

1. **`leerPadron_()`** — lee el archivo de padrón: los dos identificadores,
   nombre, región, centro de costo, área, departamento, puesto, tipo de posición y
   las dos fechas.

   Y con él, `resolverPadron_()` en el motor se simplifica de golpe. Cobranza
   necesitaba una cascada de tres pasos —id, puente de las finalizaciones,
   nombre único— para cruzar la Planta contra el Detalle, dos sistemas que
   identifican distinto. **Aquí ese problema no existe:** el padrón trae los dos
   identificadores en la misma fila, los dos son únicos y no se cruzan entre sí.
   Se fueron `indiceCentros_()`, `construirPuente_()`, `indicePorNombreUnico_()`
   y `padronDesdeDetalle_()`.

   Los dos identificadores **sí se conservan**, porque siguen haciendo falta:
   difieren en 6,532 de 15,252 personas y las finalizaciones vienen indexadas por
   cualquiera de los dos.

2. **`detectarCorrimiento_()`** — antes de mapear encabezados, comprobar si la fila
   de datos está corrida respecto a la fila 1 (§3.3). La prueba es barata: si la
   columna que dice llamarse `Curso` trae valores con forma de rango (`0-1`,
   `0-3`, una fecha) en más de la mitad de las filas, el encabezado está corrido
   una posición. Se corrige el mapeo y **se deja aviso en el diagnóstico**.
   Nunca en silencio.

3. **`Centros que si aplican` como lista blanca** — `alcanceDeCentros_()` recibe la
   lista de inclusión y `centrosExcluidos_()` sigue leyendo la de exclusión. Las
   dos columnas coexisten y manda la de inclusión, así que el día que un área use
   las dos, funciona.

   Y con eso, `reglaAplica_()` cambia de eje: las listas del plan hablan de
   **familias de centro de costo** (045, 153, 073), no del departamento donde está
   la persona. Se comparan contra `centroCosto` —el número suelto, que deja
   `"045 Distribución Foráneo"` y `"045 - DISTRIBUCION FORANEA"` en el mismo
   `45`—, no contra `centro`, que es el CEDIS físico.

4. **`AliasPuestos`** — pestaña nueva del catálogo, con el esquema
   `['puesto_en_datos', 'puesto_en_plan', 'nota']`. Se siembra con
   `COORDINADOR DE TRANSPORTE → COORDINADOR` (§2).

5. **El centro de costo como eje** — `centro` = Departamento, `nomenclatura` =
   Centro Costos, `tipo_centro` = Área.

6. **`contrastarFechas_()`**, que no estaba planeado. El Detalle Colaborador dejó
   de ser fuente y se quedó sin trabajo; se le dio uno. Compara su fecha de
   asignación de puesto contra la del padrón y avisa si coinciden en menos del
   90% de las personas que están en las dos. Sobre los datos de agosto es el
   99.0%: si ese número se desploma, casi siempre es que una de las dos fuentes
   se quedó con el corte del mes pasado — y eso, sin el aviso, se publica en
   silencio con las antigüedades equivocadas.

**Verificación:** `node pipeline/probar_ingesta.js — si` — **20 revisiones, todas
pasan.** Corre el `leerFuentes_` real contra un Drive simulado con las fuentes de
CEDIS, incluido un PDT gerencial con el encabezado corrido de verdad.

La segunda corrida hace **0 conversiones y 0 duplicados**, que era su propósito
original y sigue vigente. Lo demás es nuevo: que el padrón conserve los dos
identificadores, que las finalizaciones traigan el `Sub Estatus`, que el plan de
operación se lea alineado, que **el gerencial se lea bien a pesar del corrimiento
—curso, rango, tipo y matriz de niveles—**, que el corrimiento quede avisado, y
que la lista blanca de centros no se confunda con la negra.

Se verificó que falla al quitar la corrección: sin ella, el curso del plan
gerencial se lee como `"0-1"`, que es exactamente el fallo que esto previene.

Correrlo antes y después de tocar `20_Fuentes.gs`, sin excepción.

### Etapa 3 · Las semillas y los parámetros · 2 días · **HECHA**

Todo el contenido de `02_Semillas.gs` se reemplaza. Nada se inventa: cada renglón
sale del PDF o de los archivos medidos.

| Semilla | Contenido de CEDIS |
|---|---|
| `Regiones` | Las **26**, en el orden del PDF |
| `MapaRegiones` | Los **3** renglones de §2 |
| `AliasCursos` | **2**: `Introducción a la Seguridad y Salud Laboral CEDIS` → `…Laboral **en** CEDIS`, y `Socialización del Código de Ética` → `…**Para Líderes**` (heredado tal cual de Cobranza) |
| `AliasPuestos` | `COORDINADOR DE TRANSPORTE` → `COORDINADOR` |
| `Agrupaciones` | `Formación de Conductores CEDIS 2026` = sus 3 cursos (OLC5745710, OLC5753661, OLC5753667) |
| `NivelesGerencial` | Los **57** puestos del plan gerencial contra los 6 niveles de la matriz. Ver abajo |
| `CentrosPermitidos` | Los **34** centros de costo del PDF (reemplaza a `ExcepcionImpresion`) |
| `PuestosEspecializacion` | Los **8** puestos de la especialización, con su ID (§3.5) |
| `Fuentes` | Los 5 patrones de la etapa 2 |

#### `NivelesGerencial`: 57 renglones, pero solo uno mueve un número

Era el trabajo más largo del proyecto y resultó el más acotado, porque **la
matriz del PDT solo distingue tres bandas**, no seis:

| Banda | Cursos | Qué pierde |
|---|---:|---|
| Jefes y Coordinadores · Gerente Operación | **22** | nada |
| Gerente de Zona/Gte Sr | **18** | los 4 de seguridad operativa |
| Gerente Regional · Gerente Divisional | **15** | además, "Conociendo los CEDIS" y los tres VALORES |
| Director Corporativo o Director General | **0** | esa columna del PDT viene **sin marcas** |

Clasificar un puesto mal **dentro** de una banda no cambia nada. Y de las 1,114
personas con plan gerencial, **1,071 caen en las dos bandas que reciben los 22
cursos**. Queda un solo renglón que mueve un número hoy:

> **`GERENTE DE ZONA CEDIS` → Gerente de Zona/Gte Sr.** 43 personas que, en esa
> banda, no reciben los 4 cursos de seguridad operativa. Es el empate literal con
> el nombre de la banda, pero es el único que conviene confirmar.

Los 23 puestos del plan que hoy no tienen a nadie llevan su nivel sembrado y
marcado "por confirmar": el día que alguien los ocupe, ya está resuelto.

⚠ **`Director Corporativo o Director General` no se usa.** Su columna en el PDT
viene sin marcas, así que quien caiga ahí recibiría **cero cursos**. Ningún puesto
de CEDIS está en ese nivel, y el catálogo lo dice para que nadie lo estrene por
descuido.

#### Dos catálogos nuevos

`CentrosCosto` — los 34 del PDF. Los 34 aparecen en los datos y **no hay ninguno
fuera**: hoy no saca a nadie. Se siembra para que el día que el área abra un
centro de costo nuevo, el tablero lo diga en vez de contarlo en silencio.

`PuestosEspecificos` — los 4 puestos de operación que el PDT trae vacíos (§3.5),
con sus 9 centros de costo. Es el catálogo completando lo que al archivo le
falta, sin tocar código. `construirPlan_()` los suma a los que trae el PDT.

#### Parámetros

Los que cambian respecto a Cobranza:

```
FILTRAR_CATEGORIA_OPERACION = SI                 (el PDF lo pide)
FAMILIA_CENTRO_COSTOS       = (vacío)            (CEDIS tiene 34, no una)
BASE_ANTIGUEDAD             = PUESTO             (igual)
DEDUPLICAR_FINALIZACIONES   = SI                 (igual, y aquí pesa más: 17.7%)
```

Los tres parámetros de las decisiones 3, 4 y 5 —`SUBESTATUS_COMPLETADOS`,
`FECHA_MINIMA_VALIDA` y `PUESTOS_FUERA_DEL_PLAN`— llegaron en la etapa 4, junto
con el código que los aplica.

#### La primera corrida real

Para correr el motor sin desplegar nada hacía falta un `fuentes.json`, y para
CEDIS no existía cómo armarlo. Se escribió **`pipeline/armar_fuentes_cedis.py`**:
hace en la máquina lo mismo que `20_Fuentes.gs` hace en Drive —concentra los tres
CSV en un padrón y una tabla de finalizaciones, lee las cuatro pestañas de cada
PDT, corrige el encabezado corrido— y emite el JSON que consume
`correr_motor.js`.

```bash
python3 pipeline/armar_fuentes_cedis.py <carpeta-con-los-crudos> fuentes.json
node --max-old-space-size=4096 pipeline/correr_motor.js fuentes.json
```

Con los archivos de agosto, **el motor completa en 3.1 segundos** y cuadra:

```
14,967 colaboradores · 63.9% de avance · conciliación: correcta
286,247 asignados · 182,901 completados · 103,346 pendientes

padronLeido 15,252 − categoría 128 − fechaPosterior 157 = 14,967 ✓
origenFechaDePuesto: {padron: 15252, contratacion: 0, ninguno: 0}
finalizacionesLeidas = finalizacionesUsadas = 425,811
cursosEnFinalizaciones: 30 · cursosDelPlanSinFuente: 0 ✓
regiones: 26, ninguna "Sin región" ✓
centrosDeCostoFueraDelCatalogo: 0 ✓
puestosEspecificosDelCatalogo: 4 · especialización a 5,167 personas ✓
puestosConPlan: 104 · personasSinPlan: 85
```

Los criterios de aceptación 3, 5 y 6 (§10) quedan cumplidos. **Éstos no son los
números finales:** las tres reglas de la etapa 4 todavía no estaban. Ver ahí.

#### Dos defectos que solo aparecieron al correrlo

Ninguno de los dos se veía leyendo el código.

**1. El mismo curso se publicaba dos veces.** El PDT de operación escribe
"Introducción a la Seguridad y Salud Laboral CEDIS" y el gerencial "…Laboral
**en** CEDIS". El alias hacía que los dos encontraran las mismas finalizaciones,
pero `cursoClave` salía del nombre **del plan**, así que "Avance por curso"
enseñaba el mismo renglón dos veces con números distintos (13,748 y 1,108).
Ahora la clave sale del nombre **resuelto**; el nombre visible sigue siendo el
del plan, y el motor avisa cuáles se unieron y con qué nombre quedaron.

**2. El centro publicaba el centro de costo de la primera persona.** El centro de
CEDIS es el departamento, y **76 de los 745 departamentos abarcan más de un centro
de costo** — "07 EMBARQUES TCMC 03" junta 075, 094 y 441. `sumar_()` se quedaba
con los atributos de la primera persona leída, así que ese centro se publicaba
como si fuera el 094. Es el tipo de dato que nadie vuelve a cuestionar una vez
publicado. Ahora dice **"varios (3)"**, y `centrosConAtributosMezclados` cuenta
cuántos son (78, contando dos que además abarcan más de una región).

### Etapa 4 · El motor · 1 día · **HECHA**

El motor es genérico y casi no se toca. Lo estructural —el padrón, los ejes de
centro y las listas de centros— se fue con la etapa 2, porque es el mismo
contrato que la ingesta. Aquí quedan solo las reglas, cuatro cambios chicos:

| Dónde | Qué |
|---|---|
| `filtrarPadron_()` | `FECHA_MINIMA_VALIDA` (decisión 4); `PUESTOS_FUERA_DEL_PLAN` (decisión 5), que recolecta a los excluidos igual que `personasSinFecha`; `soloOperacion` compara contra `Tipo Posición` |
| `indiceFinalizaciones_()` | **Decisión 3.** Una finalización cuenta si `¿Lo Completó?` dice `Si` **o** si su `Sub Estatus` está en `SUBESTATUS_COMPLETADOS`. Hoy solo mira la primera columna |
| `normalizarCursos_()` | Sin cambios — la agrupación y los alias ya son catálogo |
| `acumular_()` / `armarTablas_()` | `tipoCobranza` → `tipoCentro` |

#### Los números del corte de agosto

Con las tres reglas puestas, y **éstos ya son los definitivos** salvo lo que
cambie el área:

```
14,806 colaboradores · 68.2% de avance · conciliación: correcta
284,773 asignados · 194,259 completados · 90,514 pendientes

padronLeido 15,252 − categoría 128 − sin puesto en el PDT 85
            − fecha posterior al corte 233 = 14,806 ✓

fechasCentinela: 76 · completadasPorSubEstatus: 7,224
cursosDelPlanSinFuente: 0 · personasSinPlan: 0
26 regiones · 727 centros · 27 cursos · 24,557 filas de FiltroCurso
```

Las 76 fechas centinela resultaron ser **una sola alta masiva**: 76 personas
contratadas el 2 de septiembre de 2026, con la asignación de puesto todavía sin
capturar. Salen del corte de agosto por su fecha de contratación, no por el
centinela — el aviso lo explica para que nadie busque dos problemas donde hay uno.

#### El bug que apareció al medir "Exenta"

`completadasPorSubEstatus` decía **2,530** y las "Exenta" del crudo eran **7,224**.
Faltaban 4,694, y al tirar del hilo salió algo peor.

`armar_fuentes_cedis.py` deduplicaba por `(persona, curso)` quedándose con la
primera fila. Parece equivalente —el motor ya cuenta una vez cada par— pero no lo
es: **al quedarse con la primera fila se tira el estatus de las demás**, y con él
las finalizaciones completadas que venían en una repetición posterior. Sobre los
datos de agosto eso perdía **9,161 finalizaciones completadas** antes de que el
motor las viera, y el avance salía **3.1 puntos más bajo** sin ningún error que lo
explicara.

La llave de deduplicación ahora incluye el estatus, así que solo se van las filas
que de verdad sobran. Cuesta 42,319 filas y 3.5 MB más; el motor sigue contando
cada par una sola vez porque hace el OR él mismo, en `indiceFinalizaciones_`.

> ⚠ **Esto aplica igual a `aligerar_cedis.py` en la etapa 6.** Es la misma
> operación sobre los mismos archivos, y es exactamente la familia de error que ya
> costó horas en Cobranza: un recorte que tira una columna y deja a cientos de
> personas fuera del corte sin explicación.

**Verificación:** `node pipeline/correr_motor.js fuentes.json` contra las fuentes
de CEDIS, sin desplegar nada. El control algebraico cuadra: Colaborador y Curso
suman lo mismo que el Resumen.

### Etapa 5 · El tablero · 1 día · **HECHA**

Estructura y CSS **sin cambios**, como estaba previsto. Lo que cambió:

**1. La etiqueta del centro sale del catálogo.** El detalle por colaborador decía
`Centro 07 CEDIS CROSS OAXC 02`, y esa palabra estorba cuando el valor ya se
nombra solo. Ahora es el parámetro `ETIQUETA_CENTRO`, vacío para CEDIS:

```
100174359 · 07 CEDIS CROSS OAXC 02 · 045 - DISTRIBUCION FORANEA
```

Un área cuyo centro sea un número —Cobranza, con `500306`— escribe `Centro` en el
catálogo y la recupera. El valor por omisión va vacío a propósito: `parametro_`
no distingue entre "no está" y "está en blanco", así que con `Centro` de default
no habría forma de pedir que no haya etiqueta.

**2. Los otros tableros también.** `reportesDisponibles_()` lee el parámetro
`OTROS_REPORTES` con la forma `Cobranza=https://…/exec, CATd=https://…/exec`.
Cada área es un despliegue distinto, así que enlazarlos es conocer su URL: un
dato de la instalación, no del código. Vacío = este tablero es el único.

**3. Las 26 regiones** entran en el ranking y en el filtro sin tocar nada: el
panel ya paginaba. Verificado en el navegador — el filtro trae 26 y "Ver 21 más"
despliega los 26 renglones.

#### La vista de centros no existe

El plan decía «la columna nueva `tipo_centro` en la vista de centros». Al abrir el
tablero resultó que **esa vista no existe** —ni en CEDIS ni en Cobranza—, y sin
embargo el servidor mandaba la tabla `Centro` entera en cada carga: **727 filas
por 12 columnas que la página nunca abría**.

Se dejó de mandar, para el corte vigente y para los meses cerrados. El HTML del
tablero montado pasa de **1,020 KB a 166 KB**: el 84% de lo que viajaba era eso.
El centro de cada persona sigue saliendo de su propia fila en la búsqueda, que es
de donde salía siempre.

Agregar la vista sería divergir del tablero de Cobranza, que es justo lo que este
proyecto no quiere. Si algún día hace falta, se vuelve a pedir la pestaña en
`tablasDelCorte_()` y ya.

**Verificación:** `node pipeline/montar_tablero.js corte.json tablero.html` arma
el HTML abrible con los datos reales de CEDIS y se abrió en un navegador de
verdad: sin errores de consola, 26 regiones en el filtro y en el ranking, el
detalle por colaborador paginando 90,514 pendientes, y los KPI con sus deltas.

De paso, un defecto del propio arnés: `escalar()` multiplicaba asignados **y**
completados por la misma constante, así que el avance salía idéntico los cuatro
meses y **la gráfica mensual dibujaba cuatro barras iguales** — precisamente lo
que hay que poder ver antes de desplegar. Ahora escala solo los completados y la
gráfica va 50% · 53% · 55% · 68%.

### Etapa 6 · El aligerado · 1 día · **HECHA**

Los tres CSV suman **200 MB**. `CEDIS P1.csv` pesa 96 MB y `CEDIS P2.csv` 88 MB,
contra un límite de conversión de Drive de 100 MB: pasan, pero por poco.
`aligerar_cedis.py` deja de ser opcional y **pasa a ser obligatoria**.

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
| **`cedis_finalizaciones.csv`** | **468,130** | **5** | **34.0 MB** |
| | | | **36.4 MB** |

**Seis veces más chico que un solo archivo, y ninguno cerca del límite.**

`cedis_padron.csv` — `Número Persona`, `Número Colaborador`, `Nombre Colaborador`,
`Región RRHH`, `Centro Costos`, `Área`, `Departamento`, `Puesto`, `Tipo Posición`,
`Fecha Contratación`, `Fecha Asignación Puesto`.

`cedis_finalizaciones.csv` — `Número Persona`, `Número Colaborador`,
`Nombre Curso`, `¿Lo Completó?`, `Sub Estatus Aprendizaje`.

⚠ **La llave de deduplicación lleva el estatus.** Deduplicar por `(persona,
curso)` a secas tira el estatus de las repeticiones y con él 9,161 finalizaciones
completadas — 3.1 puntos de avance. Ver la etapa 4. La llave correcta es
`(persona, curso, ¿Lo Completó?, Sub Estatus)`, y con ella el archivo de
finalizaciones queda en 468,130 filas y 34.0 MB en vez de 425,811 y 30.5.

El script **aborta** si alguna revisión falla. Son cinco, y las cinco están
aprendidas a golpes:

| Revisión | Qué evita |
|---|---|
| Las columnas existen en cada archivo de entrada | Que el reporte cambie un nombre de columna y nadie se entere |
| Ninguna columna queda vacía | El error que en Cobranza dejó a 1,281 personas fuera del corte sin explicación |
| El padrón trae a todas las personas, una vez cada una | Perder gente al concentrar |
| Todas con sus **dos fechas** | Sin la de asignación de puesto no se puede decidir qué cursos aplican |
| **Ninguna finalización completada se pierde al deduplicar** | Los 9,161 de la etapa 4 |

La última es la que importa. Se comprobó quitando la corrección: el script
detecta las 9,161 y **aborta** en vez de escribir archivos que se ven bien.

#### La prueba de que no se pierde nada

`armar_fuentes_cedis.py` ahora acepta también los dos archivos aligerados, así
que el motor se puede correr por los dos caminos y comparar. Sobre los datos de
agosto, **las siete tablas del corte salen idénticas**:

```
Resumen  1 · Region  26 · Centro  727 · Curso  27
Colaborador  14,806 · FiltroCurso  24,645 · Control  1     todas idénticas
```

Aligerar no cambia un solo número.

#### Un tercer defecto, que solo apareció al comparar

Al principio la comparación dio **dos tablas distintas**. `Colaborador` era el
mismo contenido en otro orden —el padrón aligerado sale ordenado por número de
persona y el crudo en el orden del archivo—, y eso no importa: el orden de las
filas no es parte del contrato.

Pero `Curso` traía un nombre distinto: *"Práctica de Conductor al Volante"* en un
camino y *"...al volante"* en el otro. Los dos planes escriben ese curso con
distinta mayúscula, el alias los une, y **el nombre que se publicaba era el del
primer colaborador que resultara tener ese curso** — o sea, dependía del orden
del archivo del padrón. Reordenar el archivo cambiaba una etiqueta del tablero
sin que nada más se moviera, que es de esas cosas que nadie logra explicar tres
meses después.

Ahora gana el primer plan que lo declare, y el padrón deja de opinar.

### Etapa 7 · El ensayo · 2 días · **la guía está escrita, la corrida es tuya**

Es la única etapa que necesita una cuenta de Google, así que no se puede correr
desde aquí. Lo que sí se puede es dejarla preparada al detalle:
**[`docs/07-ensayo.md`](07-ensayo.md)** lleva los nueve pasos con los números que
cada uno tiene que reproducir, los cinco avisos que son normales, y la tabla de
qué hacer cuando algo se atora.

Dos cosas se arreglaron al escribirla, y las dos habrían aparecido a media
instalación:

- **Faltaba el permiso `script.send_mail`** en `appsscript.json`. `MailApp` lo
  exige, y sin él `avisarPorCorreo_()` truena — el día que hace falta, que es
  justo el día que algo salió mal. De paso se quitó `script.external_request`,
  que sobraba: no hay un solo `UrlFetchApp` en el código.
- **`probar_identidad.js` ahora compara las semillas contra el esquema.** Un
  renglón con más o menos celdas que columnas revienta `instalar()` con la hoja a
  medio crear. Son 18 + 26 + 3 + 2 + 1 + 3 + 57 + 34 + 4 + 5 renglones: revisarlos
  a ojo no es un plan.

#### Los pasos originales

El equivalente del ensayo de agosto de Cobranza, que es lo que dio confianza para
publicar.

- [ ] `instalar()` siembra los diez catálogos con sus cuentas
- [ ] `revisarFuentes()` reconoce los cinco archivos
- [ ] `ensayarCorte('2026-08')` completa y cuadra
- [ ] Los conteos de diagnóstico se revisan uno por uno contra §2 de este documento:
      **padrón 15,252 → 14,806 publicados**, 128 por categoría, 85 sin puesto en
      el PDT, 233 con fecha posterior, `cursosDelPlanSinFuente = 0`. La lista
      completa está en `docs/07-ensayo.md`, paso 4
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
| 1 · Identidad del reporte | ~~0.5~~ **hecha** | 0 |
| 2 · Ingesta | ~~3~~ **hecha** | 1, 6 |
| 3 · Semillas y parámetros | ~~2~~ **hecha** | 1 |
| 4 · Motor | ~~1~~ **hecha** | 2, 3 |
| 5 · Tablero | ~~1~~ **hecha** | 4 |
| 6 · Aligerado | ~~1~~ **hecha** | 0 |
| 7 · Ensayo | 2 | todas |
| | **2.5 días restantes** | |

**Ya no hay nada esperando insumos del área:** las cinco decisiones están tomadas
y P2 llegó. Lo que queda son las reglas (etapa 4), la interfaz (5), el aligerado
(6) y el ensayo dentro de Apps Script (7).

---

## 10. Criterios de aceptación

El tablero de CEDIS está terminado cuando:

1. `instalar()` levanta el almacén completo con nombres CED y siembra los catálogos
2. `revisarFuentes()` reconoce los cuatro archivos de CEDIS
3. `ensayarCorte('2026-08')` completa, cuadra el control algebraico y reporta
   `cursosDelPlanSinFuente = 0`
4. El padrón publicado es de **14,806 colaboradores** de 15,252 leídos, y las 446
   exclusiones están explicadas una por una en el diagnóstico: 128 por categoría,
   85 por puesto fuera del PDT, 233 por fecha posterior al corte (de las cuales 76
   traían además la fecha centinela)
5. Las **26 regiones** aparecen en el ranking, ninguna como `Sin región`
6. La especialización de conductores le llega a las **5,181 personas** que la
   tienen en P3, no a 0
7. `procesarCorte()` publica en menos de 1,800 s
8. El tablero muestra los **mismos indicadores** que el de Cobranza: avance total,
   pendientes, avance mensual, ranking regional, avance por curso, y el detalle de
   pendientes por colaborador
9. Los dos tableros se enlazan desde el selector de reportes
