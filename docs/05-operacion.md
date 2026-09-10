# Manual de operación — Tablero de Cobranza

> **¿Todavía no está instalado?** Los pasos de instalación y despliegue están en
> [`instalacion.html`](instalacion.html) — ábrelo en el navegador; trae casillas
> que recuerdan dónde te quedaste.

Para quien opera el tablero mes con mes. No hace falta saber programar; sí hace
falta saber dónde está cada cosa y qué hacer cuando algo no sale.

---

## 1 · Qué es cada pieza

| Pieza | Dónde | Para qué |
|---|---|---|
| **Tablero** | Una URL de `script.google.com` | Lo que ve el área |
| **Proyecto de Apps Script** | `script.google.com` | El código y las funciones de mantenimiento |
| `COB · Catálogos` | Drive, carpeta *Tablero Cobranza* | **Las reglas del negocio.** Lo edita el área |
| `COB · Corte vigente` | Misma carpeta | El mes publicado. No se edita a mano |
| `COB · Histórico` | Misma carpeta | Todos los meses, en agregado. No se edita a mano |
| `Datos crudos` | Subcarpeta | Donde el área deja los archivos del mes |
| `Cortes archivados` | Subcarpeta | El detalle de meses cerrados, en `.json` |

**Solo se edita a mano `COB · Catálogos`.** Las otras dos hojas las escribe el
proceso; un cambio a mano se pierde en la siguiente publicación y, mientras
tanto, hace que el tablero mienta.

---

## 2 · El mes normal

Corriendo solo, no hay nada que hacer:

| Día | Qué pasa |
|---|---|
| hasta el 10 | El área deja los cinco archivos en *Datos crudos* |
| **11 a las 7:00** | Se revisan los archivos. **Si falta algo, llega un correo.** Si están todos, no llega nada |
| **12 a las 6:00** | Se procesa y publica el corte. Llega un correo con las cifras |

Si el día 11 llega el correo de que falta algo, hay un día para conseguirlo. Ese
es todo el punto de revisar el 11 y no el 12.

### Los cinco archivos

| Archivo | Quién lo sube |
|---|---|
| Detalle Colaborador | RRHH |
| Planta de Cobranza por Posiciones | El área de Cobranza (a más tardar el día 10) |
| PDT de Operación | Universidad Corporativa |
| PDT Gerencial | Universidad Corporativa |
| Finalizaciones (`Cobranza P1`, `P2`…) | Universidad Corporativa |

Los nombres no tienen que ser exactos: se buscan por patrón, que está en la
pestaña **Fuentes** del catálogo. Si un archivo cambia de nombre y deja de
encontrarse, se ajusta ahí — no en el código.

**Antes de subir las finalizaciones**, córrelas por
`pipeline/aligerar_cedis.py`: los deja en unos 17 MB en vez de 117, sin
perder nada (incluidas `Fecha Contratación` y `Fecha Asignación Puesto`, el
respaldo para cuando el Detalle Colaborador no trae a la persona).

---

## 3 · Procesar un corte a mano

Cuando hay que adelantarlo, repetirlo, o el automático falló.

**Siempre ensaya antes de publicar.** El ensayo calcula todo sin escribir nada y
te enseña las cifras y los avisos. Es la única forma de ver un problema antes que
el área.

Desde la hoja de Catálogos: menú **Cobranza → Ensayar el corte**. Tarda varios
minutos.

Lee lo que sale:

- **el avance** — ¿se parece al del mes pasado? Un salto de más de cinco puntos
  merece explicación antes de publicar;
- **`conciliación: correcta`** — si dice INCORRECTA, no publiques y avisa;
- **los avisos** — cada uno dice qué pasó y qué hacer.

Si se ve bien, publica: en el tablero, botón **Procesar corte**. Vuelve a leer
los archivos y publica. Solo lo ven los administradores.

### Si el motor no puede

El cuaderno de Colab sigue siendo camino válido. Genera el paquete con
`pipeline/celda_paquete.py` y súbelo con **Actualizar datos**. Pasa por
las mismas validaciones.

---

## 4 · Cambiar una regla de negocio

Todo esto se cambia **en la hoja de Catálogos**, sin tocar código ni volver a
desplegar. Después: menú **Cobranza → Aplicar cambios de los catálogos**.

| Quiero… | Pestaña | Qué hago |
|---|---|---|
| Dar de alta a quien publica | `Administradores` | Un renglón con su correo |
| Un curso cambió de nombre | `AliasCursos` | El nombre del plan, el de las finalizaciones, y `ALIAS` |
| Un curso salió del plan | `AliasCursos` | El nombre y `EXCLUIR` |
| Corregir a qué nivel va un puesto | `NivelesGerencial` | Cambiar su `nivel_matriz` |
| Cambiar los centros exceptuados | `ExcepcionImpresion` | Agregar o quitar renglones |
| Una región nueva o mal escrita | `MapaRegiones` | Cómo viene → cómo debe quedar |
| Un archivo cambió de nombre | `Fuentes` | Ajustar el `patron` |
| Cualquier decisión de cálculo | `Parametros` | Cambiar el `valor`. Cada renglón trae su descripción |

Un cambio de catálogo **no recalcula el corte publicado**: aplica al siguiente.
Para verlo ya, vuelve a procesar el corte.

---

## 5 · Cuando algo sale mal

**Lo primero, siempre:** en el editor de Apps Script, corre `diagnostico()`. Junta
en una sola pantalla la instalación, el último corte, el histórico, los archivos
crudos y los disparadores.

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| Correo: *Faltan datos para el corte* | El día 11 no estaban todos los archivos | Consíguelos y déjalos en *Datos crudos*. Si llegan tarde, procesa a mano |
| Correo: *NO se pudo procesar* | El corte falló | El tablero sigue mostrando el mes anterior. Corre `diagnostico()`; el correo trae el error |
| *No encontré ningún archivo que combine con…* | El archivo no está, o cambió de nombre | Revisa la carpeta y el `patron` en `Fuentes` |
| *No se pudo convertir … a hoja de cálculo* | Un archivo demasiado grande | Pásalo por `aligerar_cedis.py` |
| *El paquete no cuadra consigo mismo* | Las sumas no coinciden | **No se publicó nada.** Vuelve a procesar; si sigue, avisa |
| *Tu cuenta no tiene permiso* | No estás en `Administradores` | Que un administrador te agregue |
| *Ya hay un corte procesándose* | Dos a la vez | Espera unos minutos |
| El tablero dice *Este corte no cuadró consigo mismo* | Se publicó algo inconsistente | No uses esas cifras. Vuelve a procesar |
| El tablero tarda mucho | El histórico creció | Corre `estadoHistorico()` |

### Corregir un corte publicado con error

**Si el mes con el error sigue siendo el corte vigente** (no has publicado el
siguiente mes todavía): corrige la fuente del problema y vuelve a publicar ese
mismo periodo, por `procesarCorte({periodo:"2026-08"})` o subiendo un paquete
corregido con **Actualizar datos**. Republicar el mismo mes **reemplaza, no
acumula**: el corte vigente y las filas de ese periodo en el histórico quedan
completamente sustituidos por los datos nuevos, sin dejar rastro de los
erróneos. No hace falta nada más.

**Si ya publicaste el mes siguiente** (el que tiene el error quedó cerrado):
es manual, en cuatro pasos, y **el último no se puede saltar** — sin él, el mes
con el error se queda como si fuera el corte vigente para siempre.

1. `restaurarCorteArchivado("2026-08")` — trae de vuelta el detalle archivado de
   agosto (todavía con el error) al corte vigente. Esto archiva automáticamente
   el mes que sí estaba vigente (septiembre) a `cobranza-colaborador-2026-09.json`,
   sin tocar sus agregados en el histórico.
2. Corrige lo que causó el error.
3. Reprocesa agosto y publícalo. Si la carpeta *Datos crudos* ya tiene los
   archivos del mes siguiente en vez de los de agosto, `ensayarCorte` va a
   avisar que la Planta parece vieja: en ese caso, la vía limpia es regenerar el
   paquete corregido desde el Colab con los archivos de agosto que tengas
   guardados, y publicarlo con `publicarPaquete(...)`.
4. `restaurarCorteArchivado("2026-09")` — trae de vuelta el mes que nunca tuvo
   error, cuyo detalle quedó archivado intacto en el paso 1.

En ambos casos, el histórico nunca duplica: `acumularHistorico_()` siempre
reemplaza las filas del mismo periodo antes de agregar las nuevas.

---

## 6 · Los avisos que salen cada mes

No todos son errores. Los que van a aparecer siempre hasta que se arreglen en la
fuente:

**«N personas no tienen fecha de asignación de puesto en ninguna fuente»** —
esta fecha se busca en tres lugares, en orden: la columna de fecha de puesto del
Detalle Colaborador, la fecha de asignación de las finalizaciones, y como último
recurso la fecha de contratación. Para caer en el aviso, **las tres** tienen que
fallar. Que el Detalle esté al día no basta: además hay que *encontrar* a la
persona en él (por número de persona, por el puente que arma el número de
colaborador de las finalizaciones, o por nombre único), y no tener tampoco
ninguna finalización registrada.

Para saber si es grave, revisa `origenFechaDePuesto` en los conteos del ensayo
— trae el desglose `{detalle, finalizaciones, contratacion, ninguno}`:

- Si el número de **`detalle`** se mantiene alto mes con mes y solo crece
  `ninguno` poco a poco, es **normal**: son altas o cambios de puesto tan
  recientes que todavía no tienen ni el campo capturado en el Detalle ni un
  curso asignado en el LMS. No hace falta hacer nada; esas personas quedan
  fuera del corte y no mueve el avance, solo el conteo de colaboradores.
- Si **`detalle` se desploma** de golpe comparado con corridas anteriores, la
  columna de fecha de puesto probablemente cambió de nombre en el archivo de
  origen — eso sí hay que corregirlo (revisa el patrón en `Fuentes` y el
  nombre exacto de la columna en el archivo nuevo).

Para ver quiénes son exactamente, no solo cuántos, usa el menú **Cobranza →
Listar personas sin fecha (diagnóstico)** en la hoja de Catálogos: corre el
motor sin publicar y deja nombre, puesto, centro y por dónde se intentó
cruzar a cada persona en la pestaña temporal `Diagnóstico · Sin fecha` (se
sobrescribe en cada corrida, no es parte del contrato de datos). Con eso se
confirma en minutos si el motivo es un número que no coincide entre la
Planta y el Detalle, un nombre no único, o gente realmente sin cursos ni
fecha capturada todavía.

**«La pestaña más reciente es … pero se está procesando …»** — la Planta no tiene
todavía el corte del mes. Ese corte saldría con datos viejos: consigue el archivo
actualizado antes de publicar.

**«El curso X no aparece ni una vez en las finalizaciones»** — o cambió de nombre
(agrégalo a `AliasCursos`) o se dejó de impartir (ponlo en `EXCLUIR`). Mientras
tanto sale con 0% y arrastra el promedio.

**«Región X no está entre las oficiales ni mapeada»** — un centro nuevo o mal
catalogado. Agrégalo a `MapaRegiones` y avisa al dueño de `CENTROS-TIPOCENTROS`.

---

## 7 · Funciones del editor

Todas se corren desde el editor de Apps Script, con una cuenta administradora.

| Función | Para qué |
|---|---|
| `diagnostico()` | **Todo el estado.** Lo primero cuando algo falla |
| `ensayarCorte()` | Calcula sin publicar |
| `procesarCorte()` | Calcula y publica |
| `revisarDatosCrudos()` | Qué archivos hay y de cuándo son |
| `estadoDelCorte()` | Qué se publicó, cuándo, por quién |
| `estadoHistorico()` | Cuántos meses guardados y cuánto falta para el tope |
| `refrescarCatalogos()` | Aplica cambios hechos a mano |
| `agregarAdministrador("x@coppel.com")` | Alta |
| `quitarAdministrador("x@coppel.com")` | Baja |
| `verBitacora(25)` | Los últimos movimientos |
| `automatizar()` | Programa los disparadores y el menú |
| `cancelarAutomatizacion()` | Los quita todos |
| `cargarHistorico(contenido)` | Mete un mes anterior al histórico |
| `restaurarCorteArchivado("2026-07")` | Devuelve un mes archivado |
| `instalar()` | Crea o repara el almacén. Seguro de repetir |

---

## 8 · Traspaso

Lo que necesita saber quien reciba esto:

1. **La cuenta dueña.** El tablero se despliega como quien lo publicó. Si esa
   cuenta se da de baja, el tablero deja de funcionar. Debe ser una cuenta de
   área, no personal.
2. **Quién puede publicar.** Pestaña `Administradores`. Que haya al menos dos.
3. **De dónde salen los archivos.** Los cinco de la sección 2, con nombre y
   responsable.
4. **Qué avisos son normales.** La sección 6.
5. **Las decisiones abiertas.** Pestaña `Parametros`: cada renglón es una
   decisión de negocio con su descripción, y varias siguen pendientes de
   confirmar con el área.

### Lo que sigue pendiente

- Confirmar en qué nivel de la matriz gerencial caen `ENTRENAMIENTO` y
  `ENTRENAMIENTO ZONA`. Hoy reciben todos los cursos del nivel que se les supuso.
- Decidir qué hacer con quien no tiene fecha de asignación de puesto
  (`SIN_FECHA_CONTRATACION`, hoy `EXCLUIR`).
- Decidir qué hacer con las personas cuya fecha de asignación es posterior al
  corte. Hoy quedan fuera.
- Pedir el Detalle Colaborador con el mismo corte que la Planta, que es la causa
  raíz de los dos puntos anteriores.
- Pedir las finalizaciones con solo las cinco columnas que se usan.
