/**
 * La prueba de la etapa 1: que la identidad del reporte esté completa y que
 * nadie la lleve escrita duro.
 *
 * No toca Apps Script. Carga los archivos que no usan servicios de Google,
 * revisa CONFIG y el esquema, y después pasa el resto del código por un
 * detector de cadenas del área escritas a mano.
 *
 *   node pipeline/probar_identidad.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const fallos = [];
const revisar = (bien, que) => {
  if (bien) console.log(`  ok   ${que}`);
  else { console.log(`  MAL  ${que}`); fallos.push(que); }
};

/* ---- 1. CONFIG y el esquema ------------------------------------------- */
const contexto = { console, Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN };
vm.createContext(contexto);
['00_Config.gs', '01_Esquema.gs', '02_Semillas.gs', '10_Util.gs'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f });
});
// Apps Script comparte los `const` de nivel superior entre archivos, pero en un
// contexto de vm viven en el ámbito léxico. Mismo puente que correr_motor.js.
vm.runInContext('globalThis.expuesto = {CONFIG, ESQUEMA_CORTE, columna_};',
  contexto, { filename: 'puente' });
const { CONFIG, ESQUEMA_CORTE, columna_ } = contexto.expuesto;

console.log('\nCONFIG');
revisar(CONFIG.reporte === 'cedis', "reporte === 'cedis'");
revisar(CONFIG.nombreReporte === 'CEDIS', "nombreReporte === 'CEDIS'");
revisar(/CEDIS/.test(CONFIG.titulo), `titulo dice CEDIS (${CONFIG.titulo})`);
revisar(CONFIG.paquete.formato === 'cedis-report-package', 'formato del paquete');
revisar(Object.values(CONFIG.archivos).every((n) => n.startsWith('CED · ')),
  'los tres archivos del almacén llevan el prefijo CED');
revisar(Object.values(CONFIG.props).every((k) => k.startsWith('CED_')),
  'las nueve claves de ScriptProperties llevan el prefijo CED_');
revisar(new Set(Object.values(CONFIG.props)).size === Object.keys(CONFIG.props).length,
  'ninguna clave de ScriptProperties está repetida');

console.log('\nEsquema');
revisar(ESQUEMA_CORTE.Centro.indexOf('tipo_centro') !== -1, "Centro tiene 'tipo_centro'");
revisar(ESQUEMA_CORTE.Centro.indexOf('tipo_cobranza') === -1, "Centro ya no tiene 'tipo_cobranza'");
revisar(columna_(ESQUEMA_CORTE, 'Centro', 'tipo_centro') === 6,
  "'tipo_centro' sigue en la posición 6 (el orden es parte del contrato)");

/* ---- 1b. Las semillas encajan con el esquema --------------------------- */
// Un renglón con más o menos celdas que columnas revienta instalar() en
// producción, con la hoja a medio crear. Aquí cuesta un segundo verlo.
vm.runInContext('globalThis.expuesto2 = {SEMILLAS, ESQUEMA_CATALOGOS};',
  contexto, { filename: 'puente2' });
const { SEMILLAS, ESQUEMA_CATALOGOS } = contexto.expuesto2;

console.log('\nSemillas contra el esquema');
Object.keys(SEMILLAS).forEach((nombre) => {
  const columnas = ESQUEMA_CATALOGOS[nombre];
  revisar(Boolean(columnas), `la pestaña '${nombre}' existe en el esquema`);
  if (!columnas) return;
  const malas = SEMILLAS[nombre]
    .map((fila, i) => (fila.length === columnas.length ? null : `${i + 1} (${fila.length})`))
    .filter(Boolean);
  revisar(!malas.length,
    `${nombre}: ${SEMILLAS[nombre].length} renglón(es) de ${columnas.length} columnas` +
    (malas.length ? ` — mal: ${malas.slice(0, 5).join(', ')}` : ''));
});
// Al revés: una pestaña del esquema sin semilla nace vacía, y eso es legítimo
// (Administradores) pero conviene que sea a propósito.
const sinSemilla = Object.keys(ESQUEMA_CATALOGOS).filter((n) => !SEMILLAS[n]);
revisar(!sinSemilla.length,
  `todas las pestañas del catálogo tienen semilla${sinSemilla.length ? ' — falta ' + sinSemilla.join(', ') : ''}`);

/* ---- 2. Nadie lleva el área escrita duro ------------------------------- */
// Se revisa solo el código, no los comentarios: un comentario que dice de dónde
// salió una regla es documentación, no acoplamiento.
const sinComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

// Qué se revisa y qué no:
//
//   · 00_Config.gs es, por definición, donde vive la identidad.
//   · 02_Semillas.gs es el contenido del área; se reemplaza en la etapa 3.
//   · Index.html y Stylesheet.html son marcado. Los nombres que traen son
//     marcadores de posición que initialize() sobrescribe con data.reportName
//     en cuanto responde el servidor, así que no acoplan nada.
//
// Queda el código: los .gs y el <script> de JavaScript.html, que es donde un
// nombre escrito duro sí se queda mintiendo.
const exentos = new Set(['00_Config.gs', '02_Semillas.gs', 'Index.html', 'Stylesheet.html']);
const sospechosa = /'[^']*\b(cobranza|cedis)\b[^']*'|"[^"]*\b(cobranza|cedis)\b[^"]*"|`[^`]*\b(cobranza|cedis)\b[^`]*`/i;

console.log('\nCadenas del área escritas duro');
let encontradas = 0;
fs.readdirSync(SRC)
  .filter((f) => (f.endsWith('.gs') || f.endsWith('.html')) && !exentos.has(f))
  .forEach((f) => {
    sinComentarios(fs.readFileSync(path.join(SRC, f), 'utf8')).split('\n').forEach((linea, i) => {
      // Las columnas del archivo de origen se llaman así en el archivo; no son
      // identidad del tablero. Se van con la fuente, en la etapa 2.
      if (/REGION COBRANZA|TIPO COBRANZA/.test(linea)) return;
      if (sospechosa.test(linea)) {
        console.log(`  MAL  ${f}:${i + 1}  ${linea.trim().slice(0, 88)}`);
        encontradas += 1;
      }
    });
  });
revisar(encontradas === 0, `ningún archivo lleva 'Cobranza' ni 'CEDIS' en una cadena (${encontradas})`);

/* ---- 3. El front end recibe el formato del servidor -------------------- */
const web = fs.readFileSync(path.join(SRC, '90_WebApp.gs'), 'utf8');
const js = fs.readFileSync(path.join(SRC, 'JavaScript.html'), 'utf8');
console.log('\nFront end');
revisar(/packageFormat: CONFIG\.paquete\.formato/.test(web),
  'el servidor manda packageFormat');
revisar(/state\.data && state\.data\.packageFormat/.test(js),
  'el navegador valida el paquete con lo que mandó el servidor');
revisar(/function reportName\(\)/.test(js), 'el navegador saca el nombre del área de los datos');

/* ---- 4. El paquete: se acepta el de CEDIS, se rechaza el de Cobranza --- */
const contexto2 = { console, Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN };
vm.createContext(contexto2);
['00_Config.gs', '01_Esquema.gs', '10_Util.gs', '07_Paquete.gs'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto2, { filename: f });
});
vm.runInContext('globalThis.expuesto = {PESTANAS_PAQUETE, validarPaquete_};',
  contexto2, { filename: 'puente' });
Object.assign(contexto2, contexto2.expuesto);
const paquete = (formato, reporte) => ({
  formato, version: 1, reporte, periodo: '2026-08', fechaCorte: '2026-08-31',
  hojas: Object.fromEntries(contexto2.PESTANAS_PAQUETE.map((p) => [p, { filas: [] }])),
});
const rechaza = (p) => { try { contexto2.validarPaquete_(p); return null; } catch (e) { return e.message; } };

console.log('\nValidación del paquete');
const suyo = rechaza(paquete('cedis-report-package', 'cedis'));
revisar(suyo === null || !/formato|solo acepta/.test(suyo), `acepta el paquete de CEDIS (${suyo || 'sin queja'})`);
revisar(/cedis-report-package/.test(String(rechaza(paquete('cobranza-report-package', 'cobranza')))),
  'rechaza el paquete de Cobranza y dice qué esperaba');

console.log(`\n${fallos.length ? `${fallos.length} REVISIÓN(ES) FALLIDA(S)` : 'Todas las revisiones pasaron.'}`);
process.exit(fallos.length ? 1 : 0);
