# Plan de trabajo · Mover el cálculo a Colab

El corte no cabe en Apps Script. Este documento es qué implica sacarlo de ahí,
de dónde salen los archivos, dónde queda el del tablero y qué pasa con el
histórico.

---

## 1 · Por qué, en una tabla

| | |
|---|---:|
| El motor, en Node | **5.9 s** |
| `ensayarCorte()` en Apps Script | **19 min**, contra un límite de 30 |
| `procesarCorte()` | lo anterior **+ escribir 7 pestañas** |

Cabe, pero apenas. Y el margen no se queda quieto: los datos crecen, y
`acumularHistorico_()` se pone más lento cada mes (§3).

El cálculo es el 0.5% del tiempo. El resto se va en **convertir un CSV de 34 MB
a hoja de Google y leer 3.8 millones de celdas de vuelta**. Sheets no es una base
de datos: es un transporte carísimo que usamos porque es lo que Apps Script sabe
leer.

La buena noticia es que el diseño ya previó esto. `30_Motor.gs` **no toca ningún
servicio de Google a propósito** —por eso corre en Node— y ya existe un contrato
de paquete `.json` documentado, con su validador y su ruta de publicación
probada. El cálculo se puede mudar **sin tocar el tablero**.

> **La regla que no se negocia:** Colab tiene que correr **el mismo archivo**,
> no una traducción a Python. Este proyecto nació de un cuaderno de Colab y un
> tablero calculando distinto sin que nadie supiera cuál tenía razón. Repetirlo
> sería deshacer el trabajo.

---

## 2 · Cómo queda el flujo

```
  El área                Colab                        Apps Script
  ───────                ─────                        ───────────
  deja 6 archivos  →  monta Drive
  en Datos crudos     lee los catálogos de la hoja
                      aligera los CSV
                      corre correr_motor.js  (6 s)
                      escribe Paquetes/cedis-2026-08.json
                                                  →   Publicar corte
                                                      valida, archiva,
                                                      escribe 7 pestañas,
                                                      acumula el histórico
```

### De dónde se chupan los archivos

**De la misma carpeta de siempre: `Tablero CEDIS/Datos crudos`.** Para el área no
cambia nada — deja sus seis archivos igual que hoy.

Colab monta tu Drive (`/content/drive/MyDrive/…`) y los lee de ahí. Y hace el
aligerado por dentro, así que **deja de ser un paso aparte**: el cuaderno lee los
`CEDIS P*.csv` originales.

Sigue escribiendo `cedis_padron.csv` y `cedis_finalizaciones.csv` en la carpeta,
por dos razones: dejan rastro de qué se procesó, y mantienen usable el camino
alterno por Apps Script si algún día hace falta.

### Dónde se coloca el archivo del tablero

En una carpeta nueva, hermana de las otras dos:

```
Tablero CEDIS/                    ← la crea instalar()
├── Datos crudos/                 ← los 6 archivos del área  (ya existe)
├── Paquetes/                     ← NUEVO: cedis-2026-08.json
└── Cortes archivados/            ← el detalle de meses cerrados  (ya existe)
```

**El paquete no se sube por el navegador.** Se queda en Drive y el tablero lo lee
de ahí con una función nueva, `publicarDesdeDrive()`. Eso evita bajar y volver a
subir 12.6 MB, y —más importante— **deja vivo el disparador del día 12**: si el
paquete está, el corte se publica solo a las 6:00, sin nadie mirando.

El botón *Actualizar datos* del tablero se queda como está, para el caso en que
alguien traiga un paquete a mano.

---

## 3 · El histórico

**No cambia nada.** Es la parte que ya estaba bien resuelta.

El histórico no se construye leyendo archivos crudos: se construye **desde el
paquete**, en el momento de publicar. Como Colab produce exactamente el mismo
paquete que produce hoy Apps Script, `publicarPaquete()` no distingue de dónde
vino y hace lo de siempre, en este orden:

1. **`validarPaquete_`** — formato, versión, reporte, periodo, las siete pestañas
   con sus columnas exactas, y la conciliación algebraica. Si algo no cuadra,
   rechaza **antes de escribir nada**.
2. **`archivarCorteAnterior_`** — guarda el `Colaborador` del mes que estaba
   publicado como `cedis-colaborador-2026-07.json` en *Cortes archivados*.
3. **Escribe las 7 pestañas** en `CED · Corte vigente`.
4. **`acumularHistorico_`** — mete 6 de esas 7 pestañas en `CED · Histórico`,
   quitando primero las filas de ese mismo periodo. **Por eso republicar el mismo
   mes es seguro.**

`Colaborador` es la única pestaña que **no** entra al histórico, y es a propósito:
son 14,806 filas por 23 columnas cada mes. El detalle por persona de los meses
cerrados vive como `.json` en Drive, y el tablero lo dice cuando abres un mes
viejo. Así el tablero rinde igual en el mes 40 que en el mes 1.

### Pero el histórico tiene su propia bomba de tiempo

Esto lo encontré al revisar, y **Colab no lo arregla**: viene de antes y también
le pasa a Cobranza.

`acumularHistorico_()` **lee el histórico completo y lo reescribe entero** cada
mes. Y el histórico crece **25,427 filas por mes**:

| Pestaña | Filas por mes |
|---|---:|
| FiltroCurso | **24,645** ← el 97% |
| Centro | 727 |
| Curso | 27 |
| Region | 26 |
| Resumen · Control | 2 |

| | Filas acumuladas | Celdas que lee **y** reescribe cada mes |
|---|---:|---:|
| Tras un año | 305,124 | ~3.4 M |
| Tras 40 meses | 1,017,080 | ~11.2 M |

Para dimensionarlo: leer 3.8 M de celdas es justo lo que hoy no cabe en 30
minutos. O sea que **en un año el histórico solo sería tan caro como el problema
del que estamos huyendo.**

El arreglo es directo y va en este plan: **agregar en vez de reescribir**. Un mes
nuevo se añade al final; solo cuando se republica un periodo que ya estaba hay
que reescribir. Es la etapa D.

---

## 4 · Qué cambia y qué no

| | |
|---|---|
| **No se toca** | `30_Motor.gs`, `01_Esquema.gs`, el tablero, los catálogos, el esquema del paquete, el archivado del detalle |
| **Cambia poco** | `07_Paquete.gs` (una función nueva), `00_Config.gs` y `03_Almacen.gs` (una carpeta), `40_Proceso.gs` y `60_Operacion.gs` (el disparador y el menú) |
| **Se demota** | `20_Fuentes.gs` — deja de ser el camino normal y pasa a ser el alterno. Se conserva, y `probar_ingesta.js` lo sigue probando para que no se pudra |
| **Nace** | El cuaderno de Colab |

---

## 5 · Las dos trampas del plan

### 5.1 · Los catálogos tienen que venir de la hoja, no del código

Hoy `correr_motor.js` arma sus opciones desde las **SEMILLAS**, que es el
contenido *inicial* del catálogo. Si el área corrige un alias de curso o cambia
un nivel gerencial en `CED · Catálogos`, **Colab no se enteraría** y publicaría
con las reglas viejas.

Eso rompería el principio del proyecto: *las reglas del negocio viven en una hoja
que el área edita sin tocar código*.

Así que el cuaderno **lee la hoja de Catálogos** con `gspread`, autenticado con la
misma cuenta que montó Drive, y se la pasa al motor. Es la etapa C, y no es
opcional.

### 5.2 · El motor tiene que ser el de producción

El cuaderno clona el repo para usar `src/30_Motor.gs` tal cual. Como el repo es
privado, hace falta un token de GitHub guardado en **Secrets de Colab** (el icono
de la llave), no pegado en una celda.

La alternativa —guardar una copia de `src/` en Drive— es peor: se desincroniza en
silencio, que es exactamente la enfermedad que este proyecto vino a curar.

---

## 6 · Las etapas

| | Etapa | Días |
|---|---|---:|
| **A** | El paquete desde Colab | 2 |
| **B** | Publicar desde Drive | 1 |
| **C** | Los catálogos desde la hoja | 1 |
| **D** | El histórico que no se reescribe entero | 1 |
| **E** | Ensayo y documentación | 1 |
| | | **6** |

### A · El paquete desde Colab · 2 días · **HECHA** (con la C adentro)

La etapa C —los catálogos desde la hoja— se hizo aquí y no aparte: un cuaderno
que publicara con las semillas del código en vez de con la hoja sería una trampa,
no un avance a medias.

Y de paso, `correr_motor.js` **dejó de duplicar la lógica de los catálogos**.
Traía su propia copia de `opcionesDelCorte_` —los alias, los niveles, las
agrupaciones, la lista blanca de centros—, unas 60 líneas. Ahora carga
`04_Catalogos.gs` y `31_Opciones.gs` tal cual y solo sustituye `catalogo_()`,
que es la única función que habla con la hoja. Esa copia era exactamente la
enfermedad que el proyecto vino a curar.

**Verificado:**

- el paquete de agosto pasa `validar_paquete.js`, y los 11 casos rotos siguen
  siendo rechazados
- correr con `--catalogos` da **exactamente lo mismo** que correr con las semillas
  (cuando el archivo trae las mismas reglas, que es la prueba de que el formato
  no pierde nada)
- el motor es **determinista**: dos corridas del mismo archivo dan las siete
  tablas idénticas — lo único que cambia entre corridas es `Control.revision`,
  que *es* la hora
- la cadena completa del cuaderno —aligerar → armar fuentes → motor → paquete—
  corre de punta a punta y da los números conocidos

#### Los pasos originales

- `correr_motor.js` emite el paquete con el formato del contrato —ya lo hace a
  medias— y acepta un `catalogos.json` en vez de las semillas.
- El cuaderno: monta Drive, clona el repo, instala Node, aligera, corre el motor,
  escribe `Paquetes/cedis-<periodo>.json`.
- **Verificación:** `node pipeline/validar_paquete.js <paquete>` pasa, y el
  paquete de Colab sale **idéntico** al que produce el motor aquí.

### B · Publicar desde Drive · 1 día

- Carpeta `Paquetes` en `00_Config.gs` y `03_Almacen.gs`.
- `publicarDesdeDrive(periodo)`: busca el paquete del periodo, lo lee y llama a
  `publicarPaquete()`. Toda la validación y el histórico ya viven ahí.
- El disparador del día 12 publica desde Drive en vez de procesar.
- El día 11 revisa que **el paquete** esté, no los crudos.
- **Verificación:** publicar el corte de agosto y que las 7 pestañas queden con
  los números conocidos.

### C · Los catálogos desde la hoja · 1 día

- El cuaderno lee `CED · Catálogos` con `gspread` y emite `catalogos.json`.
- **Verificación:** cambiar un alias en la hoja y ver que el corte lo respeta.

### D · El histórico que no se reescribe entero · 1 día

- `acumularHistorico_()` agrega al final cuando el periodo es nuevo, y solo
  reescribe cuando se republica uno existente.
- **Verificación:** publicar tres meses seguidos y medir que el tercero no tarde
  más que el primero.

### E · Ensayo y documentación · 1 día

- El ciclo completo, cronometrado.
- Reescribir `docs/05-operacion.md` y `docs/07-ensayo.md` con el flujo nuevo.

---

## 7 · Lo que se pierde

**Deja de ser completamente desatendido.** Alguien tiene que abrir Colab y darle
*Ejecutar todo* el día 11 o 12. Son cinco minutos, pero es una persona.

El disparador del día 12 **sí sobrevive** —publica el paquete que esté esperando—
así que la parte lenta y frágil queda automática. Lo que necesita una persona es
la parte que tarda cinco minutos y nunca falla.

Colab no se puede programar de forma confiable en la versión gratuita. Si algún
día eso pesa, la respuesta es Cloud Run, que hoy está descartado.

---

## 8 · Tiempos esperados

| Paso | Estimado |
|---|---|
| Colab: leer 200 MB y aligerar | 2–3 min |
| Colab: el motor | **6 s** |
| Apps Script: validar y publicar | minutos, **no decenas** |

La publicación escribe unas 620 mil celdas. Es un orden de magnitud menos que los
3.8 millones que hoy tiene que **leer**, y por eso debería caber con holgura. Hay
que medirlo, no suponerlo — es la etapa E.
