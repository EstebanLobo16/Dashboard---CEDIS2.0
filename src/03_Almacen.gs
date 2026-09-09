/**
 * El almacén: tres hojas de cálculo y dos carpetas de Drive.
 *
 * instalar() lo crea todo y se puede volver a correr sin miedo: si algo ya
 * existe lo reutiliza, si a una pestaña le falta una columna avisa en vez de
 * pisarla, y las semillas solo entran a una pestaña que esté vacía.
 */

/* ------------------------------------------------------------------ *
 *  Instalación
 * ------------------------------------------------------------------ */

/**
 * Corre esto UNA vez desde el editor de Apps Script, con la cuenta que va a
 * ser dueña del tablero. Crea las tres hojas, las dos carpetas y siembra los
 * catálogos, y te deja a ti como primer administrador.
 *
 * Es seguro volver a correrlo: no borra nada de lo que ya haya.
 */
function instalar() {
  const props = PropertiesService.getScriptProperties();
  const reporte = [];

  const base = carpeta_(props, CONFIG.props.carpetaBase, CONFIG.carpetas.base, null);
  const crudos = carpeta_(props, CONFIG.props.carpetaCrudos, CONFIG.carpetas.crudos, base);
  const archivo = carpeta_(props, CONFIG.props.carpetaArchivo, CONFIG.carpetas.archivo, base);
  reporte.push(`Carpeta base: ${base.getName()} (${base.getId()})`);
  reporte.push(`  Datos crudos: ${crudos.getUrl()}`);
  reporte.push(`  Cortes archivados: ${archivo.getUrl()}`);

  ['catalogos', 'corte', 'historico'].forEach((clave) => {
    const hoja = hojaDeCalculo_(props, clave, base);
    const cambios = alinearPestanas_(hoja, esquemaDe_(clave));
    reporte.push(`${hoja.getName()}: ${hoja.getUrl()}`);
    cambios.forEach((c) => reporte.push(`  ${c}`));
  });

  reporte.push(...sembrarCatalogos_());
  reporte.push(...registrarPrimerAdministrador_());

  const texto = reporte.join('\n');
  console.log(texto);
  bitacora_('instalar', '', 'almacén', reporte.length, 'Instalación completada');
  return texto;
}

/**
 * Diagnóstico. Dice qué está configurado y qué falta, sin cambiar nada.
 * Úsalo cuando algo no jale antes de volver a correr instalar().
 */
function estado() {
  const props = PropertiesService.getScriptProperties();
  const lineas = [`Estado del tablero de ${CONFIG.nombreReporte}`, ''];

  Object.keys(CONFIG.props).forEach((clave) => {
    const valor = props.getProperty(CONFIG.props[clave]);
    lineas.push(`${clave.padEnd(20)} ${valor || '— sin configurar —'}`);
  });

  lineas.push('');
  try {
    const admins = administradores_();
    lineas.push(`Administradores (${admins.length}): ${admins.join(', ') || 'ninguno'}`);
  } catch (error) {
    lineas.push(`Administradores: no se pudieron leer — ${error.message}`);
  }
  lineas.push(`Tú eres: ${correoActual_() || '(sin identificar)'}`);
  lineas.push(`¿Puedes publicar?: ${puedePublicar_() ? 'sí' : 'no'}`);

  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}


/* ------------------------------------------------------------------ *
 *  Acceso a los archivos
 * ------------------------------------------------------------------ */

/** Abre una de las tres hojas del almacén por su clave. */
function abrir_(clave) {
  const id = PropertiesService.getScriptProperties().getProperty(CONFIG.props[clave]);
  if (!id) {
    throw new Error(
      `Falta configurar '${CONFIG.archivos[clave]}'. Corre la función instalar() una vez ` +
      `desde el editor de Apps Script.`
    );
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (error) {
    throw new Error(
      `No se pudo abrir '${CONFIG.archivos[clave]}' (${id}). ¿Se borró o cambió de dueño? ` +
      `Corre estado() para ver la configuración actual.`
    );
  }
}

/** Devuelve una pestaña, creándola con su encabezado si no existía. */
function pestana_(hoja, esquema, nombre) {
  const columnas = esquema[nombre];
  if (!columnas) throw new Error(`La pestaña '${nombre}' no está en el esquema.`);
  let destino = hoja.getSheetByName(nombre);
  if (!destino) {
    destino = hoja.insertSheet(nombre);
    destino.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    destino.setFrozenRows(1);
  }
  return destino;
}

/**
 * Lee una pestaña completa como arreglo de objetos, con las llaves del
 * encabezado real del archivo (no del esquema: si alguien agregó una columna a
 * mano, la vas a ver).
 */
function leerTabla_(hoja, nombre) {
  const destino = hoja.getSheetByName(nombre);
  if (!destino || destino.getLastRow() < 2) return [];
  const valores = destino.getDataRange().getValues();
  const encabezados = valores[0].map((v) => String(v).trim());
  return valores.slice(1)
    .filter((fila) => fila.some((v) => v !== '' && v !== null))
    .map((fila) => encabezados.reduce((obj, llave, i) => {
      if (llave) obj[llave] = serializable_(fila[i]);
      return obj;
    }, {}));
}

/**
 * Reemplaza el contenido de una pestaña (conservando el encabezado del
 * esquema). `filas` son arreglos posicionales en el orden del esquema.
 */
function escribirTabla_(hoja, esquema, nombre, filas) {
  const columnas = esquema[nombre];
  const destino = pestana_(hoja, esquema, nombre);
  const contenido = [columnas].concat(filas);

  filas.forEach((fila, i) => {
    if (fila.length !== columnas.length) {
      throw new Error(
        `La fila ${i + 1} de '${nombre}' trae ${fila.length} columnas y el esquema pide ` +
        `${columnas.length}.`
      );
    }
  });

  if (destino.getMaxRows() < contenido.length) {
    destino.insertRowsAfter(destino.getMaxRows(), contenido.length - destino.getMaxRows());
  }
  if (destino.getMaxColumns() < columnas.length) {
    destino.insertColumnsAfter(destino.getMaxColumns(), columnas.length - destino.getMaxColumns());
  }
  destino.clearContents();
  destino.getRange(1, 1, contenido.length, columnas.length).setValues(contenido);
  destino.setFrozenRows(1);
  return filas.length;
}


/* ------------------------------------------------------------------ *
 *  Interno
 * ------------------------------------------------------------------ */

function carpeta_(props, propiedad, nombre, padre) {
  const id = props.getProperty(propiedad);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (error) {
      console.log(`La carpeta guardada en ${propiedad} ya no existe; se crea una nueva.`);
    }
  }
  const raiz = padre || DriveApp.getRootFolder();
  const existentes = raiz.getFoldersByName(nombre);
  const carpeta = existentes.hasNext() ? existentes.next() : raiz.createFolder(nombre);
  props.setProperty(propiedad, carpeta.getId());
  return carpeta;
}

function hojaDeCalculo_(props, clave, carpetaBase) {
  const propiedad = CONFIG.props[clave];
  const id = props.getProperty(propiedad);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (error) {
      console.log(`La hoja guardada en ${propiedad} ya no existe; se crea una nueva.`);
    }
  }
  const hoja = SpreadsheetApp.create(CONFIG.archivos[clave]);
  DriveApp.getFileById(hoja.getId()).moveTo(carpetaBase);
  props.setProperty(propiedad, hoja.getId());
  return hoja;
}

/**
 * Crea las pestañas que falten y revisa las que ya estaban. Nunca reescribe un
 * encabezado existente: si no coincide con el esquema lo reporta, porque pisar
 * el encabezado de una pestaña con datos deja las columnas cruzadas en silencio.
 */
function alinearPestanas_(hoja, esquema) {
  const cambios = [];
  Object.keys(esquema).forEach((nombre) => {
    const columnas = esquema[nombre];
    let destino = hoja.getSheetByName(nombre);
    if (!destino) {
      destino = hoja.insertSheet(nombre);
      destino.getRange(1, 1, 1, columnas.length).setValues([columnas]);
      destino.setFrozenRows(1);
      cambios.push(`+ pestaña '${nombre}' creada`);
      return;
    }
    if (!destino.getLastRow()) {
      destino.getRange(1, 1, 1, columnas.length).setValues([columnas]);
      destino.setFrozenRows(1);
      cambios.push(`+ encabezado de '${nombre}' escrito`);
      return;
    }
    const actuales = destino.getRange(1, 1, 1, destino.getLastColumn()).getValues()[0]
      .map((v) => String(v).trim()).filter(Boolean);
    const faltantes = columnas.filter((c) => actuales.indexOf(c) === -1);
    if (faltantes.length) {
      cambios.push(`! '${nombre}' no tiene: ${faltantes.join(', ')} — revísala a mano`);
    }
  });

  const vacia = hoja.getSheetByName('Hoja 1') || hoja.getSheetByName('Sheet1');
  if (vacia && hoja.getSheets().length > 1 && !vacia.getLastRow()) hoja.deleteSheet(vacia);

  return cambios;
}

/** Escribe las semillas solo en las pestañas de catálogo que estén vacías. */
function sembrarCatalogos_() {
  const hoja = abrir_('catalogos');
  const reporte = [];
  Object.keys(SEMILLAS).forEach((nombre) => {
    const filas = SEMILLAS[nombre];
    if (!filas.length) return;
    const destino = pestana_(hoja, ESQUEMA_CATALOGOS, nombre);
    if (destino.getLastRow() > 1) {
      reporte.push(`  ${nombre}: ya tenía ${destino.getLastRow() - 1} renglones, no se toca`);
      return;
    }
    escribirTabla_(hoja, ESQUEMA_CATALOGOS, nombre, filas.map((f) => f.slice()));
    reporte.push(`  ${nombre}: ${filas.length} renglones sembrados`);
  });
  SpreadsheetApp.flush();
  return reporte;
}

/** Quien corre la instalación queda como primer administrador. */
function registrarPrimerAdministrador_() {
  const hoja = abrir_('catalogos');
  const destino = pestana_(hoja, ESQUEMA_CATALOGOS, 'Administradores');
  if (destino.getLastRow() > 1) {
    return [`  Administradores: ya había ${destino.getLastRow() - 1}, no se toca`];
  }
  const correo = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!correo) {
    return ['  ! No se pudo identificar tu correo. Agrega el primer administrador a mano.'];
  }
  escribirTabla_(hoja, ESQUEMA_CATALOGOS, 'Administradores', [
    [correo, '', 'SI', 'Alta automática: corrió la instalación.'],
  ]);
  SpreadsheetApp.flush();
  invalidarCacheCatalogos_();
  return [`  Administradores: ${correo} dado de alta`];
}

function serializable_(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return valor;
}
