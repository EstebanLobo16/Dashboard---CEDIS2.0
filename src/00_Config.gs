/**
 * Configuración del tablero de CEDIS.
 *
 * Aquí solo van constantes que no cambian entre instalaciones. Todo lo que un
 * día pueda querer cambiar el área —quién publica, qué reglas aplican, cómo se
 * llaman los cursos— vive en la hoja de Catálogos, no aquí. Ver 02_Semillas.gs.
 *
 * Este archivo es lo ÚNICO que distingue a este tablero del de Cobranza en
 * cuanto a identidad. El resto del código pregunta por CONFIG y no sabe de qué
 * área se trata: si encuentras un "CEDIS" escrito duro en otro archivo, es un
 * error, no una decisión. Ver docs/replicar-en-otra-area.md.
 */

const CONFIG = Object.freeze({

  /** Clave del reporte. Los planes de Colaborador y Gerencial se suman en un
   *  solo reporte "cedis" (regla de negocio 2.2). El plan de origen se conserva
   *  por colaborador en la columna `plan`, para poder filtrar. */
  reporte: 'cedis',
  nombreReporte: 'CEDIS',
  titulo: 'Plan de Capacitación · CEDIS',

  /** Nombres de los tres archivos del almacén. Ver docs/01-contrato-de-datos.md */
  archivos: Object.freeze({
    catalogos: 'CED · Catálogos',
    corte: 'CED · Corte vigente',
    historico: 'CED · Histórico',
  }),

  carpetas: Object.freeze({
    base: 'Tablero CEDIS',
    crudos: 'Datos crudos',
    archivo: 'Cortes archivados',
  }),

  /** Claves de ScriptProperties. Se llenan solas al correr instalar().
   *
   *  El prefijo CED_ importa: son las claves donde el script guarda los IDs de
   *  Drive, y si CEDIS y Cobranza vivieran en el mismo proyecto de Apps Script
   *  con las mismas claves, el segundo pisaría al primero sin decir nada. */
  props: Object.freeze({
    catalogos: 'CED_ID_CATALOGOS',
    corte: 'CED_ID_CORTE',
    historico: 'CED_ID_HISTORICO',
    carpetaBase: 'CED_ID_CARPETA_BASE',
    carpetaCrudos: 'CED_ID_CARPETA_CRUDOS',
    carpetaArchivo: 'CED_ID_CARPETA_ARCHIVO',
    ultimoPeriodo: 'CED_ULTIMO_PERIODO',
    ultimaPublicacion: 'CED_ULTIMA_PUBLICACION',
    ultimoPublicadoPor: 'CED_ULTIMA_PUBLICACION_POR',
  }),

  /** Formato del paquete que acepta la importación manual. */
  paquete: Object.freeze({
    formato: 'cedis-report-package',
    version: 1,
  }),

  cacheSegundos: 300,

  /** Tope de celdas por publicación, para no dejar la hoja inservible. */
  maxCeldasPublicacion: 1500000,
});
