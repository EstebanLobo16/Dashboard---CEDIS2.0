# El tablero — etapa 3

La aplicación web. Misma estructura, mismos indicadores, mismos filtros y mismo
comportamiento que el tablero de Tienda: los selectores con búsqueda interna, los
esqueletos de carga, el buscador con sugerencias, la paginación, los estados
vacíos y de error, y el modal de publicación.

| Archivo | Qué es |
|---|---|
| `90_WebApp.gs` | Lo que el tablero le pide al servidor |
| `Index.html` | La estructura |
| `JavaScript.html` | El comportamiento |
| `Stylesheet.html` | La hoja del tablero de Tienda, más lo que Cobranza necesita |

La hoja de estilos se copió tal cual: es la identidad visual del reporte y no
había razón para tocarla. Lo añadido está al final del archivo, en su propio
bloque, y es solo lo que aquí existe y allá no.

## Las cuatro diferencias

**Tienda es Centro.** En todo el esquema y en la interfaz. La región sale del
catálogo de Cobranza, nunca de la región cruda de RRHH. La tabla de personas
muestra el centro con su nomenclatura (`504001 · TOLC`), que es como el área los
nombra.

**Hay un filtro de Plan.** Colaborador o Gerencial. Los dos planes se suman —una
persona en ambos aparece una sola vez, marcada como «Ambos»— pero poder ver cada
malla por separado es justo lo que el documento de lógicas pide al hablar de dos
pestañas.

**La gráfica del año existe de verdad.** En el tablero de Tienda dibuja una sola
barra porque no hay histórico que graficar; aquí lee la pestaña Resumen del
histórico —12 renglones al año— y dibuja los meses publicados, con el del corte
resaltado. Con filtros puestos vuelve a una sola barra: el histórico solo guarda
totales y no se puede filtrar hacia atrás sin mentir.

**Hay un botón «Procesar corte».** Corre el motor sobre los archivos de Drive,
además del «Actualizar datos» que sube un paquete. Los dos solo aparecen para
administradores, y los dos vuelven a verificar el permiso en el servidor.

## Qué se hizo distinto, y por qué

**`getDashboardData()` nunca lee la pestaña de Colaborador.** El tablero de
Tienda la lee entera en cada cambio de filtro; con 11 mil filas por 23 columnas
son 255 mil celdas por llamada. Aquí:

- los puestos del filtro salen de `FiltroCurso` (3,099 filas en vez de 11,100),
- los indicadores filtrados se calculan sobre `FiltroCurso`, que ya viene
  agregado por puesto y región,
- la búsqueda de personas lee **solo las nueve columnas que usa**, con
  `leerColumnas_()`, en vez de las 23.

Mismo resultado, una tercera parte de los datos movidos.

**Los pendientes se parten por el separador.** El tablero de Tienda busca cada
nombre de curso dentro de `lista_pendientes` y va tachando lo que encuentra, lo
que confunde un curso con otro cuyo nombre lo contenga. Aquí la lista viene
separada por ` | ` y basta con partirla.

**Cada petición lleva número de secuencia.** Si alguien cambia de filtro mientras
una respuesta viene en camino, la vieja se descarta. Sin eso, la respuesta lenta
de un filtro anterior pisa la del filtro actual.

**«Sin región» va siempre al final del ranking.** Son las dos personas cuyo
centro no está en el catálogo; con 19 asignaciones y 100% de avance encabezarían
el ranking por encima de regiones de novecientas. No se esconde —hay que verla
para corregir el catálogo— pero no compite.

**Si el control algebraico no cuadró, el tablero lo dice.** Un aviso arriba de
los indicadores, antes de que nadie use las cifras.

## Verificación

Se montó el tablero como lo serviría Apps Script —`Index` + `Stylesheet` +
`JavaScript`, con `google.script.run` sustituido por las funciones reales de
`90_WebApp.gs` sobre el paquete del motor— y se abrió en un navegador
(`scratchpad/montar_tablero.js`).

Sobre el corte 01 AGO 26, sin un solo error de consola:

| | |
|---|---|
| Avance total | 84.8% · 140,936 completados |
| Total asignado | 166,166 · 11,100 colaboradores |
| Pendientes | 25,230 · 15.2% del total |
| Ranking | Mérida 94.7% · Villahermosa 91.4% · Guadalajara 88.9% |
| Gráfica | 8 meses, agosto resaltado |
| Filtros | Plan (2), Puestos (15), Región (16), Cursos (23) |
| Detalle | 25,230 pendientes, paginado de 20 |
| Desborde horizontal | ninguno |

Lo que **no** verifica: la ejecución dentro de Apps Script. Los tiempos de
respuesta reales, los límites de `google.script.run` y el comportamiento del
modal de proceso solo se pueden medir en el proyecto desplegado.

## Al desplegar

1. Copia también `Index.html`, `JavaScript.html` y `Stylesheet.html` al proyecto,
   **sin la extensión** (Apps Script los nombra `Index`, `JavaScript`,
   `Stylesheet`).
2. Implementar → Nueva implementación → Aplicación web, ejecutando como tú y con
   acceso para todo el dominio.
3. Abre la URL. Si nunca se ha publicado un corte verás el estado vacío con el
   botón para procesar el primero.

Antes de publicar nada, corre `ensayarCorte()` desde el editor: calcula sin
escribir y enseña los conteos y los avisos.
