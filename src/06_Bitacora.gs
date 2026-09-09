/**
 * Bitácora. Vive en la hoja de Histórico y guarda quién hizo qué y cuándo.
 *
 * Nunca truena: si escribir la bitácora fallara, el error se manda al registro
 * de ejecución y ya. Una publicación no se cae por no poder anotar que ocurrió.
 */

function bitacora_(accion, periodo, etapa, filas, mensaje) {
  try {
    const hoja = abrir_('historico');
    const destino = pestana_(hoja, ESQUEMA_HISTORICO, 'Bitacora');
    destino.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
      correoActual_() || String(Session.getEffectiveUser().getEmail() || ''),
      String(accion || ''),
      String(periodo || ''),
      String(etapa || ''),
      numero_(filas),
      String(mensaje || '').slice(0, 4000),
    ]);
  } catch (error) {
    console.log(`No se pudo escribir en la bitácora: ${error.message} — ${accion}: ${mensaje}`);
  }
}

/** Los últimos movimientos, para revisar desde el editor. */
function verBitacora(cuantos) {
  const filas = leerTabla_(abrir_('historico'), 'Bitacora');
  const limite = Math.max(1, Number(cuantos) || 25);
  const texto = filas.slice(-limite)
    .map((f) => `${f.momento}  ${f.accion.padEnd(22)} ${f.etapa.padEnd(14)} ${f.mensaje}`)
    .join('\n');
  console.log(texto || 'La bitácora está vacía.');
  return texto;
}
