/* Corre validarPaquete_() del tablero contra el paquete real generado por la
   celda del Colab, sin Apps Script: solo se cargan los archivos que no tocan
   servicios de Google. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const paquetePath = process.argv[2];

const contexto = {
  console,
  Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN,
};
vm.createContext(contexto);

// Solo lo que validarPaquete_ necesita. 07_Paquete.gs se carga completo pero
// únicamente se invoca la validación, que no toca Spreadsheet ni Drive.
['00_Config.gs', '01_Esquema.gs', '10_Util.gs', '07_Paquete.gs'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f });
});

const paquete = JSON.parse(fs.readFileSync(paquetePath, 'utf8'));

// Prueba 1: el paquete real tiene que pasar.
try {
  contexto.validarPaquete_(paquete);
  console.log('OK   el paquete real pasa la validación del tablero');
} catch (error) {
  console.log('FALLA el paquete real fue rechazado:');
  console.log('      ' + error.message.split('\n').join('\n      '));
  process.exitCode = 1;
}

// Prueba 2: cada forma de romperlo tiene que ser rechazada, con un mensaje que
// diga qué pasó. Una validación que no rechaza nada no valida nada.
const casos = [
  ['formato equivocado', (p) => { p.formato = 'macintosh-report-package'; }],
  ['versión equivocada', (p) => { p.version = 2; }],
  ['otro reporte', (p) => { p.reporte = 'gerente'; }],
  ['periodo mal formado', (p) => { p.periodo = 'agosto 2026'; }],
  ['corte fuera del periodo', (p) => { p.fechaCorte = '2026-07-31'; }],
  ['falta una pestaña', (p) => { delete p.hojas.FiltroCurso; }],
  ['columna de más', (p) => { p.hojas.Region.columnas.push('extra'); }],
  ['columna renombrada', (p) => { p.hojas.Curso.columnas[4] = 'nombre_curso'; }],
  ['fila corta', (p) => { p.hojas.Region.filas[0] = p.hojas.Region.filas[0].slice(0, -1); }],
  ['Resumen vacío', (p) => { p.hojas.Resumen.filas = []; }],
  ['totales que no cuadran', (p) => { p.hojas.Resumen.filas[0][4] += 1000; }],
];

let fallas = 0;
casos.forEach(([nombre, romper]) => {
  const copia = JSON.parse(JSON.stringify(paquete));
  romper(copia);
  try {
    contexto.validarPaquete_(copia);
    console.log(`FALLA "${nombre}" pasó la validación y no debía`);
    fallas += 1;
  } catch (error) {
    console.log(`OK   "${nombre}" rechazado — ${error.message.split('\n')[0]}`);
  }
});

if (fallas) process.exitCode = 1;
console.log(fallas ? `\n${fallas} caso(s) sin detectar.` : '\nLos 11 casos rotos fueron rechazados.');
