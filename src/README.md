# Proyecto de Apps Script — Tablero de CEDIS

Réplica del tablero de Cobranza, que está completo y publicando en producción.
Almacén, catálogos, control de administradores, motor de proceso, aplicación web,
histórico navegable y automatización: todo eso viene heredado y funcionando.

Estado: **etapa 1 de 7 · la identidad del reporte**. Lo que falta —la ingesta, las
semillas y el ensayo— está en **`docs/06-plan-cedis.md`**.

> ⚠ **No corras `instalar()` todavía.** `02_Semillas.gs` sigue trayendo los
> catálogos de Cobranza; se reemplazan en la etapa 3.

Para operarlo mes con mes: **`docs/05-operacion.md`**. Este archivo es para quien
toque el código.

## Qué NO debe saber de CEDIS

La identidad del área vive **solo** en `00_Config.gs`. Todo lo demás pregunta por
`CONFIG.reporte` y `CONFIG.nombreReporte`: el prefijo de la caché, el nombre del
menú, el asunto de los correos, el nombre de los detalles archivados y el formato
del paquete. El navegador lo recibe del servidor (`packageFormat`), no lo lleva
escrito.

Si encuentras un `'cedis'` o un `'CEDIS'` escrito duro fuera de `00_Config.gs`,
de `02_Semillas.gs` o de un comentario que explique de dónde salió una regla, es
un error: cuesta un renglón arreglarlo y ahorra la siguiente réplica.

## Archivos

| Archivo | Qué hace |
|---|---|
| `00_Config.gs` | Constantes que no cambian entre instalaciones |
| `01_Esquema.gs` | **El contrato de datos.** Única fuente de verdad del esquema |
| `02_Semillas.gs` | Contenido inicial de los catálogos |
| `03_Almacen.gs` | Crea y lee las tres hojas de cálculo |
| `04_Catalogos.gs` | Lectura de catálogos, con caché |
| `05_Acceso.gs` | Quién puede publicar |
| `06_Bitacora.gs` | Registro de movimientos |
| `07_Paquete.gs` | Valida y publica un paquete |
| `10_Util.gs` | Normalización de texto, fechas, rangos |
| `20_Fuentes.gs` | Ingesta: de los archivos de Drive a las tablas del motor |
| `30_Motor.gs` | **La lógica de negocio.** No toca ningún servicio de Google |
| `31_Opciones.gs` | Traduce los catálogos a las opciones que consume el motor |
| `40_Proceso.gs` | Orquestación, ensayo, disparador mensual |
| `50_Historico.gs` | Navegar meses cerrados, compararlos y recuperar su detalle |
| `60_Operacion.gs` | Vigilancia de fuentes, diagnóstico, disparadores y el menú |
| `90_WebApp.gs` | Lo que el tablero le pide al servidor |
| `Index.html` · `JavaScript.html` · `Stylesheet.html` | La aplicación web |

La frontera importante es `30_Motor.gs`: no usa `SpreadsheetApp` ni `DriveApp`,
así que se puede correr fuera de Apps Script contra fuentes reales
(`pipeline/correr_motor.js`) y ver los números antes de desplegar nada.

Los archivos se cargan por orden alfabético, y por eso van numerados: los
`const` de nivel superior tienen que existir antes de que alguien los use.

## Instalación

1. Crea un proyecto nuevo en [script.google.com](https://script.google.com) con
   la cuenta que va a ser **dueña** del tablero. Que no sea una cuenta personal
   que un día pueda darse de baja.
2. Copia cada archivo de esta carpeta al proyecto, con el mismo nombre y sin la
   extensión `.gs`.
3. Los tres `.html` van con el nombre **sin extensión**: Apps Script los nombra
   `Index`, `JavaScript` y `Stylesheet`.
4. Pega `appsscript.json` en el manifiesto. Para verlo:
   Configuración del proyecto → *Mostrar el archivo de manifiesto*.
5. Corre la función **`instalar()`** una vez. Autoriza los permisos que pida.
6. Lee lo que imprime en el registro de ejecución: trae los enlaces a las tres
   hojas y a las dos carpetas.
7. Implementar → Nueva implementación → Aplicación web, ejecutando como tú y con
   acceso para todo el dominio.
8. Corre **`automatizar()`** para dejar los disparadores y el menú de la hoja de
   Catálogos.

`instalar()` es idempotente: se puede volver a correr sin miedo. No borra nada,
y si a una pestaña le falta una columna lo reporta en vez de pisarla.

## Funciones que puedes correr desde el editor

| Función | Para qué |
|---|---|
| `instalar()` | Crea o repara el almacén. Una vez, o cuando algo se descuadre |
| `estado()` | Diagnóstico: qué está configurado, quién eres, si puedes publicar |
| `refrescarCatalogos()` | Aplica al instante un cambio hecho a mano en los catálogos |
| `agregarAdministrador("alguien@coppel.com")` | Alta |
| `quitarAdministrador("alguien@coppel.com")` | Baja |
| `verBitacora(25)` | Los últimos movimientos |
| `ensayarCorte()` | Calcula el corte **sin publicar** y enseña conteos y avisos |
| `procesarCorte()` | Calcula y publica |
| `estadoDelCorte()` | Qué se publicó, cuándo y por quién |
| `diagnostico()` | **Todo el estado en una corrida.** Lo primero cuando algo falla |
| `revisarDatosCrudos()` | Qué archivos hay en la carpeta y de cuándo son |
| `automatizar()` | Programa la revisión del día 11, el corte del 12 y el menú |
| `cancelarAutomatizacion()` | Quita todos los disparadores |
| `estadoHistorico()` | Cuántos periodos guardados y cuánto falta para el tope |
| `cargarHistorico(contenido)` | Mete un corte anterior sin tocar el vigente |
| `restaurarCorteArchivado("2026-07")` | Devuelve un mes archivado al corte vigente |

## Publicar un corte

**Camino principal.** Deja los archivos crudos en la carpeta *Datos crudos* y
corre `ensayarCorte()` — calcula sin publicar y te enseña los conteos y avisos.
Si se ve bien, `procesarCorte()` publica. Desde la etapa 3, el botón
*Procesar corte* hace lo mismo.

**Camino alterno.** El cuaderno de Colab con la celda
`pipeline/celda_paquete_cobranza.py` genera un `.json` que se publica con
`publicarPaquete(contenido)`. Sirve de respaldo si el motor falla.

Los dos pasan por el mismo validador: el motor no puede publicar nada que un
paquete de Colab no pudiera publicar.

## Al agregar código

- **Compara texto con `textoClave_()`, nunca con `===`.** Tres de los cursos que
  hoy no cruzan entre el plan y las finalizaciones son puro acento y mayúscula.
- **Toda función que escriba empieza con `exigirPermisoDePublicar_()`.**
- **Si cambia una columna, cambia en `01_Esquema.gs`** y en ningún otro lado. Si
  se toca el esquema, la celda del Colab tiene que moverse igual: su bloque
  `COLUMNAS` es una copia literal.

Detalles del esquema y de las decisiones: `docs/01-contrato-de-datos.md`.
