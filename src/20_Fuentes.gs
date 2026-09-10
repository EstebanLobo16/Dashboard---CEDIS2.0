/**
 * Ingesta: de los archivos crudos de Drive a las estructuras que consume el motor.
 *
 * Todo lo que toca Drive y Sheets vive aquí. El motor (30_Motor.gs) no sabe de
 * dónde salieron los datos, y por eso se puede correr fuera de Apps Script.
 *
 * Dos límites mandan sobre el diseño:
 *
 *   · Apps Script no lee .xlsx. Hay que convertir con la API de Drive.
 *   · Un CSV grande no se puede leer como texto: `getDataAsString()` se queda
 *     sin memoria. También se convierte a hoja y se lee por rangos.
 *
 * Las conversiones van a una carpeta de trabajo y se borran al terminar. Si una
 * ejecución se corta a la mitad, la siguiente reutiliza lo ya convertido en vez
 * de volver a hacerlo: convertir es lo caro.
 *
 * CEDIS no tiene Planta por Posiciones ni catálogo de centros — las dos cosas de
 * las que colgaba media ingesta de Cobranza. Su reporte de asignaciones trae la
 * región, el centro de costo, el departamento y las dos fechas de cada persona,
 * así que **el propio reporte es el censo del área**. De ahí salen las cuatro
 * fuentes de aquí en vez de las cinco de Cobranza, y de ahí que se hayan ido
 * `pestanaMasReciente_()` y `filaDelEncabezado_()`, que existían solo para la
 * Planta. Ver docs/06-plan-cedis.md §3.1.
 *
 * Los dos CSV los produce `pipeline/aligerar_cedis.py` a partir de los
 * archivos que entrega el área: 200 MB en tres archivos de 25 columnas quedan en
 * 33 MB en dos de 11 y 5. No es una comodidad — un solo archivo de 90 MB queda
 * pegado al límite de conversión de Drive.
 */

const FILAS_POR_BLOQUE = 20000;


/* =================================================================== *
 *  Localizar
 * =================================================================== */

/** Los archivos de la carpeta de crudos que combinan con un patrón del catálogo. */
function buscarArchivos_(carpeta, patron) {
  const expresion = patronAExpresion_(patron);
  const encontrados = [];
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    if (expresion.test(archivo.getName())) encontrados.push(archivo);
  }
  // El más reciente primero: si el área dejó dos versiones del mismo reporte,
  // la buena es la última que subió.
  encontrados.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());
  return encontrados;
}

/** Convierte un patrón estilo glob del catálogo en una expresión regular. */
function patronAExpresion_(patron) {
  const escapado = String(patron)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escapado}$`, 'i');
}

function archivoDeFuente_(carpeta, clave, obligatorio) {
  const definicion = fuente_(clave);
  const encontrados = buscarArchivos_(carpeta, definicion.patron);

  if (!encontrados.length) {
    if (obligatorio === false || textoClave_(definicion.obligatorio) === 'NO') return null;
    throw new Error(
      `No encontré ningún archivo que combine con "${definicion.patron}" en la carpeta de datos ` +
      `crudos. Es la fuente "${clave}". Revisa el nombre del archivo o el patrón en el catálogo ` +
      `de Fuentes.`
    );
  }
  if (encontrados.length > 1) {
    bitacora_('ingesta', '', clave, encontrados.length,
      `Varios archivos combinan con "${definicion.patron}"; se usa el más reciente: ` +
      `${encontrados[0].getName()}`);
  }
  return encontrados[0];
}


/* =================================================================== *
 *  Convertir
 * =================================================================== */

/**
 * Deja cualquier archivo (.xlsx o .csv) como hoja de cálculo y devuelve su id.
 * Reutiliza la conversión si ya existe en la carpeta de trabajo.
 *
 * La reutilización es incondicional a propósito. Convertir es, por mucho, lo
 * más caro del proceso: reconvertir por cuenta propia —aunque sea por una
 * buena razón— hace que cada corrida vuelva a pagar esos minutos y la deja sin
 * tiempo para llegar al final, sin ningún error que lo explique. Solo se
 * queda "pensando".
 *
 * El riesgo que eso deja abierto es real: si alguien reemplaza un archivo de
 * origen con el MISMO nombre, la conversión anterior seguiría usándose en
 * silencio. Por eso, cuando el original es más nuevo que su conversión, se
 * avisa en el registro de ejecución y se nombra el remedio —
 * limpiarConversiones()— en vez de decidirlo aquí.
 */
function comoHojaDeCalculo_(archivo, carpetaTrabajo) {
  if (archivo.getMimeType() === MimeType.GOOGLE_SHEETS) return archivo.getId();

  // Drive le quita la extensión al archivo cuando lo convierte a hoja de
  // cálculo: una copia pedida como "~algo.xlsx" queda guardada como "~algo".
  // Buscarla solo por el nombre con extensión no la encuentra NUNCA, así que
  // cada corrida volvía a convertir —lo más caro del proceso— y dejaba otra
  // copia en la carpeta. De ahí las conversiones duplicadas.
  //
  // Se busca con y sin extensión (para reconocer también las copias que dejaron
  // las versiones anteriores) y se crea siempre sin ella, que es la forma que
  // Drive respeta tal cual.
  const conExtension = `~${archivo.getName()}`;
  const nombre = conExtension.replace(/\.[^./]+$/, '');
  const candidatos = nombre === conExtension ? [nombre] : [nombre, conExtension];

  for (let i = 0; i < candidatos.length; i += 1) {
    const existentes = carpetaTrabajo.getFilesByName(candidatos[i]);
    while (existentes.hasNext()) {
      const copia = existentes.next();
      // Una copia en la papelera no sirve como caché, pero el iterador la puede
      // devolver: si se usara, se leería un archivo que el usuario ya borró.
      if (copia.isTrashed()) continue;

      if (copia.getLastUpdated().getTime() < archivo.getLastUpdated().getTime()) {
        console.log(
          `AVISO: "${archivo.getName()}" es más nuevo que su conversión guardada. Se está ` +
          `usando la conversión anterior. Corre limpiarConversiones() y vuelve a procesar ` +
          `para que se tome el archivo nuevo.`
        );
      }
      return copia.getId();
    }
  }

  try {
    const convertido = Drive.Files.copy(
      { title: nombre, parents: [{ id: carpetaTrabajo.getId() }] },
      archivo.getId(),
      { convert: true }
    );
    return convertido.id;
  } catch (error) {
    throw new Error(
      `No se pudo convertir "${archivo.getName()}" a hoja de cálculo: ${error.message}. ` +
      `Si el archivo pesa más de 100 MB, pídelo con menos columnas o córtalo antes ` +
      `(ver pipeline/aligerar_cedis.py).`
    );
  }
}

/** Borra las conversiones temporales. Se llama al cerrar un corte. */
function limpiarTrabajo_(carpetaTrabajo) {
  let borrados = 0;
  const archivos = carpetaTrabajo.getFiles();
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    if (archivo.getName().indexOf('~') === 0) { archivo.setTrashed(true); borrados += 1; }
  }
  return borrados;
}


/* =================================================================== *
 *  Leer
 * =================================================================== */

/**
 * Lee una pestaña por bloques y devuelve objetos con las columnas pedidas.
 *
 * `columnas` mapea el nombre que trae el archivo al nombre que quiere el motor.
 * La llave puede traer varios nombres separados por "|", y gana el primero que
 * exista: los archivos de origen cambian de nombre de columna sin avisar —el
 * Detalle Colaborador pasó de "Número de persona" a "NÚMERO_PERSONA" de un mes a
 * otro— y esto deja que las dos versiones sigan funcionando.
 *
 * Los encabezados se comparan normalizados, así que un acento de más, un guion
 * bajo o un espacio al final no rompen nada. Eso es lo que sí rompía antes, con
 * la columna "Puesto " del plan gerencial.
 */
function leerPestana_(hojaId, nombrePestana, columnas, filaEncabezado, desplazamiento) {
  const hoja = SpreadsheetApp.openById(hojaId);
  const pestana = nombrePestana
    ? hoja.getSheetByName(nombrePestana)
    : hoja.getSheets()[0];

  if (!pestana) {
    throw new Error(`La hoja no tiene una pestaña "${nombrePestana}".`);
  }

  const ultimaFila = pestana.getLastRow();
  const ultimaColumna = pestana.getLastColumn();
  if (ultimaFila < 2) return [];

  const corrimiento = Number(desplazamiento) || 0;
  const inicio = (filaEncabezado || 1);
  // Los guiones bajos se tratan como espacios para que "NÚMERO_PERSONA" y
  // "Número de persona" caigan en la misma comparación.
  const encabezados = pestana.getRange(inicio, 1, 1, ultimaColumna).getValues()[0]
    .map((v) => textoClave_(String(v).replace(/_/g, ' ')));

  const indices = {};
  Object.keys(columnas).forEach((origen) => {
    const destino = columnas[origen];
    if (indices[destino] !== undefined) return;
    const alternativas = origen.split('|');
    for (let a = 0; a < alternativas.length; a += 1) {
      const i = encabezados.indexOf(textoClave_(alternativas[a].replace(/_/g, ' ')));
      if (i !== -1) { indices[destino] = i; return; }
    }
  });

  const filas = [];
  for (let fila = inicio + 1; fila <= ultimaFila; fila += FILAS_POR_BLOQUE) {
    const alto = Math.min(FILAS_POR_BLOQUE, ultimaFila - fila + 1);
    const bloque = pestana.getRange(fila, 1, alto, ultimaColumna).getValues();
    bloque.forEach((valores) => {
      if (!valores.some((v) => v !== '' && v !== null)) return;
      const objeto = {};
      Object.keys(indices).forEach((destino) => {
        objeto[destino] = normalizarCelda_(valores[indices[destino] + corrimiento]);
      });
      filas.push(objeto);
    });
  }
  return filas;
}

function normalizarCelda_(valor) {
  if (valor instanceof Date) return aTextoFecha_(valor);
  if (valor === null || valor === undefined) return '';
  return typeof valor === 'string' ? valor.trim() : valor;
}

/**
 * ¿La fila de encabezados está corrida respecto a los datos?
 *
 * En `PDT-gerencial-adaptado.xlsx`, pestaña `Cursos_asignados`, la fila 1 trae
 * doce encabezados pero los datos empiezan con una columna de numeración que el
 * encabezado no nombra. Todo queda recorrido un lugar:
 *
 *     encabezado   Tipo | Rango de meses | Curso   | Modalidad | … | Jefes y Coord.
 *     dato real       1 | Institucional  |   "0-1" | Te damos… | … | TEC-C-3-99
 *
 * Como `leerPestana_` mapea por nombre, sin esto leería **"0-1" como nombre del
 * curso** e "Institucional" como rango de meses. No truena: publica números que
 * se ven razonables y no lo son. Es la peor forma de fallar que tiene este
 * proceso, y por eso se detecta en vez de pedirle al área que arregle el archivo
 * cada mes.
 *
 * La prueba es barata y va en los dos sentidos: la columna que dice llamarse
 * `Curso` tiene que traer nombres de curso, no rangos; y si trae rangos, la de
 * junto tiene que traer los nombres. Si las dos cosas se cumplen, hay
 * corrimiento. Si solo se cumple una, no se toca nada y se avisa: es preferible
 * un aviso raro a corregir un archivo que estaba bien.
 *
 * Devuelve 0 o 1.
 */
function corrimientoDeEncabezado_(hojaId, nombrePestana, columnaAncla, diagnostico) {
  const hoja = SpreadsheetApp.openById(hojaId);
  const pestana = nombrePestana ? hoja.getSheetByName(nombrePestana) : hoja.getSheets()[0];
  if (!pestana) return 0;

  const ultimaFila = pestana.getLastRow();
  const ultimaColumna = pestana.getLastColumn();
  if (ultimaFila < 2 || ultimaColumna < 2) return 0;

  const alto = Math.min(12, ultimaFila - 1);
  const valores = pestana.getRange(1, 1, alto + 1, ultimaColumna).getValues();
  const encabezados = valores[0].map((v) => textoClave_(String(v).replace(/_/g, ' ')));
  const ancla = encabezados.indexOf(textoClave_(columnaAncla));
  if (ancla === -1 || ancla + 1 >= ultimaColumna) return 0;

  let enSuLugar = 0;
  let unaALaDerecha = 0;
  let filas = 0;
  for (let f = 1; f <= alto; f += 1) {
    const aqui = valores[f][ancla];
    const alLado = valores[f][ancla + 1];
    if (aqui === '' && alLado === '') continue;
    filas += 1;
    if (pareceNombreDeCurso_(aqui)) enSuLugar += 1;
    if (pareceRangoDeMeses_(aqui) && pareceNombreDeCurso_(alLado)) unaALaDerecha += 1;
  }
  if (!filas) return 0;

  if (unaALaDerecha > filas / 2 && enSuLugar === 0) {
    (diagnostico ? diagnostico.avisos : []).push(
      `La pestaña "${nombrePestana}" trae la fila de encabezados corrida una columna a la ` +
      `izquierda de los datos (${unaALaDerecha} de ${filas} filas). Se corrigió al leer. ` +
      `Pídele al área que quite la columna sin encabezado, o que le ponga uno.`
    );
    return 1;
  }

  if (unaALaDerecha && enSuLugar) {
    (diagnostico ? diagnostico.avisos : []).push(
      `La pestaña "${nombrePestana}" no se lee limpio: ${enSuLugar} fila(s) traen el curso ` +
      `en su columna y ${unaALaDerecha} lo traen una a la derecha. Se leyó SIN corregir. ` +
      `Revisa el archivo a mano antes de publicar este corte.`
    );
  }
  return 0;
}

/** Un rango de meses del plan: "0-1", "12", o la fecha en que Excel convirtió "3-6". */
function pareceRangoDeMeses_(valor) {
  if (valor instanceof Date) return true;
  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  if (!texto) return false;
  return /^\d+\s*-\s*\d+$/.test(texto) ||
    /^\d+(\.\d+)?$/.test(texto) ||
    /^\d{4}-\d{2}-\d{2}/.test(texto);
}

/** Un nombre de curso: texto con letras, y que no sea un rango. */
function pareceNombreDeCurso_(valor) {
  if (valor instanceof Date) return false;
  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  if (texto.length < 4) return false;
  if (pareceRangoDeMeses_(texto)) return false;
  return /[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3}/.test(texto);
}


/* =================================================================== *
 *  Armar las fuentes del motor
 * =================================================================== */

/**
 * Lee las cuatro fuentes y devuelve el objeto que consume calcularCorte_().
 * Es la parte lenta del proceso: convertir y leer 440 mil filas.
 *
 * El Detalle Colaborador es opcional y NO participa en ningún cruce: el padrón
 * de CEDIS ya trae las dos fechas de todas sus personas. Se lee, cuando está,
 * para poder contrastarlas y avisar si se separan — que es como se detecta que
 * una de las dos fuentes se quedó con el corte del mes pasado.
 */
function leerFuentes_(periodo, diagnostico) {
  const propiedades = PropertiesService.getScriptProperties();
  const crudos = DriveApp.getFolderById(propiedades.getProperty(CONFIG.props.carpetaCrudos));
  const trabajo = carpetaDeTrabajo_(propiedades);

  const padron = leerPadron_(crudos, trabajo, diagnostico);
  const finalizaciones = leerFinalizaciones_(crudos, trabajo, diagnostico);
  const detalle = leerDetalle_(crudos, trabajo);

  const planes = [
    leerPlan_(comoHojaDeCalculo_(archivoDeFuente_(crudos, 'pdt_operacion'), trabajo),
      'Colaborador', diagnostico),
    leerPlan_(comoHojaDeCalculo_(archivoDeFuente_(crudos, 'pdt_gerencial'), trabajo),
      'Gerencial', diagnostico),
  ];

  contrastarFechas_(padron, detalle, diagnostico);
  return { padron, finalizaciones, detalle, planes };
}

/**
 * El censo del área: una fila por persona, con todo lo que el motor necesita
 * para situarla y fecharla. Sustituye a la Planta por Posiciones de Cobranza.
 *
 * Trae los DOS identificadores, y hacen falta los dos: en los datos de CEDIS
 * `Número Persona` y `Número Colaborador` difieren en 6,532 de 15,252 personas,
 * y las finalizaciones vienen indexadas por cualquiera de ellos. Aquí los dos
 * son únicos y no se cruzan entre sí, así que no hace falta la cascada de
 * identificadores que Cobranza necesitaba para reconciliar dos sistemas.
 */
function leerPadron_(crudos, trabajo, diagnostico) {
  const hoja = comoHojaDeCalculo_(archivoDeFuente_(crudos, 'padron'), trabajo);
  const filas = leerPestana_(hoja, null, {
    'Número Persona': 'numeroPersona',
    'Número Colaborador': 'numeroColaborador',
    'Nombre Colaborador|Nombre del colaborador': 'nombre',
    'Región RRHH|Region': 'region',
    'Centro Costos|Centro de Costos': 'centroCostos',
    'Área': 'area',
    'Departamento': 'departamento',
    'Puesto|Nombre de puesto': 'puesto',
    'Tipo Posición|Categoría de asignación': 'categoria',
    'Fecha Contratación': 'fechaContratacion',
    'Fecha Asignación Puesto': 'fechaPuesto',
  }).filter((f) => String(f.numeroPersona || '').trim());

  if (!filas.length) {
    throw new Error(
      'El archivo del padrón no trajo ni una fila con "Número Persona". Revisa que sea el ' +
      'que produce pipeline/aligerar_cedis.py y no uno de los CSV originales.'
    );
  }
  diagnostico.conteos.padronLeido = filas.length;
  return filas;
}

/**
 * Lo que cada quien tiene asignado y en qué estatus.
 *
 * Se aceptan varios archivos por si el área deja los cortes por separado, y se
 * lee `Sub Estatus Aprendizaje` además de `¿Lo Completó?`: las dos columnas no
 * dicen lo mismo —"Exenta" sale como NO completado y para CEDIS sí cuenta— y
 * cuál manda lo decide un parámetro, no este archivo. Ver docs/06-plan-cedis.md
 * §3.7.
 */
function leerFinalizaciones_(crudos, trabajo, diagnostico) {
  const filas = [];
  const archivos = buscarArchivos_(crudos, fuente_('finalizaciones').patron);

  if (!archivos.length) {
    throw new Error(
      `No encontré ningún archivo que combine con "${fuente_('finalizaciones').patron}" en la ` +
      `carpeta de datos crudos. Es la fuente "finalizaciones".`
    );
  }

  archivos.forEach((archivo) => {
    const hoja = comoHojaDeCalculo_(archivo, trabajo);
    const leidas = leerPestana_(hoja, null, {
      'Número Persona': 'persona',
      'Número Colaborador': 'colaborador',
      'Nombre Curso': 'curso',
      '¿Lo Completó?': 'completo',
      'Sub Estatus Aprendizaje': 'subEstatus',
    });
    leidas.forEach((fila) => filas.push(fila));
    diagnostico.avisos.push(`Finalizaciones: ${archivo.getName()} — ${leidas.length} filas.`);
  });
  return filas;
}

/** El Detalle Colaborador, si está. Solo para contrastar fechas. */
function leerDetalle_(crudos, trabajo) {
  const archivo = archivoDeFuente_(crudos, 'detalle_colaborador', false);
  if (!archivo) return [];
  return leerPestana_(comoHojaDeCalculo_(archivo, trabajo), null, {
    'NÚMERO PERSONA|Número de persona': 'numeroPersona',
    'NOMBRE COLABORADOR|Nombre': 'nombre',
    'FECHA DE INGRESO|Fecha de contratación de la empresa': 'fechaContratacion',
    'FECHA DE INGRESO DE PUESTO': 'fechaPuesto',
    'CODIGO PUESTO|Código de puesto': 'codigoPuesto',
    'PUESTO|Nombre de puesto': 'puesto',
  });
}

/**
 * Compara la fecha de asignación de puesto de las dos fuentes y avisa si se
 * separan más de la cuenta.
 *
 * Sobre los datos de agosto coinciden en el 99.0% de las personas que están en
 * las dos. Si ese número se desploma, casi siempre es que una de las dos fuentes
 * se quedó con el corte del mes pasado — y eso, sin este aviso, se publica en
 * silencio con las antigüedades equivocadas.
 *
 * No corrige nada: el padrón manda. Solo avisa.
 */
function contrastarFechas_(padron, detalle, diagnostico) {
  if (!detalle || !detalle.length) return;

  const porPersona = {};
  detalle.forEach((fila) => {
    const id = String(fila.numeroPersona || '').trim();
    if (id && !porPersona[id]) porPersona[id] = fila;
  });

  let comunes = 0;
  let iguales = 0;
  padron.forEach((persona) => {
    const suyo = porPersona[String(persona.numeroPersona || '').trim()];
    if (!suyo || !suyo.fechaPuesto || !persona.fechaPuesto) return;
    comunes += 1;
    if (aTextoFecha_(suyo.fechaPuesto) === aTextoFecha_(persona.fechaPuesto)) iguales += 1;
  });

  diagnostico.conteos.contrasteConDetalle = {
    enLasDosFuentes: comunes,
    fechaDePuestoIgual: iguales,
    soloEnElPadron: padron.length - comunes,
  };

  if (comunes && iguales / comunes < 0.9) {
    diagnostico.avisos.push(
      `La fecha de asignación de puesto solo coincide con el Detalle Colaborador en ` +
      `${iguales} de ${comunes} personas (${Math.round(iguales / comunes * 100)}%). Sobre datos ` +
      `sanos es el 99%. Revisa que las dos fuentes sean del mismo corte antes de publicar.`
    );
  }
}


/* =================================================================== *
 *  Los planes de capacitación
 * =================================================================== */

/** Las cuatro pestañas de un PDT, con la matriz de niveles si la trae. */
function leerPlan_(hojaId, familia, diagnostico) {
  const hoja = SpreadsheetApp.openById(hojaId);
  const nombreDe = (candidatos) => {
    const existentes = hoja.getSheets().map((p) => p.getName());
    for (let i = 0; i < candidatos.length; i += 1) {
      const encontrada = existentes.find((n) => textoClave_(n) === textoClave_(candidatos[i]));
      if (encontrada) return encontrada;
    }
    throw new Error(
      `El plan ${familia} no tiene ninguna pestaña entre ${candidatos.join(', ')}. ` +
      `Pestañas: ${existentes.join(', ')}`
    );
  };

  const cursos = (pestana, conNiveles) => {
    const nombre = nombreDe(pestana);
    // El encabezado del PDT gerencial viene corrido; se detecta y se corrige.
    const corrido = corrimientoDeEncabezado_(hojaId, nombre, 'Curso', diagnostico);

    const base = leerPestana_(hojaId, nombre, {
      'Curso': 'curso', 'Tipo': 'tipo', 'Rango de meses para cursar': 'rango',
    }, 1, corrido).filter((f) => String(f.curso || '').trim());

    if (!conNiveles) return base;

    const matriz = leerPestana_(hojaId, nombre, NIVELES_MATRIZ.reduce((m, nivel) => {
      m[nivel] = nivel; return m;
    }, { 'Curso': 'curso' }), 1, corrido);

    return base.map((fila, i) => {
      const marcas = matriz[i] || {};
      const niveles = {};
      let alguno = false;
      NIVELES_MATRIZ.forEach((nivel) => {
        if (marcas[nivel] !== undefined && marcas[nivel] !== '') alguno = true;
        niveles[nivel] = marcas[nivel];
      });
      return Object.assign({}, fila, { niveles: alguno ? niveles : null });
    });
  };

  const nombreEspecificos = nombreDe(['Colaboradores_especificos', 'Colaboradores específicos']);
  const especificos = leerPestana_(hojaId, nombreEspecificos, {
    'ID': 'id', 'Puesto': 'puesto',
    'Centros de costos': 'centrosDeCosto',
    'Centros que no aplican': 'centroQueNoAplica',
    'Centros que si aplican': 'centroQueSiAplica',
  });

  // Las dos columnas de centros ocupan sus propias filas, no una por puesto: son
  // listas que valen para toda la pestaña.
  //
  // Y son opuestas. Cobranza usa "Centros que no aplican" —una lista negra: los
  // 12 centros del Centro de Impresión quedan fuera de la especialización—. CEDIS
  // usa "Centros que si aplican", que es lo contrario: solo esos 9 centros de
  // costo la reciben. Leer una como si fuera la otra invierte exactamente a quién
  // le toca, así que se leen las dos por separado y el motor decide.
  const listaDe = (campo) => especificos
    .map((f) => String(f[campo] || '').trim())
    .filter(Boolean);

  const noAplican = listaDe('centroQueNoAplica');
  const siAplican = listaDe('centroQueSiAplica');

  if (noAplican.length && siAplican.length) {
    (diagnostico ? diagnostico.avisos : []).push(
      `El plan ${familia} trae las dos listas de centros a la vez: ${siAplican.length} en ` +
      `"Centros que si aplican" y ${noAplican.length} en "Centros que no aplican". Manda la ` +
      `de inclusión, y la de exclusión se aplica encima. Verifica que sea lo que quiere el área.`
    );
  }

  return {
    familia,
    cursosGenerales: cursos(['Cursos_asignados', 'Cursos asignados'], true),
    cursosEspecificos: cursos(['Cursos_especificos', 'Cursos específicos'], false),
    puestosGenerales: leerPestana_(hojaId, nombreDe(['Colaboradores_asignados', 'Colaboradores asignados']), {
      'ID': 'id', 'Puesto': 'puesto',
    }).filter((f) => String(f.puesto || '').trim()),
    puestosEspecificos: especificos
      .filter((f) => String(f.puesto || '').trim())
      .map((f) => ({
        id: f.id, puesto: f.puesto,
        centrosDeCosto: f.centrosDeCosto,
        centrosQueNoAplican: noAplican,
        centrosQueSiAplican: siAplican,
      })),
  };
}

/** Los encabezados de la matriz de niveles del plan gerencial. */
const NIVELES_MATRIZ = Object.freeze([
  'Jefes y Coordinadores',
  'Gerente Operación',
  'Gerente de Zona/Gte Sr',
  'Gerente Regional',
  'Gerente Divisional o Director de Área',
  'Director Corporativo o Director General',
]);

function carpetaDeTrabajo_(propiedades) {
  const base = DriveApp.getFolderById(propiedades.getProperty(CONFIG.props.carpetaBase));
  const existentes = base.getFoldersByName('Conversiones');
  return existentes.hasNext() ? existentes.next() : base.createFolder('Conversiones');
}
