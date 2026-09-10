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

['00_Config.gs', '01_Esquema.gs', '02_Semillas.gs', '10_Util.gs', '30_Motor.gs']
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), contexto, { filename: f }));

// Apps Script comparte los `const` de nivel superior entre archivos, pero en un
// contexto de vm viven en el ámbito léxico y no en el objeto global. Este puente
// los expone sin tocar el código que se está probando.
vm.runInContext(
  'globalThis.expuesto = {CONFIG, ESQUEMA_CATALOGOS, ESQUEMA_CORTE, SEMILLAS};',
  contexto, { filename: 'puente' });
Object.assign(contexto, contexto.expuesto);

/* ---- los catálogos, servidos desde las semillas ---- */
const overrides = {};
pisados.filter((a) => a.indexOf('=') !== -1).forEach((a) => {
  const i = a.indexOf('=');
  overrides[a.slice(0, i).trim().toUpperCase()] = a.slice(i + 1).trim();
});

const { textoClave_, claveCurso_, SEMILLAS, ESQUEMA_CATALOGOS } = contexto;
const catalogo = (nombre) => {
  const columnas = ESQUEMA_CATALOGOS[nombre];
  return (SEMILLAS[nombre] || []).map((fila) =>
    columnas.reduce((obj, c, i) => { obj[c] = fila[i]; return obj; }, {}));
};

const parametros = {};
catalogo('Parametros').forEach((f) => { parametros[String(f.clave).toUpperCase()] = String(f.valor); });
Object.assign(parametros, overrides);

const param = (clave, porDefecto) => {
  const v = parametros[String(clave).toUpperCase()];
  return v === undefined || v === '' ? porDefecto : v;
};
const siNo = (clave, porDefecto) => {
  const v = textoClave_(param(clave, porDefecto ? 'SI' : 'NO'));
  return v === 'SI' || v === 'TRUE' || v === '1';
};

const regiones = catalogo('Regiones').sort((a, b) => a.orden - b.orden).map((f) => f.region);
const mapaRegiones = catalogo('MapaRegiones');
const alias = catalogo('AliasCursos');
const agrupaciones = catalogo('Agrupaciones');
const niveles = catalogo('NivelesGerencial');
const excepciones = catalogo('ExcepcionImpresion');
const aliasPuestos = catalogo('AliasPuestos');
const centrosCosto = catalogo('CentrosCosto');
const puestosEspecificos = catalogo('PuestosEspecificos');
const soloDigitos = (v) => { const m = String(v == null ? '' : v).match(/\d+/); return m ? String(Number(m[0])) : ''; };

const opciones = {
  periodo: param('PERIODO', '2026-08'),
  fechaCorte: param('FECHA_CORTE', '2026-08-31'),
  respetarMatriz: siNo('RESPETAR_MATRIZ_GERENCIAL', true),
  deduplicar: siNo('DEDUPLICAR_FINALIZACIONES', true),
  soloOperacion: siNo('FILTRAR_CATEGORIA_OPERACION', false),
  diasPorMes: Number(param('DIAS_POR_MES', 30)),
  nuevoIngresoDias: Number(param('NUEVO_INGRESO_DIAS', 90)),
  sinFechaContratacion: textoClave_(param('SIN_FECHA_CONTRATACION', 'EXCLUIR')),
  baseAntiguedad: textoClave_(param('BASE_ANTIGUEDAD', 'PUESTO')) === 'EMPRESA' ? 'EMPRESA' : 'PUESTO',
  fechaMinimaValida: param('FECHA_MINIMA_VALIDA', '1950-01-01'),
  subEstatusCompletados: String(param('SUBESTATUS_COMPLETADOS', '') || '')
    .split(',').map(textoClave_).filter(Boolean),
  puestosFueraDelPlan:
    textoClave_(param('PUESTOS_FUERA_DEL_PLAN', 'EXCLUIR')) === 'PUBLICAR' ? 'PUBLICAR' : 'EXCLUIR',

  regionOficial: (cruda) => {
    const k = textoClave_(cruda);
    if (!k) return null;
    const directa = regiones.find((r) => textoClave_(r) === k);
    if (directa) return directa;
    const m = mapaRegiones.find((f) => textoClave_(f.region_origen) === k);
    return m ? (regiones.find((r) => textoClave_(r) === textoClave_(m.region_oficial)) || null) : null;
  },
  reglaCurso: (curso) => {
    const f = alias.find((a) => textoClave_(a.curso_en_plan) === textoClave_(curso));
    if (!f) return { accion: 'DIRECTO', nombre: String(curso).trim() };
    const accion = textoClave_(f.accion) || 'ALIAS';
    const eq = String(f.curso_en_finalizaciones || '').trim();
    if (accion === 'ALIAS' && eq) return { accion: 'ALIAS', nombre: eq };
    if (accion === 'EXCLUIR') return { accion: 'EXCLUIR', nombre: null };
    return { accion: 'PENDIENTE', nombre: null };
  },
  agrupacionDe: (curso) => {
    const f = agrupaciones.find((a) => textoClave_(a.curso) === textoClave_(curso));
    return f ? String(f.agrupacion).trim() : '';
  },
  nombresDeAgrupacion: siNo('ESPECIALIZACION_COMO_CURSO', false)
    ? []
    : [...new Set(agrupaciones.map((a) => String(a.agrupacion).trim()))].filter(Boolean),
  nivelGerencial: (puesto) => {
    const f = niveles.find((n) => textoClave_(n.puesto) === textoClave_(puesto));
    return f ? String(f.nivel_matriz).trim() : '';
  },
  puestoDelPlan: (puesto) => {
    const f = aliasPuestos.find((a) => textoClave_(a.puesto_en_datos) === textoClave_(puesto));
    const destino = f ? String(f.puesto_en_plan || '').trim() : '';
    return destino || String(puesto || '').trim();
  },
  puestosEspecificosExtra: (familia) => puestosEspecificos
    .filter((f) => textoClave_(f.plan) === textoClave_(familia))
    .filter((f) => String(f.puesto || '').trim())
    .map((f) => ({
      id: String(f.id || '').trim(),
      puesto: String(f.puesto || '').trim(),
      centrosDeCosto: '',
      centrosQueNoAplican: [],
      centrosQueSiAplican: String(f.centros || '').split(',').map((c) => c.trim()).filter(Boolean),
    })),
  centrosDeCostoDelArea: centrosCosto.map((f) => soloDigitos(f.centro_costo)).filter(Boolean),
  esFamiliaDeCentros: (valor) => {
    const familia = textoClave_(param('FAMILIA_CENTRO_COSTOS', '007'));
    const d = String(valor || '').match(/\d+/);
    return Boolean(d) && String(Number(d[0])) === String(Number(familia));
  },
  centrosExceptuados: (codigoPuesto) => {
    const codigo = String(codigoPuesto || '').trim();
    if (!codigo) return [];
    return excepciones
      .filter((f) => String(f.puestos).split(/[,;]/).map((p) => p.trim()).indexOf(codigo) !== -1)
      .map((f) => String(f.centro).trim());
  },
};

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
