# El histórico — etapa 4

Acumular cortes ya ocurría al publicar desde la etapa 1. Esta etapa es lo que
hace que ese histórico sirva de algo: navegarlo, compararlo, llenarlo hacia atrás
y recuperar lo archivado.

## Qué guarda y dónde

| | Dónde | Cuánto |
|---|---|---|
| Agregados por mes | `COB · Histórico` | ~3,700 filas por corte |
| Detalle por colaborador del mes publicado | `COB · Corte vigente` | 11,100 filas |
| Detalle de meses cerrados | `.json` en Drive | ~4 MB por mes |

El detalle por colaborador **no** se acumula: son 11 mil filas por mes y en un
año serían 2.9 millones de celdas que el tablero tendría que atravesar en cada
filtro. Al publicar un corte nuevo, el detalle del anterior se guarda como
`cobranza-colaborador-<AAAA-MM>.json` en la carpeta *Cortes archivados*.

Con ese reparto el tablero rinde igual en el mes 1 que en el mes 40, y
`estadoHistorico()` dice cuántos periodos caben todavía antes del tope de 10
millones de celdas — medido, no supuesto.

## Navegar meses

Los selectores de **Año** y **Mes** dejaron de ser decorativos. En el tablero de
Tienda están deshabilitados porque no hay histórico que recorrer; aquí abren
cualquier mes publicado.

Al abrir un mes cerrado:

- los indicadores, el ranking regional, los cursos y los filtros son los de ese
  mes, servidos desde el histórico;
- **el detalle por colaborador no está**, y el tablero lo dice con un aviso que
  enlaza al archivo en Drive. Devolver una tabla vacía parecería un error;
- los filtros se limpian al cambiar de mes: los puestos y cursos de un mes
  cerrado no tienen por qué ser los mismos que los del corte vigente.

Con un solo corte publicado los selectores quedan fijos, igual que en Tienda.

## Comparar contra el mes anterior

Es la pregunta que de verdad se hace quien abre el tablero: *¿subimos o bajamos?*

Cada indicador y cada región traen su cambio contra el mes anterior. Dos
decisiones que importan:

**Los deltas de avance van en puntos porcentuales.** De 80% a 84% es **+4 pp**,
no +5%. Confundir las dos formas es la manera más fácil de que un tablero diga
algo que no es.

**El color acompaña al signo, nunca lo sustituye.** Y la dirección no siempre es
la del número: en *Pendientes*, bajar es bueno, así que un −500 va en verde.

Cuando el cambio redondeado a un decimal da cero, se lee «sin cambio» en gris.
Un «−0.0 pp» solo confunde.

Los deltas desaparecen si hay filtros puestos: el histórico solo guarda totales y
no se puede filtrar hacia atrás sin inventar.

## Llenar el año hacia atrás

`cargarHistorico(contenido)` mete un corte viejo al histórico **sin tocar el
corte vigente**, y archiva su detalle en Drive como si se hubiera publicado en su
momento. Sirve para cargar los meses que ya se procesaron antes de que existiera
el tablero.

Se niega a cargar un periodo igual o posterior al publicado: eso no es cargar
histórico, es publicar, y para eso está `publicarPaquete()`.

## Recuperar un mes archivado

`restaurarCorteArchivado("2026-07")` vuelve a poner ese mes en el corte vigente,
detalle por colaborador incluido. Es una operación de excepción —una auditoría,
reconstruir un mes— y sustituye lo que está publicado, así que **archiva primero
lo que va a pisar**: siempre se puede volver.

Si el archivo se guardó con un esquema de columnas distinto al vigente, se niega
y da el enlace para consultarlo en Drive a mano. Restaurar a ciegas un archivo
con otras columnas dejaría los datos cruzados en silencio.

## Funciones nuevas

| Función | Para qué |
|---|---|
| `estadoHistorico()` | Cuántos periodos, cuántas filas, cuánto falta para el tope |
| `cargarHistorico(contenido)` | Mete un corte anterior sin tocar el vigente |
| `restaurarCorteArchivado(periodo)` | Devuelve un mes archivado al corte vigente |

## Verificación

Se montó el tablero con un histórico de cuatro meses (mayo a agosto) derivado del
corte real y se abrió en un navegador. Sin errores de consola:

- el selector de mes lista los cuatro periodos, con el vigente marcado;
- al elegir junio, el tablero carga sus agregados, marca el periodo como
  «cerrado» y muestra el aviso con el enlace al archivo;
- los indicadores y el ranking traen su delta contra el mes anterior, en puntos
  porcentuales y con el color siguiendo al signo;
- al volver a agosto, el detalle por colaborador vuelve a estar disponible.

Los meses de prueba se derivan escalando el corte de agosto, así que sus avances
salen parecidos; lo que se verifica es la navegación y el cálculo de los deltas,
no las cifras de esos meses.

Lo que **no** verifica: los tiempos reales de lectura del histórico dentro de
Apps Script cuando lleve un año acumulado. `estadoHistorico()` existe justo para
poder medirlo cuando llegue el momento.
