/**
 * Publicación de un corte a partir de un paquete .json.
 *
 * Es el "camino alterno" del contrato: el cuaderno de Colab (o, a partir de la
 * etapa 2, el motor) arma un paquete con las siete pestañas del corte y esta
 * función lo valida y lo publica. El botón "Actualizar datos" del tablero llama
 * a publicarPaquete(); el archivo llega como texto desde el navegador.
 *
 * Los archivos CRUDOS nunca pasan por aquí: pesan 123 MB y no caben en una
 * llamada del navegador. Esos se leen de la carpeta de Drive (etapa 2).
 *
 * Qué hace, en orden:
 *   1. Verifica que quien llama pueda publicar.
 *   2. Toma el candado, para que dos publicaciones no se pisen.
 *   3. Valida el paquete contra el esquema, sin escribir nada todavía.
 *   4. Archiva el detalle del corte que estaba publicado, si era otro periodo.
 *   5. Reemplaza el corte vigente y acumula los agregados en el histórico.
 */

function publicarPaquete(contenido) {
  const correo = exigirPermisoDePublicar_('publicarPaquete');

  const candado = LockService.getScriptLock();
  if (!candado.tryLock(30000)) {
    throw new Error('Hay otra publicación en curso. Espera unos segundos e inténtalo de nuevo.');
  }

  try {
    let paquete;
    try {
      paquete = JSON.parse(String(contenido || ''));
    } catch (error) {
      throw new Error(
        `El archivo que seleccionaste no es un paquete válido de ${CONFIG.nombreReporte}.`);
    }

    validarPaquete_(paquete);

    const corte = abrir_('corte');
    const archivado = archivarCorteAnterior_(corte, paquete.periodo);

    const filasPorPestana = {};
    ORDEN_PUBLICACION.forEach((nombre) => {
      const tabla = paquete.hojas[nombre];
      filasPorPestana[nombre] = escribirTabla_(corte, ESQUEMA_CORTE, nombre, tabla.filas);
    });
    SpreadsheetApp.flush();

    acumularHistorico_(paquete);

    const publicadoEn = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperties({
      [CONFIG.props.ultimoPeriodo]: paquete.periodo,
      [CONFIG.props.ultimaPublicacion]: publicadoEn,
      [CONFIG.props.ultimoPublicadoPor]: correo,
    });

    const totales = paquete.hojas.Resumen.filas[paquete.hojas.Resumen.filas.length - 1];
    bitacora_('publicarPaquete', paquete.periodo, 'publicación',
      filasPorPestana.Colaborador,
      `${entero_(totales[3])} colaboradores, ${entero_(totales[4])} asignados` +
      (archivado ? ` · se archivó ${archivado}` : ''));

    return {
      ok: true,
      periodo: paquete.periodo,
      fechaCorte: paquete.fechaCorte,
      publicadoEn,
      publicadoPor: correo,
      filas: filasPorPestana,
      archivado,
    };
  } finally {
    if (candado.hasLock()) candado.releaseLock();
  }
}


/* ------------------------------------------------------------------ *
 *  Validación
 * ------------------------------------------------------------------ */

/**
 * Rechaza el paquete antes de tocar el almacén. Cada error dice qué está mal y
 * qué hacer, porque quien lo va a leer es el analista que subió el archivo, no
 * quien escribió esto.
 */
function validarPaquete_(paquete) {
  if (!paquete || typeof paquete !== 'object') {
    throw new Error('El paquete viene vacío o no es un objeto JSON.');
  }
  if (paquete.formato !== CONFIG.paquete.formato) {
    throw new Error(
      `Este archivo dice ser '${paquete.formato || 'sin formato'}' y el tablero espera ` +
      `'${CONFIG.paquete.formato}'. ¿Lo generaste con la celda de exportación actualizada?`
    );
  }
  if (Number(paquete.version) !== CONFIG.paquete.version) {
    throw new Error(
      `El paquete es de la versión ${paquete.version} y este tablero lee la ` +
      `versión ${CONFIG.paquete.version}.`
    );
  }
  if (textoClave_(paquete.reporte) !== textoClave_(CONFIG.reporte)) {
    throw new Error(
      `Este tablero solo acepta paquetes de ${CONFIG.nombreReporte}, y el archivo trae ` +
      `'${paquete.reporte}'.`
    );
  }
  if (!/^\d{4}-\d{2}$/.test(String(paquete.periodo || ''))) {
    throw new Error(`El periodo '${paquete.periodo}' no tiene el formato AAAA-MM.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(paquete.fechaCorte || ''))) {
    throw new Error(`La fecha de corte '${paquete.fechaCorte}' no tiene el formato AAAA-MM-DD.`);
  }
  if (String(paquete.fechaCorte).slice(0, 7) !== String(paquete.periodo)) {
    throw new Error(
      `La fecha de corte (${paquete.fechaCorte}) no cae dentro del periodo (${paquete.periodo}).`
    );
  }
  if (!paquete.hojas || typeof paquete.hojas !== 'object') {
    throw new Error('Al paquete le falta el bloque "hojas" con el contenido de las pestañas.');
  }

  let celdas = 0;
  PESTANAS_PAQUETE.forEach((nombre) => {
    const tabla = paquete.hojas[nombre];
    const columnas = ESQUEMA_CORTE[nombre];

    if (!tabla || !Array.isArray(tabla.columnas) || !Array.isArray(tabla.filas)) {
      throw new Error(`Falta la pestaña '${nombre}' o no trae columnas y filas.`);
    }
    if (tabla.columnas.length !== columnas.length ||
        tabla.columnas.some((c, i) => String(c).trim() !== columnas[i])) {
      throw new Error(
        `Las columnas de '${nombre}' no coinciden con el contrato.\n` +
        `  Esperado: ${columnas.join(', ')}\n` +
        `  Recibido: ${tabla.columnas.join(', ')}`
      );
    }
    const mala = tabla.filas.findIndex((f) => !Array.isArray(f) || f.length !== columnas.length);
    if (mala !== -1) {
      throw new Error(
        `La fila ${mala + 1} de '${nombre}' trae ${(tabla.filas[mala] || []).length} valores y ` +
        `el contrato pide ${columnas.length}.`
      );
    }
    celdas += (tabla.filas.length + 1) * columnas.length;
  });

  if (!paquete.hojas.Resumen.filas.length) {
    throw new Error('El Resumen viene sin datos, así que no hay nada que publicar.');
  }
  if (celdas > CONFIG.maxCeldasPublicacion) {
    throw new Error(
      `La publicación son ${celdas.toLocaleString('es-MX')} celdas y el tope es ` +
      `${CONFIG.maxCeldasPublicacion.toLocaleString('es-MX')}.`
    );
  }

  validarConciliacion_(paquete);
}

/**
 * Control algebraico: lo que dice el Resumen tiene que ser exactamente lo que
 * suman las pestañas de detalle. Si no cuadra, algo se perdió al armar el
 * paquete y publicarlo dejaría el tablero mintiendo con seguridad.
 */
function validarConciliacion_(paquete) {
  const resumen = paquete.hojas.Resumen.filas[paquete.hojas.Resumen.filas.length - 1];
  const iAsignados = columna_(ESQUEMA_CORTE, 'Resumen', 'cursos_asignados');
  const iCompletados = columna_(ESQUEMA_CORTE, 'Resumen', 'cursos_completados');

  const suma = (pestana, columna) => {
    const i = columna_(ESQUEMA_CORTE, pestana, columna);
    return paquete.hojas[pestana].filas.reduce((total, fila) => total + numero_(fila[i]), 0);
  };

  const comprobaciones = [
    ['Colaborador', 'cursos_asignados', numero_(resumen[iAsignados])],
    ['Colaborador', 'cursos_completados', numero_(resumen[iCompletados])],
    ['Region', 'cursos_asignados', numero_(resumen[iAsignados])],
    ['Curso', 'asignados', numero_(resumen[iAsignados])],
    ['Curso', 'completados', numero_(resumen[iCompletados])],
  ];

  const fallas = comprobaciones
    .map(([pestana, columna, esperado]) => ({
      pestana, columna, esperado, real: suma(pestana, columna),
    }))
    .filter((c) => Math.abs(c.real - c.esperado) > 0.5);

  if (fallas.length) {
    throw new Error(
      'El paquete no cuadra consigo mismo y no se publicó:\n' +
      fallas.map((f) =>
        `  ${f.pestana}.${f.columna} suma ${f.real.toLocaleString('es-MX')} y el Resumen dice ` +
        `${f.esperado.toLocaleString('es-MX')}`
      ).join('\n')
    );
  }
}


/* ------------------------------------------------------------------ *
 *  Histórico y archivado
 * ------------------------------------------------------------------ */

/**
 * Acumula los agregados del corte en el histórico: quita las filas del mismo
 * reporte+periodo (para que volver a publicar un mes lo reemplace, no lo
 * duplique) y agrega las nuevas, ordenadas por periodo.
 *
 * Colaborador no entra: ese detalle se archiva como .json. Ver §4 del contrato.
 */
function acumularHistorico_(paquete) {
  const historico = abrir_('historico');
  const acumuladas = {};

  Object.keys(ESQUEMA_HISTORICO)
    .filter((nombre) => nombre !== 'Bitacora')
    .forEach((nombre) => {
      const columnas = ESQUEMA_HISTORICO[nombre];
      const iReporte = columnas.indexOf('reporte');
      const iPeriodo = columnas.indexOf('periodo');

      const previas = leerTabla_(historico, nombre)
        .map((obj) => columnas.map((c) => (obj[c] === undefined ? '' : obj[c])))
        .filter((fila) => !(
          textoClave_(fila[iReporte]) === textoClave_(paquete.reporte) &&
          String(fila[iPeriodo]).trim() === String(paquete.periodo)
        ));

      const combinadas = previas.concat(paquete.hojas[nombre].filas);
      combinadas.sort((a, b) => {
        const porPeriodo = String(a[iPeriodo]).localeCompare(String(b[iPeriodo]));
        return porPeriodo || textoClave_(a[iReporte]).localeCompare(textoClave_(b[iReporte]));
      });

      acumuladas[nombre] = escribirTabla_(historico, ESQUEMA_HISTORICO, nombre, combinadas);
    });

  SpreadsheetApp.flush();
  return acumuladas;
}

/**
 * Antes de pisar el corte vigente, guarda su detalle por colaborador como .json
 * en la carpeta de cortes archivados. Solo si el corte que está publicado es de
 * un periodo distinto al que llega: republicar el mismo mes no genera archivo.
 *
 * Devuelve el nombre del archivo creado, o '' si no hubo nada que archivar.
 */
function archivarCorteAnterior_(corte, periodoNuevo) {
  if (!parametroSiNo_('ARCHIVAR_DETALLE', true)) return '';

  const anteriores = leerTabla_(corte, 'Colaborador');
  if (!anteriores.length) return '';

  const periodoAnterior = String(anteriores[0].periodo || '').trim();
  if (!periodoAnterior || periodoAnterior === String(periodoNuevo)) return '';

  const columnas = ESQUEMA_CORTE.Colaborador;
  const contenido = {
    formato: CONFIG.paquete.formato,
    version: CONFIG.paquete.version,
    reporte: CONFIG.reporte,
    periodo: periodoAnterior,
    fechaCorte: String(anteriores[0].fecha_corte || ''),
    archivadoEn: new Date().toISOString(),
    hojas: {
      Colaborador: {
        columnas: columnas.slice(),
        filas: anteriores.map((obj) => columnas.map((c) => (obj[c] === undefined ? '' : obj[c]))),
      },
    },
  };

  const nombre = `${CONFIG.reporte}-colaborador-${periodoAnterior}.json`;
  const carpeta = DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty(CONFIG.props.carpetaArchivo)
  );

  const existentes = carpeta.getFilesByName(nombre);
  while (existentes.hasNext()) existentes.next().setTrashed(true);

  carpeta.createFile(nombre, JSON.stringify(contenido), MimeType.PLAIN_TEXT);
  bitacora_('archivar', periodoAnterior, 'archivado', anteriores.length, nombre);
  return nombre;
}


/* ------------------------------------------------------------------ *
 *  Publicar el paquete que dejó el cuaderno
 * ------------------------------------------------------------------ */

/**
 * Publica el paquete que el cuaderno de Colab dejó en la carpeta de Paquetes.
 *
 * Es el camino normal desde que el cálculo salió de Apps Script. El motor tarda
 * 6 segundos fuera de Google y 19 minutos aquí adentro —contra un límite de 30—
 * porque el tiempo no se va en calcular sino en mover 3.8 millones de celdas a
 * través de una hoja. Ver docs/08-plan-colab.md.
 *
 * El paquete NO se sube por el navegador: se queda en Drive y esto lo lee de
 * ahí. Así el disparador del día 12 sigue vivo —publica lo que esté esperando—
 * y nadie tiene que bajar y volver a subir 12 MB.
 *
 * Toda la validación, el archivado del detalle anterior y la acumulación del
 * histórico ya viven en publicarPaquete(): esto solo consigue el archivo.
 */
function publicarDesdeDrive(periodo) {
  const cual = String(periodo || '').trim() || periodoActivo_();
  const archivo = paqueteDelPeriodo_(cual);

  bitacora_('publicarDesdeDrive', cual, 'lectura',
    Math.round(archivo.getSize() / 1048576 * 10) / 10, archivo.getName());

  const resultado = publicarPaquete(archivo.getBlob().getDataAsString());
  resultado.archivo = archivo.getName();
  return resultado;
}

/**
 * El paquete de un periodo, o un error que dice qué falta.
 *
 * Se busca por nombre exacto —`cedis-2026-08.json`— y no por "el más reciente":
 * publicar el mes equivocado porque alguien dejó un archivo viejo es peor que no
 * publicar. Si hay varios con el mismo nombre gana el más nuevo, que es lo que
 * pasa cuando el cuaderno se vuelve a correr.
 */
function paqueteDelPeriodo_(periodo) {
  const nombre = `${CONFIG.reporte}-${periodo}.json`;
  const carpeta = DriveApp.getFolderById(
    PropertiesService.getScriptProperties().getProperty(CONFIG.props.carpetaPaquetes)
  );

  const encontrados = [];
  const archivos = carpeta.getFilesByName(nombre);
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    if (!archivo.isTrashed()) encontrados.push(archivo);
  }

  if (!encontrados.length) {
    const hay = [];
    const todos = carpeta.getFiles();
    while (todos.hasNext() && hay.length < 15) hay.push(todos.next().getName());
    throw new Error(
      `No está "${nombre}" en la carpeta ${CONFIG.carpetas.paquetes}.\n\n` +
      `Lo que sí hay ahí: ${hay.join(', ') || '(la carpeta está vacía)'}\n\n` +
      `Corre el cuaderno pipeline/colab/corte_cedis.ipynb en Colab: él deja el ` +
      `paquete de este periodo en esa carpeta.`
    );
  }

  encontrados.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());
  return encontrados[0];
}
