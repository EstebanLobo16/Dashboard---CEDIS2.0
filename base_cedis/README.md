# base_cedis — los archivos que alimentan el proceso de CEDIS

`Archivos_alimentacion.zip` (12.6 MB comprimidos, 122 MB descomprimidos) trae los
seis archivos que el área entregó para el ensayo de CEDIS:

| Archivo | Qué es | Filas |
|---|---|---:|
| `CEDIS P1.csv` | Finalizaciones, 12 cursos generales | 257,918 |
| `CEDIS P3.csv` | Finalizaciones, los 3 cursos de la especialización de conductores | 16,644 |
| `CEDIS P3(1).csv` | **Copia byte a byte de `CEDIS P3.csv`.** No subir las dos | 16,644 |
| `PDT-operacion-adaptado.xlsx` | Plan de capacitación, Operación Colaborador CEDIS | 4 pestañas |
| `PDT-gerencial-adaptado.xlsx` | Plan de capacitación, Operación Gerencial CEDIS | 4 pestañas |
| `detalle_colaborador.xlsx` | Nómina completa de Grupo Coppel, con fechas | 123,097 |

**Falta `CEDIS P2.csv`.** Ver `docs/06-plan-cedis.md`, §4.

## Por qué está comprimido

`CEDIS P1.csv` pesa 96 MB por sí solo. Descomprímelo antes de usarlo:

```bash
unzip base_cedis/Archivos_alimentacion.zip -d base_cedis/crudos/
```

## Nota sobre este archivo

El .zip se subió al repo y después se renombró desde la interfaz de GitHub a
`base_cedis/Archivos_alimentacion`. Ese renombrado **destruyó el contenido**: dejó
un archivo de texto de 2 bytes en lugar de los 12.6 MB. Se recuperó del commit
`512210b`, que todavía lo tenía íntegro. Si vuelves a moverlo, hazlo con
`git mv`, no desde la web.
