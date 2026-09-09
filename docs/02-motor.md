# El motor de proceso — etapa 2

Reemplaza al cuaderno de Colab. Lee los archivos crudos de Drive, aplica las
reglas de negocio con los nueve hallazgos corregidos, y publica el corte.

## Cómo está partido

| Archivo | Qué hace | Toca Google |
|---|---|---|
| `20_Fuentes.gs` | Convierte los archivos y los lee | sí |
| `30_Motor.gs` | Las reglas de negocio | **no** |
| `31_Opciones.gs` | Traduce los catálogos a opciones | sí |
| `40_Proceso.gs` | Orquesta, ensaya, programa | sí |

Que `30_Motor.gs` no toque ningún servicio de Google no es cosmético: es lo que
permite correrlo fuera de Apps Script, sobre las fuentes reales de un mes, y ver
los números antes de desplegar. Sin esa frontera, la única forma de probar una
regla sería publicar y ver qué sale.

```
node pipeline/correr_motor.js fuentes.json [salida.json] [CLAVE=valor ...]
```

Los catálogos se sustituyen por las semillas de `02_Semillas.gs`, así que lo que
se prueba son exactamente las reglas con las que arranca una instalación nueva.
Cualquier parámetro se puede pisar desde la línea de comandos, que es como se
armó la conciliación de más abajo.

## Cómo corre un corte

`procesarCorte()` hace dos tramos con costos muy distintos:

- **Ingesta** — convertir cinco archivos a hojas de cálculo y leer 300 mil
  filas. Es lo lento. Las conversiones quedan en una carpeta de trabajo y se
  reutilizan si una ejecución se corta, porque convertir es lo caro.
- **Cálculo y publicación** — el motor y la escritura. Sobre agosto tarda
  segundos: no materializa la tabla de asignaciones persona×curso (170 mil
  filas), sino que recorre persona por persona acumulando en los agregados.

Antes de publicar, **`ensayarCorte()`** corre todo sin escribir nada y devuelve
los conteos y los avisos. Es lo que hay que usar el primer mes y cada vez que
cambie una fuente.

El resultado del motor pasa por el mismo `validarPaquete_()` que la importación
manual, a propósito: el motor no tiene permiso de publicar algo que un paquete
de Colab no podría publicar.

## La fecha que decide la vigencia

**Es la de asignación de puesto, no la de contratación.** Casi todo puesto trae
cursos obligatorios al tomarlo, así que alguien con tres años en la empresa pero
dos meses en el puesto todavía no tiene por qué haber cursado lo de seis meses.

El Detalle Colaborador nuevo trae `FECHA_DE_INGRESO_DE_PUESTO`, y las
finalizaciones traen `Fecha Asignación Puesto`. Donde las dos fechas de una
persona difieren, las dos fuentes coinciden en **99.4%**, así que sirven como
respaldo una de la otra:

1. Detalle Colaborador, por identificador directo o por el puente — 11,017
2. Las finalizaciones — 122
3. La contratación, para quien nunca cambió de puesto — no hizo falta en agosto

Sobre el corte de agosto la mediana de antigüedad pasa de **796 días en la
empresa a 329 en el puesto**, y con umbrales de 1, 4, 6 y 12 meses eso mueve qué
cursos aplican. El efecto es del tamaño esperado y cae donde debe:

| Curso | Umbral | Desde ingreso | Desde puesto | Δ |
|---|---|---:|---:|---:|
| VALORES II · Valores III | 12 meses | 7,913 | 6,627 | −1,286 |
| VALORES I | 6 meses | 9,697 | 8,834 | −863 |
| Competencias Coppel | 4 meses | 10,297 | 9,556 | −741 |
| los de 1 mes | 1 mes | 11,020 | 10,752 | −268 |

En total, 173,436 asignaciones bajan a 166,166 (−4.2%) y el avance sube de 84.1%
a 84.8%. Es reversible con el parámetro `BASE_ANTIGUEDAD` (`PUESTO` por omisión,
`EMPRESA` para volver al cálculo anterior).

`Colaborador` publica las dos antigüedades por separado —`dias_laborados` y
`dias_en_puesto`— porque las dos se leen distinto: una dice cuánto lleva la
persona en Coppel, la otra cuánto lleva haciendo este trabajo.

### El Detalle Colaborador cambió de formato

El archivo pasó de `Cobranza_Detalle colaborador.xlsx` a
`Detalle_Colaborador.xlsx` y **renombró todas sus columnas**
(`Número de persona` → `NÚMERO_PERSONA`). También dejó de traer
`Nombre del departamento` y `Categoría de asignación` —los dos salen de la
Planta, que es el padrón, así que no se pierde nada— y ahora trae `CENTRO`, que
no se usa: el centro de Cobranza sigue saliendo de la Planta.

La ingesta acepta los dos juegos de nombres, y compara encabezados tratando el
guion bajo como espacio. El patrón del catálogo pasó a `*detalle?colaborador*.xlsx`,
donde el `?` cubre tanto el espacio como el guion bajo. Un archivo de origen que
cambia de nombre de columna de un mes a otro no debería tumbar el proceso.

## Resultado sobre el corte 01 AGO 26

Corrido de punta a punta contra las fuentes reales del repositorio:

| | Proceso anterior | Motor |
|---|---:|---:|
| Colaboradores | 11,533 | **11,100** |
| Asignaciones | 224,994 | **166,166** |
| Completados | 163,377 | **140,936** |
| Avance | 72.6% | **84.8%** |
| Cursos publicados | 20 de 24 | **23 de 24** |
| Regiones | 20 | **15 + «Sin región» (2 personas)** |
| Cursos en 0% por nombre que no cruza | 4 | **0** |
| Tiempo de cálculo | — | 3.3 s |

El paquete pasa la validación y las once formas de corromperlo siguen siendo
rechazadas.

### De dónde sale cada diferencia

Cada corrección se puede apagar por separado, que es como se aisló su efecto:

| Se apaga | Asignaciones | Avance |
|---|---:|---:|
| nada (el motor como quedó) | 166,166 | 84.8% |
| la fecha de puesto (`BASE_ANTIGUEDAD=EMPRESA`) | 173,436 | 84.1% |
| deduplicación (hallazgo 6) | 235,145 | 88.1% |
| padrón = Planta (hallazgo 5) | 180,726 | 82.7% |
| la especialización vuelve a contar como curso | 176,655 | 82.6% |
| la matriz gerencial (hallazgo 3) | 173,894 | 84.1% |

Las tres últimas se midieron antes del cambio de fecha de referencia; el orden de
magnitud no cambia.

Y curso por curso, contra lo que publicaba el proceso anterior:

| Curso | Antes | Ahora |
|---|---:|---:|
| Prevención ante el Riesgo Operativo | 0.0% | **92.2%** |
| Competencias Coppel | 0.0% | **90.1%** |
| Socialización del Código de Ética | 0.0% | **43.4%** |
| Construcción de un entorno laboral ético | 0.0% | **40.4%** |
| Responsabilidad al volante Cobranza | *no existía* | **86.2%** |
| Sesión Virtual de Conducción preventiva | *no existía* | **67.1%** |
| Práctica de Conductor al volante Cobranza | *no existía* | **62.0%** |

Los cuatro primeros estaban en cero porque el nombre no cruzaba, no porque nadie
los hubiera tomado. Los tres últimos son la especialización de conductores, que
el hallazgo 9 dejaba sin asignar a nadie.

El resto de los cursos sube unos pocos puntos y baja en asignaciones, que es lo
que hace la deduplicación: quita el doble conteo sin mover mucho el porcentaje.
`Código de Ética de Grupo Coppel` pasa de 22,075 asignaciones a 11,020 —casi
exactamente la mitad— porque aparecía completo en P1 y otra vez en P2.

## Lo que salió al correrlo

**1,139 personas del padrón (9.3%) no aparecen en ninguna fuente de fechas.** Ni
en el Detalle Colaborador, ni por el puente de identificadores, ni por nombre, ni
en los propios CSV. Casi todas son altas posteriores al corte del Detalle: la
Planta es del 01 AGO y el Detalle viene de antes. **39 más** traen fecha de
asignación de puesto posterior al corte —promociones ya capturadas a futuro, o un
dato inconsistente— y tampoco se pueden evaluar todavía.

Sin antigüedad no se puede decidir qué cursos le tocan a una persona, así que es
un parámetro (`SIN_FECHA_CONTRATACION`, decisión 10):

- `EXCLUIR` **(por omisión)** — salen del tablero y Control deja constancia.
- `ANTIGUEDAD_CERO` — entran, pero en la práctica sin cursos: el plan de
  operación no tiene ninguno con rango mínimo 0. Deja 1,168 personas visibles
  con «0 de 0 cursos».
- `TODOS` — reciben el plan completo. Infla pendientes.

Ninguna de las tres mueve el avance —esas personas aportan 0 asignados y 0
completados—, solo el conteo de colaboradores. Se eligió `EXCLUIR` porque las
otras dos producen un tablero donde lo primero que pregunta quien filtra por su
centro es por qué hay gente con cero cursos.

**La causa raíz no es del código:** hay que pedir el Detalle Colaborador con el
mismo corte que la Planta por Posiciones. Mientras eso no pase, el número va a
seguir apareciendo cada mes en el ensayo.

**99 personas tienen un puesto que no está en ningún plan** (Gerente Suplente,
Asistente, Líder de Proyecto…). Se quedan en el padrón con 0 cursos asignados, a
propósito: que un puesto de Cobranza no tenga plan de capacitación es
información que el área debe ver, no algo que esconder.

**63 asignaciones quedaron bloqueadas por la excepción del Centro de Impresión**,
que hasta ahora no se aplicaba en ninguna parte.

## Automatización

`automatizar()` (etapa 5) deja el corte corriendo solo el día 12 de cada mes a
las 6:00, y una revisión de los archivos crudos el día 11. El día 12 porque la
Plantilla de Cobranza se actualiza a más tardar el día 10, según el documento de
lógicas.

Un disparador no tiene a quién preguntarle, así que avisa por correo a los
administradores: cuando truena, con el error y qué hacer; y cuando publica, con
las cifras del corte y los avisos. Publicar en silencio es peor que no publicar.
Ver `docs/05-operacion.md`.

## Lo que falta

- Confirmar los dos renglones de `NivelesGerencial` marcados como lectura mía:
  dónde caen `ENTRENAMIENTO` y `ENTRENAMIENTO ZONA` en la matriz. Hoy reciben
  todos los cursos de su nivel supuesto.
- Decidir el parámetro `SIN_FECHA_CONTRATACION` con el área.
- Confirmar qué hacer con las 39 personas cuya fecha de asignación de puesto es
  posterior al corte. Hoy quedan fuera.
- Correr `ensayarCorte()` dentro de Apps Script con las fuentes en Drive. Lo que
  está verificado aquí es la lógica de negocio contra datos reales; la ingesta
  desde Drive solo se puede probar en el proyecto instalado.
