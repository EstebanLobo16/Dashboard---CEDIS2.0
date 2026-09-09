/**
 * Corre el leerFuentes_ REAL contra un Drive simulado.
 *
 * Responde dos preguntas, y las dos costaron caro:
 *
 *   1. ¿La segunda corrida reutiliza las conversiones, o las vuelve a hacer?
 *      Convertir es lo más lento del proceso; reconvertir en cada corrida deja
 *      al corte sin tiempo para terminar, y sin ningún error que lo explique.
 *
 *   2. ¿Se detecta el encabezado corrido del PDT gerencial? Ese archivo trae una
 *      columna de numeración que el encabezado no nombra, así que todo queda
 *      recorrido un lugar. Sin la corrección, el tablero lee "0-1" como nombre
 *      del curso y publica números que se ven razonables y no lo son.
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
const base = carpeta('Tablero CEDIS');
const crudos = carpeta('Datos crudos');
const trabajo = carpeta('Conversiones');
base.subcarpetas.push(trabajo);

const fPadron = archivo('cedis_padron_2026-08.csv', { mime: 'text/csv' });
const fFinal = archivo('cedis_finalizaciones_2026-08.csv', { mime: 'text/csv' });
const fDetalle = archivo('detalle_colaborador.xlsx');
const fOper = archivo('PDT-operacion-adaptado.xlsx');
const fGer = archivo('PDT-gerencial-adaptado.xlsx');
crudos.archivos.push(fPadron, fFinal, fDetalle, fOper, fGer);

/* Contenido que cada conversión debe entregar, por nombre del original. */
const contenidoPorOrigen = {
  'cedis_padron_2026-08.csv': [
    pestana('Hoja1', [
      ['Número Persona', 'Número Colaborador', 'Nombre Colaborador', 'Región RRHH',
        'Centro Costos', 'Área', 'Departamento', 'Puesto', 'Tipo Posición',
        'Fecha Contratación', 'Fecha Asignación Puesto'],
      // Los dos identificadores distintos, que es el caso mayoritario en CEDIS.
      ['100174359', '90533814', 'Aaron Rodriguez Pacheco', 'Oaxaca',
        '045 - DISTRIBUCION FORANEA', 'CEDIS', '07 CEDIS CROSS OAXC 02',
        'CHOFER DE DISTRIBUCION', 'OPERACION', '27 feb 2026', '27 feb 2026'],
      // Persona == colaborador, y un puesto que el plan llama de otra forma.
      ['97419877', '97419877', 'Aaron Muñoz Armenta', 'Hermosillo',
        '073 - OPERACION TRANSPORTE', 'STAFF', '07 CEDIS CROSS CDOB',
        'COORDINADOR DE TRANSPORTE', 'OPERACION', '6 jul 2016', '6 jul 2016'],
      // Un centro de costo fuera de la lista blanca de la especialización.
      ['100200001', '90600001', 'Ana Ruiz Soto', 'Tecámac',
        '060 - BODEGA ROPA PICKING', 'CEDIS', '05 CEDIS ROPA TCMC',
        'SURTIDOR', 'OPERACION', '1 mar 2025', '1 mar 2025'],
    ]),
  ],
  'cedis_finalizaciones_2026-08.csv': [
    pestana('Hoja1', [
      ['Número Persona', 'Número Colaborador', 'Nombre Curso', '¿Lo Completó?',
        'Sub Estatus Aprendizaje'],
      ['100174359', '90533814', 'Responsabilidad al volante', 'Si', 'Completado'],
      ['100174359', '90533814', 'Código de Ética de Grupo Coppel', 'No', 'Exenta'],
      ['97419877', '97419877', 'Responsabilidad al volante', 'No', 'No iniciado'],
    ]),
  ],
  'detalle_colaborador.xlsx': [
    pestana('Sheet1', [
      ['NÚMERO_PERSONA', 'FECHA_DE_INGRESO', 'FECHA_DE_INGRESO_DE_PUESTO',
        'NOMBRE_COLABORADOR', 'CODIGO_PUESTO', 'PUESTO'],
      ['100174359', '2026/02/27', '2026/02/27', 'Aaron Rodriguez Pacheco', '1047', 'CHOFER DE DISTRIBUCION'],
      ['97419877', '2016/07/06', '2016/07/06', 'Aaron Muñoz Armenta', '1049', 'COORDINADOR'],
    ]),
  ],
};

/* El PDT de operación: encabezados alineados con los datos. */
contenidoPorOrigen['PDT-operacion-adaptado.xlsx'] = [
  pestana('Cursos_asignados', [
    ['Tipo', 'Rango de meses para cursar', 'Curso', 'Modalidad', 'Duración', 'ID Curso'],
    ['Normativo', '0-1', 'Código de Ética de Grupo Coppel', 'En línea', '0:20:00', 'OLC2540583'],
  ]),
  pestana('Cursos_especificos', [
    ['Tipo', 'Rango de meses para cursar', 'Curso', 'Modalidad', 'Duración', 'ID Curso'],
    ['Normativo Especializado', '0-1', 'Responsabilidad al volante', 'En línea', '00:40:00', 'OLC5745710'],
  ]),
  pestana('Colaboradores_asignados', [['ID', 'Puesto '], ['1047', 'CHOFER DE DISTRIBUCION']]),
  pestana('Colaboradores_especificos', [['ID', 'Puesto ', 'Centros de costos']]),
];

/* El PDT gerencial, tal como llega: la fila 1 trae 12 encabezados pero los datos
   empiezan con una columna de numeración que ningún encabezado nombra, así que
   todo va recorrido un lugar. Y la lista de centros es "que SI aplican". */
contenidoPorOrigen['PDT-gerencial-adaptado.xlsx'] = [
  pestana('Cursos_asignados', [
    ['Tipo', 'Rango de meses para cursar', 'Curso', 'Modalidad', 'Duración', 'ID Curso',
      'Jefes y Coordinadores', 'Gerente Operación', 'Gerente de Zona/Gte Sr',
      'Gerente Regional', 'Gerente Divisional o Director de Área',
      'Director Corporativo o Director General '],
    [1, 'Institucional', '0-1', 'Te damos la bienvenida a Grupo Coppel', 'En línea',
      '0:50:00', 'TEC-C-3-99', 1, 1, 1, 1, 1],
    [2, 'Normativo', '0-1', 'Operación segura de maquinaria', 'En línea',
      '1:00:00', 'CU-C-487-099', 1, 1, '', '', ''],
  ]),
  pestana('Cursos_especificos', [
    ['Tipo', 'Rango de meses para cursar', 'Curso', 'Modalidad', 'Duración', 'ID Curso'],
    ['Normativo Especializado', '0-1', 'Responsabilidad al volante', 'En línea', '00:40:00', 'OLC5745710'],
  ]),
  pestana('Colaboradores_asignados', [['ID', 'Puesto '], ['1049', 'COORDINADOR']]),
  pestana('Colaboradores_especificos', [
    ['ID', 'Puesto ', 'Centros de costos', '', 'Centros que si aplican'],
    ['1049', 'COORDINADOR', '', '', '045 Distribución Foráneo'],
    ['', '', '', '', '073 Operación Transporte'],
  ]),
];

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
        CED_ID_CARPETA_CRUDOS: crudos.getId(),
        CED_ID_CARPETA_BASE: base.getId(),
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
  padron: { patron: 'cedis?padron*.csv', pestana: '', obligatorio: 'SI' },
  finalizaciones: { patron: 'cedis?finalizaciones*.csv', pestana: '', obligatorio: 'SI' },
  pdt_operacion: { patron: '*operaci?n*.xlsx', pestana: '(4 pestañas)', obligatorio: 'SI' },
  pdt_gerencial: { patron: '*gerencial*.xlsx', pestana: '(4 pestañas)', obligatorio: 'SI' },
  detalle_colaborador: { patron: '*detalle?colaborador*.xlsx', pestana: '', obligatorio: 'NO' },
};
contexto.fuente_ = (clave) => {
  const f = FUENTES[clave];
  if (!f) throw new Error(`La fuente '${clave}' no está en el catálogo de Fuentes.`);
  return f;
};

/* ---------------- Correr dos veces ---------------- */
const resumen = [];
let fuentes = null;
let avisos = [];
for (const vuelta of [1, 2]) {
  conversiones.length = 0;
  const diagnostico = { avisos: [], conteos: {} };
  fuentes = contexto.leerFuentes_('2026-08', diagnostico);
  avisos = diagnostico.avisos;
  const vivos = trabajo.archivos.filter((a) => !a.isTrashed()).map((a) => a.getName());
  resumen.push({ vuelta, conversiones: conversiones.slice(), enCarpeta: vivos });
}

console.log(`Drive le quita la extensión al convertir: ${DRIVE_QUITA_EXTENSION ? 'SÍ' : 'NO'}`);
resumen.forEach((r) => {
  console.log(`\n  corrida ${r.vuelta}: ${r.conversiones.length} conversión(es)`);
  r.conversiones.forEach((n) => console.log(`     convierte  ${n}`));
});
const ultima = resumen[1];
const duplicados = ultima.enCarpeta.filter((n, i, t2) => t2.indexOf(n) !== i);
console.log(`\n  archivos en Conversiones al final: ${ultima.enCarpeta.length}`);
console.log(`  duplicados: ${duplicados.length ? duplicados.join(', ') : 'ninguno'}`);

/* ---------------- Qué se leyó ---------------- */
const fallos = [];
const revisar = (bien, que) => {
  console.log(`  ${bien ? 'ok  ' : 'MAL '} ${que}`);
  if (!bien) fallos.push(que);
};

console.log('\nConversiones');
revisar(ultima.conversiones.length === 0, 'la segunda corrida no vuelve a convertir nada');
revisar(duplicados.length === 0, 'no quedan conversiones duplicadas');

console.log('\nPadrón');
revisar(fuentes.padron.length === 3, `tres personas (${fuentes.padron.length})`);
const uno = fuentes.padron[0];
revisar(uno.numeroPersona === '100174359' && uno.numeroColaborador === '90533814',
  'conserva los dos identificadores cuando difieren');
revisar(uno.departamento === '07 CEDIS CROSS OAXC 02', 'lee el departamento');
revisar(uno.centroCostos === '045 - DISTRIBUCION FORANEA', 'lee el centro de costos');
revisar(uno.area === 'CEDIS' && uno.region === 'Oaxaca', 'lee el área y la región');
revisar(uno.fechaPuesto === '27 feb 2026', 'lee la fecha de asignación de puesto');

console.log('\nFinalizaciones');
revisar(fuentes.finalizaciones.length === 3, `tres filas (${fuentes.finalizaciones.length})`);
revisar(fuentes.finalizaciones[1].subEstatus === 'Exenta',
  'lee Sub Estatus Aprendizaje, no solo ¿Lo Completó?');

console.log('\nDetalle Colaborador (opcional)');
revisar(fuentes.detalle.length === 2, `dos filas (${fuentes.detalle.length})`);

console.log('\nPlan de operación (encabezado alineado)');
const oper = fuentes.planes[0];
revisar(oper.cursosGenerales.length === 1 &&
  oper.cursosGenerales[0].curso === 'Código de Ética de Grupo Coppel',
  `lee el curso (${oper.cursosGenerales[0] && oper.cursosGenerales[0].curso})`);
revisar(oper.cursosGenerales[0].rango === '0-1', 'lee el rango de meses');

console.log('\nPlan gerencial (encabezado CORRIDO una columna)');
const ger = fuentes.planes[1];
const primero = ger.cursosGenerales[0] || {};
revisar(primero.curso === 'Te damos la bienvenida a Grupo Coppel',
  `lee el nombre del curso, no el rango (${primero.curso})`);
revisar(primero.rango === '0-1', `lee el rango, no el tipo (${primero.rango})`);
revisar(primero.tipo === 'Institucional', `lee el tipo, no el número de fila (${primero.tipo})`);
revisar(primero.niveles && String(primero.niveles['Jefes y Coordinadores']) === '1',
  'la matriz de niveles también queda alineada');
const segundo = ger.cursosGenerales[1] || {};
revisar(segundo.niveles && String(segundo.niveles['Gerente Regional']) === '',
  'un nivel sin marca sigue viniendo vacío');
revisar(avisos.some((a) => a.indexOf('corrida una columna') !== -1),
  'el corrimiento queda avisado, no se corrige en silencio');

console.log('\nCentros del plan específico');
const puestoEsp = ger.puestosEspecificos[0] || {};
revisar((puestoEsp.centrosQueSiAplican || []).length === 2,
  `lee la lista blanca "Centros que si aplican" (${(puestoEsp.centrosQueSiAplican || []).length})`);
revisar((puestoEsp.centrosQueNoAplican || []).length === 0,
  'no confunde la lista blanca con la negra');

console.log(`\n${fallos.length ? `RESULTADO: FALLA — ${fallos.length} revisión(es)` : 'RESULTADO: OK'}`);
process.exit(fallos.length ? 1 : 0);
