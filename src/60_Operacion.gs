/**
 * Operación: vigilar las fuentes, diagnosticar, y dejar el proceso a la mano de
 * quien no abre el editor de Apps Script.
 *
 * El disparador mensual vive en 40_Proceso.gs. Lo que hay aquí es lo que evita
 * la peor forma de fallar: llegar al día del corte y descubrir que el área nunca
 * subió un archivo. Una revisión previa unos días antes, y un aviso.
 *
 * También el menú de la hoja de Catálogos. Quien edita las reglas del negocio no
 * tiene por qué entrar al editor de código para que sus cambios se apliquen.
 */

/* =================================================================== *
 *  Vigilancia de fuentes
 * =================================================================== */

/**
 * Revisa que los archivos crudos estén y de cuándo son. **No** los abre: mira
 * nombre y fecha de modificación, que es barato y suficiente para responder «el
 * área todavía no subió nada». Si una fuente está pero desactualizada por
 * dentro —un CSV con el corte del mes pasado— eso lo detecta el ensayo, que sí
 * la abre.
 */
function revisarFuentes(periodo) {
  const cual = String(periodo || '').trim() || periodoActivo_();
  const idCarpeta = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.props.carpetaCrudos);
  if (!idCarpeta) {
    throw new Error('Falta configurar la carpeta de datos crudos. Corre instalar().');
  }
  const carpeta = DriveApp.getFolderById(idCarpeta);

  // Un archivo del corte de agosto se sube en septiembre, así que "reciente"
  // es haberse tocado desde que empezó el mes siguiente al del periodo.
  const anio = Number(cual.slice(0, 4));
  const mes = Number(cual.slice(5, 7));
  const desde = new Date(anio, mes, 1);

  const revisiones = catalogo_('Fuentes')
    .filter((fila) => String(fila.clave || '').trim())
    .filter((fila, i, todas) => todas.findIndex((f) => f.patron === fila.patron) === i)
    .map((fila) => {
      const obligatoria = textoClave_(fila.obligatorio) !== 'NO';
      const encontrados = buscarArchivos_(carpeta, fila.patron);

      if (!encontrados.length) {
        return {
          clave: fila.clave, patron: fila.patron, obligatoria,
          estado: obligatoria ? 'FALTA' : 'opcional, no está',
          detalle: 'ningún archivo combina con el patrón',
        };
      }

      const archivo = encontrados[0];
      const modificado = archivo.getLastUpdated();
      const vieja = modificado < desde;
      return {
        clave: fila.clave, patron: fila.patron, obligatoria,
        estado: vieja ? 'POSIBLEMENTE VIEJA' : 'ok',
        detalle: `${archivo.getName()} · ${aTextoFecha_(modificado)} · ` +
          `${Math.round(archivo.getSize() / 1048576 * 10) / 10} MB` +
          (encontrados.length > 1 ? ` (y ${encontrados.length - 1} más)` : ''),
      };
    });

  return { periodo: cual, revisiones, problemas: revisiones.filter((r) => problematica_(r)) };
}

function problematica_(revision) {
  return revision.estado === 'FALTA' ||
    (revision.obligatoria && revision.estado === 'POSIBLEMENTE VIEJA');
}

/** La misma revisión, en texto, para correrla desde el editor. */
function revisarDatosCrudos(periodo) {
  const resultado = revisarFuentes(periodo);
  const lineas = [`Datos crudos para el corte ${resultado.periodo}`, ''];
  resultado.revisiones.forEach((r) => {
    const marca = r.estado === 'ok' ? '·' : (r.estado === 'FALTA' ? '✗' : '⚠');
    lineas.push(`${marca} ${r.clave.padEnd(22)} ${r.estado}`);
    lineas.push(`  ${r.detalle}`);
  });
  lineas.push('', resultado.problemas.length
    ? `${resultado.problemas.length} fuente(s) con problema: ${resultado.problemas.map((r) => r.clave).join(', ')}`
    : 'Todas las fuentes obligatorias están y parecen del corte.');
  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}

/**
 * Corre unos días antes del corte y avisa solo si falta algo.
 *
 * El día 11 a propósito: las fuentes del área se actualizan a más tardar el día
 * 10 y el corte se procesa el 12, así que este aviso llega con un día para
 * reclamar. Avisar el día 12, cuando ya truena, no sirve de nada.
 *
 * Si todo está, no manda nada: un correo mensual que siempre dice "todo bien"
 * se deja de leer a los tres meses, y entonces tampoco se lee el que sí importa.
 */
function revisionPreviaMensual_() {
  const periodo = periodoActivo_();
  let resultado;
  try {
    resultado = revisarFuentes(periodo);
  } catch (error) {
    avisarPorCorreo_(`No se pudo revisar los datos crudos de ${periodo}`,
      String(error.message || error));
    return;
  }

  bitacora_('revisionPrevia', periodo, 'vigilancia', resultado.problemas.length,
    resultado.problemas.length
      ? resultado.problemas.map((r) => `${r.clave}: ${r.estado}`).join(' · ')
      : 'todo en orden');

  if (!resultado.problemas.length) return;

  avisarPorCorreo_(
    `Faltan datos para el corte ${periodo}`,
    `El corte se procesa el día 12 y estas fuentes todavía no están listas:\n\n` +
    resultado.problemas.map((r) => `  · ${r.clave}: ${r.estado}\n    ${r.detalle}`).join('\n') +
    `\n\nSúbelas a la carpeta de datos crudos antes de mañana, o el corte va a fallar.`
  );
}


/* =================================================================== *
 *  Diagnóstico
 * =================================================================== */

/**
 * Todo el estado en una sola corrida. Es lo primero que hay que correr cuando
 * algo no cuadra, antes de tocar nada.
 */
function diagnostico() {
  const partes = [
    ['Instalación', estado],
    ['Último corte', estadoDelCorte],
    ['Histórico', estadoHistorico],
    ['Datos crudos', revisarDatosCrudos],
    ['Disparadores', estadoDeDisparadores],
  ];

  const lineas = [`DIAGNÓSTICO DEL TABLERO DE ${CONFIG.nombreReporte.toUpperCase()}`,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"), ''];

  partes.forEach(([titulo, funcion]) => {
    lineas.push('='.repeat(64), titulo, '='.repeat(64));
    try {
      lineas.push(String(funcion()));
    } catch (error) {
      // Un diagnóstico que se cae en la primera sección no diagnostica nada.
      lineas.push(`No se pudo revisar: ${error.message || error}`);
    }
    lineas.push('');
  });

  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}

function estadoDeDisparadores() {
  const disparadores = ScriptApp.getProjectTriggers();
  if (!disparadores.length) {
    return 'Ninguno. El corte no va a correr solo; usa automatizar().';
  }
  return disparadores.map((d) => {
    const cuando = d.getEventType() === ScriptApp.EventType.ON_OPEN
      ? 'al abrir la hoja'
      : 'por tiempo';
    return `  ${d.getHandlerFunction()} (${cuando})`;
  }).join('\n');
}


/* =================================================================== *
 *  Automatización
 * =================================================================== */

/**
 * Deja todo corriendo solo: la revisión previa del día 11, el corte del 12 y el
 * menú de la hoja de Catálogos.
 *
 * Es lo último de la instalación y lo único que hay que correr para que el
 * tablero se mantenga sin nadie encima.
 */
function automatizar() {
  exigirPermisoDePublicar_('automatizar');
  const hechos = [];

  cancelarAutomatizacion();

  ScriptApp.newTrigger('revisionPreviaMensual_')
    .timeBased().onMonthDay(11).atHour(7).create();
  hechos.push('Revisión de datos crudos: día 11 a las 7:00 (avisa solo si falta algo).');

  ScriptApp.newTrigger('corteMensual_')
    .timeBased().onMonthDay(12).atHour(6).create();
  hechos.push('Proceso del corte: día 12 a las 6:00.');

  const idCatalogos = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.props.catalogos);
  if (idCatalogos) {
    ScriptApp.newTrigger('alAbrirCatalogos_')
      .forSpreadsheet(idCatalogos).onOpen().create();
    hechos.push(`Menú "${CONFIG.nombreReporte}" en la hoja de Catálogos.`);
  }

  bitacora_('automatizar', '', 'disparadores', hechos.length, hechos.join(' · '));
  const texto = ['Automatización lista:', ''].concat(hechos.map((h) => `  · ${h}`)).join('\n');
  console.log(texto);
  return texto;
}

/** Quita todos los disparadores del proyecto. */
function cancelarAutomatizacion() {
  let quitados = 0;
  ScriptApp.getProjectTriggers().forEach((disparador) => {
    ScriptApp.deleteTrigger(disparador);
    quitados += 1;
  });
  return `${quitados} disparador(es) cancelado(s).`;
}


/* =================================================================== *
 *  Menú de la hoja de Catálogos
 * =================================================================== */

/**
 * Quien edita las reglas del negocio no tiene por qué entrar al editor de código
 * para que sus cambios surtan efecto. Este menú aparece al abrir la hoja de
 * Catálogos.
 */
function alAbrirCatalogos_() {
  SpreadsheetApp.getUi()
    .createMenu(CONFIG.nombreReporte)
    .addItem('Aplicar cambios de los catálogos', 'menuRefrescar_')
    .addSeparator()
    .addItem('Revisar los datos crudos', 'menuRevisarFuentes_')
    .addItem('Ensayar el corte (sin publicar)', 'menuEnsayar_')
    .addSeparator()
    .addItem('Diagnóstico completo', 'menuDiagnostico_')
    .addItem('Listar personas sin fecha (diagnóstico)', 'menuSinFecha_')
    .addToUi();
}

function menuRefrescar_() {
  refrescarCatalogos();
  avisoDeMenu_('Listo', 'Los cambios de los catálogos ya se están usando.');
}

function menuRevisarFuentes_() {
  avisoDeMenu_('Datos crudos', revisarDatosCrudos());
}

/**
 * El ensayo tarda minutos —convierte y lee 300 mil filas— así que se avisa
 * antes en vez de dejar la hoja congelada sin explicación.
 */
function menuEnsayar_() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.alert('Ensayar el corte',
    'Voy a leer los archivos crudos y calcular el corte SIN publicar nada.\n\n' +
    'Tarda varios minutos. ¿Seguimos?', ui.ButtonSet.YES_NO);
  if (respuesta !== ui.Button.YES) return;
  avisoDeMenu_('Ensayo del corte', ensayarCorte());
}

function menuDiagnostico_() {
  avisoDeMenu_('Diagnóstico', diagnostico());
}

/**
 * Vacía la carpeta de Conversiones.
 *
 * Córrela cada vez que reemplaces un archivo de datos crudos conservando el
 * mismo nombre: la ingesta reutiliza la conversión anterior por nombre, así
 * que sin esto el archivo nuevo no se toma en cuenta. Es barato —solo manda
 * las conversiones a la papelera— y la siguiente corrida las rehace.
 */
function limpiarConversiones() {
  const borrados = limpiarTrabajo_(carpetaDeTrabajo_(PropertiesService.getScriptProperties()));
  const texto = `${borrados} conversión(es) borrada(s). La próxima corrida vuelve a ` +
    `convertir los archivos crudos desde cero (es la parte lenta).`;
  console.log(texto);
  bitacora_('limpiarConversiones', '', 'mantenimiento', borrados, texto);
  return texto;
}

/**
 * Igual que el ensayo, tarda minutos porque corre el motor completo. Se avisa
 * antes por la misma razón que menuEnsayar_.
 */
function menuSinFecha_() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.alert('Personas sin fecha',
    'Voy a leer los archivos crudos y calcular el corte SIN publicar nada, solo para listar ' +
    'quiénes quedan sin fecha. Tarda varios minutos. ¿Seguimos?', ui.ButtonSet.YES_NO);
  if (respuesta !== ui.Button.YES) return;
  avisoDeMenu_('Personas sin fecha', personasSinFecha());
}

/** El cuadro de diálogo tiene un tope de texto; se recorta con aviso. */
function avisoDeMenu_(titulo, texto) {
  const contenido = String(texto || '');
  const recortado = contenido.length > 4000
    ? `${contenido.slice(0, 4000)}\n\n[…] El texto completo está en el registro de ejecución.`
    : contenido;
  SpreadsheetApp.getUi().alert(titulo, recortado, SpreadsheetApp.getUi().ButtonSet.OK);
}
