# pipeline

Lo que corre fuera de Apps Script.

| Archivo | Qué es |
|---|---|
| `celda_aligerar_csv.py` | Deja los CSV de finalizaciones en ~17 MB en vez de 117, sin perder nada |
| `celda_paquete_cobranza.py` | Reemplazo de la sección 10 del cuaderno de Colab. Emite el paquete en el formato del contrato |
| `validar_paquete.js` | Corre el validador del tablero contra un paquete real, sin necesidad de subirlo |
| `correr_motor.js` | Corre el motor de `30_Motor.gs` fuera de Apps Script, contra fuentes reales |
| `montar_tablero.js` | Arma el tablero en un HTML abrible, con los datos de un paquete real |
| `probar_ingesta.js` | Corre el `leerFuentes_` real contra un Drive simulado y cuenta las conversiones |
| `probar_identidad.js` | Revisa que la identidad del reporte esté completa y que nadie la lleve escrita duro |

## Aligerar los archivos crudos

Córrela antes de subir los CSV a la carpeta de datos crudos. Deja los tres
archivos en uno solo.

| | Filas | Peso |
|---|---:|---:|
| Los 3 originales | 300,883 | 117.0 MB |
| Solo las 7 columnas necesarias | 300,883 | 22.1 MB |
| **+ sin repetir persona+curso** | **237,251** | **16.9 MB** |

El peso está en las columnas, no en las filas: los CSV traen 25 columnas y el
proceso usa 7 (las 5 de siempre más `Fecha Contratación` y
`Fecha Asignación Puesto`, que desde que la vigencia se cuenta por asignación de
puesto son el respaldo cuando el Detalle Colaborador no trae a la persona).
Quitar el 21% de las filas ahorra unos 5 MB; quitar 18 de 25 columnas ahorra
casi 95. La celda hace las dos cosas y verifica que no se pierda ninguna persona
del puente de identificadores, ni que las dos columnas de fecha queden vacías.

Lo ideal sería que el área exportara desde el origen solo esas 7 columnas.

## Generar un paquete

Pega `celda_paquete_cobranza.py` en el cuaderno, en lugar de su sección 10, y
corre el cuaderno completo. Deja `cobranza-<AAAA-MM>.json` en la carpeta de
resultados.

Son los mismos números que ya produce el cuaderno, en el formato nuevo. Las
correcciones de los nueve hallazgos llegan con el motor, en la etapa 2.

## Revisar un paquete antes de publicarlo

```
node pipeline/validar_paquete.js ruta/al/cobranza-2026-08.json
```

Carga `src/00_Config.gs`, `src/01_Esquema.gs`, `src/10_Util.gs` y
`src/07_Paquete.gs` —los que no tocan servicios de Google— y corre
`validarPaquete_()`, el mismo código que corre el tablero. Además comprueba que
once formas de corromper el paquete sean rechazadas: una validación que no
rechaza nada no valida nada.

## Correr el motor sin desplegar

```
node pipeline/correr_motor.js fuentes.json [salida.json] [CLAVE=valor ...]
```

`30_Motor.gs` no toca ningún servicio de Google, así que se puede ejecutar aquí
sobre las fuentes de un mes real y ver los números antes de publicar nada. Los
catálogos se sustituyen por las semillas de `02_Semillas.gs`, y cualquier
parámetro se puede pisar desde la línea de comandos:

```
node pipeline/correr_motor.js fuentes.json — DEDUPLICAR_FINALIZACIONES=NO
```

Así se aisló el efecto de cada corrección en `docs/02-motor.md`.

`fuentes.json` es el volcado de las cinco fuentes en el formato que consume
`calcularCorte_()`: padrón, detalle, centros, puente, finalizaciones y los dos
planes. Dentro de Apps Script lo arma `leerFuentes_()` desde Drive.

## Ver el tablero sin desplegarlo

```
node pipeline/montar_tablero.js paquete.json tablero.html
```

Junta `Index.html`, `Stylesheet.html` y `JavaScript.html` como lo haría Apps
Script y sustituye `google.script.run` por las funciones reales de
`90_WebApp.gs`, corriendo sobre el paquete que le pases. El HTML que sale se abre
en cualquier navegador.

Sirve para revisar un cambio de interfaz sin subir nada. No sustituye a probar en
Apps Script: los tiempos de respuesta y los límites de `google.script.run` solo
se miden allá.

## Probar la ingesta sin desplegar

```bash
node pipeline/probar_ingesta.js — si
```

Simula Drive y Sheets, corre el `leerFuentes_` real **dos veces seguidas** y
cuenta cuántas conversiones hace cada una. La segunda debe hacer **0
conversiones y dejar 0 duplicados**: convertir es lo caro del proceso, y una
corrida que reconvierte es una que no alcanza a terminar.

El segundo argumento simula si Drive le quita la extensión al archivo cuando lo
convierte a hoja de cálculo. **`si` es el comportamiento real**; `no` sirve de
control. El primer argumento permite apuntar a otra copia de `20_Fuentes.gs`
—una versión anterior, por ejemplo— para comparar en A/B.

Córrelo antes y después de tocar `20_Fuentes.gs`.
