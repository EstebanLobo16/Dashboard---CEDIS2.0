# Traspaso · El tablero de CAT

Este documento es para una **conversación nueva de Claude** que va a construir el
tablero de **CAT**, la tercera área, con la misma arquitectura que ya corre en
Cobranza y CEDIS. No cuenta el proyecto desde cero: cuenta qué está resuelto,
qué hay que averiguar, y en qué nos equivocamos para que no se repita.

**El camino ya está trazado.** CEDIS se hizo así, en siete etapas, y el ensayo
reprodujo los 23 conteos exactos contra el motor corriendo aparte. CAT es el
tercer recorrido del mismo camino, no una exploración.

---

## 1 · Dónde está todo

Un solo repo, `EstebanLobo16/Dashboard---CEDIS2.0`, con dos tableros vivos:

| | Rama | Estado |
|---|---|---|
| **Cobranza** | `main` | El original. En producción desde antes |
| **CEDIS** | `claude/tablero-cedis-4pp3d1` | La réplica. **Es el molde a seguir**, y ya corre en Colab |

`git diff main..claude/tablero-cedis-4pp3d1` es, literalmente, **la lista de lo
que hay que hacer para un área nueva** — mezclada con los cambios de Colab.
Sepáralas antes de copiar: `docs/09-migrar-a-colab.md` dice cuáles son cuáles.

Lee en este orden:

```
docs/06-plan-cedis.md      ← las siete etapas, con lo que se descubrió en cada una
docs/01-contrato-de-datos.md
docs/02-motor.md
docs/08-plan-colab.md       ← por qué el cálculo salió de Apps Script
docs/09-migrar-a-colab.md
```

> `docs/replicar-en-otra-area.md` se escribió **antes** de que CEDIS existiera y
> **antes** de Colab. Su sección de "qué es genérico" sigue siendo buena; sus
> detalles operativos están viejos (habla de carpetas que ya no existen y de un
> aligerado de 7 columnas que acabó siendo de 11 + 5). Ante la duda, manda este
> documento.

---

## 2 · La arquitectura, en una página

**Lo específico de un área son constantes y catálogos. Nada más.** El motor, el
almacén, el histórico y la interfaz son genéricos.

```
Archivos del área  →  fuentes.json  →  MOTOR  →  paquete.json  →  el tablero
   (Drive)            (armador)      (Node)     (Drive)          (Apps Script)
```

Dos decisiones sostienen todo esto, y ninguna se negocia:

**1 · `30_Motor.gs` no toca ningún servicio de Google.** Ni `SpreadsheetApp`, ni
`DriveApp`, ni `PropertiesService`. Recibe datos, devuelve datos. Por eso el
mismo archivo `.gs`, sin cambios, corre dentro de Node en 6 segundos — lo que a
Apps Script le toma **19 minutos**, porque los otros 19 son Drive convirtiendo
CSV a hoja y Apps Script leyendo 3.8 M de celdas.

**2 · Todo lo que decide reglas entra por parámetros y catálogos**, no está
escrito duro en el código. Las menciones a un área que veas en el motor son
comentarios que explican de dónde salió cada regla.

Si al adaptar CAT algo parece pedir un `if (area === 'cat')` en el motor, es que
falta un parámetro en el catálogo.

---

## 3 · Qué cambia para un área nueva

### `00_Config.gs` — mecánico, media hora

La identidad del reporte. Es el **único** archivo donde el cambio es obligatorio
y no requiere pensar:

```js
reporte: 'cat',
nombreReporte: 'CAT',
titulo: 'Plan de Capacitación · CAT',
archivos: { catalogos: 'CAT · Catálogos', ... },
carpetas: { base: 'Tablero CAT', crudos: 'Datos crudos',
            paquetes: 'Paquetes', archivo: 'Cortes archivados' },
props:    { catalogos: 'CAT_ID_CATALOGOS', ... },
paquete:  { formato: 'cat-report-package', version: 1 },
```

⚠ **Cambia también los prefijos de `props`.** Son las claves de Drive. Con
proyectos de Apps Script separados no hay riesgo, pero cuesta nada.

`pipeline/probar_identidad.js` revisa que no quede ninguna cadena del área vieja
escrita duro. Córrelo.

### `20_Fuentes.gs` — el grueso

Cada área entrega archivos distintos, con formas distintas. Compara:

| | Cobranza | CEDIS |
|---|---|---|
| Fuentes | 7 | 4 (+1 opcional) |
| El padrón | Se cruza `planta_posiciones` × `detalle_colaborador` | Una fila por persona en el propio CSV |
| La pestaña | Se elige por la fecha en su nombre | Nombre fijo |
| El encabezado | Se busca por columna ancla, no está en la fila 1 | Fila 1, salvo el PDT gerencial |

CEDIS **borró** cinco funciones que Cobranza sí necesita (`pestanaMasReciente_`,
`filaDelEncabezado_`, `padronDesdeDetalle_`, `indiceCentros_`,
`construirPuente_`). **Mira las dos versiones antes de decidir cuál se parece
más a CAT**, y parte de esa.

### `02_Semillas.gs` — el trabajo de verdad

Todo el contenido inicial de los catálogos. Para CEDIS fueron 18 parámetros, 26
regiones, 57 niveles gerenciales, 34 centros de costo, 4 puestos específicos.

**No inventes ni una sola semilla.** Salen de leer el PDF de reglas y los
archivos reales. Una semilla inventada no falla: publica un número equivocado.

---

## 4 · Lo que hay que averiguar de CAT antes de escribir código

Estas preguntas se le hacen al área, no al código. Sin respuesta, cualquier
implementación es adivinanza:

| | Pregunta | Para qué |
|---|---|---|
| 1 | ¿Qué archivos entrega el área, con qué nombre exacto, y cuánto pesan? | `Fuentes`, y si hace falta aligerado |
| 2 | ¿El padrón viene en un archivo o hay que cruzarlo? | La forma de `20_Fuentes.gs` |
| 3 | ¿Cuál es el eje geográfico? ¿Regiones, zonas, otra cosa? | `Regiones`, `MapaRegiones` |
| 4 | ¿Qué familia de centro de costos le toca? (`007` es Cobranza) | `FAMILIA_CENTRO_COSTOS` |
| 5 | ¿Aplica el filtro de «solo Operación»? El PDF lo pide para CEDIS | `FILTRAR_CATEGORIA_OPERACION` |
| 6 | ¿Qué sub estatus cuentan como completado? Para CEDIS, «Exenta» sí | `SUBESTATUS_COMPLETADOS` |
| 7 | ¿La vigencia se cuenta desde la asignación del puesto o desde la contratación? | El corazón del cálculo. **No lo asumas** |
| 8 | ¿Los puestos que no están en el plan se excluyen o se cuentan en cero? | `PUESTOS_FUERA_DEL_PLAN` |
| 9 | ¿Hay puestos gerenciales y con qué nivel de matriz? | `NivelesGerencial` |

El PDF `docs/Logicas Tableros Cobranza _ CEDIS _ CAT (1).pdf` cubre **las tres
áreas**, CAT incluida. Empieza por ahí: responde varias de estas solo.

> Ese PDF son imágenes, no texto. No se puede leer con `grep` ni con extractores
> de texto: hay que verlo.

---

## 5 · Lo que ya costó caro

Ocho cosas reales. Todas se pagaron una vez; no hay por qué pagarlas otra.

**1 · Deduplicar finalizaciones por (persona, curso) perdió 9,161 completadas.**
Me quedé con la primera fila de cada par, pero el estatus vive en dos columnas
—`¿Lo Completó?` y `Sub Estatus Aprendizaje`— y «Exenta» viene como `No` y
**cuenta como completada**. 3.1 puntos de avance, sin un solo error que lo
explicara. **La llave de deduplicación incluye el estatus**, y ningún archivo
intermedio opina de reglas de negocio: el motor ya hace el OR él solo.

**2 · Las revisiones corrían después de escribir.** El script fallaba, avisaba,
y los archivos malos ya estaban en la carpeta esperando a que alguien los
subiera sin volver a mirar la salida. **Revisar antes de escribir, siempre.**

**3 · `os.makedirs()` sobre Drive creó carpetas con la grafía equivocada.**
"Tablero CEDIS" y "Tablero Cedis" son dos carpetas para el montaje de Drive y
**la misma** para la búsqueda de Apps Script. Los datos acaban en una y el
tablero mira la otra, con todo saliendo en "ok". **Ningún script crea carpetas
dentro de Drive.** Si la ruta no existe, truena y dilo.

**4 · Dos ideas de dónde están los datos.** El cuaderno tenía su constante y el
aligerado resolvía la ruta por dentro. Divergieron. **Una sola fuente de
verdad:** la función devuelve la carpeta que usó, y quien llama usa esa.

**5 · Un `glob` que no encontró nada y siguió.** El fallo apareció una celda
después como un error de otra cosa. **Cada copia que importa lleva su
comprobación, y el error dice qué SÍ hay en la carpeta.**

**6 · El nombre de un curso dependía del orden de los archivos.** Salía del plan
y no del alias resuelto, así que el mismo curso se publicaba dos veces. **Los
nombres visibles se derivan del valor canónico.**

**7 · Un centro publicaba el centro de costos de la primera persona**, y 76 de
745 departamentos abarcan varios. Ahora publica "varios (n)".

**8 · GitHub corrompió un zip de 15 MB al renombrarlo desde la web.** Quedó en 2
bytes, dos veces. Anotado en `Archivos base/README.md`.

Y dos de operación:

- **Drive le quita la extensión al convertir a hoja.** La caché busca con y sin
  extensión por eso. No lo "simplifiques".
- **La app web corre la versión desplegada**, no la guardada. Hay que
  redesplegar.

---

## 6 · Las etapas

Las mismas siete de CEDIS (`docs/06-plan-cedis.md`), más la de Colab. CEDIS
tardó unas tres semanas; CAT debería ser menos, porque el camino ya está abierto
y las herramientas de prueba existen.

| | Qué | Días |
|---|---|---|
| **0** | Medir los archivos de CAT y responder las nueve preguntas del §4 | 1 |
| **1** | La identidad del reporte — `00_Config.gs` | ½ |
| **2** | La ingesta — `20_Fuentes.gs` y su arnés de pruebas | 3 |
| **3** | Las semillas y los parámetros | 2 |
| **4** | El motor — solo si alguna regla no cabe en los parámetros de hoy | 1 |
| **5** | El tablero — textos y ejes | 1 |
| **6** | El aligerado, **solo si los archivos lo piden** | 1 |
| **7** | Instalación y ensayo en Apps Script | 2 |
| **8** | El cuaderno de Colab | 1 |

**No escribas el aligerado por simetría.** El de CEDIS existe porque sus tres
CSV pesan 200 MB y dos rozan los 100 MB del límite de conversión de Drive. Si
los de CAT pesan poco, no hace falta. Mide primero.

---

## 7 · Cómo se sabe que quedó bien

Los arneses de prueba corren en Node, sin Google, en segundos:

```
node pipeline/probar_identidad.js      no queda ninguna cadena del área vieja
node pipeline/probar_ingesta.js        20 revisiones sobre la lectura de archivos
node pipeline/probar_publicacion.js    7 revisiones sobre qué paquete se publica
node pipeline/validar_paquete.js       el paquete cumple el contrato
```

Y la prueba dura: **correr el mismo periodo por los dos caminos —el cuaderno y
`ensayarCorte()` dentro de Apps Script— y exigir que los conteos salgan
idénticos.** Con CEDIS salieron los 23.

Al comparar paquetes, **excluye `Control.revision`**: es la marca de tiempo de
la corrida. Perdí un rato creyendo que el motor era no determinista y era eso.

También tiene que cuadrar la conciliación aritmética, que el propio motor
calcula:

```
padrón − excluidos por categoría − sin puesto − fecha posterior = colaboradores
```

---

## 8 · Antes de abrir la conversación

1. **Consigue los archivos de CAT** y súbelos a `Archivos base/`. Sin ellos, la
   etapa 0 no arranca. (Súbelos con **Add file → Upload files**, no renombrando
   desde la web: ver el error 8.)
2. **Decide dónde va a vivir.** CEDIS se hizo en una rama de este mismo repo y
   funcionó bien: un solo lugar donde arreglar un bug beneficia a los tres.
   `docs/replicar-en-otra-area.md` argumenta lo contrario —repos separados— y
   también es defendible si las áreas van a divergir. **Mi recomendación: una
   rama aquí**, `claude/tablero-cat`.
3. **Ten a la mano el PDF de reglas.** Es imagen, hay que verlo.

---

## 9 · Lo que sigue pendiente y es de los tres

El código es común, así que conviene arreglarlo una vez:

- **El histórico.** `acumularHistorico_()` lee y reescribe el histórico entero
  cada mes, y crece ~25,000 filas mensuales. En un año lee 3.4 M de celdas: tan
  caro como el problema del que ya huimos. Es la etapa D de
  `docs/08-plan-colab.md`. **Le pasa a los tres tableros.**
- Integrar la rama de CEDIS a `main`, para que los cuadernos no dependan de una
  rama que alguien podría borrar.
