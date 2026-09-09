/**
 * Corre el leerFuentes_ REAL contra un Drive simulado y cuenta cuántas veces
 * se convierte cada archivo. Sirve para responder una sola pregunta:
 * ¿la segunda corrida reutiliza las conversiones, o las vuelve a hacer?
 *
 *   node pipeline/probar_ingesta.js [ruta a 20_Fuentes.gs] [quitaExtension: si|no]
 *
 * Sin argumentos usa src/20_Fuentes.gs. El segundo argumento simula si Drive le
 * quita o no la extensión al convertir; el comportamiento real es "si".
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const [, , argFuentes, modoExtension] = process.argv;
const rutaFuentes = argFuentes && argFuentes !== '—' ? argFuentes : path.join(SRC, '20_Fuentes.gs');
const DRIVE_QUITA_EXTENSION = String(modoExtension).toLowerCase() === 'si';

/* ---------------- Drive simulado ---------------- */
let secuencia = 0;
const conversiones = [];               // cada Drive.Files.copy que ocurre

function archivo(nombre, opciones) {
  const o = opciones || {};
  return {
    _nombre: nombre,
    _trashed: false,
    id: o.id || `id-${(secuencia += 1)}`,
    mime: o.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    actualizado: new Date(o.actualizado || '2026-09-09T08:00:00'),
    getId() { return this.id; },
    getName() { return this._nombre; },
    getMimeType() { return this.mime; },
    getLastUpdated() { return this.actualizado; },
    getSize() { return o.size || 1000; },
    isTrashed() { return this._trashed; },
    setTrashed(v) { this._trashed = v; },
  };
}

function carpeta(nombre) {
  return {
    _nombre: nombre,
    id: `carpeta-${(secuencia += 1)}`,
    archivos: [],
    subcarpetas: [],
    getId() { return this.id; },
    getName() { return this._nombre; },
    iterador(lista) { let i = 0; return { hasNext: () => i < lista.length, next: () => lista[i++] }; },
    // Drive no lista los archivos en la papelera.
    getFiles() { return this.iterador(this.archivos.filter((a) => !a.isTrashed())); },
    getFilesByName(n) {
      return this.iterador(this.archivos.filter((a) => !a.isTrashed() && a.getName() === n));
    },
    getFoldersByName(n) { return this.iterador(this.subcarpetas.filter((c) => c.getName() === n)); },
    createFolder(n) { const c = carpeta(n); this.subcarpetas.push(c); return c; },
  };
}

/* ---------------- Hojas de cálculo simuladas ---------------- */
const hojas = {};   // id -> [{nombre, filas}]

function pestana(nombre, filas) { return { nombre, filas }; }

function hojaDeCalculo(id, pestanas) { hojas[id] = pestanas; }

function abrirHoja(id) {
  const pestanas = hojas[id];
  if (!pestanas) throw new Error(`No existe la hoja ${id}`);
  const envolver = (p) => ({
    getName: () => p.nombre,
    getLastRow: () => p.filas.length,
    getLastColumn: () => p.filas.reduce((m, f) => Math.max(m, f.length), 0),
    getRange(fila, col, alto, ancho) {
      return {
        getValues: () => {
          const salida = [];
          for (let f = 0; f < alto; f += 1) {
            const origen = p.filas[fila - 1 + f] || [];
            const linea = [];
            for (let c = 0; c < ancho; c += 1) {
              const v = origen[col - 1 + c];
              linea.push(v === undefined ? '' : v);
            }
            salida.push(linea);
          }
          return salida;
        },
      };
    },
  });
  return {
    getSheets: () => pestanas.map(envolver),
    getSheetByName: (n) => { const p = pestanas.find((x) => x.nombre === n); return p ? envolver(p) : null; },
  };
}

/* ---------------- Datos crudos, como los del usuario ---------------- */
const base = carpeta('Tablero Cobranza');
const crudos = carpeta('Datos crudos');
const trabajo = carpeta('Conversiones');
base.subcarpetas.push(trabajo);

const fPlanta = archivo('planta de cobranza por posiciones06Ene_01Ago2026.xlsx');
const fDetalle = archivo('detalle_colaborador.xlsx');
const fCentro = archivo('Planta de Cobranza por Centro Autorizada_Activa.xlsx');
const fOper = archivo('PDT-operacion-adaptado.xlsx');
const fGer = archivo('PDT-gerencial-adaptado.xlsx');
const fCsv = archivo('Cobranza P0 concentrado.csv', { mime: 'text/csv' });
crudos.archivos.push(fPlanta, fDetalle, fCentro, fOper, fGer, fCsv);

/* Contenido que cada conversión debe entregar, por nombre del original. */
const contenidoPorOrigen = {
  'planta de cobranza por posiciones06Ene_01Ago2026.xlsx': [
    pestana('01 AGO 26', [
      ['Reporte de planta', '', '', '', '', '', ''],
      ['Número de trabajador', 'Nombre del colaborador', 'Código de puesto',
        'Nombre de puesto', 'Centro', 'Departamento', 'Categoria de asignación'],
      ['10000001', 'PEREZ LOPEZ JUAN', '743', 'GESTOR DE COBRANZA', '007', 'COBRANZA', 'OPERACION'],
      ['10000002', 'RUIZ SOTO ANA', '721', 'GESTOR DE COBRANZA', '007', 'COBRANZA', 'OPERACION'],
    ]),
    pestana('CENTROS-TIPOCENTROS', [
      ['# Centro', 'REGION COBRANZA', 'NOMENCLATURA', 'TIPO COBRANZA'],
      ['007', 'NORTE', 'N-007', 'PROPIA'],
    ]),
  ],
  'detalle_colaborador.xlsx': [
    pestana('Hoja1', [
      ['NÚMERO PERSONA', 'NOMBRE COLABORADOR', 'FECHA DE INGRESO',
        'FECHA DE INGRESO DE PUESTO', 'CODIGO PUESTO', 'PUESTO'],
      ['10000001', 'PEREZ LOPEZ JUAN', '2020-01-15', '2024-03-01', '743', 'GESTOR DE COBRANZA'],
    ]),
  ],
  'Cobranza P0 concentrado.csv': [
    pestana('Hoja1', [
      ['Número Persona', 'Número Colaborador', 'Nombre Curso', '¿Lo Completó?',
        'Fecha Finalizado', 'Fecha Contratación', 'Fecha Asignación Puesto'],
      ['10000001', '10000001', 'CURSO A', 'SI', '2026-05-01', '2020-01-15', '2024-03-01'],
    ]),
  ],
};
const PESTANAS_PDT = [
  pestana('Cursos_asignados', [['Curso', 'Tipo', 'Rango de meses para cursar'], ['CURSO A', 'OBLIGATORIO', '3-6']]),
  pestana('Cursos_especificos', [['Curso', 'Tipo', 'Rango de meses para cursar']]),
  pestana('Colaboradores_asignados', [['ID', 'Puesto'], ['1', 'GESTOR DE COBRANZA']]),
  pestana('Colaboradores_especificos', [['ID', 'Puesto', 'Centros de costos', 'Centros que no aplican']]),
];
contenidoPorOrigen['PDT-operacion-adaptado.xlsx'] = PESTANAS_PDT;
contenidoPorOrigen['PDT-gerencial-adaptado.xlsx'] = PESTANAS_PDT;

/* ---------------- Contexto de Apps Script ---------------- */
const contexto = {
  console: { log: () => {} },
  Object, Array, Number, String, Math, JSON, Date, RegExp, Error, isNaN, Infinity,
  MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet', PLAIN_TEXT: 'text/plain' },
  Session: { getScriptTimeZone: () => 'America/Mazatlan' },
  Utilities: {
    formatDate: (fecha, _tz, formato) => {
      const p = (n) => String(n).padStart(2, '0');
      const y = fecha.getFullYear(), m = p(fecha.getMonth() + 1), d = p(fecha.getDate());
      return formato === 'yyyy-MM' ? `${y}-${m}` : `${y}-${m}-${d}`;
    },
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (clave) => ({
        COB_ID_CARPETA_CRUDOS: crudos.getId(),
        COB_ID_CARPETA_BASE: base.getId(),
      }[clave] || null),
    }),
  },
  DriveApp: {
    getFolderById: (id) => {
      if (id === crudos.getId()) return crudos;
      if (id === base.getId()) return base;
      throw new Error(`carpeta desconocida ${id}`);
    },
  },
  SpreadsheetApp: { openById: (id) => abrirHoja(id) },
  Drive: {
    Files: {
      copy(recurso, idOrigen, opciones) {
        const original = crudos.archivos.find((a) => a.getId() === idOrigen);
        let titulo = recurso.title;
        // Comportamiento real de Drive: al convertir, le quita la extensión.
        if (DRIVE_QUITA_EXTENSION) titulo = titulo.replace(/\.(xlsx|xlsm|csv|tsv)$/i, '');

        conversiones.push(original.getName());
        const copia = archivo(titulo, { mime: 'application/vnd.google-apps.spreadsheet' });
        // La conversión queda más nueva que el original.
        copia.actualizado = new Date(original.getLastUpdated().getTime() + 60000);
        trabajo.archivos.push(copia);
        hojaDeCalculo(copia.getId(), contenidoPorOrigen[original.getName()] || [pestana('Hoja1', [['x'], ['y']])]);
        return { id: copia.getId() };
      },
    },
  },
  bitacora_: () => {},
};
vm.createContext(contexto);

['00_Config.gs', '10_Util.gs'].forEach((f) =>
  vm.runInContext(fs.readFileSync(`${SRC}/${f}`, 'utf8'), contexto, { filename: f }));
vm.runInContext(fs.readFileSync(rutaFuentes, 'utf8'), contexto, { filename: 'fuentes' });
vm.runInContext('globalThis.CONFIG_ = CONFIG;', contexto, { filename: 'puente' });

// El catálogo de Fuentes, con los patrones reales de las semillas.
const FUENTES = {
  detalle_colaborador: { patron: '*detalle?colaborador*.xlsx', pestana: '', obligatorio: 'SI' },
  planta_posiciones: { patron: 'planta de cobranza por posiciones*.xlsx', pestana: '(fecha más reciente)', obligatorio: 'SI' },
  centros_tipocentros: { patron: 'planta de cobranza por posiciones*.xlsx', pestana: 'CENTROS-TIPOCENTROS', obligatorio: 'SI' },
  planta_centro: { patron: 'planta de cobranza por centro*.xlsx', pestana: '(fecha más reciente)', obligatorio: 'NO' },
  pdt_operacion: { patron: '*operaci?n*.xlsx', pestana: '(4 pestañas)', obligatorio: 'SI' },
  pdt_gerencial: { patron: '*gerencial*.xlsx', pestana: '(4 pestañas)', obligatorio: 'SI' },
  finalizaciones: { patron: 'cobranza*p*.csv', pestana: '', obligatorio: 'SI' },
};
contexto.fuente_ = (clave) => {
  const f = FUENTES[clave];
  if (!f) throw new Error(`La fuente '${clave}' no está en el catálogo de Fuentes.`);
  return f;
};

/* ---------------- Correr dos veces ---------------- */
const resumen = [];
for (const vuelta of [1, 2]) {
  conversiones.length = 0;
  const diagnostico = { avisos: [], conteos: {} };
  contexto.leerFuentes_('2026-08', diagnostico);
  const vivos = trabajo.archivos.filter((a) => !a.isTrashed()).map((a) => a.getName());
  resumen.push({ vuelta, conversiones: conversiones.slice(), enCarpeta: vivos });
}

console.log(`Drive le quita la extensión al convertir: ${DRIVE_QUITA_EXTENSION ? 'SÍ' : 'NO'}`);
resumen.forEach((r) => {
  console.log(`\n  corrida ${r.vuelta}: ${r.conversiones.length} conversión(es)`);
  r.conversiones.forEach((n) => console.log(`     convierte  ${n}`));
});
const ultima = resumen[1];
const duplicados = ultima.enCarpeta.filter((n, i, t) => t.indexOf(n) !== i);
console.log(`\n  archivos en Conversiones al final: ${ultima.enCarpeta.length}`);
ultima.enCarpeta.forEach((n) => console.log(`     ${n}`));
console.log(`  duplicados: ${duplicados.length ? duplicados.join(', ') : 'ninguno'}`);
console.log(ultima.conversiones.length === 0 && duplicados.length === 0
  ? '\n  RESULTADO: OK — la segunda corrida reutiliza todo y no hay duplicados.'
  : '\n  RESULTADO: FALLA — vuelve a convertir o deja duplicados.');
process.exit(ultima.conversiones.length === 0 && duplicados.length === 0 ? 0 : 1);
