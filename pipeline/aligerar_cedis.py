#!/usr/bin/env python3
"""
Aligerar los CSV de CEDIS antes de subirlos a la carpeta de datos crudos.

    python3 pipeline/aligerar_cedis.py <carpeta-con-los-crudos> [carpeta-de-salida]

Los tres archivos de agosto pesan 200 MB entre 517,615 filas, y dos de ellos
rozan los 100 MB — el límite de conversión de Drive. Esta celda no es una
comodidad: sin ella el corte no arranca.

Deja DOS archivos, que es como el motor los consume:

    cedis_padron.csv          15,252 filas   11 columnas    2.4 MB
    cedis_finalizaciones.csv 468,130 filas    5 columnas   34.0 MB
                                                           36.4 MB

Un solo archivo con las 14 columnas daría 90 MB —otra vez pegado al límite— y
repetiría el nombre, el departamento y las dos fechas de cada persona en cada
una de sus ~28 filas. El padrón es una tabla de personas y las finalizaciones
una de personas por curso: separarlas cuesta una línea y ahorra seis veces el
peso.

Medido sobre agosto:

    los 3 originales                     517,615 filas   199.7 MB   100%
    A · solo las columnas necesarias     517,615 filas    69.1 MB    35%
    B · A + separado en dos tablas       483,382 filas    36.4 MB    18%

El peso está en las columnas, no en las filas: los CSV traen 25 y el proceso
usa 14. Por eso el orden correcto es columnas primero.

Lo mejor sería que el área exportara desde el origen solo esas columnas y esto
dejara de hacer falta.
"""
import glob
import os
import sys
import unicodedata

import pandas as pd

# Las columnas del PADRÓN. Una fila por persona, y de aquí sale todo lo que el
# tablero sabe de ella: dónde está, qué puesto tiene y desde cuándo.
#
#   Número Persona           la llave. Con la que se cruzan las finalizaciones
#   Número Colaborador       el otro identificador. Difieren en 6,532 de 15,252
#                            personas, y las finalizaciones vienen indexadas por
#                            cualquiera de los dos: tirar esta columna rompe el
#                            cruce para el 43% de la gente
#   Nombre Colaborador       para buscar personas en el tablero
#   Región RRHH              una de las 26 regiones. El eje del ranking
#   Centro Costos            la nomenclatura del centro, y con lo que se
#                            comparan las listas del plan específico
#   Área                     CEDIS / STAFF / TIENDAS / ZONA
#   Departamento             el CEDIS físico. Es el "centro" del tablero
#   Puesto                   con lo que se cruza contra el plan
#   Tipo Posición            el filtro de "solo Operación" que pide el PDF
#   Fecha Contratación       antigüedad en la empresa
#   Fecha Asignación Puesto  LA FECHA QUE DECIDE QUÉ CURSOS APLICAN. Perderla
#                            es peor que perder cualquiera de las otras diez
COLUMNAS_PADRON = [
    'Número Persona', 'Número Colaborador', 'Nombre Colaborador', 'Región RRHH',
    'Centro Costos', 'Área', 'Departamento', 'Puesto', 'Tipo Posición',
    'Fecha Contratación', 'Fecha Asignación Puesto',
]

# Las columnas de las FINALIZACIONES. Una fila por persona, curso y estatus.
#
#   ¿Lo Completó?            Si / No
#   Sub Estatus Aprendizaje  NO es un reflejo de la anterior: "Exenta" viene
#                            como No y el área la cuenta como completada. Cuáles
#                            cuentan lo decide el catálogo (SUBESTATUS_COMPLETADOS),
#                            no este archivo, así que la columna tiene que viajar
COLUMNAS_FINALIZACIONES = [
    'Número Persona', 'Número Colaborador', 'Nombre Curso',
    '¿Lo Completó?', 'Sub Estatus Aprendizaje',
]

PADRON = 'cedis_padron.csv'
FINALIZACIONES = 'cedis_finalizaciones.csv'


def clave(valor):
    """Sin acentos, mayúsculas, un solo espacio. El textoClave_ de 10_Util.gs."""
    texto = '' if valor is None else str(valor)
    texto = texto.replace('\xa0', ' ')
    texto = unicodedata.normalize('NFD', texto)
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return ' '.join(texto.split()).upper()


def rutas_entrada(carpeta):
    rutas = []
    for patron in ('CEDIS P*.csv', 'CEDIS_P*.csv', 'cedis p*.csv'):
        rutas += glob.glob(os.path.join(carpeta, patron))
    rutas = sorted(set(r for r in rutas
                       if os.path.basename(r) not in (PADRON, FINALIZACIONES)))
    if not rutas:
        raise FileNotFoundError(f'No encontré ningún "CEDIS P*.csv" en {carpeta}')
    return rutas


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    entrada = sys.argv[1]
    salida = sys.argv[2] if len(sys.argv) > 2 else entrada

    rutas = rutas_entrada(entrada)
    columnas = sorted(set(COLUMNAS_PADRON) | set(COLUMNAS_FINALIZACIONES))
    peso_antes = sum(os.path.getsize(r) for r in rutas)

    partes = []
    for ruta in rutas:
        cabecera = pd.read_csv(ruta, dtype=str, nrows=0)
        faltan = [c for c in columnas if c not in cabecera.columns]
        if faltan:
            # Que truene aquí, nombrando el archivo y la columna. La alternativa
            # es que aparezca tres pasos después como un misterio en el aviso de
            # "personas sin fecha de asignación de puesto".
            raise ValueError(
                f'A "{os.path.basename(ruta)}" le faltan estas columnas: {", ".join(faltan)}. '
                f'Revisa que el reporte siga exportándolas con ese nombre exacto.'
            )
        parte = pd.read_csv(ruta, dtype=str, usecols=columnas)
        partes.append(parte)
        print(f'  {os.path.basename(ruta):<32} {len(parte):>9,} filas  '
              f'{os.path.getsize(ruta) / 1048576:>6.1f} MB')

    datos = pd.concat(partes, ignore_index=True)
    filas_antes = len(datos)

    # --- el padrón: una fila por persona ---------------------------------
    padron = (datos[COLUMNAS_PADRON]
              .drop_duplicates(subset=['Número Persona'], keep='first')
              .sort_values('Número Persona')
              .reset_index(drop=True))

    # --- las finalizaciones ----------------------------------------------
    #
    # Se quitan las filas IDÉNTICAS, no los pares persona+curso.
    #
    # Deduplicar por (persona, curso) parece equivalente —el motor ya cuenta una
    # vez cada par— pero solo lo es si además se elige la fila "más completada",
    # y eso obliga a este archivo a saber cuáles sub estatus cuentan, que es una
    # regla del catálogo y cambia sin avisar. Quedándose con la primera fila a
    # secas se tira el estatus de las demás: sobre los datos de agosto eso perdía
    # 9,161 finalizaciones completadas y 3.1 puntos de avance, sin ningún error
    # que lo explicara.
    #
    # Con el estatus en la llave solo se van las filas que de verdad sobran, este
    # archivo no opina de reglas de negocio, y el motor sigue contando cada par
    # una sola vez porque hace el OR él mismo (ver indiceFinalizaciones_).
    finalizaciones = datos[COLUMNAS_FINALIZACIONES].copy()
    finalizaciones['_curso'] = finalizaciones['Nombre Curso'].map(clave)
    finalizaciones = (finalizaciones
                      .drop_duplicates(subset=['Número Persona', '_curso',
                                               '¿Lo Completó?', 'Sub Estatus Aprendizaje'])
                      .drop(columns=['_curso'])
                      .sort_values(['Número Persona', 'Nombre Curso'])
                      .reset_index(drop=True))

    ruta_padron = os.path.join(salida, PADRON)
    ruta_final = os.path.join(salida, FINALIZACIONES)
    padron.to_csv(ruta_padron, index=False, encoding='utf-8')
    finalizaciones.to_csv(ruta_final, index=False, encoding='utf-8')
    peso_despues = os.path.getsize(ruta_padron) + os.path.getsize(ruta_final)

    print(f'\n  {len(rutas)} archivos  ->  2')
    print(f'  {filas_antes:,} filas  ->  {len(padron):,} de padrón + '
          f'{len(finalizaciones):,} de finalizaciones')
    print(f'  {peso_antes / 1048576:.1f} MB  ->  {peso_despues / 1048576:.1f} MB  '
          f'({peso_despues / peso_antes:.1%} del original)')
    print(f'\n  {ruta_padron}\n  {ruta_final}')

    revisar(datos, padron, finalizaciones)

    print(f"""
Sube estos dos a la carpeta de datos crudos de Drive y NO subas los
"CEDIS P*.csv" originales: pesan 200 MB y dos de ellos rozan el límite de
conversión de 100 MB.

Lo que esto NO borra, a propósito:

  · Filas con ¿Lo Completó? = No. Un curso sin completar queda pendiente de
    todos modos, pero borrarlas tira la diferencia entre "en curso", "no
    iniciado" y "Exenta" — y "Exenta" SÍ cuenta como completada.

  · Filas de cursos que no están en el plan. Tres son de verdad ajenos
    —Visionarios temporada 1 y 2, y Conviértete en Colaborador Digital— y
    ahorrarían unos MB. Pero filtrar por "lo que está en el plan de este mes"
    amarra el archivo crudo a la versión del plan, y el mes que el plan crezca
    ya habrías tirado las filas que hacían falta. Le pasó a Cobranza con
    "Socialización del Código de Ética Para Líderes".

  · Personas de área distinta de CEDIS. El filtro de universo es el catálogo
    CentrosCosto y el de Tipo Posición, no este recorte.
""")


def revisar(datos, padron, finalizaciones):
    """Las revisiones que valen la pena, todas aprendidas a golpes."""
    print('\nrevisiones')
    fallos = []

    def revisar_que(bien, texto):
        print(f'  {"ok  " if bien else "MAL "} {texto}')
        if not bien:
            fallos.append(texto)

    # 1. Ninguna columna puede quedar vacía. Es el error que en Cobranza dejó a
    #    1,281 personas fuera del corte sin explicación.
    for tabla, nombre in ((padron, PADRON), (finalizaciones, FINALIZACIONES)):
        vacias = [c for c in tabla.columns if tabla[c].notna().sum() == 0]
        revisar_que(not vacias, f'{nombre}: ninguna columna quedó vacía'
                                f'{"" if not vacias else " — " + ", ".join(vacias)}')

    # 2. El padrón tiene que traer a todas las personas, una vez cada una.
    antes = datos['Número Persona'].nunique()
    revisar_que(len(padron) == antes,
                f'padrón: {len(padron):,} personas, y en los originales había {antes:,}')

    # 3. Y las dos fechas de todas. Sin la de asignación de puesto no se puede
    #    decidir qué cursos aplican.
    for col in ('Fecha Contratación', 'Fecha Asignación Puesto'):
        con_dato = padron[col].notna().sum()
        revisar_que(con_dato == len(padron),
                    f'padrón: {con_dato:,} de {len(padron):,} con "{col}"')

    # 4. La que habría cazado el bug de la etapa 4: ningún par persona+curso que
    #    estuviera completado en los originales puede dejar de estarlo aquí.
    def completados(tabla):
        curso = tabla['Nombre Curso'].map(clave)
        # Cualquier estatus que hoy o mañana pueda contar como completado. Se es
        # generoso a propósito: la pregunta es si se PERDIÓ información.
        ok = tabla['¿Lo Completó?'].eq('Si') | tabla['Sub Estatus Aprendizaje'].eq('Exenta')
        return set(zip(tabla.loc[ok, 'Número Persona'], curso[ok]))

    perdidos = completados(datos) - completados(finalizaciones)
    revisar_que(not perdidos,
                f'finalizaciones: no se perdió ninguna completada al deduplicar'
                f'{"" if not perdidos else f" — se perdieron {len(perdidos):,}"}')

    if fallos:
        raise ValueError(f'{len(fallos)} revisión(es) fallaron; los archivos NO sirven.')


if __name__ == '__main__':
    main()
