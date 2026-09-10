/**
 * Prueba publicarDesdeDrive() contra un Drive simulado.
 *
 * Es el camino normal desde que el cálculo salió de Apps Script: el cuaderno
 * deja un paquete en la carpeta Paquetes y esto lo encuentra y lo publica. Lo
 * que se prueba aquí es la parte que puede equivocarse en silencio — CUÁL
 * archivo se elige — porque publicar el mes que no era es peor que no publicar.
 *
 *   node pipeline/probar_publicacion.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

/* ---------------- Drive simulado ---------------- */
const archivos = [];

function archivo(nombre, megas, diasDeAntiguedad, contenido) {
  return {
    getName: () => nombre,
    getSize: () => megas * 1048576,
    isTrashed: () => false,
    getLastUpdated: () => new Date(Date.now() - diasDeAntiguedad * 86400000),
    getBlob: () => ({ getDataAsString: () => contenido || `{"vengo_de":"${nombre}"}` }),
  };
}

const iterador = (lista) => {
  let i = 0;
  return { hasNext: () => i < lista.length, next: () => lista[i++] };
};

const carpeta = {
  getFilesByName: (n) => iterador(archivos.filter((a) => a.getName() === n)),
  getFiles: () => iterador(archivos.slice()),
};

/* ---------------- Contexto ---------------- */
const contexto = {
  console: { log: () => {} },
  Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN,
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'id-paquetes' }) },
  DriveApp: { getFolderById: () => carpeta },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  Session: { getScriptTimeZone: () => 'America/Mazatlan' },
  catalogo_: () => [],
  parametro_: (clave, porDefecto) => (porDefecto === undefined ? '' : porDefecto),
  bitacora_: () => {},
};
vm.createContext(contexto);
['00_Config.gs', '01_Esquema.gs', '10_Util.gs', '07_Paquete.gs'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f }));

// publicarPaquete habla con Sheets; aquí solo interesa QUÉ le llega. Se sustituye
// después de cargar el archivo, porque una declaración de función pisa al stub.
vm.runInContext(`
  globalThis.recibido = null;
  publicarPaquete = function (contenido) { recibido = contenido; return { ok: true }; };
  globalThis.expuesto = { publicarDesdeDrive, paqueteDelPeriodo_ };
`, contexto, { filename: 'stubs' });
const { publicarDesdeDrive, paqueteDelPeriodo_ } = contexto.expuesto;

/* ---------------- Revisiones ---------------- */
const fallos = [];
const revisar = (bien, que) => {
  console.log(`  ${bien ? 'ok  ' : 'MAL '} ${que}`);
  if (!bien) fallos.push(que);
};
const truena = (fn) => {
  try { fn(); return null; } catch (error) { return error.message; }
};

console.log('\nCuando el paquete no está');
let error = truena(() => paqueteDelPeriodo_('2026-08'));
revisar(/No está "cedis-2026-08\.json"/.test(error || ''),
  'nombra el archivo exacto que falta');
revisar(/corte_cedis\.ipynb/.test(error || ''),
  'manda al cuaderno, que es quien lo produce');

archivos.push(archivo('cedis-2026-07.json', 12, 30));
error = truena(() => paqueteDelPeriodo_('2026-08'));
revisar(/cedis-2026-07\.json/.test(error || ''),
  'lista lo que sí hay en la carpeta');

console.log('\nCuál archivo se elige');
archivos.push(archivo('cedis-2026-08.json', 12, 1));
revisar(paqueteDelPeriodo_('2026-08').getName() === 'cedis-2026-08.json',
  'encuentra el del periodo pedido');

archivos.push(archivo('cedis-2026-09.json', 12, 0));
revisar(paqueteDelPeriodo_('2026-08').getName() === 'cedis-2026-08.json',
  'NO publica otro mes solo por ser más reciente');

// El caso real: se volvió a correr el cuaderno y quedaron dos con el mismo nombre.
archivos.unshift(archivo('cedis-2026-08.json', 12, 9, 'EL VIEJO'));
publicarDesdeDrive('2026-08');
revisar(contexto.recibido !== 'EL VIEJO',
  'entre dos del mismo nombre, gana el más nuevo');

console.log('\nQué recibe publicarPaquete');
revisar(String(contexto.recibido).indexOf('cedis-2026-08.json') !== -1,
  'el contenido del archivo, tal cual');

console.log(`\n${fallos.length ? `RESULTADO: FALLA — ${fallos.length} revisión(es)` : 'RESULTADO: OK'}`);
process.exit(fallos.length ? 1 : 0);
