# Traspaso · Llevar el tablero de Cobranza al flujo de Colab

Este documento es para una **conversación nueva de Claude**, que va a hacer con
Cobranza lo que ya se hizo con CEDIS. No cuenta el proyecto desde cero: cuenta
lo que ya existe, lo que se puede copiar, lo que de verdad cambia, y en qué me
equivoqué para que no se repita.

**Antes de tocar nada: lee `docs/08-plan-colab.md` y `docs/09-migrar-a-colab.md`
completos.** Este archivo asume que ya los leíste.

---

## 1 · Dónde está todo

Un solo repo, `EstebanLobo16/Dashboard---CEDIS2.0`, con dos tableros:

| | Rama | Qué es |
|---|---|---|
| **Cobranza** | `main` | El tablero original, en producción. **Lo que hay que migrar.** |
| **CEDIS** | `claude/tablero-cedis-4pp3d1` | La réplica, ya migrada a Colab. **La implementación de referencia.** |

La rama de CEDIS salió de `main`, así que el `git diff` entre las dos es
exactamente "qué hubo que cambiar para otra área **y** para Colab". Las dos
cosas están mezcladas en ese diff: sepáralas antes de copiar nada.

> **El histórico de commits sirve.** Cada arreglo tiene su mensaje explicando
> qué se rompió y por qué. `git log --oneline main..claude/tablero-cedis-4pp3d1`.

---

## 2 · El hecho que sostiene todo el diseño

Apps Script tarda **19 minutos** en hacer un corte. El mismo cálculo, con el
mismo código, tarda **6 segundos** en Node.

El cómputo es el 0.5% del tiempo. Los otros 19 minutos son Drive convirtiendo un
CSV de 34 MB a hoja de cálculo y Apps Script leyendo 3.8 M de celdas de vuelta.
El límite de ejecución de Workspace son 1,800 s, así que el margen era de 11
minutos y se acababa solo con que creciera el padrón.

Lo que hace posible sacarlo de ahí es una decisión anterior a todo esto:
**`30_Motor.gs` no toca ningún servicio de Google.** Ni `SpreadsheetApp`, ni
`DriveApp`, ni `PropertiesService`. Recibe datos, devuelve datos. Por eso el
mismo archivo `.gs` corre sin cambios dentro de Node.

**Esa propiedad es lo que hay que no romper.** Si en algún momento parece
práctico meter un `SpreadsheetApp` en el motor, es que la solución está mal.

---

## 3 · Qué se copia tal cual

Nada de esto depende del área. Está en la rama de CEDIS y vale para Cobranza
cambiando nombres:

| Archivo | Qué hace |
|---|---|
| `pipeline/correr_motor.js` | Carga los `.gs` reales en Node con `vm.runInContext` y stubea solo `catalogo_()`. **Ya es agnóstico del área.** |
| `pipeline/colab/corte_cedis.ipynb` | Las 13 celdas del corte. Cambia rutas y nombres |
| `src/07_Paquete.gs` → `publicarDesdeDrive()` | Lee el paquete de la carpeta `Paquetes` y publica |
| `src/03_Almacen.gs` → la carpeta `Paquetes` | Tres líneas en `instalar()` |
| `pipeline/probar_publicacion.js` | 7 revisiones sobre qué paquete se elige |
| `aligerar_cedis.ruta_real()` | Corrige mayúsculas de rutas de Drive |

En Apps Script, los archivos que cambiaron para Colab (no para CEDIS) son
**seis**: `00_Config.gs`, `03_Almacen.gs`, `07_Paquete.gs`, `40_Proceso.gs`,
`60_Operacion.gs`, `90_WebApp.gs`, más `Index.html` y `JavaScript.html`. El
diff de esos seis contra `main` es casi todo lo que Cobranza necesita.

---

## 4 · Qué es de verdad distinto en Cobranza

Aquí está el trabajo real. **Cobranza lee más archivos y más raros que CEDIS.**

### Las siete fuentes de Cobranza

De `02_Semillas.gs` en `main`:

| Fuente | Archivo | Lo complicado |
|---|---|---|
| `detalle_colaborador` | `*detalle?colaborador*.xlsx` | — |
| `planta_posiciones` | `planta de cobranza por posiciones*.xlsx` | **La pestaña se elige por fecha en el nombre**, y **el encabezado no está en la fila 1**: se busca por "Número de trabajador" |
| `centros_tipocentros` | el mismo archivo, pestaña `CENTROS-TIPOCENTROS` | Catálogo Centro → Región |
| `planta_centro` | `planta de cobranza por centro*.xlsx` | Solo auditoría, no cruza |
| `pdt_operacion` | `*operaci?n*.xlsx` | 4 pestañas |
| `pdt_gerencial` | `*gerencial*.xlsx` | 4 pestañas + matriz de niveles |
| `finalizaciones` | `cobranza*p*.csv` | Uno o varios cortes parciales |

CEDIS tiene cuatro fuentes y el padrón sale de **una fila por persona** en el
propio CSV. Cobranza arma el padrón cruzando `planta_posiciones` con
`detalle_colaborador`, y eso vive en funciones que CEDIS **borró**:

```
pestanaMasReciente_()     elige pestaña por la fecha de su nombre
filaDelEncabezado_()      busca la fila del encabezado por una columna ancla
padronDesdeDetalle_()     el cruce planta × detalle
indiceCentros_()          Centro → Región
construirPuente_()        el cruce por nombre cuando no hay número
```

**El grueso del trabajo es `pipeline/armar_fuentes_cobranza.py`:** replicar esas
cinco en Python, leyendo `.xlsx` con pandas/openpyxl. `pipeline/armar_fuentes_cedis.py`
es el molde, pero su contenido no sirve: CEDIS no hace ninguno de esos cruces.

### ¿Cobranza necesita aligerado?

**Probablemente no, y hay que medirlo antes de escribirlo.** El aligerado de
CEDIS existe porque sus tres CSV pesan 200 MB y dos rozan los 100 MB del límite
de conversión de Drive. Si los `cobranza*p*.csv` pesan poco, el cuaderno los lee
directo y `aligerar_cobranza.py` no hace falta.

Mide primero. No lo escribas por simetría.

---

## 5 · Los errores que cometí, para que no se repitan

Esto es lo más valioso de este documento. Todos son reales y todos costaron.

**1 · Deduplicar finalizaciones por (persona, curso) perdió 9,161 completadas.**
Me quedé con la primera fila de cada par. Pero el estatus vive en dos columnas
—`¿Lo Completó?` y `Sub Estatus Aprendizaje`— y "Exenta" viene como `No` y
**cuenta como completada**. Quedarse con la primera fila tira el estatus de las
demás: 3.1 puntos de avance, sin un solo error que lo explicara.
**La llave de deduplicación tiene que incluir el estatus.** Y el motor ya hace
el OR él solo, así que ningún archivo intermedio debe opinar de reglas de
negocio.

**2 · Las revisiones corrían después de escribir.** El script fallaba, avisaba,
y los archivos malos ya estaban en la carpeta. Alguien los sube sin volver a
mirar la salida. **Revisar antes de escribir, siempre.**

**3 · `os.makedirs()` sobre una ruta de Drive creó carpetas con la grafía
equivocada.** "Tablero CEDIS" y "Tablero Cedis" son dos carpetas distintas para
el montaje de Drive, pero **la misma** para la búsqueda de Apps Script. Acabas
con los datos en una y el tablero mirando la otra, y todo saliendo en "ok".
**Ningún script debe crear carpetas dentro de Drive.** Si la ruta no existe,
truena y dilo.

**4 · Dos ideas de dónde están los datos.** El cuaderno tenía su constante y
`aligerar_cedis` resolvía la ruta por dentro. Divergieron. **Una sola fuente de
verdad:** la función devuelve la carpeta que usó, y quien llama usa esa.

**5 · Un `glob` que no encuentra nada y sigue.** Los dos PDT no llegaron a la
carpeta de trabajo y el fallo apareció una celda después como un error del
armador de fuentes, que no menciona que el archivo nunca llegó. **Cada copia
que importa lleva su comprobación, y el error dice qué SÍ hay en la carpeta.**

**6 · El cuaderno clonaba `main`, que era el otro tablero.** Falló tres celdas
después con "No module named". **Comprueba que la rama traiga lo que necesitas,
justo después de clonar.**

**7 · GitHub corrompió un zip de 15 MB al renombrarlo desde la web.** Quedó en 2
bytes, dos veces. Está anotado en `Archivos base/README.md`.

**8 · Un nombre de curso que dependía del orden de los archivos.** El nombre
publicado salía del plan y no del alias resuelto, así que el mismo curso
aparecía dos veces. **Los nombres visibles se derivan del valor canónico.**

---

## 6 · Etapas sugeridas

Con lo de CEDIS hecho, esto es bastante más corto. Cinco o seis días.

| | Qué | Días |
|---|---|---|
| **A** | Medir. ¿Cuánto pesan los CSV de Cobranza? ¿Cuánto tarda `procesarCorte()` hoy? Sin estos números no se sabe qué hace falta | 0.5 |
| **B** | `armar_fuentes_cobranza.py` — las cinco funciones de cruce en Python. **Es el grueso** | 2 |
| **C** | `corte_cobranza.ipynb` + `publicarDesdeDrive()` + la carpeta `Paquetes` | 1 |
| **D** | El histórico que agrega en vez de reescribir. **Cobranza tiene la misma bomba**, ver §3 de `08-plan-colab.md` | 1 |
| **E** | Ensayo cronometrado y reescribir `docs/05-operacion.md` | 1 |

---

## 7 · Cómo se verifica que quedó bien

Una sola prueba, y es dura: **correr el mismo periodo por los dos caminos y
exigir que los números salgan idénticos.**

Con CEDIS reprodujo los 23 conteos exactos:

```
14,806 colaboradores · 68.2% · conciliación correcta
284,945 asignados · 194,425 completados · 90,520 pendientes
15,252 − 128 categoría − 85 sin puesto − 233 fecha posterior = 14,806
Resumen 1 · Region 26 · Centro 727 · Curso 27 · Colaborador 14,806 · FiltroCurso 24,645
```

Cuidado con una cosa: al comparar paquetes, **excluye `Control.revision`**, que
es la marca de tiempo de la corrida. Perdí un rato creyendo que el motor era no
determinista y era eso.

Los arneses de prueba de CEDIS (`pipeline/probar_*.js`) corren en Node sin
Google y son el molde para los de Cobranza.

---

## 8 · Lo que sigue pendiente en CEDIS

Por si conviene resolverlo una vez para los dos, porque el código es común:

- **Etapa D, el histórico.** `acumularHistorico_()` lee y reescribe el histórico
  entero cada mes, y crece 25,427 filas mensuales. En un año lee 3.4 M de
  celdas: tan caro como el problema del que se está huyendo. **Le pasa igual a
  Cobranza.**
- Integrar la rama de CEDIS a `main`, para que el cuaderno no dependa de una
  rama que alguien podría borrar.
- 13 puestos sin plan, 85 personas. No mueve ningún número hoy.
