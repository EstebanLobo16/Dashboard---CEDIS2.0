# Archivos base — lo que alimenta el proceso de CEDIS

`Archivos_alimentacion.zip` (15.9 MB comprimidos, 208 MB descomprimidos) trae los
cinco archivos que el área entregó para el ensayo de CEDIS:

| Archivo | Qué es | Filas |
|---|---|---:|
| `CEDIS P1.csv` (96 MB) | Finalizaciones · 12 cursos generales | 257,918 |
| `CEDIS P2.csv` (88 MB) | Finalizaciones · 15 cursos generales | 243,053 |
| `CEDIS P3.csv` (6 MB) | Finalizaciones · los 3 de la especialización de conductores | 16,644 |
| `PDT-operacion-adaptado.xlsx` | Plan de capacitación · Operación Colaborador CEDIS | 4 pestañas |
| `PDT-gerencial-adaptado.xlsx` | Plan de capacitación · Operación Gerencial CEDIS | 4 pestañas |
| `detalle_colaborador.xlsx` | Nómina completa de Grupo Coppel, con fechas | 123,097 |

Entre los tres CSV cubren **los 30 cursos del plan** y **15,252 personas**, todas
con sus dos fechas. Ver `docs/06-plan-cedis.md` para el análisis completo.

## Cómo usarlos

`CEDIS P1.csv` y `CEDIS P2.csv` pesan casi 100 MB cada uno. Descomprímelos antes:

```bash
unzip "Archivos base/Archivos_alimentacion.zip" -d "Archivos base/crudos/"
```

**No los subas así a la carpeta de datos crudos de Drive.** Pásalos primero por
`pipeline/celda_aligerar_csv.py`, que los deja en dos archivos de 2.4 y 30.5 MB.
Ver `docs/06-plan-cedis.md`, etapa 6.

## Cuidado al mover este archivo

El .zip se ha subido dos veces al repo, y **las dos veces se destruyó al
renombrarlo desde la interfaz web de GitHub**: quedó un archivo de texto de 2
bytes en lugar de los 12.6 y 15.9 MB. Se recuperó de los commits `512210b` y
`b8725fc`, que todavía lo tenían íntegro.

Si necesitas moverlo o renombrarlo, hazlo con `git mv` desde la consola. Desde la
web, no.
