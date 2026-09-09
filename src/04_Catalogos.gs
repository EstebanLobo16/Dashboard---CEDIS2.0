/**
 * Lectura de los catálogos.
 *
 * Todo pasa por caché (5 minutos) porque el motor consulta estas tablas miles
 * de veces por corte y el tablero una vez por carga. Después de editar la hoja
 * a mano, el cambio entra solo al vencer la caché, o al instante si corres
 * invalidarCacheCatalogos_().
 */

/** El prefijo de las llaves de caché. Sale de CONFIG para que dos tableros en
 *  el mismo proyecto de Apps Script no se lean los catálogos uno al otro. */
function llaveDeCatalogo_(nombre) {
  return `${CONFIG.reporte}_cat_${nombre}`;
}

function catalogo_(nombre) {
  const cache = CacheService.getScriptCache();
  const llave = llaveDeCatalogo_(nombre);
  const guardado = cache.get(llave);
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch (error) {
      cache.remove(llave);
    }
  }
  const filas = leerTabla_(abrir_('catalogos'), nombre);
  try {
    cache.put(llave, JSON.stringify(filas), CONFIG.cacheSegundos);
  } catch (error) {
    // Un catálogo de más de 100 KB no cabe en caché. No es un error: se lee
    // directo cada vez, solo más lento.
    console.log(`El catálogo ${nombre} no cupo en caché; se leerá directo.`);
  }
  return filas;
}

function invalidarCacheCatalogos_() {
  const llaves = Object.keys(ESQUEMA_CATALOGOS).map(llaveDeCatalogo_);
  CacheService.getScriptCache().removeAll(llaves);
}

/** Fuerza la relectura de los catálogos. Corre esto tras editarlos a mano. */
function refrescarCatalogos() {
  invalidarCacheCatalogos_();
  const resumen = Object.keys(ESQUEMA_CATALOGOS)
    .map((n) => `${n}: ${catalogo_(n).length}`)
    .join('\n');
  console.log(resumen);
  return resumen;
}


/* ------------------------------------------------------------------ *
 *  Parámetros
 * ------------------------------------------------------------------ */

function parametro_(clave, porDefecto) {
  const fila = catalogo_('Parametros').find((f) => textoClave_(f.clave) === textoClave_(clave));
  if (!fila || String(fila.valor).trim() === '') {
    return porDefecto === undefined ? '' : porDefecto;
  }
  return String(fila.valor).trim();
}

function parametroSiNo_(clave, porDefecto) {
  const valor = textoClave_(parametro_(clave, porDefecto ? 'SI' : 'NO'));
  return valor === 'SI' || valor === 'TRUE' || valor === '1';
}

function parametroNumero_(clave, porDefecto) {
  const valor = Number(parametro_(clave, ''));
  return Number.isFinite(valor) && String(parametro_(clave, '')) !== '' ? valor : porDefecto;
}


/* ------------------------------------------------------------------ *
 *  Regiones
 * ------------------------------------------------------------------ */

/** Las regiones oficiales del área, en el orden del documento de lógicas. */
function regionesOficiales_() {
  return catalogo_('Regiones')
    .slice()
    .sort((a, b) => numero_(a.orden) - numero_(b.orden))
    .map((f) => String(f.region).trim())
    .filter(Boolean);
}

/**
 * Traduce la región que traen las fuentes a una de las regiones oficiales.
 * Devuelve null si la región no se reconoce ni está mapeada, para que el motor
 * pueda reportarla en vez de publicarla como región fantasma.
 */
function regionOficial_(regionCruda) {
  const clave = textoClave_(regionCruda);
  if (!clave) return null;

  const oficiales = regionesOficiales_();
  const directa = oficiales.find((r) => textoClave_(r) === clave);
  if (directa) return directa;

  const mapeo = catalogo_('MapaRegiones')
    .find((f) => textoClave_(f.region_origen) === clave);
  if (!mapeo) return null;

  const destino = oficiales.find((r) => textoClave_(r) === textoClave_(mapeo.region_oficial));
  return destino || null;
}


/* ------------------------------------------------------------------ *
 *  Cursos
 * ------------------------------------------------------------------ */

/**
 * Cómo tratar un curso del plan. Devuelve:
 *   {accion: 'ALIAS',     nombre: '<nombre en las finalizaciones>'}
 *   {accion: 'EXCLUIR',   nombre: null}     — sale del plan
 *   {accion: 'PENDIENTE', nombre: null}     — se asigna y nadie lo completa
 *   {accion: 'DIRECTO',   nombre: '<el mismo>'}  — sin regla especial
 */
function reglaCurso_(cursoDelPlan) {
  const clave = textoClave_(cursoDelPlan);
  const fila = catalogo_('AliasCursos').find((f) => textoClave_(f.curso_en_plan) === clave);
  if (!fila) return { accion: 'DIRECTO', nombre: String(cursoDelPlan).trim() };

  const accion = textoClave_(fila.accion) || 'ALIAS';
  const equivalente = String(fila.curso_en_finalizaciones || '').trim();
  if (accion === 'ALIAS' && equivalente) return { accion: 'ALIAS', nombre: equivalente };
  if (accion === 'EXCLUIR') return { accion: 'EXCLUIR', nombre: null };
  return { accion: 'PENDIENTE', nombre: null };
}

/** La agrupación a la que pertenece un curso, o '' si no pertenece a ninguna. */
function agrupacionDe_(curso) {
  const clave = textoClave_(curso);
  const fila = catalogo_('Agrupaciones').find((f) => textoClave_(f.curso) === clave);
  return fila ? String(fila.agrupacion).trim() : '';
}

/** Nombres que el motor NO debe tratar como cursos (son agrupaciones). */
function nombresDeAgrupacion_() {
  if (parametroSiNo_('ESPECIALIZACION_COMO_CURSO', false)) return [];
  return [...new Set(catalogo_('Agrupaciones').map((f) => String(f.agrupacion).trim()))]
    .filter(Boolean);
}


/* ------------------------------------------------------------------ *
 *  Plan gerencial y excepciones
 * ------------------------------------------------------------------ */

/**
 * Cómo se llama en el plan el puesto que los datos llaman de otra forma.
 *
 * El padrón de CEDIS dice "COORDINADOR DE TRANSPORTE" y el plan gerencial dice
 * "COORDINADOR" a secas. Son 26 personas que sí tienen la especialización de
 * conductores en las finalizaciones, así que sin esta traducción quedarían sin
 * plan y fuera del tablero.
 *
 * Devuelve el mismo puesto cuando no hay regla, que es el caso normal.
 */
function puestoDelPlan_(puestoEnDatos) {
  const clave = textoClave_(puestoEnDatos);
  if (!clave) return '';
  const fila = catalogo_('AliasPuestos').find((f) => textoClave_(f.puesto_en_datos) === clave);
  const destino = fila ? String(fila.puesto_en_plan || '').trim() : '';
  return destino || String(puestoEnDatos || '').trim();
}

/** El nivel de la matriz gerencial que le toca a un puesto, o '' si no aplica. */
function nivelGerencial_(puesto) {
  const clave = textoClave_(puesto);
  const fila = catalogo_('NivelesGerencial').find((f) => textoClave_(f.puesto) === clave);
  return fila ? String(fila.nivel_matriz).trim() : '';
}

/**
 * Los centros de costo que el área declara suyos, por su número.
 *
 * En CEDIS son 34, y los 34 aparecen en los datos: la lista no saca a nadie. Se
 * siembra igual, para que el día que aparezca un centro de costo que nadie
 * declaró, el tablero lo diga en vez de contarlo en silencio. Vacía = sin
 * revisión.
 */
function centrosDeCostoDelArea_() {
  return catalogo_('CentrosCosto')
    .map((f) => soloDigitos_(f.centro_costo))
    .filter(Boolean);
}

/**
 * Puestos del plan específico que el catálogo agrega a los que trae el archivo.
 *
 * Existe porque el PDT de operación de CEDIS trae `Colaboradores_especificos`
 * **vacío**: solo encabezados. Sin esto, la especialización de conductores no le
 * llegaría a los 4,858 choferes que sí la tienen en las finalizaciones. Los
 * puestos y sus centros están en el PDF de lógicas, así que el dato existe —
 * lo que falta es el renglón en el archivo.
 *
 * `centros` es la lista blanca de centros de costo, separada por comas. Vacía =
 * aplica en todos.
 */
function puestosEspecificosExtra_(familia) {
  return catalogo_('PuestosEspecificos')
    .filter((f) => textoClave_(f.plan) === textoClave_(familia))
    .filter((f) => String(f.puesto || '').trim())
    .map((f) => ({
      id: String(f.id || '').trim(),
      puesto: String(f.puesto || '').trim(),
      centrosDeCosto: '',
      centrosQueNoAplican: [],
      centrosQueSiAplican: String(f.centros || '').split(',')
        .map((c) => c.trim()).filter(Boolean),
    }));
}

/** La definición de una fuente por su clave (patrón de archivo, pestaña, etc.). */
function fuente_(clave) {
  const fila = catalogo_('Fuentes').find((f) => textoClave_(f.clave) === textoClave_(clave));
  if (!fila) throw new Error(`La fuente '${clave}' no está en el catálogo de Fuentes.`);
  return fila;
}
