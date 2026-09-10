# Contrato de datos — Tablero de Cobranza

Entregable de la **etapa 1**. Define el almacén, el esquema de las pestañas, el
formato del paquete de publicación y el modelo de administradores.

La regla que sostiene todo: **el esquema se declara en un solo lugar**,
`src/01_Esquema.gs`. El motor escribe con él, el tablero lee con él y la
importación valida contra él. La desalineación entre el cuaderno de Colab y el
tablero de Tienda existe justo porque cada uno tenía su propia copia.

---

## 1 · Las tres hojas de cálculo

`instalar()` las crea dentro de una carpeta `Tablero Cobranza` en Drive, junto
con dos subcarpetas: `Datos crudos` y `Cortes archivados`. Los identificadores
quedan guardados en las propiedades del script; nada está escrito duro.

| Archivo | Qué guarda | Quién escribe | Tamaño |
|---|---|---|---|
| `COB · Catálogos` | Reglas de negocio y permisos | **El área, a mano** | ~50 renglones |
| `COB · Corte vigente` | Las 7 pestañas del mes publicado | El motor / la importación | ≈285 mil celdas |
| `COB · Histórico` | Los agregados de todos los meses | El motor / la importación | ≈76 mil filas/año |

### Por qué tres y no una

Medido sobre el corte de agosto: un corte completo son **284,532 celdas**, de las
cuales 242 mil son la pestaña de Colaborador. El tablero lee la pestaña entera en
cada cambio de filtro. Con un mes eso es tolerable; con doce meses acumulados
serían 2.9 millones de celdas por llamada y la ejecución se corta antes de
responder. Por eso el corte vigente vive solo y siempre pesa lo mismo, el
histórico guarda únicamente agregados, y el detalle por persona de meses cerrados
se archiva como `.json` en Drive (5.5 MB por corte).

---

## 2 · COB · Catálogos

Nueve pestañas. Es lo que el área edita sin tocar código ni volver a desplegar.
Todo lo que en el cuaderno estaba escrito duro dentro de una celda de Python vive
aquí. Los cambios entran solos a los 5 minutos, o al instante con
`refrescarCatalogos()`.

| Pestaña | Columnas | Para qué |
|---|---|---|
| `Parametros` | clave, valor, tipo, descripcion | Los interruptores de las decisiones abiertas |
| `Administradores` | correo, nombre, puede_publicar, nota | Quién puede publicar |
| `Regiones` | region, orden | Las 15 regiones oficiales |
| `MapaRegiones` | region_origen, region_oficial, nota | Traduce lo que trae el catálogo de centros |
| `AliasCursos` | curso_en_plan, curso_en_finalizaciones, accion, nota | Cursos que cambiaron de nombre o salieron |
| `Agrupaciones` | agrupacion, curso | Qué cursos componen una especialización |
| `NivelesGerencial` | puesto, nivel_matriz, nota | Puente puesto → columna de la matriz gerencial |
| `ExcepcionImpresion` | centro, puestos, nota | Los 12 centros del Centro de Impresión |
| `Fuentes` | clave, patron, obligatorio, pestana, nota | Cómo se reconoce cada archivo crudo |

### Parámetros sembrados

Cada uno corresponde a una decisión de `00-propuesta.md §7`, con la recomendación
como valor inicial. Cambiar de opinión es cambiar un renglón.

| Clave | Valor inicial | Qué controla |
|---|---|---|
| `PADRON` | `PLANTA` | Quién define el universo de Cobranza |
| `RESPETAR_MATRIZ_GERENCIAL` | `SI` | Si la matriz de niveles del PDT manda |
| `ESPECIALIZACION_COMO_CURSO` | `NO` | Si "Formación de Conductores" cuenta como curso |
| `CURSO_SIN_FUENTE` | `PENDIENTE` | Qué hacer con un curso que no aparece en finalizaciones |
| `DEDUPLICAR_FINALIZACIONES` | `SI` | Si P1/P2 repetidos cuentan una o dos veces |
| `FILTRAR_CATEGORIA_OPERACION` | `NO` | Si se filtra por categoría de asignación |
| `FAMILIA_CENTRO_COSTOS` | `007` | Cómo se lee `"007 Cobranzas"` en el plan específico |
| `DIAS_POR_MES` | `30` | Conversión del rango de meses a días |
| `NUEVO_INGRESO_DIAS` | `90` | Umbral de nuevo ingreso |
| `PERIODO` | *(vacío)* | Mes a procesar; vacío = el mes anterior |
| `FECHA_CORTE` | *(vacío)* | Vacío = último día del periodo |
| `ARCHIVAR_DETALLE` | `SI` | Si se archiva el detalle del corte anterior |

---

## 3 · COB · Corte vigente — las siete pestañas

Es el esquema del tablero de Tienda, con **Tienda → Centro** y tres columnas
añadidas por necesidades de Cobranza (`numero_colaborador`, `plan`,
`nomenclatura`).

**El orden de las columnas es parte del contrato**: las filas viajan como
arreglos posicionales dentro del paquete `.json`.

### Resumen — una fila por corte
`reporte · periodo · fecha_corte · colaboradores · cursos_asignados · cursos_completados · cursos_pendientes · avance`

### Region — una fila por región de Cobranza
`reporte · periodo · fecha_corte · region · colaboradores · cursos_asignados · cursos_completados · cursos_pendientes · avance`

`colaboradores` son personas únicas, no asignaciones.

### Centro — una fila por centro de costo
`reporte · periodo · fecha_corte · region · centro · nomenclatura · tipo_cobranza · colaboradores · cursos_asignados · cursos_completados · cursos_pendientes · avance`

`nomenclatura` (CDJZ I) y `tipo_cobranza` (COB DOM) salen de `CENTROS-TIPOCENTROS`.

### Curso — una fila por curso
`reporte · periodo · fecha_corte · curso_clave · curso · iniciativa · agrupacion · asignados · completados · pendientes · avance`

- `curso_clave` es la llave del filtro de cursos. **La produce quien arma el
  paquete y el tablero nunca la recalcula**, para que no existan dos definiciones
  distintas de la misma llave. La receta está en `claveCurso_()`
  (`src/10_Util.gs`) y replicada idéntica en `clave_curso()` de la celda del Colab.
- `iniciativa` es la columna `Tipo` del PDT: Institucional, Normativo o Normativo
  Especializado.
- `agrupacion` se llena cuando el curso forma parte de una especialización.

### Colaborador — una fila por persona
`reporte · periodo · fecha_corte · numero_empleado · numero_colaborador · nombre · fecha_contratacion · codigo_puesto · puesto · plan · departamento · region · centro · nomenclatura · dias_laborados · nuevo_ingreso · cursos_asignados · cursos_completados · cursos_pendientes · avance · lista_pendientes`

- **`numero_empleado` y `numero_colaborador` son columnas distintas a propósito.**
  Es el hallazgo 1: conviven dos sistemas de identificador y meterlos en la misma
  columna es lo que hoy rompe el cruce con la Planta. Hasta la etapa 2,
  `numero_colaborador` va vacío.
- `plan` vale `Colaborador`, `Gerencial` o `Ambos`. Los dos planes se suman
  (regla 2.2), así que una persona nunca aparece dos veces.
- `lista_pendientes` va separada por ` | `, que es por donde parte el buscador
  del tablero.

### FiltroCurso — una fila por puesto × región × curso
`reporte · periodo · puesto · region · curso_clave · curso · iniciativa · asignados · completados · pendientes · avance`

Pestaña técnica. Existe para que filtrar por puesto, región o curso no obligue a
recorrer los 11,533 renglones de Colaborador en cada clic. En el corte de agosto
son 3,223 filas.

### Control — una fila por corte
`reporte · periodo · fecha_corte · revision · publicacion_actual · colaboradores_publicados · colaboradores_exportados · cursos_asignados · cursos_completados · cursos_pendientes · conciliacion_correcta`

Es la sección 7 del cuaderno hecha dato: el control algebraico viaja dentro del
paquete y queda registrado en el histórico.

---

## 4 · COB · Histórico

Las mismas pestañas **menos Colaborador**, más una `Bitacora`
(`momento · usuario · accion · periodo · etapa · filas · mensaje`).

Al publicar, `acumularHistorico_()` quita las filas del mismo reporte + periodo y
mete las nuevas, ordenadas por periodo. Volver a publicar un mes lo reemplaza; no
lo duplica.

El detalle por colaborador del corte anterior se guarda antes de sobrescribir, en
`Cortes archivados/cobranza-colaborador-<AAAA-MM>.json`. Solo si el corte que
estaba publicado es de otro periodo: republicar el mismo mes no genera archivo.

---

## 5 · El paquete de publicación

```json
{
  "formato": "cobranza-report-package",
  "version": 1,
  "reporte": "cobranza",
  "periodo": "2026-08",
  "fechaCorte": "2026-08-31",
  "generadoEn": "2026-09-08T21:40:00",
  "origen": "colab",
  "hojas": {
    "Resumen":     { "columnas": [...], "filas": [[...]] },
    "Region":      { "columnas": [...], "filas": [[...]] },
    "Centro":      { "columnas": [...], "filas": [[...]] },
    "Curso":       { "columnas": [...], "filas": [[...]] },
    "Colaborador": { "columnas": [...], "filas": [[...]] },
    "FiltroCurso": { "columnas": [...], "filas": [[...]] },
    "Control":     { "columnas": [...], "filas": [[...]] }
  }
}
```

`validarPaquete_()` lo rechaza, sin escribir nada, si: el formato o la versión no
son los esperados; el reporte no es Cobranza; el periodo o la fecha de corte no
tienen el formato correcto, o la fecha cae fuera del periodo; falta una pestaña;
las columnas de alguna pestaña no coinciden exactamente con el contrato; alguna
fila trae un número distinto de valores; el Resumen viene vacío; la publicación
supera 1.5 millones de celdas; o **el paquete no cuadra consigo mismo** —
Colaborador, Region y Curso tienen que sumar exactamente lo que dice el Resumen.

Las once formas de romperlo están probadas contra el paquete real de agosto.

### Cómo se genera

- **Hoy (etapa 1):** la celda `pipeline/celda_paquete.py` reemplaza la
  sección 10 del cuaderno. Mismos números de siempre, formato nuevo.
- **Desde la etapa 2:** el motor lo arma directo desde los crudos de Drive, ya con
  las correcciones aplicadas.

### El cambio de una línea en el cuaderno

La celda nueva llena la columna `iniciativa` con la columna `Tipo` del PDT, que
`procesar_plan_pdt()` hoy descarta. Para conservarla, en las dos proyecciones de
esa función:

```python
# antes
plan_general = plan_general[['puesto_clave', 'Curso', 'ID Curso', 'dias_minimos']].copy()
# después
plan_general = plan_general[['puesto_clave', 'Curso', 'ID Curso', 'Tipo', 'dias_minimos']].copy()
```

Sin ese cambio la celda igual corre: `iniciativa` sale vacía.

---

## 6 · Quién puede publicar

Dos capas, y solo una cuenta:

1. **La interfaz** esconde el botón cuando el visitante no es administrador. Es
   comodidad, no seguridad.
2. **El servidor** — `exigirPermisoDePublicar_()` va al principio de toda función
   que escriba. Esta es la reja.

La lista vive en la pestaña `Administradores`. Dar de alta a alguien es escribir
un renglón: no hay que editar código ni volver a desplegar, que es lo que sí
obliga la versión del tablero de Tienda.

- Quien corre `instalar()` queda dado de alta automáticamente.
- `agregarAdministrador("alguien@coppel.com")` y `quitarAdministrador(...)` hacen
  lo mismo desde el editor. La baja del último administrador se rechaza: dejar la
  lista vacía deja el tablero sin quien publique.
- **Falla cerrado**: si la hoja de Catálogos no se puede leer, nadie publica. Un
  error de lectura no debe abrir la puerta.
- Todo intento sin permiso queda en la bitácora con correo y fecha.

Ver el tablero es otra cosa: eso lo controla el despliegue de la aplicación web
(`access: DOMAIN`), y lo puede hacer cualquiera de Coppel.

---

## 7 · Cómo entran los datos

**Los archivos crudos siempre por Drive.** Pesan 123 MB; una llamada del
navegador no los mueve, y `google.script.run` mucho menos. El área los deja en
`Tablero Cobranza / Datos crudos /`, un administrador da clic en Procesar corte, y
el motor lee de ahí (etapa 2). Así queda registro de qué archivo exacto se usó y
se puede disparar solo cada mes.

**El paquete ya procesado, por cualquiera de los dos.** Pesa 5.5 MB y sí cabe en
el navegador: el botón Actualizar datos abre el modal, seleccionas el `.json` y
`publicarPaquete()` lo valida y lo publica.

---

## 8 · Verificación de la etapa 1

Sobre las fuentes reales del corte `01 AGO 26`:

- Se reprodujo el cuaderno completo (secciones 2 a 8) y se corrió la celda nueva.
- El paquete resultante: 11,533 colaboradores · 224,994 asignados · 163,377
  completados · 72.6% de avance · 5.5 MB · conciliación correcta.
- `validarPaquete_()` lo acepta.
- Once formas de corromperlo —formato, versión, reporte, periodo, fecha fuera de
  rango, pestaña faltante, columna de más, columna renombrada, fila corta, Resumen
  vacío, totales que no cuadran— son todas rechazadas con un mensaje que dice qué
  pasó.
- Los nueve archivos de `src/` pasan revisión de sintaxis.

Lo que **no** verifica: que los números sean los correctos. Son los que produce
el proceso actual, con los nueve sesgos documentados en `00-propuesta.md §2`.
Corregirlos es la etapa 2.
