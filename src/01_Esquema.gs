/**
 * Contrato de datos: qué pestañas existen y con qué columnas, en los tres
 * archivos del almacén.
 *
 * Este archivo es la única fuente de verdad del esquema. El motor escribe con
 * él, el tablero lee con él y la importación manual valida contra él, así que
 * si una columna cambia aquí cambia en los tres lados a la vez. Es justo lo que
 * hoy no pasa entre el cuaderno de Colab y el tablero de Tienda.
 *
 * El orden de las columnas es parte del contrato: las filas viajan como arreglos
 * posicionales dentro del paquete .json.
 */

/** Catálogos — lo que edita negocio. El motor lo lee, nunca lo reescribe. */
const ESQUEMA_CATALOGOS = Object.freeze({
  Parametros:         ['clave', 'valor', 'tipo', 'descripcion'],
  Administradores:    ['correo', 'nombre', 'puede_publicar', 'nota'],
  Regiones:           ['region', 'orden'],
  MapaRegiones:       ['region_origen', 'region_oficial', 'nota'],
  AliasCursos:        ['curso_en_plan', 'curso_en_finalizaciones', 'accion', 'nota'],
  Agrupaciones:       ['agrupacion', 'curso'],
  NivelesGerencial:   ['puesto', 'nivel_matriz', 'nota'],
  ExcepcionImpresion: ['centro', 'puestos', 'nota'],
  Fuentes:            ['clave', 'patron', 'obligatorio', 'pestana', 'nota'],
});

/** Corte vigente — solo el periodo publicado. Es lo único que el tablero
 *  lee en caliente, y por eso se mantiene chico pase lo que pase.
 *
 *  Colaborador lleva las dos antigüedades por separado: `dias_laborados` cuenta
 *  desde que la persona entró a la empresa y `dias_en_puesto` desde que tomó el
 *  puesto actual. La vigencia de los cursos se mide con la segunda —un puesto
 *  trae cursos obligatorios al tomarlo, no al ingresar—, pero la primera sigue
 *  siendo útil para leer al colaborador. */
const ESQUEMA_CORTE = Object.freeze({
  Resumen: [
    'reporte', 'periodo', 'fecha_corte',
    'colaboradores', 'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance',
  ],
  Region: [
    'reporte', 'periodo', 'fecha_corte', 'region',
    'colaboradores', 'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance',
  ],
  Centro: [
    'reporte', 'periodo', 'fecha_corte', 'region', 'centro', 'nomenclatura', 'tipo_centro',
    'colaboradores', 'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance',
  ],
  Curso: [
    'reporte', 'periodo', 'fecha_corte', 'curso_clave', 'curso', 'iniciativa', 'agrupacion',
    'asignados', 'completados', 'pendientes', 'avance',
  ],
  Colaborador: [
    'reporte', 'periodo', 'fecha_corte',
    'numero_empleado', 'numero_colaborador', 'nombre',
    'fecha_contratacion', 'fecha_puesto',
    'codigo_puesto', 'puesto', 'plan', 'departamento',
    'region', 'centro', 'nomenclatura',
    'dias_laborados', 'dias_en_puesto', 'nuevo_ingreso',
    'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'avance', 'lista_pendientes',
  ],
  FiltroCurso: [
    'reporte', 'periodo', 'puesto', 'region', 'curso_clave', 'curso', 'iniciativa',
    'asignados', 'completados', 'pendientes', 'avance',
  ],
  Control: [
    'reporte', 'periodo', 'fecha_corte', 'revision', 'publicacion_actual',
    'colaboradores_publicados', 'colaboradores_exportados',
    'cursos_asignados', 'cursos_completados', 'cursos_pendientes', 'conciliacion_correcta',
  ],
});

/** Histórico — los mismos agregados, acumulados por corte. NO lleva
 *  Colaborador: el detalle por persona de meses cerrados se archiva como .json
 *  en Drive (ver docs/01-contrato-de-datos.md, §4). Con eso el tablero rinde
 *  igual en el mes 1 que en el mes 40. */
const ESQUEMA_HISTORICO = Object.freeze({
  Resumen:     ESQUEMA_CORTE.Resumen,
  Region:      ESQUEMA_CORTE.Region,
  Centro:      ESQUEMA_CORTE.Centro,
  Curso:       ESQUEMA_CORTE.Curso,
  FiltroCurso: ESQUEMA_CORTE.FiltroCurso,
  Control:     ESQUEMA_CORTE.Control,
  Bitacora:    ['momento', 'usuario', 'accion', 'periodo', 'etapa', 'filas', 'mensaje'],
});

/** Pestañas del corte que viajan dentro del paquete .json de importación
 *  manual. Bitacora no viaja: es de esta instalación. */
const PESTANAS_PAQUETE = Object.freeze(Object.keys(ESQUEMA_CORTE));

/** Orden de escritura al publicar: los agregados al final, para que si algo
 *  truena a media publicación el Resumen no quede diciendo que sí terminó. */
const ORDEN_PUBLICACION = Object.freeze([
  'Colaborador', 'FiltroCurso', 'Curso', 'Centro', 'Region', 'Control', 'Resumen',
]);


/** Devuelve el esquema del archivo indicado ('catalogos' | 'corte' | 'historico'). */
function esquemaDe_(archivo) {
  const mapa = {
    catalogos: ESQUEMA_CATALOGOS,
    corte: ESQUEMA_CORTE,
    historico: ESQUEMA_HISTORICO,
  };
  const esquema = mapa[archivo];
  if (!esquema) throw new Error(`No existe el archivo de almacén '${archivo}'.`);
  return esquema;
}

/** Índice de una columna dentro de una pestaña, o -1. */
function columna_(esquema, pestana, nombre) {
  const columnas = esquema[pestana];
  if (!columnas) throw new Error(`La pestaña '${pestana}' no está en el esquema.`);
  return columnas.indexOf(nombre);
}
