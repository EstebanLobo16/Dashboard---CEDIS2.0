/**
 * El motor: de las fuentes ya leídas a las siete tablas del corte.
 *
 * Todo lo que hay aquí es lógica de negocio pura. No toca SpreadsheetApp,
 * DriveApp ni ningún servicio de Google: recibe arreglos de objetos y devuelve
 * arreglos de objetos. Eso es a propósito — es lo que permite correrlo fuera de
 * Apps Script y compararlo contra el cuaderno sobre el mismo mes, que es la
 * prueba de aceptación de esta etapa. Los servicios de Google viven en
 * 20_Fuentes.gs y 40_Proceso.gs.
 *
 * Aquí están corregidos los nueve hallazgos de docs/00-propuesta.md §2:
 *
 *   1  puente persona ↔ colaborador antes de la cascada de centro
 *   2  cruce de cursos por nombre normalizado, más el catálogo de alias
 *   3  la matriz de niveles del plan gerencial manda
 *   4  la excepción del Centro de Impresión se aplica, no solo se valida
 *   5  el padrón es la Planta por Posiciones
 *   6  las finalizaciones repetidas cuentan una vez
 *   7  regiones fuera de catálogo mapeadas a su región base
 *   8  el rango de meses tolera la fecha en que Excel lo convirtió
 *   9  "007 Cobranzas" se lee como toda el área, no como un centro
 *
 * Y la regla que corrigió el área después: la vigencia de un curso se cuenta
 * desde que la persona TOMÓ EL PUESTO, no desde que entró a la empresa. Casi
 * todo puesto trae cursos obligatorios al asignarse, así que la fecha de
 * referencia es la de asignación. Sobre el corte de agosto la mediana pasa de
 * 796 días de antigüedad en la empresa a 329 en el puesto, y eso mueve qué
 * cursos aplican.
 *
 * No se materializa la tabla de asignaciones persona×curso (unas 170 mil
 * filas): se recorre persona por persona acumulando en los agregados. Con 12 mil
 * personas y 20 cursos eso es la diferencia entre caber en una ejecución de
 * Apps Script y no caber.
 */

const SIN_REGION = 'Sin región';
const SIN_CENTRO = 'Pendiente';


/**
 * Punto de entrada. `fuentes` trae las tablas ya leídas y `opciones` los
 * parámetros del catálogo; ninguna de las dos cosas se va a buscar sola, para
 * que esta función se pueda correr en cualquier lado.
 */
function calcularCorte_(fuentes, opciones) {
  const diagnostico = { avisos: [], conteos: {} };

  const plan = construirPlan_(fuentes.planes, opciones, diagnostico);
  const personas = resolverPadron_(fuentes, plan, opciones, diagnostico);
  const finalizaciones = indiceFinalizaciones_(fuentes.finalizaciones, plan, opciones, diagnostico);

  return acumular_(personas, plan, finalizaciones, opciones, diagnostico);
}


/* =================================================================== *
 *  Plan de capacitación
 * =================================================================== */

/**
 * Convierte los dos PDT en una lista de reglas indexada por puesto.
 *
 * Cada regla dice: a qué puesto le toca qué curso, desde cuántos días de
 * antigüedad, y en qué centros no aplica.
 */
function construirPlan_(planes, opciones, diagnostico) {
  const reglas = [];
  let orden = 0;

  (planes || []).forEach((plan) => {
    const familia = plan.familia;

    // --- General: cada puesto del plan recibe cada curso de la pestaña ------
    const generales = normalizarCursos_(plan.cursosGenerales, familia, 'General',
      opciones, diagnostico);

    (plan.puestosGenerales || []).forEach((puesto) => {
      const puestoClave = textoClave_(puesto.puesto);
      if (!puestoClave) return;
      const nivel = opciones.nivelGerencial(puestoClave);

      generales.forEach((curso) => {
        // Hallazgo 3: en el plan gerencial no todos los niveles reciben todos
        // los cursos. La matriz lo dice curso por curso; ignorarla sobreasigna.
        if (opciones.respetarMatriz && curso.niveles && !nivelAplica_(curso, nivel, puestoClave, diagnostico)) {
          return;
        }
        reglas.push(regla_(orden++, puestoClave, curso, null, [], familia));
      });
    });

    // --- Específico: puesto + centro ---------------------------------------
    const especificos = normalizarCursos_(plan.cursosEspecificos, familia, 'Específico',
      opciones, diagnostico);

    // El PDT de operación de CEDIS trae Colaboradores_especificos vacío, así que
    // la especialización de conductores no le llegaría a ningún chofer. El
    // catálogo completa lo que al archivo le falta, sin tocar código. Ver
    // PuestosEspecificos en 02_Semillas.gs.
    const delCatalogo = opciones.puestosEspecificosExtra(familia);
    if (delCatalogo.length) {
      diagnostico.conteos.puestosEspecificosDelCatalogo =
        (diagnostico.conteos.puestosEspecificosDelCatalogo || 0) + delCatalogo.length;
    }

    (plan.puestosEspecificos || []).concat(delCatalogo).forEach((puesto) => {
      const puestoClave = textoClave_(puesto.puesto);
      if (!puestoClave) return;

      const alcance = alcanceDeCentros_(puesto, opciones);
      const excluidos = centrosExcluidos_(puesto, puestoClave, opciones);

      especificos.forEach((curso) => {
        reglas.push(regla_(orden++, puestoClave, curso, alcance, excluidos, familia));
      });
    });
  });

  return indexarPlan_(reglas, diagnostico);
}

function regla_(orden, puestoClave, curso, centrosPermitidos, centrosExcluidos, familia) {
  return {
    orden,
    puestoClave,
    curso: curso.curso,
    cursoClave: curso.cursoClave,
    cursoBuscado: curso.cursoBuscado,
    iniciativa: curso.iniciativa,
    agrupacion: curso.agrupacion,
    diasMinimos: curso.diasMinimos,
    sinFuente: curso.sinFuente,
    centrosPermitidos,
    centrosExcluidos,
    familia,
  };
}

/**
 * Limpia la lista de cursos de una pestaña: resuelve el rango de meses, aplica
 * el catálogo de alias y saca las agrupaciones del conteo.
 */
function normalizarCursos_(cursos, familia, tipo, opciones, diagnostico) {
  const agrupaciones = opciones.nombresDeAgrupacion.map(textoClave_);
  const salida = [];

  (cursos || []).forEach((fila) => {
    const nombre = String(fila.curso || '').trim();
    if (!nombre) return;

    // Hallazgo 3 (bis): "Formación de Conductores CEDIS 2026" no es un curso, es
    // el nombre del paquete de los otros tres, que ya vienen listados aparte.
    // Contarlo infla el denominador con algo que nadie puede completar.
    if (agrupaciones.indexOf(textoClave_(nombre)) !== -1) {
      diagnostico.conteos.cursosAgrupacionOmitidos =
        (diagnostico.conteos.cursosAgrupacionOmitidos || 0) + 1;
      return;
    }

    // Hallazgo 8: dos renglones del PDT gerencial traen "2024-06-03" porque
    // Excel convirtió solo el texto "3-6". El cuaderno truena aquí.
    const meses = rangoMesesMinimo_(fila.rango);
    if (meses === null) {
      diagnostico.avisos.push(
        `Plan ${familia}/${tipo}: no se pudo leer el rango "${fila.rango}" del curso ` +
        `"${nombre}"; se toma 0 meses.`
      );
    }

    // Hallazgo 2: el catálogo de alias resuelve lo que la normalización no
    // alcanza, como "Socialización del Código de Ética Para Líderes".
    const regla = opciones.reglaCurso(nombre);
    if (regla.accion === 'EXCLUIR') {
      diagnostico.conteos.cursosExcluidos = (diagnostico.conteos.cursosExcluidos || 0) + 1;
      return;
    }

    // La clave sale del nombre RESUELTO, no del que trae el plan.
    //
    // Los dos PDT de CEDIS escriben distinto el mismo curso: operación dice
    // "Introducción a la Seguridad y Salud Laboral CEDIS" y gerencial
    // "...Laboral EN CEDIS". El alias hace que los dos encuentren las mismas
    // finalizaciones, pero si la clave saliera del nombre del plan se
    // publicarían como DOS cursos, y "Avance por curso" enseñaría el mismo
    // renglón dos veces con números distintos.
    //
    // El nombre visible sí es el del plan —es como lo escribió el área—, y gana
    // el primer plan que lo declare.
    const buscado = regla.nombre || nombre;
    salida.push({
      curso: nombre,
      cursoClave: claveCurso_(buscado),
      cursoBuscado: buscado,
      sinFuente: regla.accion === 'PENDIENTE',
      iniciativa: String(fila.tipo || '').trim(),
      agrupacion: opciones.agrupacionDe(nombre),
      diasMinimos: (meses === null ? 0 : meses) * opciones.diasPorMes,
      niveles: fila.niveles || null,
    });
  });

  return salida;
}

/** ¿La matriz del plan gerencial marca este curso para el nivel del puesto? */
function nivelAplica_(curso, nivel, puestoClave, diagnostico) {
  if (!nivel) {
    if (!diagnostico.puestosSinNivel) diagnostico.puestosSinNivel = {};
    if (!diagnostico.puestosSinNivel[puestoClave]) {
      diagnostico.puestosSinNivel[puestoClave] = true;
      diagnostico.avisos.push(
        `El puesto "${puestoClave}" no está en NivelesGerencial; recibe todos los cursos del ` +
        `plan gerencial. Agrégalo al catálogo si debería recibir solo algunos.`
      );
    }
    return true;
  }
  const marca = curso.niveles[nivel];
  if (marca === undefined) return true;
  return String(marca).trim() === '1';
}

/**
 * En qué centros de costo aplica una regla específica. Devuelve null cuando
 * aplica en todos.
 *
 * Las dos áreas escriben esto al revés, y leer una como si fuera la otra
 * invierte exactamente a quién le toca el curso:
 *
 *   Cobranza  "Centros de costos: 007 Cobranzas" — la familia entera del área,
 *             o sea: todos. Compararla contra un número de centro como 500101 no
 *             empata nunca, y por eso la especialización no le llegaba a nadie
 *             (hallazgo 9). `esFamiliaDeCentros` es lo que reconoce ese caso.
 *
 *   CEDIS     "Centros que si aplican: 045 Distribución Foráneo, 153 Estación
 *             Rac, …" — nueve centros de costo, y nadie más. Es una lista blanca
 *             de verdad, y la columna "Centros de costos" viene vacía.
 *
 * Manda la lista de inclusión cuando existe. Los valores se comparan por su
 * número —`soloDigitos_` deja "045 Distribución Foráneo" y "045 - DISTRIBUCION
 * FORANEA" en el mismo "45"— porque el plan y el padrón los escriben distinto.
 */
function alcanceDeCentros_(puesto, opciones) {
  const inclusion = (puesto.centrosQueSiAplican || [])
    .map((c) => soloDigitos_(c))
    .filter(Boolean);
  if (inclusion.length) return sinRepetir_(inclusion);

  const texto = String(puesto.centrosDeCosto || '').trim();
  if (!texto) return null;
  if (opciones.esFamiliaDeCentros(texto)) return null;

  const centros = texto.split(/[,;\n/]+/)
    .map((parte) => soloDigitos_(parte))
    .filter(Boolean);
  return centros.length ? sinRepetir_(centros) : null;
}

/**
 * Hallazgo 4: la lista de centros exceptuados sí viene en el archivo, en la
 * columna "Centros que no aplican" que el cuaderno ni siquiera lee. Se combina
 * con el catálogo, que es el que manda sobre a qué puestos aplica (el PDF de
 * Cobranza dice 743 y 721; el PDT lista un tercer puesto en la misma pestaña).
 *
 * En CEDIS esta columna viene vacía: su restricción es la lista blanca de
 * arriba. Las dos pueden convivir —primero se ve si el centro está permitido,
 * después si está exceptuado— y así el día que un área use las dos, funciona.
 */
function centrosExcluidos_(puesto, puestoClave, opciones) {
  const delArchivo = (puesto.centrosQueNoAplican || [])
    .map((c) => soloDigitos_(c))
    .filter(Boolean);

  const delCatalogo = opciones.centrosExceptuados(puesto.id, puestoClave);
  return sinRepetir_(delArchivo.concat(delCatalogo));
}

function sinRepetir_(lista) {
  const vistos = {};
  lista.forEach((v) => { vistos[v] = true; });
  return Object.keys(vistos);
}


/** Agrupa las reglas por puesto y quita el mismo curso repetido en dos planes. */
function indexarPlan_(reglas, diagnostico) {
  const porPuesto = {};
  const vistos = {};
  const nombresPorClave = {};
  let duplicados = 0;

  reglas.forEach((regla) => {
    const llave = `${regla.puestoClave}|${regla.cursoClave}`;
    // Un puesto que estuviera en los dos planes recibiría el mismo curso dos
    // veces. Los dos planes se suman (regla 2.2), pero un curso repetido sigue
    // siendo un solo curso: la persona lo toma una vez.
    if (vistos[llave]) { duplicados += 1; return; }
    vistos[llave] = true;

    if (!nombresPorClave[regla.cursoClave]) nombresPorClave[regla.cursoClave] = {};
    nombresPorClave[regla.cursoClave][regla.curso] = true;

    if (!porPuesto[regla.puestoClave]) porPuesto[regla.puestoClave] = [];
    porPuesto[regla.puestoClave].push(regla);
  });

  // Dos nombres distintos que caen en la misma clave son el mismo curso escrito
  // de dos formas, y se publican como uno. Se dice cuál se ve, porque el que se
  // ve es el del primer plan que lo declaró y no siempre es el que uno espera.
  Object.keys(nombresPorClave).forEach((clave) => {
    const nombres = Object.keys(nombresPorClave[clave]);
    if (nombres.length < 2) return;
    diagnostico.avisos.push(
      `Los cursos ${nombres.map((n) => `"${n}"`).join(' y ')} son el mismo (los une un alias) y ` +
      `se publican como uno solo, con el nombre "${nombres[0]}".`
    );
  });

  Object.keys(porPuesto).forEach((puesto) => {
    porPuesto[puesto].sort((a, b) => a.orden - b.orden);
  });

  diagnostico.conteos.reglasDePlan = reglas.length - duplicados;
  diagnostico.conteos.reglasDuplicadasEntrePlanes = duplicados;
  diagnostico.conteos.puestosConPlan = Object.keys(porPuesto).length;
  return porPuesto;
}


/* =================================================================== *
 *  Padrón
 * =================================================================== */

/**
 * Quién entra al tablero y con qué atributos.
 *
 * En CEDIS el padrón es el propio reporte de asignaciones, ya concentrado a una
 * fila por persona. Trae la región, el centro de costo, el departamento, el
 * puesto y las dos fechas, así que aquí no hay nada que reconciliar: se traduce
 * y ya. Cobranza necesitaba una cascada de tres pasos —id, puente, nombre— para
 * cruzar la Planta contra el Detalle Colaborador, dos sistemas que identifican
 * distinto; ese problema aquí no existe.
 *
 * Lo que sí se conserva son los dos identificadores. `Número Persona` y
 * `Número Colaborador` difieren en 6,532 de 15,252 personas, y las
 * finalizaciones vienen indexadas por cualquiera de los dos.
 *
 * Los tres ejes del tablero, para CEDIS:
 *
 *   centro        el Departamento — el CEDIS físico ("07 CEDIS CROSS OAXC 02")
 *   nomenclatura  el Centro Costos ("045 - DISTRIBUCION FORANEA")
 *   tipoCentro    el Área (CEDIS / STAFF / TIENDAS / ZONA)
 *
 * y aparte `centroCosto`, que es el número suelto del centro de costo (45) y no
 * se publica: es con lo que se comparan las listas de centros del plan
 * específico, que hablan de familias de centro de costo y no de departamentos.
 */
function resolverPadron_(fuentes, plan, opciones, diagnostico) {
  const origenPuesto = { padron: 0, contratacion: 0, ninguno: 0 };
  const personas = [];
  const vistos = {};
  let repetidas = 0;

  (fuentes.padron || []).forEach((fila) => {
    const persona = String(fila.numeroPersona || '').trim();
    if (!persona) return;
    if (vistos[persona]) { repetidas += 1; return; }
    vistos[persona] = true;

    const colaborador = String(fila.numeroColaborador || '').trim() || persona;
    const fechaContratacion = fila.fechaContratacion || null;

    // La fecha que decide la vigencia: cuándo tomó ESTE puesto. En CEDIS la trae
    // el padrón para todos, pero el respaldo se conserva porque no cuesta nada y
    // el día que una fila venga incompleta es preferible subestimar la
    // antigüedad —asignar de más— a dejar a la persona fuera del corte.
    let fechaPuesto = fila.fechaPuesto || null;
    let dePuesto = fechaPuesto ? 'padron' : '';
    if (!fechaPuesto && fechaContratacion) {
      fechaPuesto = fechaContratacion;
      dePuesto = 'contratacion';
    }
    origenPuesto[dePuesto || 'ninguno'] += 1;

    const cruda = String(fila.region || '').trim();
    const region = opciones.regionOficial(cruda);
    if (!region && cruda) {
      if (!diagnostico.regionesFueraDeCatalogo) diagnostico.regionesFueraDeCatalogo = {};
      diagnostico.regionesFueraDeCatalogo[cruda] =
        (diagnostico.regionesFueraDeCatalogo[cruda] || 0) + 1;
    }

    // El puesto del plan puede llamarse distinto que el de los datos: el plan
    // gerencial dice "COORDINADOR" y el padrón "COORDINADOR DE TRANSPORTE".
    const puestoDelPlan = opciones.puestoDelPlan(fila.puesto);

    personas.push({
      colaborador,
      persona,
      nombre: String(fila.nombre || '').trim(),
      codigoPuesto: String(fila.codigoPuesto || '').trim(),
      puesto: String(fila.puesto || '').trim(),
      puestoClave: textoClave_(puestoDelPlan),
      departamento: String(fila.departamento || '').trim(),
      categoria: String(fila.categoria || '').trim(),
      centro: String(fila.departamento || '').trim() || SIN_CENTRO,
      centroCosto: soloDigitos_(fila.centroCostos),
      region: region || SIN_REGION,
      regionCruda: cruda,
      nomenclatura: String(fila.centroCostos || '').trim(),
      tipoCentro: String(fila.area || '').trim(),
      fechaContratacion: fechaContratacion ? aTextoFecha_(fechaContratacion) : '',
      fechaPuesto: fechaPuesto ? aTextoFecha_(fechaPuesto) : '',
      diasLaborados: fechaContratacion ? diasEntre_(opciones.fechaCorte, fechaContratacion) : null,
      diasEnPuesto: fechaPuesto ? diasEntre_(opciones.fechaCorte, fechaPuesto) : null,
      origenFecha: fechaContratacion ? 'padron' : 'ninguno',
      origenFechaPuesto: dePuesto || 'ninguno',
    });
  });

  // Una región que no está en el catálogo ni mapeada entraría al ranking como
  // región fantasma. Se avisa para que alguien la agregue o corrija la fuente.
  Object.keys(diagnostico.regionesFueraDeCatalogo || {}).forEach((cruda) => {
    diagnostico.avisos.push(
      `Región "${cruda}" no está entre las oficiales ni mapeada ` +
      `(${diagnostico.regionesFueraDeCatalogo[cruda]} persona(s)). Agrégala a MapaRegiones o ` +
      `corrige el archivo del padrón.`
    );
  });
  if (repetidas) {
    diagnostico.avisos.push(
      `${repetidas} fila(s) del padrón repiten un número de persona ya visto; se usó la primera.`
    );
  }

  revisarCentrosDeCosto_(personas, opciones, diagnostico);

  const filtradas = filtrarPadron_(personas, opciones, diagnostico);
  diagnostico.conteos.padronLeido = (fuentes.padron || []).length;
  diagnostico.conteos.padronPublicado = filtradas.length;
  diagnostico.conteos.origenFechaDePuesto = origenPuesto;
  return filtradas;
}


/**
 * Avisa de los centros de costo que aparecen en el padrón y que nadie declaró.
 *
 * Los 34 del PDF cubren el 100% de los datos de agosto, así que hoy esto no dice
 * nada. Existe para el día que el área abra un centro de costo nuevo: sin el
 * aviso, su gente entraría al tablero sin que nadie hubiera revisado si le toca
 * el plan de CEDIS. No excluye a nadie — solo lo dice.
 */
function revisarCentrosDeCosto_(personas, opciones, diagnostico) {
  const declarados = opciones.centrosDeCostoDelArea || [];
  if (!declarados.length) return;

  const fuera = {};
  personas.forEach((persona) => {
    if (!persona.centroCosto) return;
    if (declarados.indexOf(persona.centroCosto) !== -1) return;
    fuera[persona.nomenclatura || persona.centroCosto] =
      (fuera[persona.nomenclatura || persona.centroCosto] || 0) + 1;
  });

  const nombres = Object.keys(fuera);
  diagnostico.conteos.centrosDeCostoFueraDelCatalogo = nombres.length;
  if (!nombres.length) return;

  diagnostico.avisos.push(
    `${nombres.length} centro(s) de costo del padrón no están en el catálogo CentrosCosto: ` +
    `${nombres.map((n) => `${n} (${fuera[n]})`).join(', ')}. Entran al tablero igual. Si son del ` +
    `área, agrégalos al catálogo; si no, hay que revisar de dónde salió el archivo.`
  );
}

/**
 * Descarta a quien no puede evaluarse, y avisa de cada motivo. Las exclusiones
 * silenciosas son la peor forma de perder gente en un tablero de plantilla.
 */
function filtrarPadron_(personas, opciones, diagnostico) {
  let porCategoria = 0;
  let sinFecha = 0;
  let futuras = 0;
  const excluidosSinFecha = [];

  const salida = personas.filter((persona) => {
    // Hallazgo 6 (bis): el PDF lo pide textualmente para CEDIS —«en categoría de
    // asignación solamente se contempla el rubro de Operación»—, así que aquí va
    // encendido. Para Cobranza no lo dice y allá queda apagado.
    if (opciones.soloOperacion && textoClave_(persona.categoria).indexOf('OPERACION') !== 0) {
      porCategoria += 1;
      return false;
    }

    // `antiguedad` es la que decide qué cursos aplican. Por omisión es la del
    // puesto: un puesto trae cursos obligatorios al tomarlo.
    persona.antiguedad = opciones.baseAntiguedad === 'EMPRESA'
      ? persona.diasLaborados
      : persona.diasEnPuesto;

    if (persona.antiguedad === null || persona.antiguedad === undefined) {
      sinFecha += 1;
      if (opciones.sinFechaContratacion === 'EXCLUIR') {
        // Se guarda quién es, no solo cuántos son: es lo que permite
        // contestar "¿por qué esta persona no sale?" sin adivinar. Ver
        // personasSinFecha() en 40_Proceso.gs.
        excluidosSinFecha.push({
          colaborador: persona.colaborador,
          persona: persona.persona,
          nombre: persona.nombre,
          puesto: persona.puesto,
          departamento: persona.departamento,
          centro: persona.centro,
          region: persona.region,
          origenFecha: persona.origenFecha,
          origenFechaPuesto: persona.origenFechaPuesto,
        });
        return false;
      }
      // ANTIGUEDAD_CERO deja a la persona en el padrón sin cursos de antigüedad;
      // TODOS le aplica el plan completo.
      persona.antiguedad = opciones.sinFechaContratacion === 'TODOS' ? Infinity : 0;
      persona.antiguedadEstimada = true;
      return true;
    }

    // Una fecha de referencia posterior al corte es un dato inconsistente
    // (o una promoción ya capturada a futuro): no se puede evaluar todavía.
    if (persona.antiguedad < 0) {
      futuras += 1;
      return false;
    }
    return true;
  });

  diagnostico.conteos.excluidosPorCategoria = porCategoria;
  diagnostico.conteos.sinFechaDeContratacion = sinFecha;
  diagnostico.conteos.fechaPosteriorAlCorte = futuras;
  diagnostico.personasSinFecha = excluidosSinFecha;

  if (sinFecha) {
    const cual = opciones.baseAntiguedad === 'EMPRESA' ? 'de contratación' : 'de asignación de puesto';
    diagnostico.avisos.push(
      `${sinFecha} persona(s) del padrón no tienen fecha ${cual} en ninguna de las tres fuentes ` +
      `(Detalle Colaborador, finalizaciones, contratación) (${opciones.sinFechaContratacion}). ` +
      `Revisa "origenFechaDePuesto" en los conteos: si "detalle" es alto y solo creció "ninguno", ` +
      `son casi siempre altas o cambios de puesto recientes sin cursos registrados todavía — no ` +
      `hace falta acción. Si "detalle" cayó de golpe comparado con corridas anteriores, la columna ` +
      `de fecha de puesto probablemente cambió de nombre en el archivo de origen; no basta con que ` +
      `el Detalle esté "al día", también hay que encontrar a la persona en él (por número de ` +
      `persona, por el puente de las finalizaciones, o por nombre único). Corre "Listar personas ` +
      `sin fecha (diagnóstico)" desde el menú ${CONFIG.nombreReporte} de Catálogos para ver ` +
      `quiénes son, uno por uno.`
    );
  }
  return salida;
}


/* =================================================================== *
 *  Finalizaciones
 * =================================================================== */

/**
 * Índice de lo que cada quien completó, por los dos identificadores.
 *
 * Hallazgo 6: los cortes parciales se traslapan y el proceso anterior contaba
 * cada repetición, inflando los totales un 31%. Aquí una persona+curso vale
 * una, salvo que se pida el comportamiento viejo.
 */
function indiceFinalizaciones_(filas, plan, opciones, diagnostico) {
  const indice = {};
  const cursosVistos = {};
  let filasUsadas = 0;

  (filas || []).forEach((fila) => {
    const cursoClave = textoClave_(fila.curso);
    if (!cursoClave) return;
    cursosVistos[cursoClave] = true;

    // Hallazgo 2: el cruce es por nombre normalizado, no literal. Tres de los
    // cursos que salían en 0% eran puro acento y mayúscula.
    const completo = esAfirmativo_(fila.completo);
    filasUsadas += 1;

    // Los dos identificadores, pero sin repetir: en la gente que todavía carga
    // el número viejo, persona y colaborador son el mismo valor, y contar la
    // fila dos veces duplicaría las repeticiones.
    const ids = [String(fila.persona || '').trim()];
    const colaborador = String(fila.colaborador || '').trim();
    if (colaborador && colaborador !== ids[0]) ids.push(colaborador);

    ids.forEach((id) => {
      if (!id) return;
      const llave = `${id}|${cursoClave}`;
      const previo = indice[llave];
      if (!previo) {
        indice[llave] = { completo, repeticiones: 1 };
        return;
      }
      previo.repeticiones += 1;
      if (completo) previo.completo = true;
    });
  });

  // Cursos del plan que nunca encuentran una sola finalización: o cambiaron de
  // nombre y les falta un alias, o se dejaron de impartir.
  const huerfanos = [];
  Object.keys(plan).forEach((puesto) => {
    plan[puesto].forEach((regla) => {
      const buscado = textoClave_(regla.cursoBuscado);
      if (!cursosVistos[buscado] && huerfanos.indexOf(regla.curso) === -1) {
        huerfanos.push(regla.curso);
      }
    });
  });
  huerfanos.forEach((curso) => {
    diagnostico.avisos.push(
      `El curso "${curso}" no aparece ni una vez en las finalizaciones: saldrá con 0% de avance. ` +
      `Si cambió de nombre, agrégalo a AliasCursos.`
    );
  });

  diagnostico.conteos.finalizacionesLeidas = (filas || []).length;
  diagnostico.conteos.finalizacionesUsadas = filasUsadas;
  diagnostico.conteos.cursosEnFinalizaciones = Object.keys(cursosVistos).length;
  diagnostico.conteos.cursosDelPlanSinFuente = huerfanos.length;
  diagnostico.cursosSinFuente = huerfanos;
  return indice;
}

function esAfirmativo_(valor) {
  const texto = textoClave_(valor);
  return texto === 'SI' || texto === 'S' || texto === 'TRUE' || texto === '1';
}


/* =================================================================== *
 *  Acumulación
 * =================================================================== */

/**
 * Recorre persona por persona acumulando en los agregados, sin materializar la
 * tabla de asignaciones. Devuelve las siete tablas del corte, ya como filas
 * posicionales del esquema.
 */
function acumular_(personas, plan, finalizaciones, opciones, diagnostico) {
  const reporte = CONFIG.reporte;
  const periodo = opciones.periodo;
  const corte = opciones.fechaCorte;

  const porCurso = {};
  const porCentro = {};
  const porRegion = {};
  const porFiltro = {};
  const colaboradores = [];

  let totalAsignados = 0;
  let totalCompletados = 0;
  let sinPlan = 0;
  const sospechososImpresion = [];

  personas.forEach((persona) => {
    const reglas = plan[persona.puestoClave] || [];
    if (!reglas.length) sinPlan += 1;

    let asignados = 0;
    let completados = 0;
    const pendientes = [];

    reglas.forEach((regla) => {
      if (!reglaAplica_(regla, persona, sospechososImpresion)) return;
      if (persona.antiguedad < regla.diasMinimos) return;

      const marca = regla.sinFuente
        ? null
        : (finalizaciones[`${persona.persona}|${textoClave_(regla.cursoBuscado)}`] ||
           finalizaciones[`${persona.colaborador}|${textoClave_(regla.cursoBuscado)}`]);

      const veces = (opciones.deduplicar || !marca) ? 1 : marca.repeticiones;
      const hechos = marca && marca.completo ? veces : 0;

      asignados += veces;
      completados += hechos;
      if (!hechos) pendientes.push(regla.curso);

      sumar_(porCurso, regla.cursoClave, {
        curso: regla.curso, iniciativa: regla.iniciativa, agrupacion: regla.agrupacion,
      }, veces, hechos);

      sumar_(porCentro, persona.centro, {
        region: persona.region, centro: persona.centro,
        nomenclatura: persona.nomenclatura, tipoCentro: persona.tipoCentro,
      }, veces, hechos, persona.colaborador);

      sumar_(porRegion, persona.region, { region: persona.region }, veces, hechos, persona.colaborador);

      sumar_(porFiltro, `${persona.puestoClave}|${persona.region}|${regla.cursoClave}`, {
        puesto: persona.puesto, region: persona.region,
        cursoClave: regla.cursoClave, curso: regla.curso, iniciativa: regla.iniciativa,
      }, veces, hechos);
    });

    totalAsignados += asignados;
    totalCompletados += completados;

    colaboradores.push([
      reporte, periodo, corte,
      persona.persona, persona.colaborador, persona.nombre,
      persona.fechaContratacion, persona.fechaPuesto,
      persona.codigoPuesto, persona.puesto, planDe_(reglas), persona.departamento,
      persona.region, persona.centro, persona.nomenclatura,
      numeroOVacio_(persona.diasLaborados), numeroOVacio_(persona.diasEnPuesto),
      persona.diasLaborados !== null && persona.diasLaborados < opciones.nuevoIngresoDias,
      asignados, completados, asignados - completados,
      avance_(completados, asignados),
      pendientes.join(' | '),
    ]);
  });

  diagnostico.conteos.personasSinPlan = sinPlan;
  diagnostico.conteos.excepcionImpresionAplicada = sospechososImpresion.length;

  return armarTablas_(
    { colaboradores, porCurso, porCentro, porRegion, porFiltro },
    { totalAsignados, totalCompletados, personas: personas.length },
    opciones, diagnostico
  );
}

/**
 * ¿Esta regla le toca a esta persona por centro?
 *
 * Hallazgos 4 y 9 juntos, que son la misma columna mal leída: una inventa una
 * restricción que no existe, la otra ignora la que sí.
 */
function reglaAplica_(regla, persona, sospechosos) {
  // Las listas del plan hablan de familias de centro de costo (045, 153, 073),
  // no del departamento donde está la persona. Se comparan contra `centroCosto`,
  // que es el número suelto, no contra `centro`, que es el CEDIS físico.
  const suyo = persona.centroCosto;

  if (regla.centrosExcluidos && regla.centrosExcluidos.length &&
      regla.centrosExcluidos.indexOf(suyo) !== -1) {
    sospechosos.push({ colaborador: persona.colaborador, centro: persona.centro, curso: regla.curso });
    return false;
  }
  if (!regla.centrosPermitidos) return true;
  return regla.centrosPermitidos.indexOf(suyo) !== -1;
}

function planDe_(reglas) {
  const familias = {};
  reglas.forEach((r) => { familias[r.familia] = true; });
  const lista = Object.keys(familias);
  if (lista.length > 1) return 'Ambos';
  return lista[0] || '';
}

function sumar_(mapa, llave, atributos, asignados, completados, persona) {
  if (!llave) return;
  let fila = mapa[llave];
  if (!fila) {
    fila = mapa[llave] = Object.assign(
      { asignados: 0, completados: 0, personas: {}, variantes: {} }, atributos);
  } else {
    // Un mismo centro puede juntar gente con atributos distintos: 76 de los 745
    // departamentos de CEDIS abarcan más de un centro de costo. Publicar el
    // valor de la primera persona como si fuera el de todas es mentir en voz
    // baja, así que se anota que hubo varios.
    Object.keys(atributos).forEach((campo) => {
      const valor = atributos[campo];
      if (valor === '' || valor === undefined || valor === fila[campo]) return;
      if (!fila.variantes[campo]) fila.variantes[campo] = {};
      fila.variantes[campo][fila[campo]] = true;
      fila.variantes[campo][valor] = true;
    });
  }
  fila.asignados += asignados;
  fila.completados += completados;
  if (persona) fila.personas[persona] = true;
}


/* =================================================================== *
 *  Tablas del corte
 * =================================================================== */

function armarTablas_(datos, totales, opciones, diagnostico) {
  const reporte = CONFIG.reporte;
  const periodo = opciones.periodo;
  const corte = opciones.fechaCorte;
  const pendientes = totales.totalAsignados - totales.totalCompletados;

  const region = Object.keys(datos.porRegion).sort().map((llave) => {
    const f = datos.porRegion[llave];
    return [reporte, periodo, corte, f.region, Object.keys(f.personas).length,
      f.asignados, f.completados, f.asignados - f.completados,
      avance_(f.completados, f.asignados)];
  });

  let centrosMezclados = 0;
  const centro = Object.keys(datos.porCentro).sort().map((llave) => {
    const f = datos.porCentro[llave];
    if (f.variantes.nomenclatura || f.variantes.region) centrosMezclados += 1;
    return [reporte, periodo, corte, unoODiverso_(f, 'region'), f.centro,
      unoODiverso_(f, 'nomenclatura'), unoODiverso_(f, 'tipoCentro'),
      Object.keys(f.personas).length, f.asignados, f.completados, f.asignados - f.completados,
      avance_(f.completados, f.asignados)];
  });
  diagnostico.conteos.centrosConAtributosMezclados = centrosMezclados;

  const curso = Object.keys(datos.porCurso).sort().map((llave) => {
    const f = datos.porCurso[llave];
    return [reporte, periodo, corte, llave, f.curso, f.iniciativa, f.agrupacion,
      f.asignados, f.completados, f.asignados - f.completados,
      avance_(f.completados, f.asignados)];
  });

  const filtroCurso = Object.keys(datos.porFiltro).sort().map((llave) => {
    const f = datos.porFiltro[llave];
    return [reporte, periodo, f.puesto, f.region, f.cursoClave, f.curso, f.iniciativa,
      f.asignados, f.completados, f.asignados - f.completados,
      avance_(f.completados, f.asignados)];
  });

  const resumen = [[reporte, periodo, corte, datos.colaboradores.length,
    totales.totalAsignados, totales.totalCompletados, pendientes,
    avance_(totales.totalCompletados, totales.totalAsignados)]];

  // El control algebraico de la sección 7 del cuaderno, hecho dato: si estas
  // sumas no cuadran, la publicación se rechaza antes de escribir nada.
  const iAsignadosColaborador = columna_(ESQUEMA_CORTE, 'Colaborador', 'cursos_asignados');
  const iAsignadosCurso = columna_(ESQUEMA_CORTE, 'Curso', 'asignados');
  const sumaColaborador = datos.colaboradores.reduce((t, f) => t + numero_(f[iAsignadosColaborador]), 0);
  const sumaCurso = curso.reduce((t, f) => t + numero_(f[iAsignadosCurso]), 0);
  const cuadra = sumaColaborador === totales.totalAsignados && sumaCurso === totales.totalAsignados;

  const control = [[reporte, periodo, corte,
    new Date().toISOString(), etiquetaPeriodo_(periodo),
    datos.colaboradores.length, totales.personas,
    totales.totalAsignados, totales.totalCompletados, pendientes, cuadra]];

  if (!cuadra) {
    diagnostico.avisos.push(
      `Control algebraico: Colaborador suma ${sumaColaborador}, Curso suma ${sumaCurso} y el ` +
      `Resumen dice ${totales.totalAsignados}.`
    );
  }

  return {
    hojas: {
      Resumen: resumen,
      Region: region,
      Centro: centro,
      Curso: curso,
      Colaborador: datos.colaboradores,
      FiltroCurso: filtroCurso,
      Control: control,
    },
    diagnostico,
  };
}

/**
 * El valor de un atributo del centro, o "varios (n)" cuando su gente no coincide.
 *
 * El centro de CEDIS es el departamento —el CEDIS físico— y no es 1 a 1 con el
 * centro de costo: "07 EMBARQUES TCMC 03" junta gente de 075, 094 y 441. Decir
 * que ese centro "es" el 094 solo porque esa fue la primera persona leída es
 * falso, y es el tipo de dato que nadie vuelve a cuestionar una vez publicado.
 */
function unoODiverso_(fila, campo) {
  const variantes = fila.variantes && fila.variantes[campo];
  if (!variantes) return fila[campo];
  const cuantas = Object.keys(variantes).length;
  return cuantas > 1 ? `varios (${cuantas})` : fila[campo];
}

/** Un número que no sea finito se publica vacío, no como "Infinity". */
function numeroOVacio_(valor) {
  return (valor === null || valor === undefined || !Number.isFinite(valor)) ? '' : valor;
}

function soloDigitos_(valor) {
  const m = String(valor === null || valor === undefined ? '' : valor).match(/\d+/);
  return m ? String(Number(m[0])) : '';
}
