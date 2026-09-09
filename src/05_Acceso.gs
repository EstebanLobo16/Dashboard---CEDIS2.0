/**
 * Quién puede publicar.
 *
 * Dos capas, y solo una cuenta de verdad:
 *
 *   1. La interfaz esconde el botón "Actualizar datos" cuando el visitante no
 *      es administrador. Eso es comodidad, no seguridad: cualquiera con la
 *      consola del navegador puede llamar a la función del servidor.
 *   2. Toda función que escriba —publicar un paquete, procesar un corte,
 *      archivar— empieza con exigirPermisoDePublicar_(). Esta es la reja.
 *
 * La lista vive en la pestaña Administradores de la hoja de Catálogos, así que
 * dar de alta a alguien es escribir un renglón: no hay que editar código ni
 * volver a desplegar. Quien corre instalar() queda dado de alta solo.
 *
 * Falla cerrado a propósito: si la hoja de Catálogos no se puede leer, nadie
 * publica. Es preferible a que un error de lectura abra la puerta.
 */

/** El correo de quien está usando el tablero en este momento. */
function correoActual_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (error) {
    return '';
  }
}

/** Los correos con permiso de publicar, en minúsculas. */
function administradores_() {
  return catalogo_('Administradores')
    .filter((fila) => {
      const activo = textoClave_(fila.puede_publicar);
      return activo === '' || activo === 'SI' || activo === 'TRUE' || activo === '1';
    })
    .map((fila) => String(fila.correo || '').trim().toLowerCase())
    .filter(Boolean);
}

/** ¿El usuario actual puede publicar? Nunca truena: devuelve false ante duda. */
function puedePublicar_() {
  const correo = correoActual_();
  if (!correo) return false;
  try {
    return administradores_().indexOf(correo) !== -1;
  } catch (error) {
    console.log(`No se pudo leer la lista de administradores: ${error.message}`);
    return false;
  }
}

/**
 * Corta la ejecución si el usuario actual no puede publicar. Va al principio de
 * toda función que escriba en el almacén.
 */
function exigirPermisoDePublicar_(accion) {
  const correo = correoActual_();

  if (!correo) {
    throw new Error(
      'No pudimos identificar tu cuenta. Abre el tablero con tu correo de Coppel e inténtalo ' +
      'de nuevo.'
    );
  }

  let permitidos;
  try {
    permitidos = administradores_();
  } catch (error) {
    bitacora_(accion || 'publicar', '', 'acceso', 0,
      `Catálogo de administradores ilegible: ${error.message}`);
    throw new Error(
      'No se pudo leer la lista de administradores, así que la publicación quedó bloqueada por ' +
      'seguridad. Corre estado() desde el editor de Apps Script para ver qué falta.'
    );
  }

  if (permitidos.indexOf(correo) === -1) {
    bitacora_(accion || 'publicar', '', 'acceso', 0, `Intento sin permiso: ${correo}`);
    throw new Error(
      `Tu cuenta (${correo}) no tiene permiso para publicar en este tablero. Pídele a un ` +
      `administrador que te agregue en la pestaña Administradores de la hoja de Catálogos.`
    );
  }

  return correo;
}

/**
 * Alta de un administrador desde el editor, por si alguien se queda fuera y no
 * quiere abrir la hoja. Solo puede correrla alguien que ya sea administrador,
 * salvo que la lista esté vacía (arranque en frío).
 */
function agregarAdministrador(correo, nombre) {
  const nuevo = String(correo || '').trim().toLowerCase();
  if (!nuevo || nuevo.indexOf('@') === -1) {
    throw new Error('Pásame un correo válido: agregarAdministrador("alguien@coppel.com").');
  }

  const actuales = administradores_();
  if (actuales.length) exigirPermisoDePublicar_('agregarAdministrador');
  if (actuales.indexOf(nuevo) !== -1) return `${nuevo} ya estaba en la lista.`;

  const hoja = abrir_('catalogos');
  const destino = pestana_(hoja, ESQUEMA_CATALOGOS, 'Administradores');
  destino.appendRow([nuevo, String(nombre || ''), 'SI', `Alta por ${correoActual_() || 'editor'}`]);
  SpreadsheetApp.flush();
  invalidarCacheCatalogos_();

  bitacora_('agregarAdministrador', '', 'acceso', 1, `Alta de ${nuevo}`);
  return `${nuevo} quedó dado de alta como administrador.`;
}

/**
 * Baja de un administrador. Nunca deja la lista vacía: si se intenta quitar al
 * último, truena, porque una lista vacía deja el tablero sin nadie que publique.
 */
function quitarAdministrador(correo) {
  exigirPermisoDePublicar_('quitarAdministrador');
  const objetivo = String(correo || '').trim().toLowerCase();

  if (administradores_().length <= 1) {
    throw new Error(
      'Es el único administrador que queda. Da de alta a alguien más antes de quitarlo, o el ' +
      'tablero se queda sin quien publique.'
    );
  }

  const destino = pestana_(abrir_('catalogos'), ESQUEMA_CATALOGOS, 'Administradores');
  const valores = destino.getDataRange().getValues();
  for (let i = valores.length - 1; i >= 1; i -= 1) {
    if (String(valores[i][0] || '').trim().toLowerCase() === objetivo) {
      destino.deleteRow(i + 1);
      SpreadsheetApp.flush();
      invalidarCacheCatalogos_();
      bitacora_('quitarAdministrador', '', 'acceso', 1, `Baja de ${objetivo}`);
      return `${objetivo} ya no es administrador.`;
    }
  }
  return `${objetivo} no estaba en la lista.`;
}
