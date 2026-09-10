/**
 * Corre el motor de 30_Motor.gs fuera de Apps Script, contra fuentes reales.
 *
 * El motor no toca ningún servicio de Google a propósito: recibe arreglos de
 * objetos y devuelve arreglos de objetos. Eso permite ejecutarlo aquí, sobre
 * las fuentes de un mes de verdad, y ver los números antes de desplegar nada.
 * Es la prueba de aceptación de la etapa 2.
 *
 *   node pipeline/correr_motor.js fuentes.json [salida.json] [clave=valor ...]
 *
 * Los catálogos se sustituyen por las semillas de 02_Semillas.gs, así que lo que
 * se prueba son exactamente las reglas con las que va a arrancar la instalación.
 * Cualquier parámetro se puede pisar desde la línea de comandos, por ejemplo:
 *
 *   node pipeline/correr_motor.js fuentes.json — DEDUPLICAR_FINALIZACIONES=NO
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const [, , rutaFuentes, rutaSalida, ...pisados] = process.argv;

if (!rutaFuentes) {
  console.error('Uso: node pipeline/correr_motor.js <fuentes.json> [salida.json] [CLAVE=valor ...]');
  process.exit(1);
}

/* ---- contexto mínimo: nada de SpreadsheetApp ni DriveApp ---- */
const contexto = {
  console, Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN, Infinity,
  Session: { getScriptTimeZone: () => 'America/Mazatlan' },
  Utilities: {
    formatDate: (fecha, _tz, formato) => {
      const p = (n) => String(n).padStart(2, '0');
      const y = fecha.getFullYear(), m = p(fecha.getMonth() + 1), d = p(fecha.getDate());
      if (formato === 'yyyy-MM') return `${y}-${m}`;
      if (formato.indexOf('HH') !== -1) {
        return `${y}-${m}-${d}T${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}`;
      }
      return `${y}-${m}-${d}`;
    },
  },
};
vm.createContext(contexto);

// El motor y TODO lo que decide reglas: 04_Catalogos.gs y 31_Opciones.gs se
// cargan tal cual, en vez de reescribir su lógica aquí. Antes este archivo traía
// una copia de `opcionesDelCorte_` —los alias, los niveles, las agrupaciones— y
// esa copia es exactamente la enfermedad que el proyecto vino a curar: dos
// implementaciones de la misma regla que se separan sin que nadie lo note.
[
  '00_Config.gs', '01_Esquema.gs', '02_Semillas.gs', '10_Util.gs',
  '04_Catalogos.gs', '31_Opciones.gs', '30_Motor.gs',
].forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f }));

// Apps Script comparte los `const` de nivel superior entre archivos, pero en un
// contexto de vm viven en el ámbito léxico y no en el objeto global. Este puente
// los expone sin tocar el código que se está probando.
vm.runInContext(
  'globalThis.expuesto = {CONFIG, ESQUEMA_CATALOGOS, ESQUEMA_CORTE, SEMILLAS};',
  contexto, { filename: 'puente' });
Object.assign(contexto, contexto.expuesto);

/* ---- los catálogos ----------------------------------------------------- *
 *
 * De dónde salen las reglas, en orden de preferencia:
 *
 *   --catalogos <archivo.json>   lo que HOY tiene la hoja de Catálogos. Es lo
 *                                que hay que usar para publicar: el área corrige
 *                                un alias en la hoja y el corte lo respeta.
 *   (nada)                       las SEMILLAS, o sea el contenido INICIAL del
 *                                catálogo. Sirve para probar, no para publicar.
 *
 * El archivo trae una tabla por pestaña, cada fila como objeto con los nombres
 * de columna del esquema:
 *
 *   {"Parametros": [{"clave": "DIAS_POR_MES", "valor": "30", ...}], "Regiones": [...]}
 * ---------------------------------------------------------------------- */
const { CONFIG, ESQUEMA_CATALOGOS, ESQUEMA_CORTE, SEMILLAS } = contexto;

const desdeSemillas = (nombre) => {
  const columnas = ESQUEMA_CATALOGOS[nombre];
  return (SEMILLAS[nombre] || []).map((fila) =>
    columnas.reduce((obj, c, i) => { obj[c] = fila[i]; return obj; }, {}));
};

const rutaCatalogos = (() => {
  const i = pisados.indexOf('--catalogos');
  return i !== -1 ? pisados[i + 1] : '';
})();

const catalogos = {};
if (rutaCatalogos) {
  const leidos = JSON.parse(fs.readFileSync(rutaCatalogos, 'utf8'));
  Object.keys(ESQUEMA_CATALOGOS).forEach((nombre) => {
    catalogos[nombre] = Array.isArray(leidos[nombre]) ? leidos[nombre] : [];
    if (!leidos[nombre]) {
      console.log(`AVISO: el archivo de catálogos no trae la pestaña '${nombre}'; va vacía.`);
    }
  });
  console.log(`catálogos: ${rutaCatalogos}`);
} else {
  Object.keys(ESQUEMA_CATALOGOS).forEach((nombre) => { catalogos[nombre] = desdeSemillas(nombre); });
  console.log('catálogos: las SEMILLAS del código (para publicar, usa --catalogos)');
}

// Cualquier parámetro se puede pisar desde la línea de comandos. Se escribe en la
// tabla, no en una capa aparte, para que `parametro_` lo vea como cualquier otro.
pisados.filter((a) => a.indexOf('=') !== -1).forEach((a) => {
  const i = a.indexOf('=');
  const clave = a.slice(0, i).trim();
  const valor = a.slice(i + 1).trim();
  const fila = catalogos.Parametros.find((f) => contexto.textoClave_(f.clave) === contexto.textoClave_(clave));
  if (fila) fila.valor = valor;
  else catalogos.Parametros.push({ clave, valor, tipo: '', descripcion: '(desde la línea de comandos)' });
  console.log(`  pisado: ${clave} = ${valor}`);
});

// `catalogo_()` es lo único que se sustituye. Todo lo que cuelga de él
// —parametro_, regionOficial_, reglaCurso_, nivelGerencial_, opcionesDelCorte_—
// es el código de producción, sin copiar.
vm.runInContext(
  `var _catalogos = ${JSON.stringify(catalogos)};
   catalogo_ = function (nombre) { return _catalogos[nombre] || []; };`,
  contexto, { filename: 'catalogos' });

const opciones = contexto.opcionesDelCorte_();

/* ---- correr ---- */
const inicio = Date.now();
const fuentes = JSON.parse(fs.readFileSync(rutaFuentes, 'utf8'));
console.log(`fuentes leídas en ${((Date.now() - inicio) / 1000).toFixed(1)} s\n`);

const t0 = Date.now();
const salida = contexto.calcularCorte_(fuentes, opciones);
const segundos = (Date.now() - t0) / 1000;

const { hojas, diagnostico } = salida;
const r = hojas.Resumen[0];
const nf = (n) => Number(n).toLocaleString('es-MX');

console.log(`corte ${opciones.periodo} · fecha ${opciones.fechaCorte} · ${segundos.toFixed(1)} s\n`);
Object.keys(hojas).forEach((n) => console.log(`  ${n.padEnd(14)} ${String(hojas[n].length).padStart(8)} filas`));

console.log(`\n  ${nf(r[3])} colaboradores · ${nf(r[4])} asignados · ${nf(r[5])} completados`);
console.log(`  ${nf(r[6])} pendientes · ${(r[7] * 100).toFixed(1)}% de avance`);
console.log(`  conciliación: ${hojas.Control[0][10] ? 'correcta' : 'INCORRECTA'}`);

console.log('\nconteos');
Object.keys(diagnostico.conteos).forEach((k) => {
  const v = diagnostico.conteos[k];
  console.log(`  ${k.padEnd(34)} ${typeof v === 'object' ? JSON.stringify(v) : nf(v)}`);
});

if (diagnostico.avisos.length) {
  console.log(`\navisos (${diagnostico.avisos.length})`);
  diagnostico.avisos.forEach((a) => console.log(`  · ${a}`));
}

if (rutaSalida && rutaSalida !== '—') {
  const paquete = {
    formato: contexto.CONFIG.paquete.formato,
    version: contexto.CONFIG.paquete.version,
    reporte: contexto.CONFIG.reporte,
    periodo: opciones.periodo,
    fechaCorte: opciones.fechaCorte,
    generadoEn: new Date().toISOString(),
    origen: 'motor',
    hojas: {},
  };
  Object.keys(contexto.ESQUEMA_CORTE).forEach((n) => {
    paquete.hojas[n] = { columnas: contexto.ESQUEMA_CORTE[n], filas: hojas[n] };
  });
  fs.writeFileSync(rutaSalida, JSON.stringify(paquete));
  console.log(`\npaquete: ${rutaSalida} (${(fs.statSync(rutaSalida).size / 1048576).toFixed(1)} MB)`);
}
