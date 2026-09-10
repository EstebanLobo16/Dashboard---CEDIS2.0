# Tablero de avance de capacitación · CEDIS

Réplica del tablero de Cobranza sobre datos de CEDIS, íntegramente en Google
Apps Script. Universidad Corporativa · Coppel.

> **En construcción · etapas 1 a 6 de 7 terminadas.** La séptima es instalarlo
> en Apps Script: **[`docs/07-ensayo.md`](docs/07-ensayo.md)**. El código heredado de Cobranza
> está completo y probado en producción; lo que falta es adaptarlo a las fuentes
> y las reglas de CEDIS. El plan, con los datos ya medidos, está en
> **[`docs/06-plan-cedis.md`](docs/06-plan-cedis.md)**.
>
> **El motor ya corre contra los datos reales de CEDIS**, fuera de Apps Script,
> con todas las reglas del área puestas: **14,806 colaboradores, 68.2% de avance,
> conciliación correcta**, en 5.9 segundos. Ver `docs/06-plan-cedis.md` §6.
>
> El tablero ya se abre con esos datos en un navegador y los archivos para
> Drive ya se preparan solos. Falta correrlo dentro de Apps Script (etapa 7).

## Por dónde empezar

| Si eres… | Lee |
|---|---|
| Quien va a **instalarlo y publicarlo** | **[`docs/07-ensayo.md`](docs/07-ensayo.md)** — los nueve pasos, con los números que cada uno debe dar |
| Quien va a **construir** este tablero | **[`docs/06-plan-cedis.md`](docs/06-plan-cedis.md)** — el plan, con los datos de CEDIS ya medidos |
| Quien **retoma este proyecto** sin contexto | El plan de arriba, y luego [lo que se hereda de Cobranza](#lo-que-se-hereda-de-cobranza) |
| Quien **usa** el tablero o necesita configurarlo | **[`docs/manual.html`](docs/manual.html)** — el manual completo, ábrelo en el navegador |
| Quien lo va a **instalar** | [`docs/instalacion.html`](docs/instalacion.html) — ábrelo en el navegador |
| Quien **opera** el tablero mes con mes | [`docs/05-operacion.md`](docs/05-operacion.md) |
| Quien **toca el código** | [`src/README.md`](src/README.md) |
| Quien quiere **entender por qué está así** | [`docs/00-propuesta.md`](docs/00-propuesta.md) |

## Qué hay aquí

| Carpeta | Qué es |
|---|---|
| `src/` | El proyecto de Apps Script: almacén, motor, tablero |
| `pipeline/` | Lo que corre fuera de Apps Script: el cuaderno de Colab y las herramientas de prueba |
| `docs/` | La propuesta, el contrato de datos y los manuales |
| `Archivos base/` | Los archivos con que el área alimenta el proceso de **CEDIS** |

## Documentos

| | |
|---|---|
| [`00-propuesta.md`](docs/00-propuesta.md) | Los nueve hallazgos de datos, la arquitectura y las etapas |
| [`01-contrato-de-datos.md`](docs/01-contrato-de-datos.md) | El almacén, el esquema y el modelo de administradores |
| [`02-motor.md`](docs/02-motor.md) | Cómo se calcula un corte y de dónde sale cada número |
| [`03-tablero.md`](docs/03-tablero.md) | La aplicación web |
| [`04-historico.md`](docs/04-historico.md) | Navegar meses cerrados y compararlos |
| [`05-operacion.md`](docs/05-operacion.md) | **El manual del día a día** |
| [`manual.html`](docs/manual.html) | **El manual completo**: reglas, catálogos y configuración |
| [`instalacion.html`](docs/instalacion.html) | Los pasos para instalar y desplegar |
| [`replicar-en-otra-area.md`](docs/replicar-en-otra-area.md) | Cómo levantar el mismo tablero para CEDIS o CATd |
| [`06-plan-cedis.md`](docs/06-plan-cedis.md) | **El plan de trabajo del tablero de CEDIS**: los datos medidos, las siete diferencias con Cobranza y las etapas |
| [`07-ensayo.md`](docs/07-ensayo.md) | **La guía paso a paso para instalarlo y publicar el primer corte**, con los números que cada paso debe reproducir |

## Cómo funciona, en corto

El área deja sus archivos en una carpeta de Drive. El día 11 se revisa que
estén; el 12 el motor los lee, aplica las reglas del plan de capacitación y
publica el corte. El tablero lo muestra, y los meses cerrados quedan en el
histórico.

Las reglas del negocio —qué curso equivale a cuál, qué puesto recibe qué, quién
puede publicar— viven en una hoja de cálculo que el área edita sin tocar código.

---

# Lo que se hereda de Cobranza

Todo lo que sigue describe el **tablero de Cobranza**, que es de donde sale este
código. Se conserva completo a propósito: son los números de referencia, las
trampas que ya costaron horas y las decisiones que no hay que volver a tomar.

Para el estado de **CEDIS**, ver [`docs/06-plan-cedis.md`](docs/06-plan-cedis.md).

## Estado de Cobranza (2026-09-09)

Las cinco etapas están entregadas y el sistema está **instalado y corriendo** en
Apps Script. Lo que falta es cerrar la primera publicación real.

Para ver la instalación concreta —IDs de las tres hojas, las carpetas de Drive,
quién es administrador— corre **`estado()`** desde el editor. No se anotan aquí a
propósito: viven en las propiedades del script y ahí siempre están al día.

## Qué está verificado

El **ensayo de agosto 2026 corrió completo y cuadra**. Estos son los números de
referencia: si una corrida futura sobre las mismas fuentes no los reproduce, algo
cambió.

```
11,094 colaboradores · 84.8% de avance · conciliación: correcta
166,087 asignados · 140,872 completados · 25,215 pendientes

padronLeido: 12,278 − sinFecha 1,139 − fechaPosterior 45 − categoría 0 = 11,094 ✓
origenFechaDePuesto: {detalle: 10997, finalizaciones: 142, contratacion: 0, ninguno: 1139}
finalizacionesLeidas = finalizacionesUsadas = 237,251
puenteIdentificadores: 12,207 · cursosDelPlanSinFuente: 0
```

Los **1,139 sin fecha son normales**: altas y cambios de puesto recientes, sin
cursos registrados todavía. Quedan fuera del corte y no mueven el avance.

**Agosto 2026 ya está publicado.** La primera corrida completa de `procesarCorte()`
cerró bien, desde el editor y en frío, con los números de arriba. El ciclo entero
—ingesta, cálculo, validación, publicación y archivado— está probado de punta a
punta contra datos reales.

## Qué falta

1. **`automatizar()`** — todavía no se ha corrido, así que no hay disparadores: el
   corte no corre solo y el menú *Cobranza* no aparece en la hoja de Catálogos.
   Ya se puede correr: agosto está publicado.
2. **Redesplegar la app web** para que la página use el código actual
   (*Implementar → Administrar implementaciones → ✏️ → Nueva versión*).

## Rendimiento: el punto flojo

Medido sobre agosto, cuenta Workspace (límite de ejecución: **1,800 s**):

| Corrida | Tiempo |
|---|---|
| `ensayarCorte()` en frío (5 conversiones + motor) | **699 s** |
| `procesarCorte()` en frío (lo anterior + escribir 7 pestañas) | **completó**, entre 15 y 25 min |

Cada corte mensual es **en frío**: los archivos son nuevos y `procesarCorte()`
limpia las conversiones al terminar. Así que hay que contar **15–25 minutos por
corte**, con menos holgura de la que quisiéramos frente al límite.

Eso es tolerable mientras corra desatendido a las 6:00 AM del día 12 — nadie lo
espera. Deja de serlo si un corte se pasa de 1,800 s, y el margen no es enorme:
si las finalizaciones crecen de forma apreciable, esto es lo primero que truena. **Si eso pasa, la palanca es una:** dejar de
convertir el CSV de finalizaciones a hoja de cálculo y leerlo directo con
`Utilities.parseCsv()` sobre el blob. Eso elimina la conversión más lenta *y* las
12 lecturas por bloques de 237 mil filas. El riesgo a medir es la memoria al
parsear ~1.66 M de celdas de un jalón. **No está implementado.**

## Trampas que costaron horas (léelas antes de tocar nada)

| Trampa | Qué pasa | Qué hacer |
|---|---|---|
| **La app web corre la versión *desplegada*, no la guardada** | Cambias código, guardas, y la página sigue con el código viejo | *Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión*. Cada vez |
| **Cancelar en el navegador no detiene el servidor** | La ejecución sigue viva; un segundo intento choca con el candado | Verifica en **Ejecuciones** que no haya nada *En curso* |
| **La barra de progreso del tablero es simulada** | Rota mensajes cada 2.2 s sin saber nada del servidor: no distingue "trabajando" de "se cayó" | La verdad está en **Ejecuciones** y en `estadoDelCorte()` |
| **Reemplazar un crudo con el mismo nombre** | Se reutiliza la conversión anterior; el archivo nuevo se ignora en silencio (queda aviso en el registro) | Corre **`limpiarConversiones()`** una vez |
| **El menú *Cobranza* no existe sin `automatizar()`** | Lo instala un disparador `onOpen` | Corre las funciones desde el editor, o corre `automatizar()` |

Republicar el mismo periodo **es seguro**: `escribirTabla_` reescribe cada pestaña
completa y `acumularHistorico_` quita las filas de ese reporte+periodo antes de
agregar. Una corrida cancelada a medias se arregla volviéndola a correr. No hay
que borrar nada a mano — y la pestaña `Bitacora` **no se toca**, es la auditoría.

## Verificar que el código en Apps Script está al día

Busca (Ctrl+F) estos textos en cada pestaña. Si están, esa pestaña tiene los
arreglos de esta sesión:

| Pestaña | Buscar | Qué garantiza |
|---|---|---|
| `20_Fuentes.gs` | `const candidatos = nombre === conExtension` | No reconvierte los cinco archivos en cada corrida |
| `30_Motor.gs` | `diagnostico.personasSinFecha = excluidosSinFecha;` | Recolecta quiénes quedan sin fecha |
| `40_Proceso.gs` | `function personasSinFecha(periodo)` | La función del diagnóstico |
| `40_Proceso.gs` | `const necesarias = filas.length + 1;` | No revienta al escribir más de 1000 filas |
| `60_Operacion.gs` | `function limpiarConversiones()` | La limpieza explícita de conversiones |

## Errores corregidos en esta sesión

| Qué estaba mal | Síntoma | Arreglo |
|---|---|---|
| `aligerar_cedis.py` recortaba el CSV a 5 columnas y tiraba `Fecha Contratación` y `Fecha Asignación Puesto` | El respaldo por finalizaciones nunca se activaba: 1,281 personas sin fecha en vez de 1,139 | Se agregaron las dos columnas y una verificación que aborta si quedan vacías (`e49e988`) |
| La caché de conversiones se buscaba por `~archivo.xlsx`, pero **Drive le quita la extensión al convertir** | No encontraba nunca su propia conversión: reconvertía los 5 archivos en cada corrida y acumulaba duplicados | Se busca con y sin extensión, y se crea sin ella (`d893ec3`) |
| El escritor del diagnóstico no agrandaba la pestaña | Reventaba al escribir 1,139 filas en una pestaña de 1000 | Crece la pestaña antes de escribir (`ab60f3f`) |
| Un intento de invalidar la caché por fecha | Reconvertía todo en cada corrida y la dejaba sin tiempo, sin ningún error | Revertido; el remedio ahora es explícito: `limpiarConversiones()` (`2037880`) |

El primero es el que motivó todo: **el Detalle Colaborador nunca tuvo la culpa.**
`origenFechaDePuesto.detalle` valía 10,997 antes y después; lo único que cambió
fue el respaldo por finalizaciones, de 0 a 142. `1,281 − 142 = 1,139`.

## Decisiones abiertas

- **Mover el diagnóstico de personas sin fecha a local.** Acordado, no hecho.
  Implica quitar `personasSinFecha()` de `40_Proceso.gs` y su ítem de menú de
  `60_Operacion.gs`, **conservar** la recolección en `30_Motor.gs` (es casi
  gratis), y volcar la lista desde `pipeline/correr_motor.js`. El aviso del motor
  todavía manda al menú: hay que ajustar ese texto si se quita.
- **El botón del tablero cuelga de una llamada síncrona de 10+ minutos.** Debería
  disparar el proceso y que la página consulte el estado cada tanto — así muestra
  progreso real y sobrevive a que cierres la pestaña.
- **La optimización de `parseCsv`**, si el rendimiento lo obliga (arriba).

## Cómo se prueba sin desplegar

El motor (`30_Motor.gs`) no toca ningún servicio de Google a propósito, así que
corre en Node:

```bash
node pipeline/correr_motor.js fuentes.json          # el motor contra fuentes reales
node pipeline/montar_tablero.js                     # el tablero en un HTML abrible
node pipeline/probar_ingesta.js — si                # la ingesta contra un Drive simulado
```

La ingesta sí toca Drive, así que `probar_ingesta.js` lo simula: corre el
`leerFuentes_` **real** dos veces seguidas y cuenta las conversiones por archivo.
La segunda corrida debe hacer **0 conversiones y 0 duplicados**. Fue lo que
identificó el bug de la extensión — **córrelo antes y después de tocar
`20_Fuentes.gs`**. El segundo argumento simula si Drive le quita la extensión al
convertir; `si` es el comportamiento real.
