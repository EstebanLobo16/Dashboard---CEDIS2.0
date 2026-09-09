/* Arma el tablero como lo serviría Apps Script —Index + Stylesheet + JavaScript—
   y sustituye google.script.run por un stub que corre las funciones reales de
   90_WebApp.gs sobre el paquete del motor. Sirve para verlo antes de desplegar. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const [, , rutaPaquete, salida] = process.argv;
const paquete = JSON.parse(fs.readFileSync(rutaPaquete, 'utf8'));

/* ---- el corte, como si fueran hojas de cálculo ---- */
const hojas = {};
Object.keys(paquete.hojas).forEach((nombre) => {
  const { columnas, filas } = paquete.hojas[nombre];
  hojas[nombre] = filas.map((fila) => columnas.reduce((o, c, i) => { o[c] = fila[i]; return o; }, {}));
});

// Un histórico de varios meses, derivado del corte real: los agregados de cada
// mes son los de agosto con el avance escalado, que es suficiente para ejercitar
// la navegación por periodo y las comparativas.
const PERIODOS = ['2026-05', '2026-06', '2026-07', '2026-08'];
const ESCALA = { '2026-05': 0.74, '2026-06': 0.78, '2026-07': 0.81, '2026-08': 1 };

function escalar(filas, periodo, campos) {
  const k = ESCALA[periodo];
  return filas.map((fila) => {
    const copia = Object.assign({}, fila, { periodo });
    campos.forEach((c) => { copia[c] = Math.round(Number(fila[c] || 0) * k); });
    copia.avance = copia[campos[0]] ? copia[campos[1]] / copia[campos[0]] : 0;
    return copia;
  });
}

const historicoPorPestana = { Resumen: [], Region: [], Centro: [], Curso: [], FiltroCurso: [], Control: [] };
PERIODOS.forEach((periodo) => {
  historicoPorPestana.Resumen.push(...escalar(hojas.Resumen, periodo, ['cursos_asignados', 'cursos_completados']));
  historicoPorPestana.Region.push(...escalar(hojas.Region, periodo, ['cursos_asignados', 'cursos_completados']));
  historicoPorPestana.Centro.push(...escalar(hojas.Centro, periodo, ['cursos_asignados', 'cursos_completados']));
  historicoPorPestana.Curso.push(...escalar(hojas.Curso, periodo, ['asignados', 'completados']));
  historicoPorPestana.FiltroCurso.push(...escalar(hojas.FiltroCurso, periodo, ['asignados', 'completados']));
  historicoPorPestana.Control.push(...hojas.Control.map((f) => Object.assign({}, f, { periodo })));
});
// Que las regiones no se muevan todas igual, para ver deltas distintos.
historicoPorPestana.Region.forEach((fila, i) => {
  if (String(fila.periodo) !== '2026-07') return;
  fila.avance = Math.min(0.99, Number(fila.avance) * (i % 3 === 0 ? 1.06 : 0.97));
});

/* ---- servicios de Google, lo mínimo ---- */
const contexto = {
  console, Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN, Infinity,
  Session: { getScriptTimeZone: () => 'America/Mazatlan', getActiveUser: () => ({ getEmail: () => 'demo@coppel.com' }) },
  Utilities: { formatDate: (f, _t, fmt) => {
    const p = (n) => String(n).padStart(2, '0');
    return fmt.indexOf('HH') !== -1
      ? `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}:${p(f.getSeconds())}`
      : `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
  } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'demo' }) },
  DriveApp: { getFolderById: () => ({ getFilesByName: () => ({ hasNext: () => false }), getFiles: () => ({ hasNext: () => false }) }) },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/demo' }) },
};
vm.createContext(contexto);
['00_Config.gs', '01_Esquema.gs', '10_Util.gs', '50_Historico.gs', '90_WebApp.gs']
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f }));

// abrir_/leerTabla_/leerColumnas_/puedePublicar_ hablan con Sheets; aquí sirven
// los mismos datos desde memoria, con la misma forma.
vm.runInContext(`
  var _hojas = ${JSON.stringify(hojas)};
  var _historico = ${JSON.stringify(historicoPorPestana)};
  abrir_ = function (clave) { return { clave: clave }; };
  leerTabla_ = function (h, nombre) {
    if (h.clave === 'historico') return _historico[nombre] || [];
    return _hojas[nombre] || [];
  };
  archivoDeDetalle_ = function (periodo) {
    return { periodo: periodo, nombre: CONFIG.reporte + '-colaborador-' + periodo + '.json',
             url: 'https://drive.google.com/demo', megas: 4.2, archivadoEn: '2026-09-01' };
  };
  leerColumnas_ = function (h, nombre, cols) {
    return (_hojas[nombre] || []).map(function (fila) {
      var o = {}; cols.forEach(function (c) { o[c] = fila[c]; }); return o;
    });
  };
  puedePublicar_ = function () { return true; };
  serializable_ = function (v) { return v; };
`, contexto, { filename: 'stubs' });

/* ---- la respuesta de cada llamada, precalculada ---- */
const respuestas = {
  getDashboardData: contexto.getDashboardData(),
  searchEmployees: {},
  getFilteredOverview: {},
};
console.log(`  Resumen: ${respuestas.getDashboardData.summary.colaboradores} colaboradores · ` +
  `${(respuestas.getDashboardData.summary.avance * 100).toFixed(1)}% · ` +
  `${respuestas.getDashboardData.regions.length} regiones · ` +
  `${respuestas.getDashboardData.courses.length} cursos · ` +
  `${respuestas.getDashboardData.positions.length} puestos · ` +
  `planes ${JSON.stringify(respuestas.getDashboardData.planes)} · ` +
  `${respuestas.getDashboardData.monthly.length} meses`);

/* ---- armar el HTML ---- */
const leer = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
let html = leer('Index.html');

const stub = `<script>
  // Sustituto de google.script.run: las respuestas ya vienen calculadas por las
  // funciones reales de 90_WebApp.gs.
  const POR_PERIODO = ${JSON.stringify(
    PERIODOS.reduce((m, p) => {
      m[p] = {
        getDashboardData: contexto.getDashboardData({ periodo: p }),
        searchEmployees: contexto.searchEmployees({ period: p, page: 1, pageSize: 20,
          isCurrent: p === respuestas.getDashboardData.period }),
      };
      return m;
    }, {}))};
  let periodoActivo = ${JSON.stringify(respuestas.getDashboardData.period)};
  const RESPUESTAS = {
    get getDashboardData() { return POR_PERIODO[periodoActivo].getDashboardData; },
    get searchEmployees() { return POR_PERIODO[periodoActivo].searchEmployees; },
    getFilteredOverview: ${JSON.stringify(contexto.getFilteredOverview({ period: respuestas.getDashboardData.period, region: 'LEON' }))},
  };
  window.google = { script: { run: (function () {
    const api = {};
    let ok = null, fail = null;
    api.withSuccessHandler = (f) => { ok = f; return api; };
    api.withFailureHandler = (f) => { fail = f; return api; };
    ['getDashboardData', 'searchEmployees', 'getFilteredOverview', 'importarPaquete', 'procesarCorteDesdeTablero']
      .forEach((nombre) => {
        api[nombre] = (arg) => {
          if (nombre === 'getDashboardData' && arg && arg.periodo && POR_PERIODO[arg.periodo]) periodoActivo = arg.periodo;
          setTimeout(() => ok && ok(RESPUESTAS[nombre] || {}), 40);
        };
      });
    return api;
  })() } };
</script>`;
html = html
  .replace("<?!= include('Stylesheet'); ?>", leer('Stylesheet.html'))
  .replace("<?!= include('JavaScript'); ?>", stub + '\n' + leer('JavaScript.html'));

if (html.indexOf('<?!=') !== -1) throw new Error('quedó una etiqueta de plantilla sin resolver');
if (html.indexOf('window.google') === -1) throw new Error('el sustituto de google.script.run no entró');

fs.writeFileSync(salida, html);
console.log(`  ${salida} (${(fs.statSync(salida).size / 1024).toFixed(0)} KB)`);
