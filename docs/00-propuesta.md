# Propuesta de trabajo — Tablero de avance de capacitación Cobranza

Réplica del tablero de Tienda, sobre datos de Cobranza, íntegramente en Google Apps Script.

- **Corte analizado:** 01 AGO 26 (el volcado de `Avance-interrumpido/`)
- **Estado:** las cinco etapas entregadas
- **Versión legible / compartible:** https://claude.ai/code/artifact/8e81fcf3-e7e4-4fb8-a42e-bb849371927c

---

## 1 · De dónde partimos

### El tablero del compañero (`Tablero-Compañero/`)

Proyecto de Apps Script de cuatro archivos (`Code`, `Index`, `JavaScript`, `StyleSheet`) publicado
como aplicación web con acceso de dominio. No es un prototipo: trae `LockService` para concurrencia,
validación de esquema al importar, lista blanca de administradores para publicar, y
`mergeHistoricalValues_()`, que ya sabe conservar cortes anteriores y reemplazar solo el periodo que
se publica. **El histórico, del lado del tablero, ya está resuelto.**

Su universo es la Tienda: cinco reportes hermanos (Almacenista, Asesor, Cajero, Gerente, Gerente de
Zona), cada uno un despliegue distinto con el mismo esquema de siete pestañas, y un selector arriba
que salta entre ellos.

### El cuaderno de Colab (`Avance-interrumpido/cobranza_pipeline_git.ipynb`)

Resuelve ~80% de la lógica de negocio de Cobranza y está bien documentado. Pero está escrito contra
una versión anterior del tablero:

| El cuaderno emite | El tablero espera |
|---|---|
| `Resumen · Regiones · Cursos · Puestos · Colaboradores` | `Resumen · Region · Tienda · Curso · Colaborador · FiltroCurso · Control` |

Hoy ese paquete sería rechazado por el propio `validateTables_()`. Lo primero es fijar **un solo
contrato** entre las dos piezas.

### Los datos, medidos sobre las fuentes reales

| | |
|---|---|
| Personas con un puesto contemplado en alguno de los dos planes | **12,472** |
| Cursos distintos entre plan de Operación y Gerencial | **24** |
| Asignaciones persona-curso antes de filtrar por antigüedad | **≈ 207,000** |
| Filas de finalizaciones (P1 + P2 + P3, 123 MB) | **300,884** |

Fuentes: `Cobranza_Detalle colaborador.xlsx` (122,783 filas — toda la empresa),
`Planta de Cobranza por Posiciones` (12,903 filas en la pestaña `01 AGO 26`), los dos PDT adaptados y
`Cobranza P1–P3.csv`.

---

## 2 · Nueve hallazgos que hay que cerrar

Todos salieron de correr las fuentes reales contra la lógica del cuaderno. Los hallazgos 8 y 9 se
encontraron al ejecutar el pipeline completo durante la etapa 1, y son los dos más graves: uno impide
que el cuaderno corra, el otro deja sin asignar la especialización a la que el PDF dedica su primera
página entera.

**Resultado de correr el proceso actual sobre el corte 01 AGO 26:** 11,533 colaboradores · 224,994
asignaciones · 163,377 completados · **72.6% de avance**. Ese número es el que publicaría el tablero
hoy, y está mal por al menos tres razones distintas de las de abajo.

### 1. Hay dos sistemas de número de empleado y se están cruzando como si fueran uno — **bloqueante**

En `Detalle Colaborador`, `Número de persona` trae dos formatos: 70,215 registros de 8 dígitos (el
número viejo) y 52,568 de 9 dígitos que empiezan con `100…` (el nuevo). En la Planta por Posiciones,
`Número de trabajador` es **siempre** de 8 dígitos. El cuaderno iguala esas dos columnas para
resolver el Centro, así que solo funciona con quien todavía carga el número viejo: **6,176 de 12,472
personas (49%)**. Las otras 6,296 caen a respaldos por nombre (4,783) y por departamento (1,195), y
318 se quedan sin Centro ni región.

El puente existe: los CSV de finalizaciones traen **las dos** columnas, `Número Persona` y
`Número Colaborador`, y la correspondencia es limpia (12,207 pares, ninguna persona con dos números).

> **Corrección.** Construir el equivalente persona ↔ colaborador desde los CSV y usarlo antes de la
> cascada. Probado sobre agosto: la resolución por identificador sube de **6,176 a 10,966 personas
> (49% → 88%)**. Las 1,506 restantes son gente sin ninguna finalización registrada; para ellas
> `Nombre del departamento` (`07 OPERACION DE COBRANZA CTLZ 05`) es determinista y sirve como último
> respaldo, ya sin competir con el cruce por nombre.

### 2. Cinco cursos del plan no existen con ese nombre exacto en las finalizaciones — **bloqueante**

De los 24 nombres del plan contra los 26 que aparecen en los CSV, cinco no calzan.

Tres son solo mayúsculas y acentos, y se arreglan normalizando:

| Plan | Finalizaciones |
|---|---|
| `Construcción de un entorno laboral ético` | `Construcción de un Entorno Laboral Ético` |
| `Prevención ante el Riesgo Operativo` | `Prevención ante el riesgo operativo` |
| `Responsabilidad al volante Cobranza` | `Responsabilidad al Volante Cobranza` |

Hay un cuarto que ni siquiera es de acentos: en el plan, `Competencias Coppel ` trae un **espacio al
final** y el cuaderno no lo recorta antes de cruzar.

Los otros dos son de negocio:

- `Socialización del Código de Ética` no aparece ni una vez en la fuente de finalizaciones.
- `Formación de Conductores Cobranza 2026` **no es un curso**: la página 1 del PDF dice que es la
  *especialización* compuesta por otros tres (Responsabilidad al volante, Sesión Virtual de
  Conducción preventiva, Práctica de Conductor al volante), que ya están listados aparte en la misma
  pestaña.

**Medido en la corrida de agosto:** cuatro cursos salen con **exactamente 0.0% de avance** y suman
**25,102 asignaciones**, el 11% del total. No es que nadie los haya tomado: es que el nombre no
cruza.

| Curso | Asignaciones | Avance | Causa |
|---|---:|---:|---|
| Prevención ante el Riesgo Operativo | 11,629 | 0.0% | mayúsculas |
| Competencias Coppel | 10,437 | 0.0% | espacio al final |
| Construcción de un entorno laboral ético | 1,518 | 0.0% | mayúsculas |
| Socialización del Código de Ética | 1,518 | 0.0% | no existe en la fuente |

> **Corrección.** Comparar por nombre normalizado —sin acentos, mayúsculas, un solo espacio, ya
> implementado en `textoClave_()`— y llevar un catálogo de alias editable por negocio para lo que la
> normalización no alcance. Sacar `Formación de Conductores Cobranza 2026` del conteo y tratarla como
> agrupación de tres cursos. Confirmar con el área el estatus de `Socialización del Código de Ética`.

### 3. El plan Gerencial trae una matriz por nivel jerárquico que hoy se ignora — **bloqueante**

`Cursos_asignados` del PDT gerencial no es una lista plana: tiene seis columnas adicionales —Jefes y
Coordinadores, Gerente Operación, Gerente de Zona/Gte Sr, Gerente Regional, Gerente Divisional o
Director de Área, Director Corporativo o Director General— marcadas con `1` curso por curso. Un
Gerente Regional recibe 13 cursos, un Gerente de Zona 16, y solo Jefes y Gerentes de Operación
reciben los 20 (los tres cursos de VALORES y cuatro de seguridad no suben de cierto nivel).

El cuaderno hace producto cartesiano puesto × curso e ignora la matriz: sobreasigna a los 95
colaboradores de Gerente de Zona, Gerente Regional y Gerente Divisional.

> **Corrección.** Respetar la matriz. Requiere una tabla de 8 renglones que mapee puesto → nivel,
> porque los encabezados de columna no coinciden literalmente con los nombres de puesto. Va en el
> catálogo editable.

### 4. La excepción del Centro de Impresión viene en el archivo, pero no se aplica — **alto**

El PDF (p. 2) exceptúa a los puestos 743 y 721 de la especialización de conductores en 12 centros de
costo. El cuaderno decidió no programarla y solo validar que la fuente ya la reflejara. La fuente sí
la refleja: `Colaboradores_especificos` del PDT gerencial tiene una columna `Centros que no aplican`
con exactamente esos 12 centros. Pero nadie la lee — el código toma `Centros de costos` e ignora la
columna de al lado. **La excepción hoy no se aplica en ninguna parte.**

> **Corrección.** Leer la columna y restar esos centros de la asignación específica. Mantener la
> validación como red de seguridad.

### 5. El universo de personas no está delimitado a Cobranza — **alto**

`Detalle Colaborador` es la nómina completa: 122,783 filas. El único filtro que se aplica es «que su
puesto aparezca en el plan», y eso arrastra gente de otras áreas con el mismo nombre de puesto (el
primer registro del archivo es un `CHOFER EJECUTIVO` de Administración y Finanzas). La Planta por
Posiciones sí es el censo real del área: 12,278 personas identificadas.

Falta una regla explícita de pertenencia. Hoy el resultado depende de si la cascada de Centro alcanzó
a resolverle un centro a la persona, que no es lo mismo que decidir si pertenece al área.

> **Corrección.** Declarar la Planta por Posiciones como padrón de Cobranza y usar `Detalle
> Colaborador` solo para los atributos que la Planta no trae (fecha de contratación → antigüedad).
> Es la lectura más cercana al PDF: «de las regiones Tienda o RRHH que vienen de raíz se hace un cruce
> con la plantilla de Cobranza». **Requiere confirmación** — es el hallazgo que más mueve el denominador.

### 6. Las finalizaciones repetidas cuentan doble, a propósito — **por confirmar**

Los tres archivos de periodo se concatenan sin deduplicar: si alguien aparece en P1 y otra vez en P2
con el mismo curso completado, suma 2 al total y 2 a completados. El cuaderno lo documenta como
decisión deliberada heredada del SQL anterior, y P1/P2 sí se traslapan.

**Medido:** el plan genera **171,760** asignaciones y, al cruzarlas con las finalizaciones, salen
**224,994** filas. Son **53,234 renglones duplicados, un 31% de inflación.** En la propuesta original
dije que el efecto era menor; con el número enfrente, no lo es. El avance porcentual sí aguanta
—el duplicado infla numerador y denominador— pero «cursos asignados» y «pendientes» quedan un tercio
por encima de la realidad, y son dos de los tres indicadores grandes del tablero.

> **Corrección.** Deduplicar por persona + curso, quedándose con la finalización más reciente.
> Reversible con un interruptor si el área prefiere el comportamiento anterior por comparabilidad.

### 7. Dos filtros documentados que hoy no se usan — **por confirmar**

- **`Categoría de asignación`** existe en Detalle Colaborador y nadie la lee. El PDF pide, para CEDIS,
  «en categoría de asignación solamente se contempla el rubro de Operación». Para Cobranza no lo dice,
  pero 12,274 de 12,472 ya son Operación: el filtro solo afectaría a 198.
- **Cuatro regiones fuera de catálogo.** `CENTROS-TIPOCENTROS` tiene 554 centros; cuatro apuntan a
  regiones que no están entre las 15 oficiales: `CULIACAN DIV I`, `IZTAPALAPA DIV III`,
  `LEON DIV II`, `QUERETARO DIV IV` (un centro cada una). El cuaderno las detecta y las imprime como
  aviso, pero igual las publica — aparecerían como cuatro regiones extra en el ranking.

> Ambos son decisiones de negocio, no de código. Van en el bloque de decisiones.

**Confirmado en la corrida:** las cuatro regiones fantasma sí aparecen en el resultado, con **un solo
colaborador cada una**, y se colarían al ranking regional junto a las 15 reales. También aparece un
grupo `Sin región` con 236 personas y 30.2% de avance —los que la cascada no logró ubicar (hallazgo 1).

### 8. Excel convirtió un rango en fecha y el cuaderno truena — **bloqueante**

En la pestaña `Cursos_asignados` del PDT gerencial, dos renglones —`Agilidad para Grupo Coppel` y
`VALORES I`— traen en `Rango de meses para cursar` el valor **`2024-06-03`**. No es una fecha: alguien
escribió `3-6` en Excel y Excel lo convirtió solo en «3 de junio». Los renglones vecinos dicen `0-1`,
`0-4` y `12`, así que el valor real es el rango 3-6.

`meses_minimos()` no contempla esa forma y **lanza una excepción**. El cuaderno, tal como está
subido, no puede procesar el PDT gerencial de agosto: revienta en la sección 3, antes de leer
ninguna otra fuente. Lo encontré porque la etapa 1 lo corrió de verdad.

> **Corrección.** `rangoMesesMinimo_()` (ya escrita, en `src/10_Util.gs`) acepta las tres formas
> —`0-3`, `12` y la fecha— y reconstruye el rango desde el día y el mes. Además hay que avisarle al
> dueño del PDT para que la celda quede con formato de texto, porque el mes que viene vuelve a pasar.

### 9. La especialización de conductores no se le asigna a nadie — **bloqueante**

El más grave, y estaba invisible porque no truena: simplemente no aparece.

La pestaña `Colaboradores_especificos` de los dos PDT trae, en `Centros de costos`, un único valor:
**`"007 Cobranzas"`**. El cuaderno le saca los dígitos con una expresión regular, obtiene `"007"`, y
lo compara contra el Centro de cada persona, que es un número como `500101`. **`"007"` nunca es igual
a `"500101"`**, así que el filtro descarta el 100% de las asignaciones específicas.

Resultado: de los 24 cursos del plan, la salida solo trae **20**. Los cuatro que faltan son
justamente los de la especialización —Formación de Conductores, Responsabilidad al volante, Sesión
Virtual de Conducción preventiva y Práctica de Conductor al volante—, a la que el PDF le dedica su
primera página completa. Son **3,664 personas** con un puesto de la especialización y unas **14,656
asignaciones** que hoy no existen.

`"007 Cobranzas"` no es un centro: es la **familia de centro de costo** del área —la Planta la trae
como `007 - COBRANZAS`— y significa «toda Cobranza». La restricción real por centro no está ahí:
está en la columna `Centros que no aplican`, que es el hallazgo 4.

> **Corrección.** Leer `"007 Cobranzas"` como la familia completa (parámetro `FAMILIA_CENTRO_COSTOS`,
> ya sembrado) y aplicar la restricción de centro desde `Centros que no aplican`. Los dos hallazgos
> se arreglan juntos porque son la misma columna mal leída.

---

## 3 · Arquitectura, sin salir de Google

Todo en Apps Script implica traer también el cuaderno de Colab para adentro, que es la parte que
nadie ha escrito todavía. Tres piezas con frontera clara:

```
FUENTES (Drive)                 PROCESO (Apps Script)          CONSUMO
┌────────────────────┐          ┌─────────────────────┐        ┌──────────────────────┐
│ Detalle Colaborador│          │  Motor de proceso   │        │ Almacén · 3 hojas    │
│ Planta Posiciones  │ ───────► │  1 Ingesta          │ ─────► │  Catálogos (negocio) │
│ PDT Oper + Gerenc. │          │  2 Padrón/centro    │        │  Corte vigente       │
│ Finalizaciones P1-3│          │  3 Explosión plan   │        │  Histórico agregado  │
└────────────────────┘          │  4 Cruce finaliz.   │        └──────────┬───────────┘
                                │  5 Publicación      │                   │
                                └─────────────────────┘                   ▼
                                 estado guardado                ┌──────────────────────┐
                                 entre etapas                   │ Tablero Cobranza     │
                                                                │ (aplicación web)     │
                                                                └──────────────────────┘
                                        detalle de meses cerrados ──► JSON en Drive
```

### A · Almacén — tres hojas de cálculo, no una

- **Catálogos** — lo que define reglas y no se regenera: alias de nombres de curso, mapa puesto →
  nivel de la matriz gerencial, centros de la excepción de Impresión, las 15 regiones oficiales,
  correos con permiso de publicar. La edita negocio sin tocar código; es donde vive todo lo que hoy
  está escrito duro dentro del cuaderno.
- **Corte vigente** — las siete pestañas del mes en curso, con el esquema del tablero de Tienda. Es
  lo único que el tablero lee en caliente.
- **Histórico** — solo agregados por mes.

### B · Motor de proceso — el reemplazo del Colab

Proyecto de Apps Script aparte, con su botón «Procesar corte» expuesto en el tablero. Cinco etapas,
cada una por debajo del límite de ejecución, encadenadas con disparadores y con el estado en una
pestaña de proceso: si una etapa falla, se reanuda desde ahí y no desde el principio. Al terminar
deja bitácora con los conteos de cada etapa y las tres validaciones que ya trae el cuaderno
(excepción de Impresión, personas en ambos planes, control algebraico).

Es la pieza de más riesgo. Prueba de aceptación dura: correr el mismo mes en el Colab y en el motor,
y que los totales coincidan o que cada diferencia esté explicada por uno de los siete hallazgos.

### C · Tablero — copia del de Tienda, con tres cambios

Misma estructura, indicadores, filtros y comportamiento: vista de colaboradores, buscador con
sugerencias, selectores con búsqueda interna, esqueletos de carga, modal de publicación, estados
vacíos y de error. Diferencias:

1. **Tienda pasa a ser Centro** en todo el esquema y la interfaz, y la región se calcula desde el
   catálogo de Cobranza, nunca desde la región cruda de RRHH.
2. **El selector de reportes pasa de cinco a dos**: Operación Colaborador y Operación Gerencial, como
   pide el PDF. La misma mecánica de salto entre despliegues sirve tal cual, y deja el camino abierto
   para CEDIS y CATd.
3. **La gráfica «Avance mensual» por fin tiene los doce meses.** Hoy dibuja una sola barra porque no
   hay histórico. Con el almacén histórico, el mismo componente muestra el año sin cambiar diseño.

Se conserva la importación manual del paquete `.json` como vía alterna.

---

## 4 · Dónde vive el histórico

El límite no es el espacio: es el tiempo que tarda Apps Script en leer una pestaña grande dentro de
su ventana de ejecución.

| Pestaña | Una fila por | Filas / mes | Celdas / mes |
|---|---|---:|---:|
| Colaborador | persona | 12,472 | ≈ 237,000 |
| FiltroCurso | puesto × región × curso | ≈ 5,700 | ≈ 63,000 |
| Centro | centro de costo | ≈ 550 | ≈ 6,000 |
| Curso | curso | 24 | ≈ 240 |
| Region | región de Cobranza | 15 | 135 |
| Resumen · Control | el reporte completo | 2 | ≈ 40 |
| **Total por corte** | | | **≈ 306,000** |

Doce meses caben (3.7 M de celdas contra un tope de 10 M), pero el tablero del compañero lee la
pestaña completa en cada filtro y después filtra en memoria. Con un solo mes ya son 237 mil celdas
por llamada; con doce meses acumulados, cada cambio de filtro leería 2.8 millones y la ejecución se
cortaría. El problema aparece al cuarto o quinto mes, no el primer día — que es lo que lo hace
traicionero.

**Reparto propuesto:**

- **Corte vigente** — hoja propia, solo el mes publicado. La única que el tablero lee entera. Se
  mantiene en ~306 mil celdas sin importar cuántos años lleve el proyecto.
- **Histórico** — hoja propia, solo agregados (Resumen, Region, Centro, Curso, FiltroCurso por mes):
  ~6,300 filas al mes, ~76,000 al año. Alimenta la gráfica anual y las comparativas.
- **Detalle de meses cerrados** — un JSON por corte en una carpeta de Drive (5–10 MB), con el formato
  del paquete que ya existe. Respaldo auditable e insumo para reconstruir un mes. No se lee en la
  operación diaria.

Con esto el tablero rinde igual en el mes 1 que en el mes 40, el histórico es consultable, y nada
depende de infraestructura fuera de Drive y Sheets.

---

## 5 · Etapas de entrega

| # | Etapa | Entregable |
|---|---|---|
| 0 | **Cerrar decisiones.** Responder las siete preguntas y confirmar dueño y periodicidad de cada fuente. Sin código. | Este documento actualizado con las respuestas, como versión vigente de las reglas. |
| 1 | **Contrato de datos y catálogos.** Crear las tres hojas del almacén, poblar Catálogos con lo que hoy está duro en el cuaderno, fijar el esquema de las siete pestañas. | Las tres hojas creadas y documentadas, y el Colab ajustado para emitir ya el esquema correcto. |
| 2 | **Motor de proceso en Apps Script.** Las cinco etapas con los siete hallazgos corregidos, reanudación ante fallo, bitácora y validaciones. | El motor corriendo de punta a punta sobre agosto, con comparativo lado a lado contra el Colab y cada diferencia explicada. |
| 3 | **Tablero de Cobranza.** La copia adaptada a Centro y a los dos reportes, leyendo el corte vigente, con caché y agregados precalculados. | Aplicación web desplegada con acceso de dominio y datos reales de agosto. |
| 4 | **Histórico y gráfica anual.** Acumulación por corte, archivado en Drive, gráfica de doce meses conectada al histórico real. | El tablero mostrando la serie del año y el archivo mensual funcionando. |
| 5 | **Automatización y traspaso.** Disparador mensual, aviso por correo ante fuente sin actualizar o validación fallida, manual de operación. | El proceso corriendo solo y documentado para que lo opere alguien más. |

Las etapas 1 y 3 son cortas y de bajo riesgo; la 2 concentra la mayor parte del esfuerzo. **Si hay
que recortar alcance**, la vía es dejar el Colab como motor y quedarse con las etapas 1, 3 y 4:
tendrías el tablero completo y el histórico, con un paso manual al mes.

---

## 6 · Límites reales de Apps Script

| Límite | Cómo pega aquí | Cómo se resuelve |
|---|---|---|
| Tiempo de ejecución (6 min; 30 min en Workspace) | Procesar 300 mil filas no cabe en una corrida. | Motor por etapas con estado y disparadores encadenados. Verificar cuál límite aplica en el dominio de Coppel. |
| Tamaño de archivo en memoria | `Cobranza P2.csv` pesa 65 MB; leerlo como texto de un jalón no es viable. | Convertir a hoja con la API de Drive y leer por rangos, tomando solo 7 de las 25 columnas. |
| 10 M de celdas por hoja | Se alcanzaría hacia el tercer año si todo el detalle viviera en un archivo. | El reparto en tres hojas más el archivado en Drive (§4). |
| Apps Script no lee `.xlsx` | Cuatro de las cinco fuentes llegan como Excel. | Conversión a hoja con la API de Drive en la etapa de ingesta, una vez por corte. |
| Permisos y propiedad | El tablero se despliega como quien lo publica; el motor necesita escritura en el almacén. | Definir una cuenta dueña del proyecto para que no dependa de un empleado en particular. |

**Mejora que no está en mis manos:** los CSV de finalizaciones traen 25 columnas y se usan siete
(las cinco de siempre más `Fecha Contratación` y `Fecha Asignación Puesto`, respaldo cuando el
Detalle Colaborador no trae a la persona). Si el área que los genera pudiera exportar solo esas
siete, los 123 MB bajarían a unos 20 y la ingesta se volvería trivial.

---

## 7 · Decisiones que necesito

Las siete de la propuesta original más las dos que salieron al correr el proceso.

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Quién define el universo de Cobranza: la Planta por Posiciones, o cualquier persona de nómina cuyo puesto esté en el plan? | **La Planta por Posiciones** como padrón, con Detalle Colaborador aportando solo la fecha de contratación. |
| 2 | ¿La matriz de niveles del plan Gerencial manda? | **Sí.** Está en el archivo por algo, y hoy sobreasignamos a 95 personas. Necesito el mapa de los 8 puestos a los 6 niveles. |
| 3 | ¿Cómo se cuenta `Formación de Conductores Cobranza 2026`? | **Sacarla del conteo** y mostrar los tres cursos que la componen agrupados bajo esa etiqueta. |
| 4 | ¿`Socialización del Código de Ética` sigue vigente? | **Preguntar al dueño del PDT** antes de la etapa 2. Si cambió de nombre, entra al catálogo de alias. |
| 5 | ¿Deduplicamos las finalizaciones repetidas? | **Sí**, por persona + curso. Deja los conteos absolutos correctos y el avance casi igual. Con interruptor para volver atrás. |
| 6 | ¿Se filtra por `Categoría de asignación = Operación`? | **No de entrada.** Casilla en Catálogos para prenderlo si el área lo pide (afecta a 198 de 12,472). |
| 7 | ¿Qué hago con las cuatro regiones fuera de catálogo? | **Mapearlas a su región base** (Culiacán, Ixtapaluca, León, Querétaro) y avisar al dueño del catálogo para que lo corrija en la fuente. |
| 8 | El rango `3-6` que Excel volvió fecha en dos cursos del PDT gerencial, ¿es 3 a 6 meses? | **Sí**, por los renglones vecinos. Confírmalo con el dueño del PDT y pídele que la columna quede como texto. |
| 9 | `"007 Cobranzas"` en el plan específico, ¿significa toda el área? | **Sí.** Es la familia de centro de costo, no un centro. Es lo que explica que la especialización de conductores hoy no le llegue a nadie. |

---

## Estado

Las cinco etapas están entregadas.

| Etapa | Qué quedó | Documento |
|---|---|---|
| 1 | Contrato de datos, almacén, catálogos, administradores | `01-contrato-de-datos.md` |
| 2 | Motor de proceso con los nueve hallazgos corregidos | `02-motor.md` |
| 3 | El tablero | `03-tablero.md` |
| 4 | Histórico navegable y comparativa mensual | `04-historico.md` |
| 5 | Automatización y manual de operación | `05-operacion.md` |

Sobre el corte 01 AGO 26, el proceso anterior publicaba **72.6%** de avance con 20 de 24 cursos y
20 regiones. El motor publica **84.8%** con 23 de 24 cursos y las 15 regiones oficiales: cuatro
cursos que salían en cero lo hacían porque el nombre no cruzaba, y la especialización de conductores
no se le asignaba a nadie.

Después se corrigió además la regla de vigencia —se cuenta desde la asignación de puesto, no desde
la contratación— y el archivo de origen cambió de formato por completo.

**Lo que falta no es código**, es información del área: los dos niveles de la matriz gerencial sin
confirmar, qué hacer con quien no tiene fecha de asignación de puesto, y pedir el Detalle
Colaborador con el mismo corte que la Planta. Está todo en `05-operacion.md`, sección 8.
