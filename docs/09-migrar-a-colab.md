# Migrar el corte a Colab · paso a paso

El cálculo sale de Apps Script y se va a Colab. Apps Script se queda con lo que
sabe hacer rápido: publicar.

**Se hace una vez.** Después, el mes normal son dos pasos: correr el cuaderno y
publicar — o ni eso, si dejas el corte automático del día 12.

| | Antes | Después |
|---|---|---|
| Calcular | Apps Script · **19 min** de 30 | Colab · **6 s** |
| Publicar | lo mismo, más escribir | Apps Script · minutos |
| El botón del tablero | colgado 20 minutos | responde |
| Los archivos crudos | se suben aligerados a mano | se dejan tal cual; el cuaderno aligera |

---

## Antes de empezar

| | |
|---|---|
| El tablero instalado | Los pasos 1 y 2 de [`07-ensayo.md`](07-ensayo.md) |
| Un token de GitHub | Para que Colab clone el repo, que es privado |
| La misma cuenta de Google | Para Drive, Colab y la hoja de Catálogos |

---

## Paso 1 · El token de GitHub

Colab tiene que clonar el repo para usar **el motor de producción**, no una copia.

1. En GitHub: tu foto → **Settings** → **Developer settings** → **Personal access
   tokens** → **Tokens (classic)** → **Generate new token**.
2. Nombre: `Colab CEDIS`. Vigencia: la que te deje tu política. Permiso: solo
   **`repo`**.
3. Cópialo. **Solo se ve una vez.**

Guárdalo en Colab, no en una celda:

4. Abre [colab.research.google.com](https://colab.research.google.com) → cuaderno
   nuevo.
5. Icono de la **llave** (barra izquierda) → **Agregar secreto**.
6. Nombre `GITHUB_TOKEN`, valor el token, y activa **Acceso del cuaderno**.

> **Nunca lo pegues en una celda.** Un cuaderno se comparte, se exporta y se
> guarda en Drive; un secreto no viaja con él.

---

## Paso 2 · Actualizar el código en Apps Script

> **No se borra ningún archivo.** El proyecto sigue teniendo los mismos 19, más
> el manifiesto. Estos ocho **cambiaron** y hay que pegarlos encima; los otros
> once se quedan exactamente como están. Si borraras alguno, el tablero deja de
> arrancar: todo cuelga de todo.

Del repo, vuelve a copiar **solo estos ocho** sobre el editor:

| Archivo | Qué trae |
|---|---|
| `00_Config.gs` | La carpeta `Paquetes` y su clave |
| `03_Almacen.gs` | Que `instalar()` la cree |
| `07_Paquete.gs` | **`publicarDesdeDrive()`** |
| `40_Proceso.gs` | El disparador del día 12 publica en vez de calcular |
| `60_Operacion.gs` | *Publicar el corte del mes* en el menú, y la revisión del día 11 |
| `90_WebApp.gs` | El botón del tablero |
| `Index.html` · `JavaScript.html` | Los textos del botón |

Y estos **once no se tocan**, aunque sigan siendo necesarios:

| Archivo | Por qué se queda |
|---|---|
| `01_Esquema.gs` | El contrato de datos. Lo usa el validador del paquete |
| `02_Semillas.gs` | El contenido inicial de los catálogos |
| `04_Catalogos.gs` | Lee las reglas de la hoja |
| `05_Acceso.gs` | Quién puede publicar. La reja de `publicarPaquete()` |
| `06_Bitacora.gs` | El registro de quién hizo qué |
| `10_Util.gs` | Fechas, normalización de texto, rangos |
| `20_Fuentes.gs` · `30_Motor.gs` · `31_Opciones.gs` | El camino alterno: calcular aquí si Colab no está |
| `50_Historico.gs` | Navegar meses cerrados y recuperar su detalle |
| `Stylesheet.html` | La interfaz |
| `appsscript.json` | El manifiesto: permisos y servicio de Drive |

> **Ojo con los catálogos.** Volver a copiar un `.gs` actualiza el **código**. Si
> lo que cambió fue una **regla** —un alias, un nivel gerencial— eso vive en la
> hoja `CED · Catálogos`, y `instalar()` **no pisa una pestaña que ya tenga
> renglones**. Esas se editan en la hoja, y después *CEDIS → Aplicar cambios de
> los catálogos*.

Después corre **`instalar()`** otra vez. Es seguro: **no toca nada de lo que ya
existe**, solo crea lo que falta. Tiene que aparecer un renglón nuevo:

```
Carpeta base: Tablero CEDIS (…)
  Datos crudos: https://drive.google.com/…
  Paquetes: https://drive.google.com/…          ← nuevo
  Cortes archivados: https://drive.google.com/…
```

**Abre esa URL de *Paquetes* y guárdala**, que la vas a necesitar en el paso 4.

> ⚠ **Redespliega la app web.** *Implementar → Administrar implementaciones → ✏️
> → Versión: **Nueva versión***. Sin eso el botón sigue llamando al código viejo
> y va a tardar veinte minutos.

---

## Paso 3 · Subir el cuaderno a Colab

1. Del repo, descarga `pipeline/colab/corte_cedis.ipynb`.
2. En Colab: **Archivo → Subir cuaderno** → elígelo.
3. Guárdalo en tu Drive (**Archivo → Guardar una copia en Drive**) para no volver
   a subirlo cada mes.

---

## Paso 4 · Ajustar la primera celda

Es lo único que se edita, y solo esta vez:

```python
CARPETA_CRUDOS   = '/content/drive/MyDrive/Tablero CEDIS/Datos crudos'
CARPETA_PAQUETES = '/content/drive/MyDrive/Tablero CEDIS/Paquetes'
PERIODO = ''          # vacío = el mes anterior al día de hoy
```

> ⚠ **Copia esas rutas, no las escribas.** Para Drive, `Tablero CEDIS` y `Tablero
> Cedis` son **dos carpetas distintas**, y el tablero solo mira las que creó
> `instalar()`. Abre las URLs del paso 2 para saber cuáles son, y saca la ruta
> del panel de archivos de Colab con clic derecho → **Copiar ruta**.

---

## Paso 5 · La primera corrida

**Entorno de ejecución → Ejecutar todo.** La primera vez pide permiso para montar
Drive y para leer tus hojas: acéptalos con la cuenta dueña del tablero.

Unos minutos. Lo que tiene que salir, en orden:

```
repo: EstebanLobo16/Dashboard---CEDIS2.0 @ main (0da87fa)
node: v20.x

catálogos: CED · Catálogos
  Parametros            18 renglones
  Regiones              26 renglones
  NivelesGerencial      57 renglones
  …

revisiones
  ok   padrón: 15,252 personas, y en los originales había 15,252
  ok   finalizaciones: no se perdió ninguna completada al deduplicar
  …

corte 2026-08 · fecha 2026-08-31 · 6.4 s
  14,806 colaboradores · 284,945 asignados · 194,425 completados
  conciliación: correcta
```

**Los números tienen que ser ésos.** Son los mismos que dio `ensayarCorte()`
dentro de Apps Script, en 19 minutos. Si no coinciden, algo cambió y hay que
entender qué antes de publicar.

La última celda termina con la ruta del paquete y su peso (~12 MB).

---

## Paso 6 · Publicar

Cualquiera de los tres, dan lo mismo:

| Dónde | Cómo |
|---|---|
| **El tablero** | Botón **Publicar corte** |
| **La hoja de Catálogos** | Menú *CEDIS → Publicar el corte del mes* |
| **El editor** | `publicarDesdeDrive('2026-08')` |

Tarda **minutos, no decenas**: solo escribe. Valida el paquete, archiva el
detalle del mes anterior, escribe las siete pestañas y acumula el histórico.

Republicar el mismo periodo es seguro.

---

## Paso 7 · Dejarlo corriendo

Si ya corriste `automatizar()`, no hay nada que hacer: el disparador del día 12
**ya publica desde Drive**. Si no:

```
automatizar()
```

Queda así:

- **Día 11, 7:00** — revisa que **el paquete** esté. Avisa por correo solo si
  falta.
- **Día 12, 6:00** — publica el paquete que esté esperando.

O sea: la parte lenta y frágil quedó automática, y lo que necesita a una persona
es la parte que tarda seis segundos.

---

## El mes normal, después de esto

1. El área deja sus archivos en **Datos crudos** — igual que siempre, sin
   aligerar.
2. Abres el cuaderno y das **Ejecutar todo**. Cinco minutos.
3. El día 12 se publica solo. (O le das al botón, si tienes prisa.)

---

## ¿Y `aligerar_cedis.py`? ¿Lo corro aparte?

**No.** El cuaderno lo corre por ti. La celda 4 hace esto:

```python
sys.path.insert(0, '/content/repo/pipeline')
import aligerar_cedis
aligerar_cedis.CARPETA_ENTRADA = CARPETA_CRUDOS      # Datos crudos, en tu Drive
aligerar_cedis.CARPETA_SALIDA  = '/content/trabajo'  # disco local de Colab
aligerar_cedis.main(instrucciones=False)
```

O sea: es el mismo archivo de siempre, pero importado en vez de pegado en una
celda. No hay una segunda copia que mantener.

De ahí se desprenden las tres respuestas:

| Pregunta | Respuesta |
|---|---|
| ¿Tengo que aligerar antes de subir? | **No.** Sube los tres `CEDIS P*.csv` como los entrega el área |
| ¿Dejo los tres originales en *Datos crudos*? | **Sí**, y ahí se quedan. El cuaderno los lee, no los toca |
| ¿Sigue sirviendo suelto? | **Sí.** Es el camino alterno: `python3 pipeline/aligerar_cedis.py <carpeta>`, o pegado en una celda, para cuando vayas a correr `procesarCorte()` dentro de Apps Script |

Por qué el aligerado se quedó donde está: el cuaderno lo hace sobre el **disco
local de Colab**, no sobre Drive. Leer 200 MB desde Drive montado y escribir 36
de vuelta es lo que tardaría; leer una vez y trabajar en local, no.

Con `DEJAR_ALIGERADOS_EN_DRIVE = True` (así viene), al terminar copia
`cedis_padron.csv` y `cedis_finalizaciones.csv` de vuelta a *Datos crudos*. No
los necesita el cuaderno: son para dejar rastro y para que el camino alterno
—`procesarCorte()` dentro de Apps Script— encuentre lo que espera sin que
tengas que aligerar de nuevo.

**Volver a correrlo es seguro.** El script busca `CEDIS P*.csv` y excluye por
nombre exacto `cedis_padron.csv` y `cedis_finalizaciones.csv`, así que sus
propias salidas nunca vuelven a entrar como entradas, corras el cuaderno una
vez o cinco.

Lo único que sí tienes que hacer cada mes: **borrar los CSV del mes pasado**
antes de subir los nuevos. El script se traga *todos* los `CEDIS P*.csv` que
encuentre en la carpeta, y no tiene forma de saber cuáles son de agosto y
cuáles de septiembre.

---

## Si tu carpeta se llama "Tablero Cedis" y no "Tablero CEDIS"

No borres nada, y no tienes dos carpetas: tienes una.

`instalar()` no crea la carpeta a ciegas — primero la busca por nombre, y la
búsqueda de Drive **no distingue mayúsculas**. Encontró la que ya tenías, la
reusó, y guardó su ID en `CED_ID_CARPETA_BASE`. De ahí en adelante el tablero
trabaja con el **ID**, no con el nombre: le da igual cómo se llame.

El problema es del otro lado. El montaje de Drive en Colab **sí** distingue
mayúsculas, y ahí `/Tablero CEDIS/` y `/Tablero Cedis/` son rutas distintas.

Para saber cuál es la tuya, corre `estado()` en el editor de Apps Script: te
imprime el ID de la carpeta base. Ábrela en
`drive.google.com/drive/folders/<ese-id>` — esa, la que el tablero mira de
verdad.

El cuaderno ya lo resuelve solo: la celda 4 corre `ruta_real()`, que corrige las
mayúsculas de la ruta y te dice si tuvo que hacerlo. Si prefieres, escribe el
nombre exacto en `CARPETA_CRUDOS` y no hace nada.

Lo que **no** debes hacer es crear una segunda carpeta con la otra grafía.
Acabarías con los datos en una y el tablero mirando la otra, y todo saliendo en
"ok". Por eso ni el cuaderno ni el aligerado crean carpetas dentro de Drive: si
la ruta no existe, truenan y te lo dicen.

---

## Qué pasa con lo de antes

**Nada se borra.** El camino viejo sigue ahí, demotado a alterno:

| | |
|---|---|
| `procesarCorte()` | Sigue funcionando. Es el respaldo si Colab no está disponible — con sus 19 minutos |
| `ensayarCorte()` | Igual. Sirve para contrastar contra el cuaderno |
| El botón *Actualizar datos* | Igual. Para subir un paquete a mano |
| Los dos CSV aligerados | El cuaderno los sigue dejando en Datos crudos, para el camino alterno y para dejar rastro |

El histórico y los cortes archivados **no cambian en absoluto**: se construyen
desde el paquete, y el paquete es el mismo venga de donde venga.

---

## Si algo se atora

| Síntoma | Qué pasa | Qué hacer |
|---|---|---|
| *No encontré el secreto GITHUB_TOKEN* | No está o no tiene acceso del cuaderno | Paso 1, y revisa el interruptor |
| *Falló: git clone* | Token vencido o sin permiso `repo` | Genera otro |
| *SpreadsheetNotFound* | La hoja no se llama así, o hay dos | Pon su ID en `CATALOGOS_ID` |
| *No encontré ningún "CEDIS P*.csv"* | El área no dejó los archivos, o con otro nombre | El cuaderno lista lo que sí hay en la carpeta |
| *No está "cedis-2026-08.json"* | No corriste el cuaderno para ese mes | Córrelo. El error lista lo que sí hay en Paquetes |
| El botón tarda 20 minutos | No redesplegaste la app web | Paso 2, la advertencia |
| Los números no son los de arriba | Cambiaron los datos, o un catálogo | Compara contra `ensayarCorte()`: los dos leen lo mismo |

Lo primero, siempre, es **`diagnostico()`**.

---

## Lo que queda pendiente

1. **La etapa D del plan** ([`08-plan-colab.md`](08-plan-colab.md) §3):
   `acumularHistorico_()` reescribe el histórico completo cada mes, y el
   histórico crece 25,427 filas mensuales. En un año sería tan caro como el
   problema del que acabamos de salir.
2. **Cronometrar la publicación.** Es el número que falta para saber cuánta
   pista queda.
