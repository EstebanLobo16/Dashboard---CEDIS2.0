/**
 * Utilidades compartidas entre el motor y el tablero.
 *
 * textoClave_() es el equivalente de la macro del mismo nombre del proceso
 * anterior, y es la pieza que resuelve tres de los cinco cursos que hoy no
 * cruzan entre el plan y las finalizaciones ("Entorno Laboral Ético" contra
 * "entorno laboral ético"). Compara SIEMPRE con esta función, nunca con === .
 */

/** Sin acentos, mayúsculas, un solo espacio. */
function textoClave_(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Como textoClave_ pero en minúsculas, para comparar contra texto de interfaz. */
function normalizar_(valor) {
  return textoClave_(valor).toLowerCase();
}

/** Número seguro: lo que no sea número finito vale 0. */
function numero_(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

/** Entero seguro. */
function entero_(valor) {
  return Math.round(numero_(valor));
}

/** Cociente que no truena con denominador 0. */
function avance_(completados, asignados) {
  const total = numero_(asignados);
  return total ? numero_(completados) / total : 0;
}

/**
 * Convierte a fecha lo que venga: serial de Excel, texto en varios formatos, o
 * un Date. Devuelve null si no se pudo interpretar.
 */
function aFecha_(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  const texto = String(valor).trim();
  if (!texto) return null;

  // Serial de Excel: días desde el 30/12/1899.
  if (/^\d+(\.\d+)?$/.test(texto)) {
    const dias = Math.floor(Number(texto));
    if (dias > 20000 && dias < 60000) {
      return new Date(Date.UTC(1899, 11, 30) + dias * 86400000);
    }
  }

  // AAAA-MM-DD o AAAA/MM/DD
  let m = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // DD/MM/AAAA o DD-MM-AAAA
  m = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  // "26 nov 2025", como viene en los CSV de finalizaciones.
  m = texto.match(/^(\d{1,2})\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(\d{4})$/);
  if (m) {
    const mes = MESES_ABREVIADOS[textoClave_(m[2]).slice(0, 3)];
    if (mes) return new Date(Number(m[3]), mes - 1, Number(m[1]));
  }

  const intento = new Date(texto);
  return isNaN(intento.getTime()) ? null : intento;
}

const MESES_ABREVIADOS = Object.freeze({
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
});

const MESES_ES = Object.freeze({
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
});

/** Fecha a texto AAAA-MM-DD. */
function aTextoFecha_(fecha) {
  const d = aFecha_(fecha);
  if (!d) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Días completos entre dos fechas. Negativo si la segunda es posterior. */
function diasEntre_(hasta, desde) {
  const a = aFecha_(hasta);
  const b = aFecha_(desde);
  if (!a || !b) return null;
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

/**
 * El periodo a procesar, en formato AAAA-MM. Sale del parámetro PERIODO; si
 * está vacío, el mes anterior al de hoy, que es el caso normal (el corte de
 * agosto se procesa en septiembre).
 */
function periodoActivo_() {
  const configurado = parametro_('PERIODO', '');
  if (/^\d{4}-\d{2}$/.test(configurado)) return configurado;

  const hoy = new Date();
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return Utilities.formatDate(anterior, Session.getScriptTimeZone(), 'yyyy-MM');
}

/**
 * La fecha de corte del periodo activo. Sale del parámetro FECHA_CORTE; si está
 * vacío, el último día del periodo, que es lo normal.
 */
function fechaCorteActiva_() {
  const configurada = parametro_('FECHA_CORTE', '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(configurada)) return configurada;

  const periodo = periodoActivo_();
  const anio = Number(periodo.slice(0, 4));
  const mes = Number(periodo.slice(5, 7));
  const ultimo = new Date(anio, mes, 0);
  return Utilities.formatDate(ultimo, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** 'Agosto 2026' a partir de '2026-08'. */
function etiquetaPeriodo_(periodo) {
  const p = String(periodo || '');
  if (!/^\d{4}-\d{2}$/.test(p)) return p;
  return `${MESES_ES[p.slice(5, 7)] || p.slice(5, 7)} ${p.slice(0, 4)}`;
}

/**
 * El mínimo de meses del "Rango de meses para cursar" del plan ('0-3' -> 0).
 *
 * Tolera tres formas, porque las tres aparecen en los PDT reales:
 *   '0-3'  rango           -> 0
 *   '12'   número suelto   -> 12
 *   fecha  '2024-06-03'    -> 3
 *
 * La tercera no es un formato: es Excel convirtiendo solo el texto "3-6" en la
 * fecha 3 de junio. Se recupera el rango original leyendo día-mes. Devuelve
 * null si no se pudo interpretar, para que quien llame decida si truena o si
 * reporta y sigue; el cuaderno truena, y por eso hoy no puede procesar el PDT
 * gerencial de agosto. Ver hallazgo 8.
 */
function rangoMesesMinimo_(valor) {
  if (valor instanceof Date) return valor.getDate();

  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  if (!texto) return null;

  let m = texto.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return Number(m[1]);

  m = texto.match(/^(\d+)$/);
  if (m) return Number(m[1]);

  // '2024-06-03' o '2024-06-03 00:00:00': día = mínimo, mes = máximo.
  m = texto.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (m) return Number(m[2]);

  return null;
}

/**
 * ¿El "Centros de costos" del plan específico nombra a toda la familia de
 * Cobranza en vez de un centro concreto?
 *
 * En los PDT de agosto la columna dice "007 Cobranzas", que es la familia
 * completa (la Planta la trae como "007 - COBRANZAS"), no un centro como
 * 500101. Compararla contra el número de centro no empata nunca, y por eso hoy
 * la especialización de conductores no le llega a nadie. Ver hallazgo 9.
 */
function esFamiliaDeCentros_(centrosDeCosto) {
  const familia = textoClave_(parametro_('FAMILIA_CENTRO_COSTOS', '007'));
  if (!familia) return false;
  const digitos = String(centrosDeCosto || '').match(/\d+/);
  return Boolean(digitos) && String(Number(digitos[0])) === String(Number(familia));
}

/** Clave estable de un curso, para usarla como valor en los filtros. */
function claveCurso_(curso) {
  return textoClave_(curso)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
