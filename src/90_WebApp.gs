/**
 * La aplicación web: lo que el tablero le pide al servidor.
 *
 * Misma estructura y mismos indicadores que el tablero de Tienda. Tres
 * diferencias, todas de fondo y ninguna de forma:
 *
 *   · Tienda pasa a ser Centro, y la región sale de los catálogos del área.
 *   · La gráfica "Avance mensual" por fin lee el histórico real. En el tablero
 *     de Tienda dibuja una sola barra porque no hay de dónde sacar las otras.
 *   · Hay un botón "Procesar corte" que corre el motor sobre los archivos de
 *     Drive, además del "Actualizar datos" que sube un paquete.
 *
 * Lo que NO se hace, y es deliberado: `getDashboardData()` nunca lee la pestaña
 * de Colaborador. Son 11 mil filas por 23 columnas, y el tablero de Tienda las
 * lee enteras en cada cambio de filtro. Los puestos salen de FiltroCurso (3 mil
 * filas) y la búsqueda de personas lee solo las siete columnas que usa. Es la
 * diferencia entre responder en un segundo y quedarse pensando.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(archivo) {
  return HtmlService.createHtmlOutputFromFile(archivo).getContent();
}


/* =================================================================== *
 *  Carga inicial
 * =================================================================== */

/**
 * `peticion.periodo` permite abrir un mes cerrado. Sin él se abre el corte
 * vigente, que es el caso normal.
 *
 * Un mes anterior se sirve desde el histórico: sus agregados están completos,
 * pero el detalle por colaborador no —ese se archivó en Drive—, y por eso la
 * respuesta trae `esVigente` y `archivo`, para que el tablero pueda decirlo en
 * vez de enseñar una tabla vacía.
 */
function getDashboardData(peticion) {
  const corte = abrir_('corte');
  const solicitado = String((peticion || {}).periodo || '').trim();
  const base = {
    title: CONFIG.titulo,
    report: CONFIG.reporte,
    reportName: CONFIG.nombreReporte,
    availableReports: reportesDisponibles_(),
    // El validador del paquete vive en el navegador; sin esto tendría que
    // llevar el nombre del formato escrito duro y se desincroniza de CONFIG.
    packageFormat: CONFIG.paquete.formato,
    packageVersion: CONFIG.paquete.version,
    // Cómo se antepone el centro en el tablero. La etiqueta es OPCIONAL y por
    // omisión no hay ninguna: en CEDIS el departamento ya se nombra solo
    // ("07 CEDIS CROSS OAXC 02") y anteponerle "Centro" estorba. Un área cuyo
    // centro sea un número —Cobranza, con "500306"— escribe "Centro" en el
    // catálogo y la recupera.
    //
    // El valor por omisión va vacío a propósito: `parametro_` no distingue entre
    // "no está" y "está en blanco", así que si el default fuera "Centro" no
    // habría forma de pedir que no haya etiqueta.
    centroLabel: parametro_('ETIQUETA_CENTRO', ''),
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
    canUpdate: puedePublicar_(),
  };

  const resumen = leerTabla_(corte, 'Resumen');
  if (!resumen.length) {
    return Object.assign(base, {
      empty: true, summary: null, control: {}, periods: [],
      regions: [], courses: [], positions: [], planes: [], monthly: [],
    });
  }

  const vigente = String(resumen[resumen.length - 1].periodo || '');
  const periodo = solicitado && solicitado !== vigente ? solicitado : vigente;
  const esVigente = periodo === vigente;

  // Mismas pestañas para un mes cerrado que para el vigente: sin `Centro`, que
  // son 727 filas que la página no abre. Ver tablasDelCorte_().
  const tablas = esVigente
    ? tablasDelCorte_(corte, periodo)
    : agregadosDePeriodo_(periodo, ['Resumen', 'Region', 'Curso', 'FiltroCurso', 'Control']);

  const summary = (tablas.Resumen || []).pop();
  if (!summary) {
    throw new Error(`No hay ningún corte publicado del periodo ${periodo}.`);
  }

  return Object.assign(base, {
    empty: false,
    summary,
    control: (tablas.Control || []).pop() || {},
    period: periodo,
    currentPeriod: vigente,
    isCurrent: esVigente,
    cutoffDate: String(summary.fecha_corte || ''),
    periods: periodosDisponibles_(vigente),
    regions: (tablas.Region || []).sort(porAvance_),
    courses: (tablas.Curso || []).sort(porAvance_),
    // Los puestos salen de FiltroCurso y no de Colaborador: mismo resultado, una
    // tercera parte de las filas.
    positions: distintos_(tablas.FiltroCurso || [], 'puesto'),
    planes: esVigente ? planesPublicados_(corte) : [],
    monthly: serieMensual_(periodo),
    comparison: comparativaDePeriodo_(periodo),
    // Para un mes cerrado, dónde quedó su detalle por colaborador.
    archivo: esVigente ? null : archivoDeDetalle_(periodo),
  });
}

/**
 * Las pestañas del corte vigente que el tablero necesita, filtradas a su periodo.
 *
 * `Centro` NO está: son 727 filas por 12 columnas que la página recibía en cada
 * carga y no abría nunca. El centro de una persona sale de su propia fila en la
 * búsqueda, y los agregados por centro no se muestran en ninguna vista. Si algún
 * día hay una vista de centros, se vuelve a pedir aquí.
 */
function tablasDelCorte_(corte, periodo) {
  const delCorte = (fila) => (!periodo || String(fila.periodo || '') === periodo);
  const tablas = {};
  ['Resumen', 'Region', 'Curso', 'FiltroCurso', 'Control'].forEach((nombre) => {
    tablas[nombre] = leerTabla_(corte, nombre).filter(delCorte);
  });
  return tablas;
}

/**
 * Los meses que se pueden abrir: los del histórico más el vigente, del más
 * reciente al más viejo. El vigente puede no estar todavía en el histórico si
 * alguien mira el tablero a media publicación.
 */
function periodosDisponibles_(vigente) {
  const periodos = periodosDelHistorico_();
  if (vigente && periodos.indexOf(vigente) === -1) periodos.push(vigente);
  return periodos.sort().reverse().map((periodo) => ({
    periodo,
    anio: periodo.slice(0, 4),
    mes: periodo.slice(5, 7),
    nombreMes: MESES_ES[periodo.slice(5, 7)] || periodo.slice(5, 7),
    esVigente: periodo === vigente,
  }));
}

/**
 * Los tableros entre los que se puede saltar desde el selector de reportes.
 *
 * Cada área es un proyecto y un despliegue distinto, así que enlazarlos es
 * conocer su URL — un dato de la instalación, no del código. Vive en el
 * parámetro OTROS_REPORTES con la forma:
 *
 *     Cobranza=https://script.google.com/…/exec, CATd=https://…/exec
 *
 * Vacío = este tablero es el único, y el selector enseña un solo renglón.
 */
function reportesDisponibles_() {
  const actual = ScriptApp.getService().getUrl() || '';
  const propios = [{ key: CONFIG.reporte, name: CONFIG.nombreReporte, url: actual, current: true }];

  return propios.concat(
    String(parametro_('OTROS_REPORTES', '')).split(',')
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((parte) => {
        const i = parte.indexOf('=');
        if (i === -1) return null;
        const nombre = parte.slice(0, i).trim();
        const url = parte.slice(i + 1).trim();
        if (!nombre || !url) return null;
        return { key: normalizar_(nombre), name: nombre, url, current: false };
      })
      .filter(Boolean)
  );
}

/**
 * El avance de cada mes del año, para la gráfica. Sale del histórico, que solo
 * guarda agregados: 12 renglones al año, no 11 mil por mes.
 */
function serieMensual_(periodoActual) {
  const anio = String(periodoActual || '').slice(0, 4);
  return leerTabla_(abrir_('historico'), 'Resumen')
    .filter((fila) => normalizar_(fila.reporte) === CONFIG.reporte &&
      String(fila.periodo || '').slice(0, 4) === anio)
    .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
    .map((fila) => ({
      periodo: String(fila.periodo),
      mes: MESES_ES[String(fila.periodo).slice(5, 7)] || '',
      avance: numero_(fila.avance),
      asignados: numero_(fila.cursos_asignados),
      completados: numero_(fila.cursos_completados),
      colaboradores: numero_(fila.colaboradores),
      actual: String(fila.periodo) === String(periodoActual),
    }));
}

/** Los planes presentes en el corte, para el filtro Colaborador / Gerencial. */
function planesPublicados_(corte) {
  const valores = leerColumnas_(corte, 'Colaborador', ['plan'])
    .map((fila) => String(fila.plan || '').trim())
    .filter(Boolean);
  const vistos = {};
  valores.forEach((v) => {
    // "Ambos" no es un plan: es alguien que recibe cursos de los dos.
    if (v === 'Ambos') { vistos.Colaborador = true; vistos.Gerencial = true; return; }
    vistos[v] = true;
  });
  return Object.keys(vistos).sort();
}


/* =================================================================== *
 *  Indicadores filtrados
 * =================================================================== */

/**
 * Recalcula los indicadores cuando hay filtros puestos.
 *
 * Con un curso seleccionado los totales salen de FiltroCurso, que ya viene
 * agregado por puesto y región. Sin curso, de las mismas tablas agregadas: en
 * ningún caso hace falta recorrer a los 11 mil colaboradores.
 */
function getFilteredOverview(peticion) {
  const opciones = peticion || {};
  const periodo = String(opciones.period || '').trim();
  const corte = opciones.isCurrent === false ? abrir_('historico') : abrir_('corte');
  const region = normalizar_(opciones.region || '');
  const puesto = normalizar_(opciones.position || '');
  const curso = normalizar_(opciones.course || '');

  const filas = leerTabla_(corte, 'FiltroCurso').filter((fila) =>
    (!periodo || String(fila.periodo || '') === periodo) &&
    (!region || normalizar_(fila.region) === region) &&
    (!puesto || normalizar_(fila.puesto) === puesto) &&
    (!curso || normalizar_(fila.curso_clave) === curso || normalizar_(fila.curso) === curso));

  const totals = filas.reduce((t, fila) => {
    t.asignados += numero_(fila.asignados);
    t.completados += numero_(fila.completados);
    t.pendientes += numero_(fila.pendientes);
    return t;
  }, { colaboradores: 0, asignados: 0, completados: 0, pendientes: 0 });
  totals.avance = avance_(totals.completados, totals.asignados);
  totals.colaboradores = colaboradoresFiltrados_(periodo, opciones);

  return {
    totals,
    regions: agrupar_(filas, 'region', (fila) => ({ region: fila.region })).map((fila) => ({
      region: fila.region,
      colaboradores: 0,
      cursos_asignados: fila.asignados,
      cursos_completados: fila.completados,
      cursos_pendientes: fila.pendientes,
      avance: fila.avance,
    })),
    courses: agrupar_(filas, 'curso_clave', (fila) => ({
      curso_clave: fila.curso_clave, curso: fila.curso, iniciativa: fila.iniciativa,
    })),
  };
}

/**
 * Cuántas personas distintas caen bajo los filtros. Lee solo cuatro columnas de
 * Colaborador, no las 23.
 */
function colaboradoresFiltrados_(periodo, opciones) {
  const region = normalizar_(opciones.region || '');
  const puesto = normalizar_(opciones.position || '');
  const plan = normalizar_(opciones.plan || '');
  if (!region && !puesto && !plan) return 0;
  if (opciones.isCurrent === false) return 0;

  return leerColumnas_(abrir_('corte'), 'Colaborador', ['periodo', 'region', 'puesto', 'plan'])
    .filter((fila) =>
      (!periodo || String(fila.periodo || '') === periodo) &&
      (!region || normalizar_(fila.region) === region) &&
      (!puesto || normalizar_(fila.puesto) === puesto) &&
      (!plan || normalizar_(fila.plan) === plan || normalizar_(fila.plan) === 'ambos'))
    .length;
}

function agrupar_(filas, llave, atributos) {
  const mapa = {};
  filas.forEach((fila) => {
    const valor = String(fila[llave] || '');
    if (!mapa[valor]) {
      mapa[valor] = Object.assign({ asignados: 0, completados: 0, pendientes: 0 }, atributos(fila));
    }
    mapa[valor].asignados += numero_(fila.asignados);
    mapa[valor].completados += numero_(fila.completados);
    mapa[valor].pendientes += numero_(fila.pendientes);
  });
  return Object.keys(mapa).map((valor) => {
    const fila = mapa[valor];
    fila.avance = avance_(fila.completados, fila.asignados);
    return fila;
  });
}


/* =================================================================== *
 *  Detalle por colaborador
 * =================================================================== */

/**
 * Una fila por persona + curso pendiente, paginada.
 *
 * Los pendientes vienen concentrados en `lista_pendientes`, separados por " | ".
 * El tablero de Tienda los recupera buscando cada nombre de curso dentro de esa
 * cadena y tachando lo que va encontrando; aquí basta con partir por el
 * separador, que es exacto y no confunde un curso con otro cuyo nombre lo
 * contenga.
 */
function searchEmployees(peticion) {
  const opciones = peticion || {};
  const periodo = String(opciones.period || '').trim();

  // El detalle por colaborador solo vive en el corte vigente. El de los meses
  // cerrados está archivado en Drive: se dice, en vez de devolver una tabla
  // vacía que parecería un error.
  if (opciones.isCurrent === false) {
    const archivo = archivoDeDetalle_(periodo);
    return {
      page: 1, pageSize: 20, total: 0, totalPages: 1, rows: [],
      archivado: archivo || { periodo },
      mensaje: archivo
        ? `El detalle de ${etiquetaPeriodo_(periodo)} está archivado en Drive (${archivo.megas} MB).`
        : `No hay detalle archivado de ${etiquetaPeriodo_(periodo)}.`,
    };
  }

  const corte = abrir_('corte');
  const consulta = normalizar_(opciones.query || '');
  const region = normalizar_(opciones.region || '');
  const puesto = normalizar_(opciones.position || '');
  const plan = normalizar_(opciones.plan || '');
  const curso = normalizar_(opciones.course || '');
  const centro = String(opciones.centro || '').trim();

  const pagina = Math.max(1, numero_(opciones.page) || 1);
  const tamano = Math.min(50, Math.max(10, numero_(opciones.pageSize) || 20));

  const personas = leerColumnas_(corte, 'Colaborador', [
    'periodo', 'numero_empleado', 'nombre', 'puesto', 'plan',
    'region', 'centro', 'nomenclatura', 'lista_pendientes',
  ]).filter((fila) => {
    const coincideTexto = !consulta || [fila.numero_empleado, fila.nombre, fila.puesto, fila.centro]
      .some((valor) => normalizar_(valor).indexOf(consulta) !== -1);
    return coincideTexto &&
      (!periodo || String(fila.periodo || '') === periodo) &&
      (!region || normalizar_(fila.region) === region) &&
      (!puesto || normalizar_(fila.puesto) === puesto) &&
      (!plan || normalizar_(fila.plan) === plan || normalizar_(fila.plan) === 'ambos') &&
      (!centro || String(fila.centro || '').trim() === centro);
  });

  const filas = [];
  personas.forEach((persona) => {
    String(persona.lista_pendientes || '').split('|')
      .map((nombre) => nombre.trim())
      .filter(Boolean)
      .forEach((pendiente) => {
        if (curso && normalizar_(pendiente) !== curso) return;
        filas.push({
          numero_empleado: persona.numero_empleado,
          nombre: persona.nombre,
          puesto: persona.puesto,
          region: persona.region,
          centro: persona.centro,
          nomenclatura: persona.nomenclatura,
          curso_pendiente: pendiente,
        });
      });
  });

  filas.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es') ||
    String(a.curso_pendiente).localeCompare(String(b.curso_pendiente), 'es'));

  const total = filas.length;
  const desde = (pagina - 1) * tamano;
  return {
    page: pagina,
    pageSize: tamano,
    total,
    totalPages: Math.max(1, Math.ceil(total / tamano)),
    rows: filas.slice(desde, desde + tamano),
  };
}


/* =================================================================== *
 *  Acciones
 * =================================================================== */

/** Sube un paquete .json. La reja está en publicarPaquete(). */
function importarPaquete(contenido) {
  return publicarPaquete(contenido);
}

/**
 * Publica el paquete que dejó el cuaderno. La reja está en publicarPaquete().
 *
 * Es lo que hace el botón del tablero desde que el cálculo salió de Apps Script.
 * Solo escribe, así que tarda minutos y no decenas — el botón ya no cuelga de
 * una llamada de veinte minutos.
 */
function publicarDesdeTablero(opciones) {
  return publicarDesdeDrive((opciones || {}).periodo || '');
}

/** El camino alterno: calcular aquí. Lento; ver docs/08-plan-colab.md. */
function procesarCorteDesdeTablero(opciones) {
  return procesarCorte(opciones || {});
}

/** Carga un corte de un mes anterior al publicado. La reja está en cargarHistorico(). */
function cargarHistoricoDesdeTablero(contenido) {
  return cargarHistorico(contenido);
}


/* =================================================================== *
 *  Lectura
 * =================================================================== */

/**
 * Lee solo las columnas pedidas de una pestaña.
 *
 * `getDataRange().getValues()` sobre Colaborador trae 255 mil celdas cuando la
 * búsqueda necesita 88 mil. Leer por columnas contiguas cuesta unas cuantas
 * llamadas más y mueve una tercera parte de los datos.
 */
function leerColumnas_(hoja, nombrePestana, nombres) {
  const pestana = hoja.getSheetByName(nombrePestana);
  if (!pestana || pestana.getLastRow() < 2) return [];

  const encabezados = pestana.getRange(1, 1, 1, pestana.getLastColumn()).getValues()[0]
    .map((valor) => String(valor).trim());
  const indices = nombres
    .map((nombre) => ({ nombre, i: encabezados.indexOf(nombre) }))
    .filter((par) => par.i !== -1);
  if (!indices.length) return [];

  const alto = pestana.getLastRow() - 1;
  const desde = Math.min.apply(null, indices.map((par) => par.i));
  const hasta = Math.max.apply(null, indices.map((par) => par.i));
  const bloque = pestana.getRange(2, desde + 1, alto, hasta - desde + 1).getValues();

  return bloque
    .filter((fila) => fila.some((valor) => valor !== '' && valor !== null))
    .map((fila) => indices.reduce((objeto, par) => {
      objeto[par.nombre] = serializable_(fila[par.i - desde]);
      return objeto;
    }, {}));
}

function porAvance_(a, b) {
  return numero_(b.avance) - numero_(a.avance);
}

function distintos_(filas, campo) {
  const vistos = {};
  filas.forEach((fila) => {
    const valor = String(fila[campo] || '').trim();
    if (valor) vistos[valor] = true;
  });
  return Object.keys(vistos).sort((a, b) => a.localeCompare(b, 'es'));
}
