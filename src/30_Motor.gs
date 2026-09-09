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

  const catalogoCentros = indiceCentros_(fuentes.centros, opciones, diagnostico);
  const plan = construirPlan_(fuentes.planes, opciones, diagnostico);
  const personas = resolverPadron_(fuentes, catalogoCentros, plan, opciones, diagnostico);
  const finalizaciones = indiceFinalizaciones_(fuentes.finalizaciones, plan, opciones, diagnostico);

  return acumular_(personas, plan, finalizaciones, opciones, diagnostico);
}


/* =================================================================== *
 *  Catálogo de centros
 * =================================================================== */

function indiceCentros_(centros, opciones, diagnostico) {
  const indice = {};
  const fueraDeCatalogo = {};

  (centros || []).forEach((fila) => {
    const centro = soloDigitos_(fila.centro);
    if (!centro) return;

    const cruda = String(fila.region || '').trim();
    const region = opciones.regionOficial(cruda);
    if (!region && cruda) {
      fueraDeCatalogo[cruda] = (fueraDeCatalogo[cruda] || 0) + 1;
    }

    indice[centro] = {
      centro,
      region: region || SIN_REGION,
      regionCruda: cruda,
      nomenclatura: String(fila.nomenclatura || '').trim(),
      tipoCobranza: String(fila.tipoCobranza || '').trim(),
    };
  });

  // Hallazgo 7: publicarlas tal cual metería regiones fantasma al ranking, con
  // un colaborador cada una. Se avisa para que alguien corrija la fuente.
  Object.keys(fueraDeCatalogo).forEach((cruda) => {
    diagnostico.avisos.push(
      `Región "${cruda}" no está entre las oficiales ni mapeada (${fueraDeCatalogo[cruda]} ` +
      `centro(s)). Agrégala a MapaRegiones o corrige CENTROS-TIPOCENTROS.`
    );
  });

  diagnostico.conteos.centrosEnCatalogo = Object.keys(indice).length;
  return indice;
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

    (plan.puestosEspecificos || []).forEach((puesto) => {
      const puestoClave = textoClave_(puesto.puesto);
      if (!puestoClave) return;

      const alcance = alcanceDeCentros_(puesto.centrosDeCosto, opciones);
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

    // Hallazgo 3 (bis): "Formación de Conductores Cobranza 2026" no es un curso,
    // es el nombre del paquete de los otros tres, que ya vienen listados aparte.
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

    salida.push({
      curso: nombre,
      cursoClave: claveCurso_(nombre),
      cursoBuscado: regla.nombre || nombre,
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
 * Hallazgo 9: en los PDT, "Centros de costos" dice "007 Cobranzas" — la familia
 * de centro de costo del área, no un centro. Compararla contra números como
 * 500101 descarta el 100% de las asignaciones específicas, y por eso la
 * especialización de conductores hoy no le llega a nadie.
 *
 * Devuelve null cuando la regla vale para toda Cobranza, o la lista de centros
 * cuando de verdad nombra centros.
 */
function alcanceDeCentros_(centrosDeCosto, opciones) {
  const texto = String(centrosDeCosto || '').trim();
  if (!texto) return null;
  if (opciones.esFamiliaDeCentros(texto)) return null;

  const centros = texto.split(/[,;\n/]+/)
    .map((parte) => soloDigitos_(parte))
    .filter(Boolean);
  return centros.length ? centros : null;
}

/**
 * Hallazgo 4: la lista de centros exceptuados sí viene en el archivo, en la
 * columna "Centros que no aplican" que el cuaderno ni siquiera lee. Se combina
 * con el catálogo, que es el que manda sobre a qué puestos aplica (el PDF dice
 * 743 y 721; el PDT lista un tercer puesto en la misma pestaña).
 */
function centrosExcluidos_(puesto, puestoClave, opciones) {
  const delArchivo = (puesto.centrosQueNoAplican || [])
    .map((c) => soloDigitos_(c))
    .filter(Boolean);

  const delCatalogo = opciones.centrosExceptuados(puesto.id, puestoClave);
  const todos = {};
  delArchivo.concat(delCatalogo).forEach((c) => { todos[c] = true; });
  return Object.keys(todos);
}

/** Agrupa las reglas por puesto y quita el mismo curso repetido en dos planes. */
function indexarPlan_(reglas, diagnostico) {
  const porPuesto = {};
  const vistos = {};
  let duplicados = 0;

  reglas.forEach((regla) => {
    const llave = `${regla.puestoClave}|${regla.cursoClave}`;
    // Un puesto que estuviera en los dos planes recibiría el mismo curso dos
    // veces. Los dos planes se suman (regla 2.2), pero un curso repetido sigue
    // siendo un solo curso: la persona lo toma una vez.
    if (vistos[llave]) { duplicados += 1; return; }
    vistos[llave] = true;

    if (!porPuesto[regla.puestoClave]) porPuesto[regla.puestoClave] = [];
    porPuesto[regla.puestoClave].push(regla);
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
 * Hallazgo 5: el universo es la Planta por Posiciones, el censo del área, no la
 * nómina completa filtrada por nombre de puesto —que arrastra gente de otras
 * áreas con el mismo nombre de puesto.
 *
 * Hallazgo 1: la Planta identifica con número de trabajador (8 dígitos) y el
 * Detalle con número de persona (8 o 9). Son sistemas distintos. Los CSV de
 * finalizaciones traen los dos y sirven de puente.
 */
function resolverPadron_(fuentes, catalogoCentros, plan, opciones, diagnostico) {
  const puente = construirPuente_(fuentes.puente, diagnostico);
  const porPersona = {};
  (fuentes.detalle || []).forEach((fila) => {
    const id = String(fila.numeroPersona || '').trim();
    if (id && !porPersona[id]) porPersona[id] = fila;
  });
  const porNombre = indicePorNombreUnico_(fuentes.detalle);

  const base = opciones.padron === 'DETALLE'
    ? padronDesdeDetalle_(fuentes, plan)
    : (fuentes.padron || []);

  const origenes = { id: 0, puente: 0, nombre: 0, finalizaciones: 0, ninguno: 0 };
  const origenPuesto = { detalle: 0, finalizaciones: 0, contratacion: 0, ninguno: 0 };
  const personas = [];
  const vistos = {};

  base.forEach((fila) => {
    const colaborador = String(fila.numeroColaborador || '').trim();
    if (!colaborador || vistos[colaborador]) return;
    vistos[colaborador] = true;

    // Cascada del identificador, en orden de confianza.
    let persona = colaborador;
    let detalle = porPersona[colaborador];
    let origen = detalle ? 'id' : '';

    if (!detalle && puente.aPersona[colaborador]) {
      persona = puente.aPersona[colaborador];
      detalle = porPersona[persona];
      if (detalle) origen = 'puente';
    }

    const nombreClave = textoClave_(fila.nombre);
    if (!detalle && porNombre[nombreClave]) {
      detalle = porNombre[nombreClave];
      persona = String(detalle.numeroPersona || colaborador).trim();
      origen = 'nombre';
    }

    let fechaContratacion = detalle ? detalle.fechaContratacion : null;
    if (!fechaContratacion && puente.fecha[colaborador]) {
      fechaContratacion = puente.fecha[colaborador];
      if (!origen) origen = 'finalizaciones';
    }
    if (!origen) origen = 'ninguno';
    origenes[origen] += 1;

    // La fecha que decide la vigencia: cuándo tomó ESTE puesto. Tiene su propia
    // cascada porque las finalizaciones también la traen, y ahí coinciden con el
    // Detalle en el 99.4% de los casos en que las dos fechas difieren.
    let fechaPuesto = detalle ? detalle.fechaPuesto : null;
    let dePuesto = fechaPuesto ? 'detalle' : '';
    if (!fechaPuesto && puente.fechaPuesto[colaborador]) {
      fechaPuesto = puente.fechaPuesto[colaborador];
      dePuesto = 'finalizaciones';
    }
    // Último recurso: quien nunca cambió de puesto lo tomó al entrar. Es cierto
    // para el 43% de la nómina, y para el resto subestima la antigüedad en el
    // puesto, que es el lado conservador (asigna de más, no de menos).
    if (!fechaPuesto && fechaContratacion) {
      fechaPuesto = fechaContratacion;
      dePuesto = 'contratacion';
    }
    origenPuesto[dePuesto || 'ninguno'] += 1;

    const centro = soloDigitos_(fila.centro);
    const info = catalogoCentros[centro] || {};
    const dias = fechaContratacion ? diasEntre_(opciones.fechaCorte, fechaContratacion) : null;
    const diasPuesto = fechaPuesto ? diasEntre_(opciones.fechaCorte, fechaPuesto) : null;

    personas.push({
      colaborador,
      persona,
      nombre: String(fila.nombre || '').trim(),
      codigoPuesto: String(fila.codigoPuesto || '').trim(),
      puesto: String(fila.puesto || '').trim(),
      puestoClave: textoClave_(fila.puesto),
      departamento: String(fila.departamento || '').trim(),
      categoria: String(fila.categoria || '').trim(),
      centro: centro || SIN_CENTRO,
      region: info.region || SIN_REGION,
      nomenclatura: info.nomenclatura || '',
      tipoCobranza: info.tipoCobranza || '',
      fechaContratacion: fechaContratacion ? aTextoFecha_(fechaContratacion) : '',
      fechaPuesto: fechaPuesto ? aTextoFecha_(fechaPuesto) : '',
      diasLaborados: dias,
      diasEnPuesto: diasPuesto,
      origenFecha: origen,
      origenFechaPuesto: dePuesto || 'ninguno',
    });
  });

  const filtradas = filtrarPadron_(personas, opciones, diagnostico);
  diagnostico.conteos.padronLeido = base.length;
  diagnostico.conteos.padronPublicado = filtradas.length;
  diagnostico.conteos.origenDeLaFecha = origenes;
  diagnostico.conteos.origenFechaDePuesto = origenPuesto;
  return filtradas;
}

/** El puente persona ↔ colaborador que sale de los propios CSV. */
function construirPuente_(filas, diagnostico) {
  const aPersona = {};
  const fecha = {};
  const fechaPuesto = {};
  let conflictos = 0;

  (filas || []).forEach((fila) => {
    const persona = String(fila.persona || '').trim();
    const colaborador = String(fila.colaborador || '').trim();
    if (!persona || !colaborador) return;

    if (aPersona[colaborador] && aPersona[colaborador] !== persona) {
      conflictos += 1;
      return;
    }
    aPersona[colaborador] = persona;
    if (fila.fechaContratacion && !fecha[colaborador]) {
      fecha[colaborador] = fila.fechaContratacion;
    }
    if (fila.fechaPuesto && !fechaPuesto[colaborador]) {
      fechaPuesto[colaborador] = fila.fechaPuesto;
    }
  });

  diagnostico.conteos.puenteIdentificadores = Object.keys(aPersona).length;
  if (conflictos) {
    diagnostico.avisos.push(
      `${conflictos} número(s) de colaborador apuntan a más de un número de persona en las ` +
      `finalizaciones; se ignoran esos pares.`
    );
  }
  return { aPersona, fecha, fechaPuesto };
}

function indicePorNombreUnico_(detalle) {
  const cuenta = {};
  (detalle || []).forEach((fila) => {
    const clave = textoClave_(fila.nombre);
    if (!clave) return;
    if (!cuenta[clave]) cuenta[clave] = [];
    if (cuenta[clave].length < 2) cuenta[clave].push(fila);
  });
  const indice = {};
  Object.keys(cuenta).forEach((clave) => {
    if (cuenta[clave].length === 1) indice[clave] = cuenta[clave][0];
  });
  return indice;
}

/**
 * El padrón alterno, para PADRON=DETALLE: la nómina completa filtrada a los
 * puestos que aparecen en algún plan, que es como decidía el cuaderno.
 *
 * El filtro por puesto es lo único que acota las 122,783 filas de la nómina, y
 * por eso arrastra gente de otras áreas que comparte nombre de puesto — el
 * hallazgo 5. Se conserva para poder comparar contra el proceso anterior.
 */
function padronDesdeDetalle_(fuentes, plan) {
  return (fuentes.detalle || [])
    .filter((fila) => plan[textoClave_(fila.puesto)])
    .map((fila) => ({
      numeroColaborador: String(fila.numeroPersona || '').trim(),
      fechaPuesto: fila.fechaPuesto,
      nombre: fila.nombre,
      codigoPuesto: fila.codigoPuesto,
      puesto: fila.puesto,
      departamento: fila.departamento,
      categoria: fila.categoria,
      centro: fila.centro || '',
    }));
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
    // Hallazgo 6 (bis): el PDF pide el filtro para CEDIS y no dice nada de
    // Cobranza; queda apagado por omisión.
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
      `sin fecha (diagnóstico)" desde el menú Cobranza de Catálogos para ver quiénes son, uno por uno.`
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
        nomenclatura: persona.nomenclatura, tipoCobranza: persona.tipoCobranza,
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
  if (regla.centrosExcluidos && regla.centrosExcluidos.length &&
      regla.centrosExcluidos.indexOf(persona.centro) !== -1) {
    sospechosos.push({ colaborador: persona.colaborador, centro: persona.centro, curso: regla.curso });
    return false;
  }
  if (!regla.centrosPermitidos) return true;
  return regla.centrosPermitidos.indexOf(persona.centro) !== -1;
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
    fila = mapa[llave] = Object.assign({ asignados: 0, completados: 0, personas: {} }, atributos);
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

  const centro = Object.keys(datos.porCentro).sort().map((llave) => {
    const f = datos.porCentro[llave];
    return [reporte, periodo, corte, f.region, f.centro, f.nomenclatura, f.tipoCobranza,
      Object.keys(f.personas).length, f.asignados, f.completados, f.asignados - f.completados,
      avance_(f.completados, f.asignados)];
  });

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

/** Un número que no sea finito se publica vacío, no como "Infinity". */
function numeroOVacio_(valor) {
  return (valor === null || valor === undefined || !Number.isFinite(valor)) ? '' : valor;
}

function soloDigitos_(valor) {
  const m = String(valor === null || valor === undefined ? '' : valor).match(/\d+/);
  return m ? String(Number(m[0])) : '';
}
