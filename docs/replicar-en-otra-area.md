# Replicar este tablero en otra área (CEDIS, CATd)

Este proyecto se diseñó desde el principio para que hubiera más de un área. El
motor, el almacén, el tablero y el histórico son genéricos: lo específico de
Cobranza son un puñado de constantes y el contenido de los catálogos.

## Lo primero: no copies y pegues

La forma más lenta y más frágil de arrancar el tablero de CEDIS es pegar código
en una conversación nueva. Se pierde contexto, se truncan archivos y se
reintroducen errores que ya están resueltos aquí.

**Duplica el repositorio y adjunta el nuevo.** Una sesión nueva puede leer el
repo completo —los 16 archivos de Apps Script, los manuales, las herramientas de
prueba— sin que tú pegues una sola línea.

### Duplicarlo en GitHub

La vía más limpia, porque no deja el repo nuevo colgado del viejo:

1. En este repo: **Settings → General → Template repository** (activar).
2. Arriba, botón **Use this template → Create a new repository**.
3. Nómbralo, por ejemplo, `dashboard---cedis`.

Si prefieres consola:

```bash
git clone --bare https://github.com/<usuario>/dashboard---cobranza-2.0.git
cd dashboard---cobranza-2.0.git
git push --mirror https://github.com/<usuario>/dashboard---cedis.git
```

### Qué borrar del repo nuevo antes de empezar

| Ruta | Qué hacer |
|---|---|
| `Avance-interrumpido/Planta de Cobranza...zip` | Borrar. Va en su lugar la planta de CEDIS |
| `Avance-interrumpido/cobranza_pipeline_git.ipynb` | Borrar. Era el cuaderno que el motor reemplazó |
| `Avance-interrumpido/Logicas Tableros...pdf` | **Conservar.** Trae las reglas de las tres áreas |
| `Tablero-Compañero/` | Conservar. Es la referencia visual |
| `docs/`, `src/`, `pipeline/` | Conservar todo |

---

## El mensaje para abrir la conversación nueva

Una vez adjuntado el repo nuevo, esto es todo lo que hace falta escribir:

> Este repo es una copia del tablero de capacitación de **Cobranza**, que ya está
> terminado, probado y publicando en producción. Quiero el mismo tablero, con las
> mismas funciones y la misma interfaz, pero para **CEDIS**.
>
> Antes de proponer nada, lee `README.md`, `docs/manual.html` y
> `docs/replicar-en-otra-area.md` — ese último explica qué es genérico y qué es
> específico de Cobranza. Las reglas de negocio de CEDIS están en el PDF de
> `Avance-interrumpido/`, que cubre las tres áreas.
>
> Voy a subir los archivos fuente de CEDIS. Dime qué necesitas ver y qué
> decisiones tengo que confirmar antes de que empieces.

Eso basta. La sesión nueva tiene el código, los manuales y las reglas.

---

## Qué es genérico y qué hay que cambiar

### Genérico — no se toca

`01_Esquema.gs`, `03_Almacen.gs`, `05_Acceso.gs`, `06_Bitacora.gs`,
`07_Paquete.gs`, `10_Util.gs`, `20_Fuentes.gs`, `40_Proceso.gs`,
`50_Historico.gs`, `60_Operacion.gs`, `90_WebApp.gs`, y las tres plantillas de
interfaz salvo los textos visibles.

El motor (`30_Motor.gs`) también es genérico: **todo lo que decide reglas entra
por parámetros y catálogos**, no está escrito duro. Las menciones a Cobranza que
verás ahí son comentarios que explican de dónde salió cada regla.

### La identidad del reporte — `00_Config.gs`

Es el único archivo donde el cambio es obligatorio y mecánico:

```js
reporte: 'cedis',
nombreReporte: 'CEDIS',
titulo: 'Plan de Capacitación · CEDIS',
archivos: { catalogos: 'CED · Catálogos', corte: 'CED · Corte vigente', historico: 'CED · Histórico' },
carpetas: { base: 'Tablero CEDIS', ... },
props:    { catalogos: 'CED_ID_CATALOGOS', ... },
```

⚠️ **Cambia también los prefijos de `props`.** Son las claves donde el script
guarda los IDs de Drive. Si CEDIS y Cobranza vivieran en el mismo proyecto de
Apps Script con las mismas claves, el segundo pisaría al primero. Con proyectos
separados no hay riesgo, pero cambiarlas cuesta nada y evita el accidente.

### Los datos del área — `02_Semillas.gs`

Aquí está el trabajo de verdad. Todo el contenido inicial de los catálogos es de
Cobranza y hay que reemplazarlo:

| Semilla | Qué hay que averiguar para CEDIS |
|---|---|
| `Regiones` | ¿CEDIS se organiza por las mismas 15 regiones, o por otra estructura? |
| `MapaRegiones` | Las regiones mal escritas serán otras |
| `AliasCursos` | Los cursos son otros; los alias se descubren al ensayar |
| `Agrupaciones` | ¿Hay paquetes de cursos que no son cursos? |
| `NivelesGerencial` | Los puestos gerenciales de CEDIS y su nivel de matriz |
| `ExcepcionImpresion` | ¿Existe una excepción equivalente? Si no, va vacía |
| `Fuentes` | Los patrones de nombre de los archivos de CEDIS |
| `Parametros` | Ver abajo — hay al menos uno que cambia |

**No inventes estas semillas.** Se llenan leyendo el PDF de reglas y los archivos
reales de CEDIS, igual que se hicieron las de Cobranza.

---

## Lo que ya sabemos de CEDIS

Tres cosas están documentadas en este repo y ahorran discusión:

**1. El filtro de categoría sí aplica a CEDIS.** El PDF pide, textualmente, que
«en categoría de asignación solamente se contempla el rubro de Operación». Para
Cobranza no lo dice y por eso quedó apagado. Para CEDIS:

```
FILTRAR_CATEGORIA_OPERACION = SI
```

**2. La familia de centro de costo es otra.** `007` es Cobranza. Hay que
averiguar cuál corresponde a CEDIS y ponerla en `FAMILIA_CENTRO_COSTOS`.

**3. El tablero ya prevé varios reportes.** `reportesDisponibles_()` en
`90_WebApp.gs` tiene el lugar donde CEDIS entra como segundo reporte, con la
misma mecánica de salto entre despliegues que usa el tablero de Tienda. Cuando
los dos existan, ahí se enlazan.

---

## Lo que NO hay que volver a descubrir

Estos errores ya costaron horas aquí. Van heredados y resueltos, pero conviene
saberlos para no repetirlos al adaptar:

- **La celda de aligerado necesita 7 columnas**, no 5. Si se recorta el CSV de
  finalizaciones sin `Fecha Contratación` y `Fecha Asignación Puesto`, el
  respaldo de fechas deja de funcionar en silencio y cientos de personas quedan
  fuera del corte sin explicación.
- **Drive le quita la extensión al convertir a hoja.** La caché de conversiones
  busca con y sin extensión por eso. No lo "simplifiques".
- **La app web corre la versión desplegada**, no la guardada. Hay que redesplegar
  para que la página tome los cambios.
- **La vigencia se cuenta desde la asignación del puesto**, no desde la
  contratación. Confirma que para CEDIS aplica el mismo criterio antes de asumir.

Corre `node pipeline/probar_ingesta.js — si` antes y después de tocar
`20_Fuentes.gs`: la segunda corrida debe hacer 0 conversiones.

---

## Una nota sobre repos separados

Dos repos significan que un error corregido en uno **no se corrige en el otro**.
Esta sesión encontró tres bugs reales en código que llevaba semanas escrito; con
dos copias, cada uno de esos arreglos hay que portarlo a mano y es fácil que uno
se quede atrás.

La alternativa sería un solo proyecto con `CONFIG.reporte` como interruptor y dos
despliegues — el código ya está casi listo para eso. Es más trabajo al principio
y menos mantenimiento después.

Repos separados es una decisión razonable si las áreas van a divergir o si las
maneja gente distinta. Solo conviene tomarla a sabiendas, y anotar en ambos README
que son parientes.
