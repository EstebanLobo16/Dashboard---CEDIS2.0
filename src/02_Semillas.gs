/**
 * Contenido inicial de la hoja de Catálogos.
 *
 * Todo lo que en el cuaderno de Colab estaba escrito duro dentro del código
 * vive aquí, y a partir de la instalación vive en una hoja que el área puede
 * editar sin tocar nada de esto. Estas semillas se escriben UNA vez, al correr
 * instalar(); después el archivo manda y este código ya no lo pisa.
 *
 * Nada de lo que sigue está inventado: sale del PDF de lógicas, de los dos PDT,
 * o de medir los tres CSV que entregó el área. Donde hubo que interpretar, lo
 * dice la columna `nota`, para que quien sepa pueda corregirlo sin preguntarle a
 * nadie y sin volver a desplegar.
 *
 * Los números de los comentarios son del corte 2026-08 y están en
 * docs/06-plan-cedis.md §2.
 */

const SEMILLAS = Object.freeze({

  Parametros: [
    ['RESPETAR_MATRIZ_GERENCIAL', 'SI', 'si_no',
      'Si SI, un curso del plan Gerencial solo aplica al nivel jerárquico marcado con 1 en la ' +
      'matriz del PDT. Si NO, los 22 cursos aplican a los 57 puestos por igual.'],
    ['ESPECIALIZACION_COMO_CURSO', 'NO', 'si_no',
      'Si NO, "Formación de Conductores CEDIS 2026" no cuenta como curso: es la agrupación de ' +
      'los tres que aparecen en la pestaña Agrupaciones.'],
    ['CURSO_SIN_FUENTE', 'PENDIENTE', 'texto',
      'Qué hacer con un curso del plan que no aparece nunca en las finalizaciones, una vez ' +
      'agotados los alias. PENDIENTE = cuenta como asignado y nadie lo completa. EXCLUIR = sale ' +
      'del plan. Con los tres CSV y los dos alias no debería quedar ninguno.'],
    ['DEDUPLICAR_FINALIZACIONES', 'SI', 'si_no',
      'Si SI, una misma persona+curso cuenta una sola vez. Aquí pesa más que en Cobranza: los ' +
      'tres CSV traen 517,615 filas para 425,811 pares persona+curso, o sea 91,804 repeticiones ' +
      '(17.7 por ciento), y casi todas están DENTRO de un mismo archivo. Sin esto el avance se ' +
      'calcula sobre un denominador inflado en una sexta parte.'],
    ['FILTRAR_CATEGORIA_OPERACION', 'SI', 'si_no',
      'Si SI, solo entran las personas con Tipo Posición = Operación. El PDF lo pide ' +
      'textualmente para CEDIS: "en categoría de asignación solamente se contempla el rubro de ' +
      'Operación". En los datos de agosto casi todo ya viene filtrado (1,959 filas de 517,615 ' +
      'dicen STAFF), así que hoy cambia poco; está encendido para el día que el área exporte ' +
      'sin filtrar.'],
    ['FAMILIA_CENTRO_COSTOS', '', 'texto',
      'Vacío a propósito. En Cobranza esto valía "007" porque el PDT decía "007 Cobranzas" para ' +
      'referirse a toda el área. CEDIS tiene 34 centros de costo, no una familia, y su plan ' +
      'específico sí nombra centros concretos en "Centros que si aplican". Ver CentrosCosto.'],
    ['BASE_ANTIGUEDAD', 'PUESTO', 'texto',
      'Desde cuándo se cuenta la antigüedad que decide si un curso aplica. PUESTO = desde la ' +
      'fecha de asignación del puesto actual, que es cuando un puesto trae sus cursos ' +
      'obligatorios. EMPRESA = desde la contratación. La mediana en el puesto es de 471 días.'],
    ['SIN_FECHA_CONTRATACION', 'EXCLUIR', 'texto',
      'Qué hacer con quien no tiene fecha utilizable. En CEDIS el padrón trae las dos fechas de ' +
      'las 15,252 personas, así que esto casi no aplica: solo alcanza a las 76 fechas centinela ' +
      'y a las 157 posteriores al corte. EXCLUIR = sale del tablero y Control deja constancia. ' +
      'ANTIGUEDAD_CERO = entra sin cursos. TODOS = recibe el plan completo.'],
    ['DIAS_POR_MES', '30', 'numero',
      'Conversión del "Rango de meses para cursar" del plan a días. Un curso aplica cuando ' +
      'dias_en_puesto >= minimo_del_rango por este valor.'],
    ['NUEVO_INGRESO_DIAS', '90', 'numero',
      'Debajo de cuántos días laborados se marca a un colaborador como nuevo ingreso.'],
    ['PERIODO', '', 'texto',
      'Periodo a procesar en formato AAAA-MM. Vacío = el mes anterior al día en que se corre.'],
    ['FECHA_CORTE', '', 'fecha',
      'Fecha de corte en formato AAAA-MM-DD. Vacío = último día del periodo.'],
    ['ARCHIVAR_DETALLE', 'SI', 'si_no',
      'Si SI, al publicar un corte nuevo el detalle por colaborador del corte anterior se guarda ' +
      'como .json en la carpeta de cortes archivados.'],
  ],

  // Se llena en la instalación con quien la corre; ver instalar().
  Administradores: [],

  // Las 26 regiones nacionales de CEDIS (PDF de lógicas, página 3), en el orden
  // del documento, que es el que usa el tablero cuando no ordena por avance.
  // Los nombres son los de los DATOS, no los del PDF: tres vienen mal escritos o
  // truncados allá. Ver MapaRegiones.
  Regiones: [
    ['Veracruz', 1], ['Los Mochis', 2], ['Hermosillo', 3], ['Mérida', 4],
    ['León', 5], ['Toluca', 6], ['Guadalajara', 7], ['Tecámac', 8],
    ['Ixtapaluca', 9], ['Monterrey', 10], ['Villahermosa', 11], ['Texcoco', 12],
    ['Monterrey II', 13], ['Cuautitlán Izcalli', 14], ['Mexicali', 15], ['Guadalajara II', 16],
    ['Oaxaca', 17], ['Torreón', 18], ['Azcapotzalco', 19], ['Culiacán', 20],
    ['Puebla', 21], ['Iztapalapa', 22], ['San Luis Potosí', 23], ['Ciudad Juárez', 24],
    ['Puebla II', 25], ['León II', 26],
  ],

  // Tres de las 26 se escriben distinto en el PDF y en los datos. La
  // normalización resuelve acentos y mayúsculas sola; esto no lo alcanza.
  MapaRegiones: [
    ['Azcalpotzalco', 'Azcapotzalco',
      'Está mal escrito EN LOS DATOS ("Azcal", no "Azcap"). Avisar al dueño de la fuente.'],
    ['CD Juarez', 'Ciudad Juárez', 'El PDF la abrevia; el nombre bueno es el de los datos.'],
    ['Cuautitlán Izca', 'Cuautitlán Izcalli',
      'El PDF viene truncado; el nombre bueno es el de los datos.'],
  ],

  // El cruce plan <-> finalizaciones compara por nombre normalizado (sin
  // acentos, mayúsculas, un solo espacio), así que "Construcción de un Entorno
  // Laboral Ético" contra "...entorno laboral ético" se resuelve solo. Esta
  // pestaña es para lo que la normalización no alcanza.
  //
  // Con estos dos renglones los 30 cursos del plan cruzan, y
  // cursosDelPlanSinFuente queda en 0.
  AliasCursos: [
    ['Introducción a la Seguridad y Salud Laboral CEDIS',
      'Introducción a la Seguridad y Salud Laboral en CEDIS', 'ALIAS',
      'El PDT de operación lo escribe sin el "en"; el gerencial y las finalizaciones, con él. ' +
      'Es el mismo curso (CU-C-2191-099).'],
    ['Socialización del Código de Ética',
      'Socialización del Código de Ética Para Líderes', 'ALIAS',
      'En las finalizaciones se llama "...Para Líderes": 15,255 filas. Es exactamente el mismo ' +
      'alias que ya existe en el tablero de Cobranza.'],
  ],

  // El padrón y el plan no siempre llaman igual al mismo puesto.
  AliasPuestos: [
    ['COORDINADOR DE TRANSPORTE', 'COORDINADOR',
      'El plan gerencial dice "COORDINADOR" a secas. Son 26 personas, y sí tienen la ' +
      'especialización de conductores en las finalizaciones: sin este renglón quedarían sin ' +
      'plan y fuera del tablero.'],
  ],

  // "Formación de Conductores CEDIS 2026" no es un curso: es el nombre de la
  // especialización que se compone de estos tres (PDF de lógicas, página 3, y
  // Cursos_especificos de los dos PDT). Contarla infla el denominador con algo
  // que nadie puede completar.
  Agrupaciones: [
    ['Formación de Conductores CEDIS 2026', 'Responsabilidad al volante'],
    ['Formación de Conductores CEDIS 2026', 'Sesión Virtual de Conducción Preventiva'],
    ['Formación de Conductores CEDIS 2026', 'Práctica de Conductor al volante'],
  ],

  // La pestaña Cursos_asignados del PDT gerencial marca con 1 qué nivel recibe
  // cada curso, pero los encabezados de esas columnas no son nombres de puesto.
  // Esta tabla es el puente, para los 57 puestos del plan gerencial.
  //
  // Solo hay TRES bandas que cambien algo, porque la matriz solo distingue tres:
  //
  //   Jefes y Coordinadores · Gerente Operación     22 cursos (todos)
  //   Gerente de Zona/Gte Sr                        18  (sin los 4 de seguridad operativa)
  //   Gerente Regional · Gerente Divisional         15  (sin, además, "Conociendo los CEDIS"
  //                                                      y los tres VALORES)
  //
  // Por eso la mayoría de los renglones marcados "por confirmar" no mueven ningún
  // número: caen dentro de la misma banda. Sobre el corte de agosto, 1,071 de las
  // 1,114 personas con plan gerencial están en las dos bandas que reciben los 22.
  //
  // NO uses "Director Corporativo o Director General": esa columna del PDT viene
  // SIN MARCAS, así que quien caiga ahí recibiría CERO cursos. Ningún puesto de
  // CEDIS está en ese nivel.
  //
  // Un puesto que falte aquí recibe TODOS los cursos, y el motor lo avisa.
  NivelesGerencial: [
    ['JEFE DE REPOSICION', 'Jefes y Coordinadores', ''],
    ['JEFE DE ACTIVACION DE MOTOS', 'Jefes y Coordinadores', ''],
    ['JEFE DE DESCARGA', 'Jefes y Coordinadores', ''],
    ['JEFE DE TRANSPORTE', 'Jefes y Coordinadores', ''],
    ['JEFE DE HABILITADO', 'Jefes y Coordinadores', ''],
    ['JEFE DE CEDIS ROPA', 'Jefes y Coordinadores', ''],
    ['JEFE DE TALLER DE SERVICIOS', 'Jefes y Coordinadores', ''],
    ['JEFE DE TRASLADO', 'Jefes y Coordinadores', ''],
    ['JEFE DE CEDIS', 'Jefes y Coordinadores', ''],
    ['JEFE DE PISO CEDIS', 'Jefes y Coordinadores', ''],
    ['JEFE DE CEDIS COLGADO', 'Jefes y Coordinadores', ''],
    ['JEFE DE EMBARQUES', 'Jefes y Coordinadores', ''],
    ['JEFE DE ENVIO A CLIENTES', 'Jefes y Coordinadores', ''],
    ['JEFE DE LOTEO', 'Jefes y Coordinadores', ''],
    ['JEFE DE RACK', 'Jefes y Coordinadores', ''],
    ['JEFE DE TALLER AUTOMOTRIZ', 'Jefes y Coordinadores', ''],
    ['JEFE DE MANTENIMIENTO', 'Jefes y Coordinadores', ''],
    ['JEFE DE OFICINA CONTROL', 'Jefes y Coordinadores', ''],
    ['SUPERVISOR DE UNIDADES', 'Jefes y Coordinadores', ''],
    ['INSPECTOR DE CALIDAD', 'Jefes y Coordinadores', ''],
    ['CENTRALIZADOR', 'Jefes y Coordinadores', ''],
    ['ENTRENAMIENTO', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['PLANEADOR DE OLAS', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['ESPECIALISTA DE WMS', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['ESPECIALISTA DE DATOS CDS', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['CIENTIFICO DE DATOS CDS', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['INGENIERO DE CONTROL', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['INGENIERO DE PRODUCTIVIDAD', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['TEAM COACH', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['FUNCIONAL', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['CONSULTOR', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['CONSULTOR DE INGENIERIA DE CEDIS', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['LIDER DE PROYECTO', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['DUEÑO DE PRODUCTO', 'Jefes y Coordinadores', 'Colaborador individual, no jefe. Mi lectura, por confirmar. No mueve cursos: la banda recibe los 22 igual.'],
    ['GERENTE DE AREA CEDIS', 'Gerente Operación', ''],
    ['GERENTE DE DISTRIBUCION', 'Gerente Operación', ''],
    ['GERENTE SUPLENTE', 'Gerente Operación', ''],
    ['GERENTE DE EMBARQUES', 'Gerente Operación', ''],
    ['GERENTE DE TRANSPORTE', 'Gerente Operación', ''],
    ['GERENTE DE TRASLADO', 'Gerente Operación', ''],
    ['GERENTE DE DESCARGA', 'Gerente Operación', ''],
    ['GERENTE DE OFICINA CONTROL', 'Gerente Operación', ''],
    ['GERENTE DE TALLER AUTOMOTRIZ', 'Gerente Operación', ''],
    ['GERENTE DE RACK', 'Gerente Operación', ''],
    ['GERENTE DE MANTENIMIENTO', 'Gerente Operación', ''],
    ['GERENTE DE OPERACION CEDIS', 'Gerente Operación', ''],
    ['GERENTE DE PRODUCTO', 'Gerente Operación', 'Puesto corporativo, no de piso. Mi lectura, por confirmar. Hoy no tiene a nadie.'],
    ['GERENTE DE PROYECTOS', 'Gerente Operación', 'Puesto corporativo, no de piso. Mi lectura, por confirmar. Hoy no tiene a nadie.'],
    ['GERENTE DE ZONA CEDIS', 'Gerente de Zona/Gte Sr', 'EL ÚNICO RENGLÓN QUE MUEVE UN NÚMERO HOY: 43 personas que en esta banda no reciben los 4 cursos de seguridad operativa.'],
    ['GERENTE SR DE SOLUCIONES DE TI', 'Gerente de Zona/Gte Sr', '"Gte Sr" está en el nombre de la banda. Hoy no tiene a nadie.'],
    ['GERENTE SR DE PROYECTOS TRANSVERSALES', 'Gerente de Zona/Gte Sr', '"Gte Sr" está en el nombre de la banda. Hoy no tiene a nadie.'],
    ['GERENTE SR DE INGENIERIA Y PRODUCTIVIDAD DE CEDIS', 'Gerente de Zona/Gte Sr', '"Gte Sr" está en el nombre de la banda. Hoy no tiene a nadie.'],
    ['GERENTE SR DE CENTRALIZACION CEDIS', 'Gerente de Zona/Gte Sr', '"Gte Sr" está en el nombre de la banda. Hoy no tiene a nadie.'],
    ['GERENTE SR DE AUTOMATIZACION Y GESTION ALMACENES', 'Gerente de Zona/Gte Sr', '"Gte Sr" está en el nombre de la banda. Hoy no tiene a nadie.'],
    ['GERENTE DE OPTIMIZACION DE TRANSPORTE Y CEDIS', 'Gerente de Zona/Gte Sr', 'Alcance por encima de un CEDIS. Mi lectura, por confirmar. Hoy no tiene a nadie.'],
    ['GERENTE NACIONAL DE INGENIERIA CEDIS', 'Gerente Divisional o Director de Área', 'Alcance nacional. Mi lectura, por confirmar. Hoy no tiene a nadie.'],
    ['GERENTE NACIONAL DE OPERACION CEDIS', 'Gerente Divisional o Director de Área', 'Alcance nacional. Mi lectura, por confirmar. Hoy no tiene a nadie.'],
  ],

  // Los 34 centros de costo que el PDF declara de CEDIS (páginas 3 y 4). Los 34
  // aparecen en los datos y NO hay ninguno fuera de la lista: hoy no saca a
  // nadie. Se siembra para que el día que aparezca un centro de costo que nadie
  // declaró, el tablero lo diga en vez de contarlo en silencio.
  CentrosCosto: [
    ['006', 'DISTRIBUCION', ''],
    ['010', 'AREA DE BOD MUEBLES', ''],
    ['011', 'TALLER DE SERVICIOS', ''],
    ['012', 'OFICINA CONTROL', ''],
    ['013', 'TALLER AUTOMOTRIZ', ''],
    ['014', 'BODEGA ROPA COLGADO', ''],
    ['038', 'ZONA BODEGA MUEBLES', ''],
    ['045', 'DISTRIBUCION FORANEA', ''],
    ['058', 'BODEGA ROPA DOBLADO', ''],
    ['059', 'BODEGA ROPA ZAPATERIA', ''],
    ['060', 'BODEGA ROPA PICKING', ''],
    ['061', 'ZONA BODEGA ROPA', ''],
    ['062', 'BODEGA ROPA FRONTERA', ''],
    ['064', 'IMPORTACION STAFF', ''],
    ['070', 'BODEGAS PRODUCTIVAS AREAS', ''],
    ['072', 'TRASLADO', ''],
    ['073', 'OPERACION TRANSPORTE', ''],
    ['075', 'EMBARQUES', ''],
    ['079', 'BODEGA ROPA STAFF', ''],
    ['088', 'TALLER CELULARES', ''],
    ['092', 'ZONA CEDIS MUEBLES IMPORTACION', ''],
    ['093', 'DESCARGA (IMPORTACION)', ''],
    ['094', 'EMBARQUES (IMPORTACION)', ''],
    ['098', 'SORTER', ''],
    ['099', 'CALIDAD', ''],
    ['100', 'HABILITADO', ''],
    ['115', 'ENVIO A CLIENTES', ''],
    ['152', 'ZONA DISTRIBUCION', ''],
    ['153', 'ESTACION RAC', ''],
    ['157', 'MEDIA MILLA ESTACION RAC', ''],
    ['305', 'ACTIVADO DE MOTOS', ''],
    ['441', 'SURTIDO IMPORTACION', ''],
    ['443', 'OFICINA CONTROL IMPORTACION', ''],
    ['458', 'TRASLADO IMPORTACION', ''],
  ],

  // El PDT de operación trae Colaboradores_especificos VACÍO —solo encabezados—
  // así que la especialización de conductores no le llegaría a ningún chofer. El
  // PDF sí los nombra (página 3), y en las finalizaciones esos cuatro puestos
  // suman 4,858 personas con la especialización asignada.
  //
  // Los cuatro puestos gerenciales de la misma especialización (1078, 41, 1049 y
  // 1057) sí vienen en su archivo y no se repiten aquí.
  //
  // `centros` es la lista de "Centros que si aplican" del PDT gerencial: los
  // nueve centros de costo donde la especialización aplica.
  PuestosEspecificos: [
    ['Colaborador', '44', 'CHOFER', '157, 153, 152, 094, 073, 064, 045, 013, 006',
      'PDF de lógicas, página 3. Falta en Colaboradores_especificos del PDT de operación.'],
    ['Colaborador', '1047', 'CHOFER DE DISTRIBUCION', '157, 153, 152, 094, 073, 064, 045, 013, 006',
      'PDF de lógicas, página 3. 3,587 personas con la especialización en las finalizaciones.'],
    ['Colaborador', '395', 'CHOFER DE MUDANZA TIPO E', '157, 153, 152, 094, 073, 064, 045, 013, 006',
      'PDF de lógicas, página 3. 848 personas.'],
    ['Colaborador', '45', 'CHOFER DE MUDANZA', '157, 153, 152, 094, 073, 064, 045, 013, 006',
      'PDF de lógicas, página 3. 411 personas.'],
  ],

  // Vacía: la excepción del Centro de Impresión es de Cobranza. CEDIS restringe
  // al revés, con la lista blanca de PuestosEspecificos.
  ExcepcionImpresion: [],

  // Cómo se reconoce cada archivo dentro de la carpeta de datos crudos. Los
  // patrones son estilo glob y no distinguen mayúsculas, para que los sufijos
  // tipo "(12)" o los rangos de fecha en el nombre no rompan nada.
  //
  // Son cuatro, no las cinco de Cobranza: CEDIS no tiene Planta por Posiciones
  // ni catálogo de centros. Los dos CSV los produce celda_aligerar_csv.py; los
  // originales que entrega el área NO se suben tal cual (200 MB en tres
  // archivos, dos de ellos pegados al límite de conversión de Drive).
  Fuentes: [
    ['padron', 'cedis?padron*.csv', 'SI', '',
      'El censo del área: una fila por persona, con región, centro de costo, área, ' +
      'departamento, puesto, tipo de posición y las dos fechas. Sustituye a la Planta por ' +
      'Posiciones de Cobranza. Lo produce pipeline/celda_aligerar_csv.py.'],
    ['finalizaciones', 'cedis?finalizaciones*.csv', 'SI', '',
      'Una fila por persona y curso, con "¿Lo Completó?" y "Sub Estatus Aprendizaje". Se ' +
      'aceptan varios archivos si el área los deja por separado. Lo produce ' +
      'pipeline/celda_aligerar_csv.py.'],
    ['pdt_operacion', '*operaci?n*.xlsx', 'SI', '(4 pestañas)',
      'Cursos_asignados, Colaboradores_asignados, Cursos_especificos, Colaboradores_especificos.'],
    ['pdt_gerencial', '*gerencial*.xlsx', 'SI', '(4 pestañas)',
      'Mismas 4 pestañas, más la matriz de niveles en Cursos_asignados. Ojo: su fila de ' +
      'encabezados viene corrida una columna. La ingesta lo detecta y lo avisa; no hay que ' +
      'arreglar el archivo a mano.'],
    ['detalle_colaborador', '*detalle?colaborador*.xlsx', 'NO', '',
      'OPCIONAL. No participa en ningún cruce: el padrón ya trae las dos fechas de todas sus ' +
      'personas. Se usa solo para contrastarlas y avisar si las dos fuentes se separan, que ' +
      'es como se detecta que una se quedó con el corte del mes pasado.'],
  ],
});
