/**
 * Ingesta: de los archivos crudos de Drive a las estructuras que consume el motor.
 *
 * Todo lo que toca Drive y Sheets vive aquí. El motor (30_Motor.gs) no sabe de
 * dónde salieron los datos, y por eso se puede correr fuera de Apps Script.
 *
 * Dos límites mandan sobre el diseño:
 *
 *   · Apps Script no lee .xlsx. Hay que convertir con la API de Drive.
 *   · Un CSV de 65 MB no se puede leer como texto: `getDataAsString()` se queda
 *     sin memoria. También se convierte a hoja y se lee por rangos.
 *
 * Las conversiones van a una carpeta de trabajo y se borran al terminar. Si una
 * ejecución se corta a la mitad, la siguiente reutiliza lo ya convertido en vez
 * de volver a hacerlo: convertir es lo caro.
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
      `(ver pipeline/celda_aligerar_csv.py).`
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
function leerPestana_(hojaId, nombrePestana, columnas, filaEncabezado) {
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
        objeto[destino] = normalizarCelda_(valores[indices[destino]]);
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
 * Entre pestañas con nombre de fecha ("01 AGO 26"), la más reciente.
 * Avisa fuerte si no corresponde al periodo que se está procesando: es la señal
 * de que el área todavía no subió el corte del mes y el proceso seguiría
 * corriendo en silencio con datos viejos.
 */
function pestanaMasReciente_(hojaId, periodo, diagnostico) {
  const pestanas = SpreadsheetApp.openById(hojaId).getSheets();
  const fechadas = [];

  pestanas.forEach((pestana) => {
    const fecha = fechaDeNombreDePestana_(pestana.getName());
    if (fecha) fechadas.push({ nombre: pestana.getName(), fecha });
  });

  if (!fechadas.length) {
    throw new Error(
      `Ninguna pestaña tiene nombre con formato de fecha (por ejemplo "01 AGO 26"). ` +
      `Pestañas: ${pestanas.map((p) => p.getName()).join(', ')}`
    );
  }

  fechadas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const elegida = fechadas[fechadas.length - 1];
  const suPeriodo = Utilities.formatDate(elegida.fecha, Session.getScriptTimeZone(), 'yyyy-MM');

  if (periodo && suPeriodo !== periodo) {
    (diagnostico ? diagnostico.avisos : []).push(
      `La pestaña más reciente es "${elegida.nombre}" (${suPeriodo}) pero se está procesando ` +
      `${periodo}. Es probable que esta fuente todavía no tenga el corte del mes.`
    );
  }
  return elegida.nombre;
}

function fechaDeNombreDePestana_(nombre) {
  const partes = textoClave_(nombre).split(' ');
  if (partes.length !== 3) return null;
  const dia = Number(partes[0]);
  const mes = MESES_ABREVIADOS[partes[1].slice(0, 3)];
  let anio = Number(partes[2]);
  if (!dia || !mes || !anio) return null;
  if (anio < 100) anio += 2000;
  const fecha = new Date(anio, mes - 1, dia);
  return isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * La Planta por Posiciones a veces trae una tabla resumen encima de la tabla
 * nominal. Se busca la fila donde de verdad empieza el encabezado en vez de
 * asumir que es la primera.
 */
function filaDelEncabezado_(hojaId, nombrePestana, ancla) {
  const pestana = SpreadsheetApp.openById(hojaId).getSheetByName(nombrePestana);
  const alto = Math.min(15, pestana.getLastRow());
  const valores = pestana.getRange(1, 1, alto, pestana.getLastColumn()).getValues();
  const buscada = textoClave_(ancla);

  for (let i = 0; i < valores.length; i += 1) {
    if (valores[i].some((v) => textoClave_(v) === buscada)) return i + 1;
  }
  throw new Error(
    `No encontré la columna "${ancla}" en las primeras ${alto} filas de la pestaña ` +
    `"${nombrePestana}". Puede que el archivo haya cambiado de estructura.`
  );
}


/* =================================================================== *
 *  Armar las fuentes del motor
 * =================================================================== */

/**
 * Lee las cinco fuentes y devuelve el objeto que consume calcularCorte_().
 * Es la parte lenta del proceso: convertir y leer 300 mil filas.
 */
function leerFuentes_(periodo, diagnostico) {
  const propiedades = PropertiesService.getScriptProperties();
  const crudos = DriveApp.getFolderById(propiedades.getProperty(CONFIG.props.carpetaCrudos));
  const trabajo = carpetaDeTrabajo_(propiedades);

  // --- Planta por Posiciones: padrón y catálogo de centros ------------------
  const archivoPlanta = archivoDeFuente_(crudos, 'planta_posiciones');
  const planta = comoHojaDeCalculo_(archivoPlanta, trabajo);
  const pestanaPlanta = pestanaMasReciente_(planta, periodo, diagnostico);
  const encabezado = filaDelEncabezado_(planta, pestanaPlanta, 'Número de trabajador');

  const padron = leerPestana_(planta, pestanaPlanta, {
    'Número de trabajador': 'numeroColaborador',
    'Nombre del colaborador': 'nombre',
    'Código de puesto': 'codigoPuesto',
    'Nombre de puesto': 'puesto',
    'Centro': 'centro',
    'Departamento': 'departamento',
    'Categoria de asignación': 'categoria',
  }, encabezado).filter((f) => String(f.numeroColaborador || '').trim());

  // TODO(etapa 2): CEDIS no tiene catálogo de centros. Esta fuente y las dos de
  // la Planta desaparecen, y el centro pasa a salir del propio padrón.
  const centros = leerPestana_(planta, fuente_('centros_tipocentros').pestana, {
    '# Centro': 'centro',
    'REGION COBRANZA': 'region',
    'NOMENCLATURA': 'nomenclatura',
    'TIPO COBRANZA': 'tipoCentro',
  });

  // --- Detalle Colaborador: la fecha de contratación ------------------------
  const detalleHoja = comoHojaDeCalculo_(archivoDeFuente_(crudos, 'detalle_colaborador'), trabajo);
  // El Detalle Colaborador cambió de formato: los nombres nuevos van primero.
  // La versión nueva ya no trae departamento ni categoría de asignación, pero
  // los dos salen de la Planta, que es el padrón.
  const detalle = leerPestana_(detalleHoja, null, {
    'NÚMERO PERSONA|Número de persona': 'numeroPersona',
    'NOMBRE COLABORADOR|Nombre': 'nombre',
    'FECHA DE INGRESO|Fecha de contratación de la empresa': 'fechaContratacion',
    'FECHA DE INGRESO DE PUESTO': 'fechaPuesto',
    'CODIGO PUESTO|Código de puesto': 'codigoPuesto',
    'PUESTO|Nombre de puesto': 'puesto',
    'Nombre del departamento': 'departamento',
    'Categoría de asignación': 'categoria',
  });

  // --- Finalizaciones: uno o varios cortes parciales ------------------------
  const finalizaciones = [];
  const puente = [];
  const vistosEnPuente = {};

  buscarArchivos_(crudos, fuente_('finalizaciones').patron).forEach((archivo) => {
    const hoja = comoHojaDeCalculo_(archivo, trabajo);
    const filas = leerPestana_(hoja, null, {
      'Número Persona': 'persona',
      'Número Colaborador': 'colaborador',
      'Nombre Curso': 'curso',
      '¿Lo Completó?': 'completo',
      'Fecha Contratación': 'fechaContratacion',
      'Fecha Asignación Puesto': 'fechaPuesto',
    });
    filas.forEach((fila) => {
      finalizaciones.push({
        persona: fila.persona, colaborador: fila.colaborador,
        curso: fila.curso, completo: fila.completo,
      });
      const llave = String(fila.colaborador || '');
      if (llave && !vistosEnPuente[llave]) {
        vistosEnPuente[llave] = true;
        puente.push({
          persona: fila.persona, colaborador: fila.colaborador,
          fechaContratacion: fila.fechaContratacion,
          fechaPuesto: fila.fechaPuesto,
        });
      }
    });
    diagnostico.avisos.push(`Finalizaciones: ${archivo.getName()} — ${filas.length} filas.`);
  });

  // --- Los dos planes ------------------------------------------------------
  const planes = [
    leerPlan_(comoHojaDeCalculo_(archivoDeFuente_(crudos, 'pdt_operacion'), trabajo), 'Colaborador'),
    leerPlan_(comoHojaDeCalculo_(archivoDeFuente_(crudos, 'pdt_gerencial'), trabajo), 'Gerencial'),
  ];

  return { padron, centros, detalle, finalizaciones, puente, planes };
}

/** Las cuatro pestañas de un PDT, con la matriz de niveles si la trae. */
function leerPlan_(hojaId, familia) {
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
    const base = leerPestana_(hojaId, nombre, {
      'Curso': 'curso', 'Tipo': 'tipo', 'Rango de meses para cursar': 'rango',
    }).filter((f) => String(f.curso || '').trim());

    if (!conNiveles) return base;

    const matriz = leerPestana_(hojaId, nombre, NIVELES_MATRIZ.reduce((m, nivel) => {
      m[nivel] = nivel; return m;
    }, { 'Curso': 'curso' }));

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

  const especificos = leerPestana_(hojaId, nombreDe(['Colaboradores_especificos', 'Colaboradores específicos']), {
    'ID': 'id', 'Puesto': 'puesto',
    'Centros de costos': 'centrosDeCosto',
    'Centros que no aplican': 'centroQueNoAplica',
  });

  // "Centros que no aplican" ocupa sus propias filas, no una por puesto: es una
  // lista que vale para toda la pestaña.
  const noAplican = especificos
    .map((f) => String(f.centroQueNoAplica || '').trim())
    .filter(Boolean);

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
