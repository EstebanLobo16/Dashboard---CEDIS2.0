/**
 * Orquestación: el botón "Procesar corte".
 *
 * Un corte son dos tramos con costos muy distintos:
 *
 *   INGESTA   convertir cinco archivos a hojas de cálculo y leer 300 mil filas.
 *             Es lo lento y lo que puede no caber en una ejecución.
 *   CÁLCULO   correr el motor y publicar. Sobre las fuentes de agosto tarda
 *             segundos, porque no materializa la tabla de asignaciones.
 *
 * Si una ejecución se corta por tiempo, no se reanuda sola: hay que volver a
 * lanzarla. Lo que sí evita repetir el trabajo caro es que las conversiones de
 * los archivos quedan en la carpeta de trabajo, así que el segundo intento se
 * salta la parte lenta. El cálculo corre entero o no corre.
 *
 * El estado vive en las propiedades del script. Cada paso deja rastro en la
 * bitácora, así que si algo truena se ve dónde y con qué conteos.
 */

const ESTADO_PROP = 'COB_ESTADO_PROCESO';


/**
 * Procesa y publica el corte. Es lo que llama el botón del tablero.
 *
 * Solo un administrador puede correrlo, y solo uno a la vez.
 */
function procesarCorte(opcionesDeLlamada) {
  const correo = exigirPermisoDePublicar_('procesarCorte');

  const candado = LockService.getScriptLock();
  if (!candado.tryLock(10000)) {
    throw new Error('Ya hay un corte procesándose. Espera a que termine.');
  }

  const inicio = Date.now();
  const peticion = opcionesDeLlamada || {};
  const periodo = String(peticion.periodo || '').trim() || periodoActivo_();
  const opciones = opcionesDelCorte_(periodo, peticion.fechaCorte);
  const diagnostico = { avisos: [], conteos: {} };

  try {
    bitacora_('procesarCorte', periodo, 'inicio', 0, `Lanzado por ${correo}`);
    guardarEstado_({ paso: 'ingesta', periodo, desde: new Date().toISOString() });

    const fuentes = leerFuentes_(periodo, diagnostico);
    diagnostico.conteos.segundosIngesta = Math.round((Date.now() - inicio) / 1000);
    bitacora_('procesarCorte', periodo, 'ingesta',
      fuentes.finalizaciones.length,
      `padrón ${fuentes.padron.length} · finalizaciones ${fuentes.finalizaciones.length} · ` +
      `detalle ${fuentes.detalle.length} · ${diagnostico.conteos.segundosIngesta}s`);

    guardarEstado_({ paso: 'calculo', periodo });
    const calculo = calcularCorte_(fuentes, opciones);
    calculo.diagnostico.avisos = diagnostico.avisos.concat(calculo.diagnostico.avisos);
    Object.assign(calculo.diagnostico.conteos, diagnostico.conteos);

    guardarEstado_({ paso: 'publicacion', periodo });
    const publicacion = publicarCalculo_(calculo, opciones, correo);

    guardarEstado_(null);
    limpiarTrabajo_(carpetaDeTrabajo_(PropertiesService.getScriptProperties()));

    const segundos = Math.round((Date.now() - inicio) / 1000);
    bitacora_('procesarCorte', periodo, 'fin',
      publicacion.filas.Colaborador,
      `${publicacion.filas.Colaborador} colaboradores en ${segundos}s`);

    return Object.assign(publicacion, {
      segundos,
      avisos: calculo.diagnostico.avisos,
      conteos: calculo.diagnostico.conteos,
    });
  } catch (error) {
    guardarEstado_({ paso: 'error', periodo, mensaje: String(error.message || error) });
    bitacora_('procesarCorte', periodo, 'error', 0, String(error.message || error));
    throw error;
  } finally {
    if (candado.hasLock()) candado.releaseLock();
  }
}

/**
 * Escribe el resultado del motor en el corte vigente y el histórico.
 *
 * Pasa por el mismo validador que la importación manual, a propósito: el motor
 * no tiene permiso de publicar algo que un paquete de Colab no podría publicar.
 */
function publicarCalculo_(calculo, opciones, correo) {
  const paquete = {
    formato: CONFIG.paquete.formato,
    version: CONFIG.paquete.version,
    reporte: CONFIG.reporte,
    periodo: opciones.periodo,
    fechaCorte: opciones.fechaCorte,
    generadoEn: new Date().toISOString(),
    origen: 'motor',
    hojas: {},
  };
  PESTANAS_PAQUETE.forEach((nombre) => {
    paquete.hojas[nombre] = {
      columnas: ESQUEMA_CORTE[nombre].slice(),
      filas: calculo.hojas[nombre],
    };
  });

  validarPaquete_(paquete);

  const corte = abrir_('corte');
  const archivado = archivarCorteAnterior_(corte, paquete.periodo);
  const filas = {};
  ORDEN_PUBLICACION.forEach((nombre) => {
    filas[nombre] = escribirTabla_(corte, ESQUEMA_CORTE, nombre, paquete.hojas[nombre].filas);
  });
  SpreadsheetApp.flush();

  acumularHistorico_(paquete);

  const publicadoEn = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperties({
    [CONFIG.props.ultimoPeriodo]: paquete.periodo,
    [CONFIG.props.ultimaPublicacion]: publicadoEn,
    [CONFIG.props.ultimoPublicadoPor]: correo,
  });

  return { ok: true, periodo: paquete.periodo, fechaCorte: paquete.fechaCorte,
    publicadoEn, publicadoPor: correo, filas, archivado };
}


/* ------------------------------------------------------------------ *
 *  Estado y diagnóstico
 * ------------------------------------------------------------------ */

function guardarEstado_(estado) {
  const propiedades = PropertiesService.getScriptProperties();
  if (!estado) { propiedades.deleteProperty(ESTADO_PROP); return; }
  propiedades.setProperty(ESTADO_PROP, JSON.stringify(estado));
}

function estadoDelProceso_() {
  const guardado = PropertiesService.getScriptProperties().getProperty(ESTADO_PROP);
  if (!guardado) return null;
  try { return JSON.parse(guardado); } catch (error) { return null; }
}

/**
 * Corre el motor SIN publicar y devuelve los conteos y avisos.
 *
 * Es lo que hay que usar el primer mes, y cada vez que cambie una fuente: deja
 * ver los números y las validaciones antes de que nadie los vea en el tablero.
 */
function ensayarCorte(periodo) {
  exigirPermisoDePublicar_('ensayarCorte');

  const cual = String(periodo || '').trim() || periodoActivo_();
  const opciones = opcionesDelCorte_(cual);
  const diagnostico = { avisos: [], conteos: {} };

  const fuentes = leerFuentes_(cual, diagnostico);
  const calculo = calcularCorte_(fuentes, opciones);
  const resumen = calculo.hojas.Resumen[0];

  const lineas = [
    `Ensayo del corte ${cual} · fecha ${opciones.fechaCorte}`,
    '',
    `  ${resumen[3]} colaboradores`,
    `  ${resumen[4]} asignados · ${resumen[5]} completados · ${resumen[6]} pendientes`,
    `  ${(resumen[7] * 100).toFixed(1)}% de avance`,
    `  conciliación: ${calculo.hojas.Control[0][10] ? 'correcta' : 'INCORRECTA'}`,
    '',
    'Conteos:',
  ];
  Object.keys(calculo.diagnostico.conteos).forEach((clave) => {
    const valor = calculo.diagnostico.conteos[clave];
    lineas.push(`  ${clave}: ${typeof valor === 'object' ? JSON.stringify(valor) : valor}`);
  });

  const avisos = diagnostico.avisos.concat(calculo.diagnostico.avisos);
  if (avisos.length) {
    lineas.push('', `Avisos (${avisos.length}):`);
    avisos.forEach((aviso) => lineas.push(`  · ${aviso}`));
  }

  const texto = lineas.join('\n');
  console.log(texto);
  bitacora_('ensayarCorte', cual, 'ensayo', resumen[3], `${(resumen[7] * 100).toFixed(1)}% de avance`);
  return texto;
}

/**
 * Diagnóstico: quiénes quedaron fuera del padrón por no tener fecha de
 * referencia en ninguna de las tres fuentes. No publica nada — corre el
 * motor igual que ensayarCorte() y escribe la lista en una pestaña temporal
 * de Catálogos para revisarla a mano, en vez de dejar solo el conteo.
 *
 * La pestaña se sobrescribe cada vez que esto corre: no es parte del
 * contrato de datos (§01-contrato-de-datos.md), es una foto de un momento
 * para diagnosticar. Con nombre, puesto y "por dónde se intentó cruzar" de
 * cada quien, se puede confirmar en minutos si el motivo es un número que no
 * coincide entre la Planta y el Detalle, un nombre no único, o gente
 * realmente sin cursos ni fecha capturada todavía.
 */
function personasSinFecha(periodo) {
  exigirPermisoDePublicar_('personasSinFecha');

  const cual = String(periodo || '').trim() || periodoActivo_();
  const opciones = opcionesDelCorte_(cual);
  const diagnostico = { avisos: [], conteos: {} };

  const fuentes = leerFuentes_(cual, diagnostico);
  const calculo = calcularCorte_(fuentes, opciones);
  const personas = calculo.diagnostico.personasSinFecha || [];

  const columnas = ['numero_colaborador', 'numero_persona', 'nombre', 'puesto',
    'departamento', 'centro', 'region', 'origen_fecha', 'origen_fecha_puesto'];
  const filas = personas.map((p) => [
    p.colaborador, p.persona, p.nombre, p.puesto,
    p.departamento, p.centro, p.region, p.origenFecha, p.origenFechaPuesto,
  ]);

  const nombrePestana = 'Diagnóstico · Sin fecha';
  const catalogos = abrir_('catalogos');
  let destino = catalogos.getSheetByName(nombrePestana);
  if (!destino) destino = catalogos.insertSheet(nombrePestana);

  // Una pestaña nueva nace con 1000 filas: escribir 1,139 personas sin
  // agrandarla revienta con "las coordenadas del rango no son válidas".
  const necesarias = filas.length + 1;
  if (destino.getMaxRows() < necesarias) {
    destino.insertRowsAfter(destino.getMaxRows(), necesarias - destino.getMaxRows());
  }
  if (destino.getMaxColumns() < columnas.length) {
    destino.insertColumnsAfter(destino.getMaxColumns(), columnas.length - destino.getMaxColumns());
  }

  destino.clearContents();
  destino.getRange(1, 1, 1, columnas.length).setValues([columnas]);
  destino.setFrozenRows(1);
  if (filas.length) {
    destino.getRange(2, 1, filas.length, columnas.length).setValues(filas);
  }
  SpreadsheetApp.flush();

  const texto = `${filas.length} persona(s) sin fecha en el corte ${cual}, listadas en la pestaña ` +
    `"${nombrePestana}" de ${CONFIG.archivos.catalogos}. Esa pestaña se sobrescribe en cada ` +
    `corrida de este diagnóstico; no es parte del contrato de datos.`;
  console.log(texto);
  bitacora_('personasSinFecha', cual, 'diagnóstico', filas.length, texto);
  return texto;
}

/** Qué pasó con el último corte. Sirve cuando algo se quedó a medias. */
function estadoDelCorte() {
  const propiedades = PropertiesService.getScriptProperties();
  const estado = estadoDelProceso_();
  const lineas = [
    `Último periodo publicado: ${propiedades.getProperty(CONFIG.props.ultimoPeriodo) || '—'}`,
    `Publicado el:             ${propiedades.getProperty(CONFIG.props.ultimaPublicacion) || '—'}`,
    `Publicado por:            ${propiedades.getProperty(CONFIG.props.ultimoPublicadoPor) || '—'}`,
    `Proceso en curso:         ${estado ? JSON.stringify(estado) : 'ninguno'}`,
  ];
  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}


/* ------------------------------------------------------------------ *
 *  Corte automático
 * ------------------------------------------------------------------ */

/**
 * Lo que corre el disparador del día 12. Ver automatizar() en 60_Operacion.gs.
 *
 * Un disparador no tiene a quién preguntarle nada, así que manda correo siempre:
 * cuando truena, con el error; y cuando publica, con las cifras y los avisos.
 * Un corte que se publica en silencio no se revisa, y el mes que salga mal nadie
 * se va a enterar hasta que alguien mire el tablero.
 */
function corteMensual_() {
  const periodo = periodoActivo_();
  try {
    const resultado = procesarCorte({ periodo });
    avisarPorCorreo_(
      `Corte ${periodo} publicado` +
        (resultado.avisos.length ? ` con ${resultado.avisos.length} aviso(s)` : ''),
      resumenParaCorreo_(periodo, resultado)
    );
  } catch (error) {
    avisarPorCorreo_(`El corte ${periodo} NO se pudo procesar`,
      `${error.message || error}\n\n` +
      `El tablero sigue mostrando el corte anterior. Corre diagnostico() desde el editor de ` +
      `Apps Script para ver qué falta, y procesarCorte() cuando esté resuelto.`);
    throw error;
  }
}

function resumenParaCorreo_(periodo, resultado) {
  const corte = leerTabla_(abrir_('corte'), 'Resumen').pop() || {};
  const lineas = [
    `Corte ${etiquetaPeriodo_(periodo)} · fecha de corte ${resultado.fechaCorte}`,
    `Procesado en ${resultado.segundos} segundos.`,
    '',
    `  ${numero_(corte.colaboradores).toLocaleString('es-MX')} colaboradores`,
    `  ${numero_(corte.cursos_asignados).toLocaleString('es-MX')} cursos asignados`,
    `  ${numero_(corte.cursos_completados).toLocaleString('es-MX')} completados`,
    `  ${numero_(corte.cursos_pendientes).toLocaleString('es-MX')} pendientes`,
    `  ${(numero_(corte.avance) * 100).toFixed(1)}% de avance`,
  ];

  const comparativa = comparativaDePeriodo_(periodo);
  if (comparativa) {
    const puntos = comparativa.avance * 100;
    lineas.push('', `Contra ${comparativa.etiquetaAnterior}: ` +
      `${puntos >= 0 ? '+' : '−'}${Math.abs(puntos).toFixed(1)} puntos de avance.`);
  }

  if (resultado.avisos.length) {
    lineas.push('', `Avisos (${resultado.avisos.length}):`);
    resultado.avisos.forEach((aviso) => lineas.push(`  · ${aviso}`));
  }
  return lineas.join('\n');
}

function avisarPorCorreo_(asunto, cuerpo) {
  try {
    const destinatarios = administradores_();
    if (!destinatarios.length) return;
    MailApp.sendEmail(destinatarios.join(','), `[Tablero ${CONFIG.nombreReporte}] ${asunto}`,
      `${cuerpo}\n\n—\nTablero de ${CONFIG.nombreReporte} · Universidad Corporativa`);
  } catch (error) {
    console.log(`No se pudo avisar por correo: ${error.message}`);
  }
}
