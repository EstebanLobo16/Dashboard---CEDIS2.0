# Etapa 7 · El ensayo dentro de Apps Script

Todo lo anterior corre fuera de Google. Esta etapa es la única que necesita tu
cuenta, y es la que convierte «el motor calcula bien» en «el tablero está
publicando».

**Guárdate una tarde.** Convertir los archivos es lo lento del proceso y no hay
forma de apurarlo. Nada de lo que sigue es reversible-por-accidente: republicar
el mismo periodo es seguro, y una corrida cortada a la mitad se arregla
volviéndola a correr.

---

## Antes de empezar

Ten a la mano:

| | |
|---|---|
| Una cuenta de Google Workspace de Coppel | Va a ser la **dueña** del tablero. Personal, no compartida |
| Los archivos del mes | Ver el paso 3 |
| `docs/instalacion.html` | Los pasos de instalación, con capturas. Ábrelo en el navegador |
| Una cuenta de Colab | Para el paso 3. Con la misma cuenta de Google basta |
| Este documento | Los números que cada paso tiene que reproducir |

Los pasos 1 y 2 solo se hacen **una vez**. Del 3 en adelante es el ciclo mensual.

---

## Paso 1 · Crear el proyecto

Sigue `docs/instalacion.html` hasta *«Copia los 3 archivos de la interfaz»*. En
resumen:

1. [script.google.com](https://script.google.com) → **Nuevo proyecto**, nómbralo
   `Tablero CEDIS`.
2. ⚙️ **Configuración del proyecto** → activa *«Mostrar el archivo de manifiesto
   appsscript.json»*.
3. Pega el contenido de `src/appsscript.json` sobre el manifiesto.
4. Crea los **16 archivos `.gs`** con exactamente los nombres de `src/`, y pega
   cada uno. **El orden importa**: Apps Script los carga alfabéticamente y los
   `const` de nivel superior tienen que existir antes de que alguien los use. Por
   eso van numerados.
5. Crea los **3 archivos HTML** —`Index`, `JavaScript`, `Stylesheet`— sin la
   extensión `.html` en el nombre.

> **Revisión.** El manifiesto tiene que traer el servicio avanzado `Drive` (v2) y
> **cinco** permisos, entre ellos `script.send_mail`. Sin ese último, los avisos
> por correo truenan el día que hagan falta — que es justo el día que algo salió
> mal.

---

## Paso 2 · `instalar()`

En el editor, elige `instalar` en el desplegable de funciones y dale **Ejecutar**.
Google va a pedirte permisos: acéptalos con la cuenta dueña.

Tarda unos segundos y deja en el registro algo así:

```
Carpeta base: Tablero CEDIS (1a2b3c…)
  Datos crudos: https://drive.google.com/…
  Cortes archivados: https://drive.google.com/…
CED · Catálogos: https://docs.google.com/…
CED · Corte vigente: https://docs.google.com/…
CED · Histórico: https://docs.google.com/…
  Parametros: 18 renglones sembrados
  Regiones: 26 renglones sembrados
  MapaRegiones: 3 renglones sembrados
  AliasCursos: 2 renglones sembrados
  AliasPuestos: 1 renglones sembrados
  Agrupaciones: 3 renglones sembrados
  NivelesGerencial: 57 renglones sembrados
  CentrosCosto: 34 renglones sembrados
  PuestosEspecificos: 4 renglones sembrados
  Fuentes: 5 renglones sembrados
```

**Revisa los diez números.** Si alguno no cuadra, la hoja de Catálogos quedó a
medias y hay que arreglarla antes de seguir; `instalar()` se puede volver a
correr sin miedo, pero **no toca una pestaña que ya tenga renglones**.

`ExcepcionImpresion` y `Administradores` salen vacías a propósito: la primera es
de Cobranza, la segunda se llena con quien corre la instalación.

Corre después **`estado()`** y guarda su salida: trae los IDs de las tres hojas y
las dos carpetas. Es lo que le vas a pasar a quien retome esto.

---

## Paso 3 · Preparar y subir los archivos

El área entrega **seis** archivos. Solo tres pasan por el script.

| Archivo | Qué se hace con él |
|---|---|
| `CEDIS P1.csv` · `CEDIS P2.csv` · `CEDIS P3.csv` | **Entran al script.** Salen convertidos en otros dos |
| `PDT-operacion-adaptado.xlsx` | Se sube a Drive **tal cual** |
| `PDT-gerencial-adaptado.xlsx` | Se sube a Drive **tal cual** |
| `detalle_colaborador.xlsx` | Se sube **tal cual**, y es opcional |

Los PDT y el Detalle son chicos y no hay nada que recortarles. Los tres CSV sí:
pesan **200 MB entre los tres**, y dos de ellos rozan los **100 MB**, que es el
límite de conversión de Drive. Sin aligerarlos, el corte no arranca.

### 3.1 · Correr el aligerado, en Colab

1. Sube los tres `CEDIS P*.csv` a una carpeta de tu Drive, si no están ya.
   Ponlos **solos en su carpeta**; es más fácil de apuntar.
2. Abre [colab.research.google.com](https://colab.research.google.com) →
   **Archivo → Nuevo cuaderno**.
3. Abre `pipeline/aligerar_cedis.py`, **cópialo entero** y pégalo en una celda.
4. Arriba del todo, en la celda, llena las dos rutas:

```python
CARPETA_ENTRADA = '/content/drive/MyDrive/CEDIS/crudos de agosto'
CARPETA_SALIDA  = '/content/drive/MyDrive/Tablero CEDIS/Datos crudos'
```

`CARPETA_SALIDA` apuntando directo a **Datos crudos** te ahorra subir 36 MB a
mano: los dos archivos quedan donde el tablero los va a buscar. Si prefieres
revisarlos antes, déjala vacía y salen junto a los originales.

5. **Ejecutar.** Te va a pedir permiso para montar tu Drive: acéptalo.

> ⚠ **Pega el archivo tal cual, sin dejar que Colab te "ayude".** Si el editor
> ofrece autocompletar o corregir algo, recházalo. Una sugerencia de Colab ya
> cambió una línea de este script por una llamada a una función que no existe
> (`pluralize_str_if_needed`), y reventó a media corrida.

> **¿Cómo saco la ruta de una carpeta de Drive?** En Colab, el icono de carpeta
> de la barra izquierda → `drive` → `MyDrive` → navega hasta ella → clic derecho
> → **Copiar ruta**. Siempre empieza con `/content/drive/MyDrive/`.

Tarda unos minutos. Si algo está mal, el script **no escribe nada** y te dice
qué pasó: si no encuentra los CSV, te lista lo que sí hay en esa carpeta.

Si truena con un error de Python que menciona un nombre raro —una función que no
reconoces—, no es tu instalación: es el pegado. Vuelve a copiar el archivo desde
el repo y pégalo en una celda nueva.

### 3.2 · Las seis revisiones

Corren **antes** de escribir nada, así que salen primero. Tienen que dar las seis
en `ok`:

```
  ok   cedis_padron.csv: ninguna columna quedó vacía
  ok   cedis_finalizaciones.csv: ninguna columna quedó vacía
  ok   padrón: 15,252 personas, y en los originales había 15,252
  ok   padrón: 15,252 de 15,252 con "Fecha Contratación"
  ok   padrón: 15,252 de 15,252 con "Fecha Asignación Puesto"
  ok   finalizaciones: no se perdió ninguna completada al deduplicar
```

**Si alguna dice `MAL`, el script para y no escribe nada** — ni siquiera un
archivo a medias. Está bien que sea así: los archivos que produciría se verían
correctos y no lo serían, y nadie vuelve a mirar esta salida antes de subirlos.
Las seis están ahí porque cada una tapa un error que ya costó horas.

Después de las revisiones viene el resumen de peso, que es el que confirma que
valió la pena:

```
  3 archivos  ->  2
  517,615 filas  ->  15,252 de padrón + 468,130 de finalizaciones
  190.5 MB  ->  34.3 MB  (18.0% del original)
```

### 3.3 · Qué queda en Datos crudos

Cinco archivos, ni uno más:

| Archivo | Peso |
|---|---:|
| `cedis_padron.csv` | 2.4 MB |
| `cedis_finalizaciones.csv` | 34.0 MB |
| `PDT-operacion-adaptado.xlsx` | 27 KB |
| `PDT-gerencial-adaptado.xlsx` | 29 KB |
| `detalle_colaborador.xlsx` *(opcional)* | 7.9 MB |

> ⚠ **Los `CEDIS P1/P2/P3.csv` no van ahí.** Ni siquiera "por si acaso": el
> patrón del catálogo busca `cedis?padron*.csv` y `cedis?finalizaciones*.csv`, y
> los originales solo estorban y se arriesgan a que alguien los convierta.

### 3.4 · Confirmar desde Apps Script

Corre **`revisarDatosCrudos()`**, que mira nombres y fechas sin abrir nada:

```
· padron                 ok
· finalizaciones         ok
· pdt_operacion          ok
· pdt_gerencial          ok
· detalle_colaborador    ok

Todas las fuentes obligatorias están y parecen del corte.
```

Si alguna sale **FALTA**, el archivo no está o se llama distinto de lo que
espera el catálogo `Fuentes`. Si sale **POSIBLEMENTE VIEJA**, está pero es de
antes del corte: probablemente subiste los del mes pasado.

### Si no quieres usar Colab

El mismo archivo corre en una terminal con Python y `pandas`:

```bash
pip install pandas
python3 pipeline/aligerar_cedis.py <carpeta-con-los-crudos> [carpeta-de-salida]
```

Manda lo que esté escrito en `CARPETA_ENTRADA`: si lo llenaste, los argumentos
sobran. Déjalo vacío para usar la terminal.

---

## Paso 4 · `ensayarCorte('2026-08')`

**Éste es el paso que decide si algo salió mal.** Calcula el corte completo y
**no publica nada**, así que se puede repetir las veces que haga falta.

Tarda varios minutos: convierte los cinco archivos y lee medio millón de filas.
Si el navegador se queda pensando, no lo canceles — mira **Ejecuciones** en el
menú de la izquierda, que es donde está la verdad.

### Los números que tiene que reproducir

Son los del motor corrido fuera de Google sobre estos mismos archivos. **Si no
salen éstos, algo cambió y hay que entender qué antes de publicar.**

```
14,806 colaboradores · 68.2% de avance · conciliación: correcta
284,945 asignados · 194,425 completados · 90,520 pendientes
```

Y la resta del padrón, que es lo primero que se revisa:

```
padronLeido              15,252
− excluidosPorCategoria     128     Tipo Posición distinto de Operación
− excluidosSinPuestoEnElPlan  85     puesto que ningún PDT nombra
− fechaPosteriorAlCorte     233     altas capturadas después del 31 de agosto
= padronPublicado        14,806  ✓
```

Los demás conteos:

| Conteo | Valor | Qué significa si cambia |
|---|---:|---|
| `cursosDelPlanSinFuente` | **0** | Si sube, un curso del plan dejó de cruzar: le falta un alias |
| `cursosEnFinalizaciones` | 30 | Los cursos distintos que traen los CSV |
| `centrosDeCostoFueraDelCatalogo` | **0** | Si sube, el área abrió un centro de costo que nadie declaró |
| `puestosConPlan` | 104 | Puestos que reciben al menos un curso |
| `personasSinPlan` | **0** | Tiene que ser 0: los excluye `PUESTOS_FUERA_DEL_PLAN` |
| `puestosEspecificosDelCatalogo` | 4 | Los cuatro puestos de chofer que el PDT trae vacíos |
| `fechasCentinela` | 76 | Los `1 ene 1900` descartados |
| `completadasPorSubEstatus` | 7,224 | Las "Exenta" que cuentan como completadas |
| `finalizacionesLeidas` | 468,130 | Igual a `finalizacionesUsadas` |
| `origenFechaDePuesto` | `{padron: 15176, contratacion: 76}` | `ninguno` tiene que ser 0 |
| `centrosConAtributosMezclados` | 78 | Centros que abarcan más de un centro de costo |
| `reglasDePlan` | 2,112 | |

Y las tablas:

```
Resumen 1 · Region 26 · Centro 727 · Curso 27
Colaborador 14,806 · FiltroCurso 24,645 · Control 1
```

### Los cinco avisos normales

`ensayarCorte()` **siempre** deja estos cinco. Que salgan es señal de que todo
funciona; que **falte** alguno es la señal de alarma.

1. Los dos "Introducción a la Seguridad y Salud Laboral **(en)** CEDIS" son el
   mismo curso y se publican como uno.
2. Los dos "Práctica de Conductor al **v/V**olante", igual.
3. Las 76 fechas anteriores a 1950 se descartaron.
4. 85 personas fuera porque su puesto no está en ningún plan, con los 13 puestos
   listados.
5. 7,224 finalizaciones cuentan como completadas por su Sub Estatus.

### Cronometra

Anota cuánto tardó. **Es el dato que falta de todo el proyecto.** El límite de
Apps Script son **1,800 segundos**; el corte de Cobranza tarda entre 15 y 25
minutos con cinco archivos de 17 MB, y CEDIS lleva dos de 36 MB.

Si `ensayarCorte()` se acerca a los 1,800 s, **no publiques todavía** y lee la
sección de rendimiento del `README.md`: la palanca está identificada
(`Utilities.parseCsv()` sobre el blob, sin convertir a hoja) y no está
implementada.

---

## Paso 5 · `procesarCorte()`

Solo cuando el paso 4 cuadre. Hace lo mismo que el ensayo **y además escribe las
siete pestañas** y archiva el corte anterior.

Al terminar, `CED · Corte vigente` tiene que traer las siete pestañas con las
filas de arriba, y la pestaña `Bitacora` de `CED · Histórico` un renglón de
`procesarCorte`.

Corre **`estadoDelCorte()`** para confirmarlo.

> Republicar el mismo periodo **es seguro**. `escribirTabla_` reescribe cada
> pestaña completa y `acumularHistorico_` quita las filas de ese reporte+periodo
> antes de agregar. La `Bitacora` no se toca nunca: es la auditoría.

---

## Paso 6 · Desplegar la aplicación web

**Implementar → Nueva implementación → Aplicación web**, ejecutando **como tú** y
con acceso **para todos los de Coppel**. Copia la URL y ábrela.

Tienes que ver:

- El encabezado diciendo **CEDIS**
- **68.2%** de avance total y **90,520** pendientes
- **26 regiones** en el ranking, con «Ver 21 más»
- **27 cursos** en «Avance por curso», con «Ver 20 más»
- El botón ◎ abriendo el detalle, que pagina **90,520 pendientes**
- Cada persona con su centro **sin la palabra "Centro"** delante:
  `100174359 · 07 CEDIS CROSS OAXC 02 · 045 - DISTRIBUCION FORANEA`

> ⚠ **La trampa que más cuesta.** La app web corre la versión **desplegada**, no
> la guardada. Cada vez que cambies código: *Implementar → Administrar
> implementaciones → ✏️ → Versión: **Nueva versión***. Sin eso la página sigue
> con el código viejo y vas a perseguir un fantasma.

---

## Paso 7 · `automatizar()`

Deja tres cosas corriendo solas:

- **Día 11, 7:00** — revisión de datos crudos. Avisa por correo **solo si falta
  algo**.
- **Día 12, 6:00** — el corte.
- El menú **CEDIS** en la hoja de Catálogos.

Confírmalo con **`estadoDeDisparadores()`**. El menú aparece al **volver a abrir**
la hoja de Catálogos, no antes.

---

## Paso 8 · Dar de alta a los demás

En `CED · Catálogos`, pestaña **Administradores**, un renglón por persona:
correo, nombre, `SI` en `puede_publicar`.

Después: menú **CEDIS → Aplicar cambios de los catálogos** (o `refrescarCatalogos()`
desde el editor). Los catálogos tienen caché de 5 minutos.

---

## Paso 9 · Anotar los números

Cuando cierre, escribe en el `README.md`, en «Qué está verificado», los números
reales de tu corrida: los conteos y **el tiempo**. Es lo que le va a permitir a
quien venga después saber si una corrida futura está bien o algo cambió.

---

## Si algo se atora

| Síntoma | Casi siempre es | Qué hacer |
|---|---|---|
| *No encontré ningún archivo que combine con `cedis?padron*.csv`* | Se subieron los CSV originales | Corre `aligerar_cedis.py` y sube los dos que produce |
| *No se pudo convertir … a hoja de cálculo* | Un archivo de más de 100 MB | Lo mismo |
| Reemplazaste un archivo con el mismo nombre y el corte no cambió | Se reutilizó la conversión vieja | **`limpiarConversiones()`** una vez, y vuelve a procesar |
| La página no refleja un cambio de código | No redesplegaste | *Administrar implementaciones → ✏️ → Nueva versión* |
| El menú *CEDIS* no aparece | Falta `automatizar()` | Córrelo, y vuelve a abrir la hoja |
| Se cortó a la mitad | Tiempo, o lo cancelaste | Verifica en **Ejecuciones** que no haya nada *En curso*, y vuelve a correr |
| Un curso salió en 0% | Cambió de nombre en la fuente | Agrégalo a `AliasCursos` y refresca catálogos |
| Aparecieron personas con "0 de 0 cursos" | `PUESTOS_FUERA_DEL_PLAN` en `PUBLICAR` | Debe decir `EXCLUIR` |

**Lo primero, siempre, es `diagnostico()`**: junta el estado de la instalación,
el último corte, el histórico, los datos crudos y los disparadores en una sola
corrida.

---

## Lo que queda pendiente después de esto

1. **El tiempo del corte.** Es el único riesgo abierto del proyecto y solo se
   mide corriéndolo.
2. **`OTROS_REPORTES`**, para enlazar con el tablero de Cobranza. Necesita su URL
   de despliegue, que solo existe si Cobranza ya está desplegado.
3. **Los 13 puestos sin plan** (85 personas). Si alguno debe llevar plan, va al
   PDT; si se llama distinto que en el plan, a `AliasPuestos`.
4. **Los renglones de `NivelesGerencial` marcados «por confirmar»**. Ninguno mueve
   un número hoy —todos caen dentro de la misma banda o no tienen a nadie— pero
   el día que alguien ocupe uno de esos puestos, conviene que estén bien.
