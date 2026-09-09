/**
 * Configuración del tablero de Cobranza.
 *
 * Aquí solo van constantes que no cambian entre instalaciones. Todo lo que un
 * día pueda querer cambiar el área —quién publica, qué reglas aplican, cómo se
 * llaman los cursos— vive en la hoja de Catálogos, no aquí. Ver 02_Semillas.gs.
 */

const CONFIG = Object.freeze({

  /** Clave del reporte. Los planes de Colaborador y Gerencial se suman en un
   *  solo reporte "cobranza" (regla de negocio 2.2). El plan de origen se
   *  conserva por colaborador en la columna `plan`, para poder filtrar. */
  reporte: 'cobranza',
  nombreReporte: 'Cobranza',
  titulo: 'Plan de Capacitación · Cobranza',

  /** Nombres de los tres archivos del almacén. Ver docs/01-contrato-de-datos.md */
  archivos: Object.freeze({
    catalogos: 'COB · Catálogos',
    corte: 'COB · Corte vigente',
    historico: 'COB · Histórico',
  }),

  carpetas: Object.freeze({
    base: 'Tablero Cobranza',
    crudos: 'Datos crudos',
    archivo: 'Cortes archivados',
  }),

  /** Claves de ScriptProperties. Se llenan solas al correr instalar(). */
  props: Object.freeze({
    catalogos: 'COB_ID_CATALOGOS',
    corte: 'COB_ID_CORTE',
    historico: 'COB_ID_HISTORICO',
    carpetaBase: 'COB_ID_CARPETA_BASE',
    carpetaCrudos: 'COB_ID_CARPETA_CRUDOS',
    carpetaArchivo: 'COB_ID_CARPETA_ARCHIVO',
    ultimoPeriodo: 'COB_ULTIMO_PERIODO',
    ultimaPublicacion: 'COB_ULTIMA_PUBLICACION',
    ultimoPublicadoPor: 'COB_ULTIMA_PUBLICACION_POR',
  }),

  /** Formato del paquete que acepta la importación manual. */
  paquete: Object.freeze({
    formato: 'cobranza-report-package',
    version: 1,
  }),

  cacheSegundos: 300,

  /** Tope de celdas por publicación, para no dejar la hoja inservible. */
  maxCeldasPublicacion: 1500000,
});
