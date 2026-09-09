# =============================================================================
# Aligerar los CSV de finalizaciones
# =============================================================================
#
# Los tres archivos de agosto pesan 117 MB entre 300,883 filas. Esta celda los
# deja en uno solo de ~17 MB sin perder nada que el tablero necesite.
#
# El peso NO está en las filas: está en las columnas. Los CSV traen 25 y el
# proceso usa 7. Medido sobre agosto:
#
#   los 3 originales                          300,883 filas   117.0 MB   100%
#   A · solo las 7 columnas necesarias         300,883 filas    22.1 MB    19%
#   B · A + sin repetir persona+curso          237,251 filas    16.9 MB    14%
#
# Quitar el 21% de las filas ahorra unos 5 MB. Quitar 18 de 25 columnas ahorra
# casi 95. Por eso el orden correcto es columnas primero.
#
# Antes traía solo 5 columnas y no las dos de fecha. Eso era correcto en la
# etapa 1, cuando la vigencia de un curso se contaba desde la fecha de
# contratación (que sí vivía en el Detalle Colaborador, sin necesidad del CSV).
# Al cambiar la vigencia a la fecha de ASIGNACIÓN DE PUESTO, esas dos columnas
# se volvieron parte del respaldo: cuando el Detalle no trae a alguien, este CSV
# es la única otra fuente. Si ya generaste un "Cobranza P0 concentrado.csv" con
# la versión vieja de esta celda, vuelve a correrla — el archivo viejo no tiene
# por dónde recuperar esas dos fechas.
#
# Esta celda hace A + B. Ya no incluye el filtro "solo cursos del plan" que
# existía antes (la opción C de la nota original): un curso del plan que no
# cruce por nombre exacto sigue necesitando su fila aquí para poder
# diagnosticarlo, y filtrar de más es más caro que los pocos MB que ahorraba.
#
# Lo mejor sería que el área exportara desde el origen solo estas 7 columnas y
# esto dejara de hacer falta. Mientras tanto, corre esta celda antes de subir
# los archivos a la carpeta de datos crudos.
# =============================================================================

import glob
import os

import pandas as pd

CARPETA_ENTRADA = RUTA_CRUDOS            # de la sección 0 del cuaderno
CARPETA_SALIDA = RUTA_CRUDOS             # sobrescribe en el mismo lugar
NOMBRE_SALIDA = 'Cobranza P0 concentrado.csv'

# Las únicas 7 columnas que el proceso usa, y por qué:
#   Número Persona           llave del cruce contra el plan
#   Número Colaborador       el puente de identificadores (hallazgo 1) — sin
#                            esta columna, el Centro solo se resuelve para el
#                            49% de la gente. La más fácil de tirar por error.
#   Nombre Curso             llave del cruce contra el plan
#   ¿Lo Completó?            Si / No
#   Fecha Finalizado         decide cuál gana al deduplicar
#   Fecha Contratación       respaldo de la fecha de contratación cuando el
#                            Detalle Colaborador no trae a la persona
#   Fecha Asignación Puesto  respaldo de la fecha de vigencia (desde qué día
#                            aplican los cursos del puesto actual) cuando el
#                            Detalle tampoco la trae. Es la fecha que decide
#                            qué cursos aplican, así que perderla es peor que
#                            perder cualquiera de las otras seis.
COLUMNAS = ['Número Persona', 'Número Colaborador', 'Nombre Curso',
            '¿Lo Completó?', 'Fecha Finalizado',
            'Fecha Contratación', 'Fecha Asignación Puesto']


def _rutas_entrada():
    rutas = []
    for patron in ('Cobranza P*.csv', 'Cobranza_P*.csv'):
        rutas += glob.glob(os.path.join(CARPETA_ENTRADA, patron))
    rutas = sorted(set(r for r in rutas if os.path.basename(r) != NOMBRE_SALIDA))
    if not rutas:
        raise FileNotFoundError(f'No encontré ningún Cobranza P*.csv en {CARPETA_ENTRADA}')
    return rutas


rutas = _rutas_entrada()
peso_antes = sum(os.path.getsize(r) for r in rutas)

partes = []
for ruta in rutas:
    parte = pd.read_csv(ruta, dtype=str, usecols=COLUMNAS)
    partes.append(parte)
    print(f'  {os.path.basename(ruta):<40} {len(parte):>9,} filas  '
          f'{os.path.getsize(ruta) / 1048576:>6.1f} MB')

datos = pd.concat(partes, ignore_index=True)[COLUMNAS]
filas_antes = len(datos)

# Una persona+curso se queda con una sola fila. Gana la que diga que sí lo
# completó y, entre varias, la de finalización más reciente. Sin ese orden, el
# "No" de un corte viejo podría tapar el "Si" de uno nuevo.
#
# Las columnas de contratación y asignación de puesto no participan del
# deduplicado: son atributos de la PERSONA, no del curso, así que cualquier
# fila que sobreviva sirve como fuente de esas dos fechas.
datos['_completo'] = datos['¿Lo Completó?'].eq('Si').astype(int)
datos['_fecha'] = pd.to_datetime(datos['Fecha Finalizado'], format='%d %b %Y', errors='coerce')
datos = (datos
         .sort_values(['_completo', '_fecha'], ascending=[False, False])
         .drop_duplicates(subset=['Número Persona', 'Nombre Curso'], keep='first')
         .drop(columns=['_completo', '_fecha'])
         .sort_values(['Número Persona', 'Nombre Curso'])
         .reset_index(drop=True))

destino = os.path.join(CARPETA_SALIDA, NOMBRE_SALIDA)
datos.to_csv(destino, index=False, encoding='utf-8')
peso_despues = os.path.getsize(destino)

print(f'\n  {len(rutas)} archivos  ->  1')
print(f'  {filas_antes:,} filas  ->  {len(datos):,}  '
      f'({filas_antes - len(datos):,} repetidas, {(filas_antes - len(datos)) / filas_antes:.1%})')
print(f'  {peso_antes / 1048576:.1f} MB  ->  {peso_despues / 1048576:.1f} MB  '
      f'({peso_despues / peso_antes:.1%} del original)')
print(f'\n  {destino}')

# Revisión: el puente de identificadores tiene que salir completo. Si aquí se
# perdieran personas, el Centro de esa gente se resolvería por nombre, que es
# justo el cruce frágil que estamos tratando de quitar.
personas_antes = pd.concat([pd.read_csv(r, dtype=str, usecols=['Número Persona'])
                            for r in rutas])['Número Persona'].nunique()
personas_despues = datos['Número Persona'].nunique()
print(f'\n  personas distintas: {personas_antes:,} antes, {personas_despues:,} después', end='')
print('  ✓' if personas_antes == personas_despues else '  ⚠️ SE PERDIERON PERSONAS')

# Segunda revisión: las dos columnas de fecha tienen que sobrevivir. Si esta
# celda alguna vez vuelve a quedar desactualizada respecto al esquema que lee
# 20_Fuentes.gs, mejor que truene aquí y no que aparezca como un misterio en
# el aviso de "personas sin fecha de asignación de puesto" tres pasos después.
for _col in ('Fecha Contratación', 'Fecha Asignación Puesto'):
    _con_dato = datos[_col].notna().sum()
    print(f'  {_col}: {_con_dato:,} de {len(datos):,} filas con dato')
    if _con_dato == 0:
        raise ValueError(
            f'La columna "{_col}" quedó vacía en todas las filas. Revisa que el CSV de origen '
            f'todavía traiga esa columna con ese nombre exacto.'
        )

print(f"""
Después de correr esto, borra los 'Cobranza P1/P2/P3.csv' de la carpeta y deja
solo '{NOMBRE_SALIDA}'. El patrón de búsqueda 'Cobranza P*.csv' lo encuentra igual.

Lo que esta celda NO borra, a propósito:

  · Filas con ¿Lo Completó? = No (64,944). Parecen desechables porque un curso
    sin completar queda pendiente de todos modos, pero 359 personas SOLO tienen
    filas 'No': si las borras, esas 359 salen del puente de identificadores y su
    Centro vuelve a resolverse por nombre. Además pierdes para siempre la
    diferencia entre 'en curso' y 'no iniciado', que hoy no se usa pero es la
    primera pregunta que alguien va a hacer.

  · Filas de cursos que no están en el plan (38,856). Tres son de verdad ajenos
    —Visionarios temporada 1 y 2, y Conviértete en Colaborador Digital— y sí se
    podrían borrar; ahorran 2 MB. Pero el cuarto,
    'Socialización del Código de Ética Para Líderes', resultó ser el mismo curso
    que el plan llama 'Socialización del Código de Ética': borrarlo dejaría ese
    curso en 0% para siempre. Filtrar por 'lo que está en el plan de este mes'
    amarra el archivo crudo a la versión del plan, y el mes que el plan crezca
    ya habrías tirado las filas que hacían falta.

  · Filas de área distinta de COBRANZAS (1,264). Es el 0.4%: no ahorra nada y sí
    puede quitar a alguien que sí es de Cobranza y está mal catalogado.
""")
