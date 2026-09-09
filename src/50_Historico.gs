/**
 * El histórico: navegar meses cerrados, compararlos y recuperar su detalle.
 *
 * La acumulación por corte y el archivado del detalle ya ocurren al publicar
 * (07_Paquete.gs). Aquí está lo que hace que ese histórico sirva de algo:
 *
 *   · leer los agregados de un mes anterior sin tocar el corte vigente,
 *   · comparar un mes contra el anterior, que es la pregunta que de verdad se
 *     hace quien abre el tablero ("¿subimos o bajamos?"),
 *   · cargar hacia atrás cortes viejos sin pisar el mes publicado,
 *   · recuperar el detalle por colaborador que se archivó en Drive.
 *
 * Reparto de costos, que es lo que decide el diseño: Resumen son 12 filas al año
 * y Region 192, así que la gráfica y las comparativas se leen siempre. Centro y
 * FiltroCurso son ~44 mil filas al año y solo se leen cuando alguien navega a un
 * mes concreto. El detalle por colaborador no vive aquí: son 11 mil filas por
 * mes y está archivado como .json en Drive.
 */

/** Los periodos publicados, del más viejo al más nuevo. */
function periodosDelHistorico_() {
  const vistos = {};
  leerTabla_(abrir_('historico'), 'Resumen').forEach((fila) => {
    if (normalizar_(fila.reporte) !== CONFIG.reporte) return;
    const periodo = String(fila.periodo || '').trim();
    if (/^\d{4}-\d{2}$/.test(periodo)) vistos[periodo] = true;
  });
  return Object.keys(vistos).sort();
}

/** El periodo inmediatamente anterior a uno dado, o '' si es el primero. */
function periodoAnterior_(periodo) {
  const periodos = periodosDelHistorico_();
  const i = periodos.indexOf(String(periodo));
  return i > 0 ? periodos[i - 1] : '';
}

/**
 * Los agregados de un periodo del histórico, con la forma que espera el tablero.
 *
 * `pestanas` acota qué se lee: pedir solo Resumen y Region cuesta 200 filas, y
 * pedirlo todo cuesta 44 mil. La diferencia se nota.
 */
function agregadosDePeriodo_(periodo, pestanas) {
  const historico = abrir_('historico');
  const cuales = pestanas || ['Resumen', 'Region', 'Centro', 'Curso', 'FiltroCurso', 'Control'];
  const salida = {};

  cuales.forEach((nombre) => {
    salida[nombre] = leerTabla_(historico, nombre).filter((fila) =>
      normalizar_(fila.reporte) === CONFIG.reporte &&
      String(fila.periodo || '').trim() === String(periodo));
  });
  return salida;
}


/* =================================================================== *
 *  Comparativa contra el mes anterior
 * =================================================================== */

/**
 * Cuánto se movió cada cosa respecto del mes anterior.
 *
 * Los deltas de avance van en puntos porcentuales, no en porcentaje del
 * porcentaje: pasar de 80% a 84% es "+4 pp", no "+5%". La confusión entre las
 * dos formas es la manera más fácil de que un tablero diga algo que no es.
 *
 * Devuelve null cuando no hay mes anterior con qué comparar, para que la
 * interfaz simplemente no muestre nada en vez de enseñar un cero engañoso.
 */
function comparativaDePeriodo_(periodo) {
  const anterior = periodoAnterior_(periodo);
  if (!anterior) return null;

  const historico = abrir_('historico');
  const resumenes = leerTabla_(historico, 'Resumen')
    .filter((fila) => normalizar_(fila.reporte) === CONFIG.reporte);
  const deEste = resumenes.filter((f) => String(f.periodo) === String(periodo)).pop();
  const deAntes = resumenes.filter((f) => String(f.periodo) === anterior).pop();
  if (!deEste || !deAntes) return null;

  const regiones = {};
  leerTabla_(historico, 'Region')
    .filter((fila) => normalizar_(fila.reporte) === CONFIG.reporte &&
      (String(fila.periodo) === String(periodo) || String(fila.periodo) === anterior))
    .forEach((fila) => {
      const nombre = String(fila.region || '');
      if (!regiones[nombre]) regiones[nombre] = {};
      regiones[nombre][String(fila.periodo) === anterior ? 'antes' : 'ahora'] = numero_(fila.avance);
    });

  const porRegion = {};
  Object.keys(regiones).forEach((nombre) => {
    const par = regiones[nombre];
    // Una región que no existía el mes pasado no "subió": no hay con qué comparar.
    if (par.antes === undefined || par.ahora === undefined) return;
    porRegion[nombre] = par.ahora - par.antes;
  });

  return {
    periodoAnterior: anterior,
    etiquetaAnterior: etiquetaPeriodo_(anterior),
    avance: numero_(deEste.avance) - numero_(deAntes.avance),
    asignados: numero_(deEste.cursos_asignados) - numero_(deAntes.cursos_asignados),
    completados: numero_(deEste.cursos_completados) - numero_(deAntes.cursos_completados),
    pendientes: numero_(deEste.cursos_pendientes) - numero_(deAntes.cursos_pendientes),
    colaboradores: numero_(deEste.colaboradores) - numero_(deAntes.colaboradores),
    regiones: porRegion,
  };
}


/* =================================================================== *
 *  Detalle archivado
 * =================================================================== */

/** El archivo .json con el detalle por colaborador de un mes cerrado. */
function archivoDeDetalle_(periodo) {
  const id = PropertiesService.getScriptProperties().getProperty(CONFIG.props.carpetaArchivo);
  if (!id) return null;

  const nombre = `cobranza-colaborador-${periodo}.json`;
  let carpeta;
  try {
    carpeta = DriveApp.getFolderById(id);
  } catch (error) {
    return null;
  }

  const archivos = carpeta.getFilesByName(nombre);
  if (!archivos.hasNext()) return null;
  const archivo = archivos.next();
  return {
    periodo,
    nombre,
    url: archivo.getUrl(),
    megas: Math.round((archivo.getSize() / 1048576) * 10) / 10,
    archivadoEn: aTextoFecha_(archivo.getLastUpdated()),
  };
}

/**
 * Vuelve a poner en el corte vigente el detalle de un mes archivado.
 *
 * Es una operación de excepción —una auditoría, reconstruir un mes— y no algo
 * de la operación diaria: sustituye lo que está publicado. Por eso archiva
 * primero lo que va a pisar, así que siempre se puede volver.
 */
function restaurarCorteArchivado(periodo) {
  const correo = exigirPermisoDePublicar_('restaurarCorteArchivado');
  const cual = String(periodo || '').trim();
  if (!/^\d{4}-\d{2}$/.test(cual)) {
    throw new Error('Pásame el periodo en formato AAAA-MM: restaurarCorteArchivado("2026-07").');
  }

  const referencia = archivoDeDetalle_(cual);
  if (!referencia) {
    throw new Error(
      `No hay detalle archivado de ${cual}. Los meses con archivo son: ` +
      `${periodosArchivados_().join(', ') || 'ninguno'}.`
    );
  }

  const contenido = JSON.parse(
    DriveApp.getFilesByName(referencia.nombre).next().getBlob().getDataAsString()
  );
  const columnas = ESQUEMA_CORTE.Colaborador;
  const tabla = contenido.hojas && contenido.hojas.Colaborador;
  if (!tabla || !Array.isArray(tabla.filas)) {
    throw new Error(`El archivo ${referencia.nombre} no trae la tabla de Colaborador.`);
  }
  if (JSON.stringify(tabla.columnas) !== JSON.stringify(columnas)) {
    throw new Error(
      `El archivo de ${cual} se guardó con otro esquema de columnas y no se puede restaurar ` +
      `directamente. Consúltalo en Drive: ${referencia.url}`
    );
  }

  const corte = abrir_('corte');
  const archivado = archivarCorteAnterior_(corte, cual);

  const agregados = agregadosDePeriodo_(cual);
  ORDEN_PUBLICACION.forEach((nombre) => {
    const filas = nombre === 'Colaborador' ? tabla.filas : (agregados[nombre] || [])
      .map((fila) => ESQUEMA_CORTE[nombre].map((c) => (fila[c] === undefined ? '' : fila[c])));
    escribirTabla_(corte, ESQUEMA_CORTE, nombre, filas);
  });
  SpreadsheetApp.flush();

  PropertiesService.getScriptProperties().setProperty(CONFIG.props.ultimoPeriodo, cual);
  bitacora_('restaurarCorte', cual, 'restauración', tabla.filas.length,
    `Restaurado por ${correo}${archivado ? `; se archivó ${archivado}` : ''}`);

  return `Corte ${cual} restaurado: ${tabla.filas.length} colaboradores.` +
    (archivado ? ` El corte anterior quedó archivado como ${archivado}.` : '');
}

function periodosArchivados_() {
  const id = PropertiesService.getScriptProperties().getProperty(CONFIG.props.carpetaArchivo);
  if (!id) return [];
  const periodos = [];
  const archivos = DriveApp.getFolderById(id).getFiles();
  while (archivos.hasNext()) {
    const m = archivos.next().getName().match(/cobranza-colaborador-(\d{4}-\d{2})\.json/);
    if (m) periodos.push(m[1]);
  }
  return periodos.sort();
}


/* =================================================================== *
 *  Carga hacia atrás
 * =================================================================== */

/**
 * Mete al histórico un corte de un mes anterior sin tocar el corte vigente.
 *
 * Sirve para llenar el año hacia atrás con los meses que ya se procesaron antes
 * de que existiera el tablero. El detalle por colaborador se archiva en Drive,
 * igual que si se hubiera publicado en su momento.
 *
 * Se niega a cargar un periodo posterior al publicado: eso no es cargar
 * histórico, es publicar, y para eso está publicarPaquete().
 */
function cargarHistorico(contenido) {
  const correo = exigirPermisoDePublicar_('cargarHistorico');

  let paquete;
  try {
    paquete = JSON.parse(String(contenido || ''));
  } catch (error) {
    throw new Error('El archivo que seleccionaste no es un paquete válido de Cobranza.');
  }
  validarPaquete_(paquete);

  const vigente = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.props.ultimoPeriodo) || '';
  if (vigente && String(paquete.periodo) >= vigente) {
    throw new Error(
      `El paquete es de ${paquete.periodo} y el corte publicado es de ${vigente}. Para publicar ` +
      `un corte igual o más reciente usa el botón "Actualizar datos"; esta función solo carga ` +
      `meses anteriores al publicado.`
    );
  }

  const candado = LockService.getScriptLock();
  if (!candado.tryLock(30000)) throw new Error('Hay otra publicación en curso.');

  try {
    const acumuladas = acumularHistorico_(paquete);
    const archivado = guardarDetalleArchivado_(paquete);
    bitacora_('cargarHistorico', paquete.periodo, 'carga',
      paquete.hojas.Colaborador.filas.length, `Cargado por ${correo}; ${archivado}`);
    return {
      ok: true,
      periodo: paquete.periodo,
      filas: acumuladas,
      archivado,
      periodos: periodosDelHistorico_(),
    };
  } finally {
    if (candado.hasLock()) candado.releaseLock();
  }
}

/** Guarda el detalle de un paquete como archivo del mes, sin pasar por el corte. */
function guardarDetalleArchivado_(paquete) {
  const columnas = ESQUEMA_CORTE.Colaborador;
  const contenido = {
    formato: CONFIG.paquete.formato,
    version: CONFIG.paquete.version,
    reporte: CONFIG.reporte,
    periodo: paquete.periodo,
    fechaCorte: paquete.fechaCorte,
    archivadoEn: new Date().toISOString(),
    hojas: { Colaborador: { columnas: columnas.slice(), filas: paquete.hojas.Colaborador.filas } },
  };

  const nombre = `cobranza-colaborador-${paquete.periodo}.json`;
  const carpeta = DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty(CONFIG.props.carpetaArchivo)
  );
  const previos = carpeta.getFilesByName(nombre);
  while (previos.hasNext()) previos.next().setTrashed(true);

  carpeta.createFile(nombre, JSON.stringify(contenido), MimeType.PLAIN_TEXT);
  return nombre;
}


/* =================================================================== *
 *  Mantenimiento
 * =================================================================== */

/**
 * Cuánto pesa el histórico y cuánto le falta para el tope.
 *
 * Una hoja de cálculo aguanta 10 millones de celdas. Con el reparto del contrato
 * el histórico crece unas 44 mil filas al año, así que el tope está a más de una
 * década; pero conviene medirlo en vez de suponerlo, porque el día que alguien
 * decida guardar también el detalle por colaborador la cuenta cambia sola.
 */
function estadoHistorico() {
  const historico = abrir_('historico');
  const periodos = periodosDelHistorico_();
  const lineas = [
    'Histórico del tablero de Cobranza',
    '',
    `Periodos publicados: ${periodos.length}` + (periodos.length ? ` (${periodos[0]} a ${periodos[periodos.length - 1]})` : ''),
  ];

  let celdas = 0;
  let filas = 0;
  Object.keys(ESQUEMA_HISTORICO).forEach((nombre) => {
    const pestana = historico.getSheetByName(nombre);
    if (!pestana) { lineas.push(`  ${nombre}: no existe`); return; }
    const altas = Math.max(0, pestana.getLastRow() - 1);
    const anchas = ESQUEMA_HISTORICO[nombre].length;
    filas += altas;
    celdas += (altas + 1) * anchas;
    lineas.push(`  ${nombre.padEnd(14)} ${String(altas).padStart(8)} filas`);
  });

  const porPeriodo = periodos.length ? Math.round(celdas / periodos.length) : 0;
  const cabenMas = porPeriodo ? Math.floor((10000000 - celdas) / porPeriodo) : '—';
  lineas.push('',
    `Total: ${filas.toLocaleString('es-MX')} filas · ${celdas.toLocaleString('es-MX')} celdas`,
    `Por periodo: ${porPeriodo.toLocaleString('es-MX')} celdas`,
    `Caben ${cabenMas} periodos más antes del tope de 10,000,000 celdas.`);

  const archivados = periodosArchivados_();
  lineas.push('',
    `Detalle archivado en Drive: ${archivados.length} mes(es)` +
    (archivados.length ? ` (${archivados.join(', ')})` : ''));

  const sinArchivo = periodos.filter((p) => archivados.indexOf(p) === -1);
  if (sinArchivo.length) {
    lineas.push(
      `  ⚠ Sin detalle archivado: ${sinArchivo.join(', ')}. Son meses cuyos agregados están en el ` +
      `histórico pero cuyo detalle por colaborador ya no se puede recuperar.`);
  }

  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}
