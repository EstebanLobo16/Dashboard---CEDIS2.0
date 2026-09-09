# =============================================================================
# 10 · Exportar paquete para el tablero  —  REEMPLAZA la sección 10 del cuaderno
# =============================================================================
#
# Pega esta celda encima de la que hoy arma `cobranza.macintosh.json`. Emite el
# paquete en el formato que el tablero de Cobranza valida de verdad: siete
# pestañas con los nombres y el orden de columnas de docs/01-contrato-de-datos.md.
#
# El paquete anterior emitía Resumen/Regiones/Cursos/Puestos/Colaboradores, que
# el validador del tablero rechaza. Este emite el contrato vigente.
#
# IMPORTANTE — qué NO hace esta celda:
#   Son los MISMOS números que ya calcula el cuaderno, en el formato nuevo. Las
#   siete correcciones de docs/00-propuesta.md §2 (el puente de identificadores,
#   los nombres de curso que no cruzan, la matriz de niveles del plan gerencial,
#   la excepción de Impresión, el padrón, la deduplicación) llegan con el motor
#   en la etapa 2. Hasta entonces, un paquete generado aquí publica el avance
#   con los sesgos que ya tiene el proceso actual.
#
# Entradas que espera del cuaderno (ya existen en las secciones 5 a 8):
#   resultados            una fila por asignación persona+curso
#   detalle_colaborador   una fila por persona
#   centros_tipocentros   catálogo de centros (opcional; da nomenclatura y tipo)
#   FECHA_CORTE, ETIQUETA_MES, RUTA_RESULTADOS
#
# Salida: <RUTA_RESULTADOS>/cobranza-<AAAA-MM>.json
# =============================================================================

import json
import os
import re
import unicodedata
from datetime import datetime

import numpy as np
import pandas as pd

FORMATO_PAQUETE = 'cobranza-report-package'
VERSION_PAQUETE = 1
REPORTE = 'cobranza'

PERIODO = FECHA_CORTE[:7]


# --- Utilidades ---------------------------------------------------------------

def _texto_clave(valor):
    """Igual que textoClave_() del lado de Apps Script: sin acentos, mayúsculas,
    un solo espacio. Las dos implementaciones tienen que dar lo mismo."""
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return ''
    texto = unicodedata.normalize('NFD', str(valor))
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', texto).strip().upper()


def clave_curso(curso):
    """La llave con la que el filtro de cursos identifica a cada curso.

    La produce quien arma el paquete y el tablero NUNCA la recalcula, para que
    no puedan existir dos definiciones distintas de la misma llave."""
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', _texto_clave(curso).lower()))


def limpio(valor):
    """NaN/NaT -> None, numpy -> tipos nativos, fechas -> AAAA-MM-DD.
    json.dump(allow_nan=False) truena con NaN, y el tablero no sabe leerlo."""
    if valor is None:
        return None
    if isinstance(valor, (pd.Timestamp, datetime)):
        return valor.strftime('%Y-%m-%d')
    if isinstance(valor, np.bool_):
        return bool(valor)
    if isinstance(valor, np.integer):
        return int(valor)
    if isinstance(valor, np.floating):
        return None if np.isnan(valor) else float(valor)
    try:
        if pd.isna(valor):
            return None
    except (TypeError, ValueError):
        pass
    return valor


def fila(valores):
    return [limpio(v) for v in valores]


def avance(completados, asignados):
    return (float(completados) / float(asignados)) if asignados else 0.0


def texto(valor, por_defecto=''):
    v = limpio(valor)
    return por_defecto if v is None else str(v)


# --- Esquema. Copiado tal cual de src/01_Esquema.gs. --------------------------

COLUMNAS = {
    'Resumen': [
        'reporte', 'periodo', 'fecha_corte',
        'colaboradores', 'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance',
    ],
    'Region': [
        'reporte', 'periodo', 'fecha_corte', 'region',
        'colaboradores', 'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance',
    ],
    'Centro': [
        'reporte', 'periodo', 'fecha_corte', 'region', 'centro', 'nomenclatura', 'tipo_cobranza',
        'colaboradores', 'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance',
    ],
    'Curso': [
        'reporte', 'periodo', 'fecha_corte', 'curso_clave', 'curso', 'iniciativa', 'agrupacion',
        'asignados', 'completados', 'pendientes', 'avance',
    ],
    'Colaborador': [
        'reporte', 'periodo', 'fecha_corte',
        'numero_empleado', 'numero_colaborador', 'nombre',
        'fecha_contratacion', 'fecha_puesto',
        'codigo_puesto', 'puesto', 'plan', 'departamento',
        'region', 'centro', 'nomenclatura',
        'dias_laborados', 'dias_en_puesto', 'nuevo_ingreso',
        'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance', 'lista_pendientes',
    ],
    'FiltroCurso': [
        'reporte', 'periodo', 'puesto', 'region', 'curso_clave', 'curso', 'iniciativa',
        'asignados', 'completados', 'pendientes', 'avance',
    ],
    'Control': [
        'reporte', 'periodo', 'fecha_corte', 'revision', 'publicacion_actual',
        'colaboradores_publicados', 'colaboradores_exportados',
        'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'conciliacion_correcta',
    ],
}

NUEVO_INGRESO_DIAS = 90
SIN_REGION = 'Sin región'
SIN_CENTRO = 'Pendiente'


# --- Catálogo de centros: nomenclatura y tipo de cobranza ---------------------

_nomenclatura, _tipo_cobranza = {}, {}
if 'centros_tipocentros' in dir():
    _cat = centros_tipocentros.copy()
    _cat['_centro'] = _cat['# Centro'].astype(str).str.extract(r'(\d+)')[0]
    for _, _f in _cat.dropna(subset=['_centro']).drop_duplicates('_centro').iterrows():
        _nomenclatura[_f['_centro']] = texto(_f.get('NOMENCLATURA'))
        _tipo_cobranza[_f['_centro']] = texto(_f.get('TIPO COBRANZA'))


def _centro_texto(valor):
    v = limpio(valor)
    if v is None or str(v).strip() in ('', SIN_CENTRO):
        return SIN_CENTRO
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return str(v).strip()


# --- Normalización de la tabla de asignaciones --------------------------------

r = resultados.copy()
r['_region'] = r['region_cobranza'].apply(lambda v: texto(v, SIN_REGION) or SIN_REGION)
r['_centro'] = r['centro_cobranza'].apply(_centro_texto)
r['_curso'] = r['curso'].astype(str).str.strip()
r['_clave'] = r['_curso'].apply(clave_curso)
r['_puesto'] = r['Nombre de puesto'].apply(lambda v: texto(v))
# 'Tipo' es la iniciativa del PDT (Institucional / Normativo / Normativo
# Especializado). Si `procesar_plan_pdt` todavía la descarta, queda vacía.
r['_iniciativa'] = r['Tipo'].apply(texto) if 'Tipo' in r.columns else ''

TOTAL_ASIGNADOS = int(r['total'].sum())
TOTAL_COMPLETADOS = int(r['completados'].sum())
TOTAL_PENDIENTES = TOTAL_ASIGNADOS - TOTAL_COMPLETADOS
TOTAL_COLABORADORES = int(r['numero_persona'].nunique())


# --- Resumen ------------------------------------------------------------------

filas_resumen = [fila([
    REPORTE, PERIODO, FECHA_CORTE,
    TOTAL_COLABORADORES, TOTAL_ASIGNADOS, TOTAL_COMPLETADOS, TOTAL_PENDIENTES,
    avance(TOTAL_COMPLETADOS, TOTAL_ASIGNADOS),
])]


# --- Region -------------------------------------------------------------------

filas_region = []
for region, g in r.groupby('_region', dropna=False):
    asignados, completados = int(g['total'].sum()), int(g['completados'].sum())
    filas_region.append(fila([
        REPORTE, PERIODO, FECHA_CORTE, region,
        int(g['numero_persona'].nunique()),
        asignados, completados, asignados - completados, avance(completados, asignados),
    ]))


# --- Centro -------------------------------------------------------------------

filas_centro = []
for (region, centro), g in r.groupby(['_region', '_centro'], dropna=False):
    asignados, completados = int(g['total'].sum()), int(g['completados'].sum())
    filas_centro.append(fila([
        REPORTE, PERIODO, FECHA_CORTE, region, centro,
        _nomenclatura.get(centro, ''), _tipo_cobranza.get(centro, ''),
        int(g['numero_persona'].nunique()),
        asignados, completados, asignados - completados, avance(completados, asignados),
    ]))


# --- Curso --------------------------------------------------------------------

filas_curso = []
for (clave, curso), g in r.groupby(['_clave', '_curso'], dropna=False):
    asignados, completados = int(g['total'].sum()), int(g['completados'].sum())
    iniciativas = [i for i in g['_iniciativa'].unique() if i] if '_iniciativa' in g else []
    filas_curso.append(fila([
        REPORTE, PERIODO, FECHA_CORTE, clave, curso,
        iniciativas[0] if iniciativas else '',
        '',  # agrupacion: la resuelve el motor contra el catálogo, en la etapa 2
        asignados, completados, asignados - completados, avance(completados, asignados),
    ]))


# --- FiltroCurso --------------------------------------------------------------
# Es la pestaña técnica que permite filtrar por puesto + región + curso sin
# tener que recorrer los 12 mil colaboradores en cada cambio de filtro.

filas_filtro = []
for (puesto, region, clave, curso), g in r.groupby(
        ['_puesto', '_region', '_clave', '_curso'], dropna=False):
    asignados, completados = int(g['total'].sum()), int(g['completados'].sum())
    iniciativas = [i for i in g['_iniciativa'].unique() if i] if '_iniciativa' in g else []
    filas_filtro.append(fila([
        REPORTE, PERIODO, puesto, region, clave, curso,
        iniciativas[0] if iniciativas else '',
        asignados, completados, asignados - completados, avance(completados, asignados),
    ]))


# --- Colaborador --------------------------------------------------------------
# Una fila por persona. `lista_pendientes` va separada por ' | ' porque el
# buscador del tablero parte por ese separador.
#
# `fecha_puesto` y `dias_en_puesto` salen del Detalle Colaborador si el archivo
# ya trae FECHA_DE_INGRESO_DE_PUESTO. OJO: esta celda solo EMPAQUETA — el
# cuaderno sigue calculando la vigencia desde la contratación, así que estas dos
# columnas van de referencia. Para que el cuaderno también use la fecha de
# puesto, cambia en su sección 5:
#
#   detalle['dias_laborados'] = (fecha_corte_ts - detalle['fecha_contratacion']).dt.days
#   -> detalle['dias_laborados'] = (fecha_corte_ts - detalle['fecha_puesto']).dt.days
#
# El motor de la etapa 2 ya lo hace bien y no necesita este parche.

_ALIAS_FECHA_PUESTO = ['FECHA_DE_INGRESO_DE_PUESTO', 'Fecha de asignación de puesto']
_fecha_puesto = {}
if 'detalle' in dir():
    _col = next((c for c in _ALIAS_FECHA_PUESTO if c in detalle.columns), None)
    if _col:
        for _, _f in detalle.iterrows():
            _fecha_puesto[str(_f.get('Número de persona', _f.get('NÚMERO_PERSONA', '')))] = texto(_f[_col])


def _dias_desde(valor):
    if not valor:
        return None
    fecha = pd.to_datetime(valor, errors='coerce')
    return None if pd.isna(fecha) else int((pd.Timestamp(FECHA_CORTE) - fecha).days)

_por_persona = r.groupby('numero_persona')
_planes = (_por_persona['plan_familia'].apply(lambda s: sorted(set(s)))
           if 'plan_familia' in r.columns else None)

filas_colaborador = []
for _, p in detalle_colaborador.iterrows():
    persona = p['Número de persona']
    if persona in _por_persona.groups:
        g = _por_persona.get_group(persona)
        pendientes_orden = (g.loc[g['pendiente']].sort_values('plan_orden')
                            if 'plan_orden' in g.columns else g.loc[g['pendiente']])
        lista_pendientes = ' | '.join(pendientes_orden['curso'].astype(str).str.strip())
    else:
        lista_pendientes = ''

    if _planes is not None and persona in _planes.index:
        planes = _planes.loc[persona]
        plan = 'Ambos' if len(planes) > 1 else (planes[0] if planes else '')
    else:
        plan = ''

    asignados = int(limpio(p['Total']) or 0)
    completados = int(limpio(p['Completados']) or 0)
    dias = limpio(p['Dias laborados'])
    centro = _centro_texto(p['Centro'])

    fecha_puesto = _fecha_puesto.get(str(persona), '')
    dias_puesto = _dias_desde(fecha_puesto)

    filas_colaborador.append(fila([
        REPORTE, PERIODO, FECHA_CORTE,
        str(persona),
        '',  # numero_colaborador: lo resuelve el puente de identificadores (etapa 2)
        texto(p['Nombre']),
        texto(p['Fecha de contratación de la empresa']),
        fecha_puesto,
        texto(p['Código de puesto']),
        texto(p['Nombre de puesto']),
        plan,
        texto(p['Nombre del departamento']),
        texto(p['Región'], SIN_REGION) or SIN_REGION,
        centro,
        _nomenclatura.get(centro, ''),
        int(dias) if dias is not None else None,
        dias_puesto,
        bool(dias is not None and dias < NUEVO_INGRESO_DIAS),
        asignados, completados, asignados - completados,
        avance(completados, asignados),
        lista_pendientes,
    ]))


# --- Control ------------------------------------------------------------------
# La conciliación es la misma validación de la sección 7: si las pestañas de
# detalle no suman lo que dice el Resumen, el tablero rechaza el paquete.

_i_asignados = COLUMNAS['Colaborador'].index('cursos_asignados')
_i_completados = COLUMNAS['Colaborador'].index('cursos_completados')
_suma_colab_asignados = sum(int(f[_i_asignados] or 0) for f in filas_colaborador)
_suma_colab_completados = sum(int(f[_i_completados] or 0) for f in filas_colaborador)
_conciliacion = (
    _suma_colab_asignados == TOTAL_ASIGNADOS and
    _suma_colab_completados == TOTAL_COMPLETADOS
)

filas_control = [fila([
    REPORTE, PERIODO, FECHA_CORTE,
    datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
    ETIQUETA_MES,
    len(filas_colaborador), TOTAL_COLABORADORES,
    TOTAL_ASIGNADOS, TOTAL_COMPLETADOS, TOTAL_PENDIENTES,
    bool(_conciliacion),
])]


# --- Armado y escritura -------------------------------------------------------

_filas = {
    'Resumen': filas_resumen,
    'Region': filas_region,
    'Centro': filas_centro,
    'Curso': filas_curso,
    'Colaborador': filas_colaborador,
    'FiltroCurso': filas_filtro,
    'Control': filas_control,
}

paquete = {
    'formato': FORMATO_PAQUETE,
    'version': VERSION_PAQUETE,
    'reporte': REPORTE,
    'periodo': PERIODO,
    'fechaCorte': FECHA_CORTE,
    'generadoEn': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
    'origen': 'colab',
    'hojas': {
        nombre: {'columnas': COLUMNAS[nombre], 'filas': _filas[nombre]}
        for nombre in COLUMNAS
    },
}

# Revisión antes de escribir: el tablero corre exactamente estas mismas dos
# comprobaciones y rechaza el archivo si fallan, así que es mejor enterarse aquí.
for _nombre, _tabla in paquete['hojas'].items():
    _ancho = len(_tabla['columnas'])
    _malas = [i for i, f in enumerate(_tabla['filas']) if len(f) != _ancho]
    if _malas:
        raise ValueError(f"{_nombre}: las filas {_malas[:5]} no traen {_ancho} columnas.")

if not _conciliacion:
    raise ValueError(
        'El paquete no cuadra consigo mismo:\n'
        f'  Colaborador.cursos_asignados suma {_suma_colab_asignados:,} y el Resumen dice '
        f'{TOTAL_ASIGNADOS:,}\n'
        f'  Colaborador.cursos_completados suma {_suma_colab_completados:,} y el Resumen dice '
        f'{TOTAL_COMPLETADOS:,}\n'
        'Revisa la sección 8 antes de exportar.'
    )

os.makedirs(RUTA_RESULTADOS, exist_ok=True)
ruta_paquete = os.path.join(RUTA_RESULTADOS, f'cobranza-{PERIODO}.json')
with open(ruta_paquete, 'w', encoding='utf-8') as f:
    json.dump(paquete, f, ensure_ascii=False, allow_nan=False)

print(f'Paquete {PERIODO} · corte {FECHA_CORTE}')
for _nombre in COLUMNAS:
    print(f'  {_nombre:<14} {len(paquete["hojas"][_nombre]["filas"]):>8,} filas')
print(f'\n  {TOTAL_COLABORADORES:,} colaboradores · {TOTAL_ASIGNADOS:,} asignados · '
      f'{TOTAL_COMPLETADOS:,} completados · '
      f'{avance(TOTAL_COMPLETADOS, TOTAL_ASIGNADOS):.1%} de avance')
print(f'  Conciliación: {"correcta" if _conciliacion else "INCORRECTA"}')
print(f'\nExportado en: {ruta_paquete}')
print('Súbelo en el tablero con el botón "Actualizar datos".')
