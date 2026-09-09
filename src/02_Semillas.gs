/**
 * Contenido inicial de la hoja de Catálogos.
 *
 * Todo lo que en el cuaderno de Colab estaba escrito duro dentro del código
 * vive aquí, y a partir de la instalación vive en una hoja que el área puede
 * editar sin tocar nada de esto. Estas semillas se escriben UNA vez, al correr
 * instalar(); después el archivo manda y este código ya no lo pisa.
 *
 * Las decisiones que quedaron abiertas en docs/00-propuesta.md §7 están
 * sembradas con la recomendación de la propuesta. Cambiar de opinión es cambiar
 * un renglón en la hoja, no volver a desplegar.
 *
 * ⚠ PENDIENTE — ETAPA 3
 *
 * Todo lo que sigue es TODAVÍA CONTENIDO DE COBRANZA: las 15 regiones, los
 * puestos gerenciales, los centros del Centro de Impresión y los patrones de
 * archivo. La etapa 1 solo cambió la identidad del reporte (00_Config.gs); las
 * semillas se reemplazan en la etapa 3, con los datos ya medidos en
 * docs/06-plan-cedis.md §2.
 *
 * NO corras instalar() en producción hasta entonces: crearía la hoja de
 * Catálogos de CEDIS con las reglas de Cobranza dentro.
 */

const SEMILLAS = Object.freeze({

  Parametros: [
    ['PADRON', 'PLANTA', 'texto',
      'Quién define el universo de Cobranza. PLANTA = la Planta por Posiciones (censo del área). ' +
      'DETALLE = toda la nómina filtrada por puesto del plan, como hacía el cuaderno. Decisión 1.'],
    ['RESPETAR_MATRIZ_GERENCIAL', 'SI', 'si_no',
      'Si SI, un curso del plan Gerencial solo aplica al nivel jerárquico marcado con 1 en la ' +
      'matriz del PDT. Si NO, los 20 cursos aplican a los 8 puestos por igual. Decisión 2.'],
    ['ESPECIALIZACION_COMO_CURSO', 'NO', 'si_no',
      'Si NO, "Formación de Conductores Cobranza 2026" no cuenta como curso: es la agrupación de ' +
      'los tres que aparecen en la pestaña Agrupaciones. Decisión 3.'],
    ['CURSO_SIN_FUENTE', 'PENDIENTE', 'texto',
      'Qué hacer con un curso del plan que no aparece nunca en las finalizaciones, una vez ' +
      'agotados los alias. PENDIENTE = cuenta como asignado y nadie lo completa. EXCLUIR = sale ' +
      'del plan. Decisión 4.'],
    ['DEDUPLICAR_FINALIZACIONES', 'SI', 'si_no',
      'Si SI, una misma persona+curso cuenta una sola vez aunque aparezca en P1 y P2. ' +
      'Si NO, se replica el comportamiento del proceso anterior. Decisión 5.'],
    ['FILTRAR_CATEGORIA_OPERACION', 'NO', 'si_no',
      'Si SI, solo entran las personas con Categoría de asignación = Operación. ' +
      'Afecta a 198 de 12,472 en el corte 01 AGO 26. Decisión 6.'],
    ['FAMILIA_CENTRO_COSTOS', '007', 'texto',
      'La familia de centro de costo de Cobranza. Cuando la columna "Centros de costos" del plan ' +
      'específico dice "007 Cobranzas" se refiere a toda el área, no a un centro: la restricción ' +
      'real es la lista de ExcepcionImpresion. Decisión 9, confirmada por el área.'],
    ['BASE_ANTIGUEDAD', 'PUESTO', 'texto',
      'Desde cuándo se cuenta la antigüedad que decide si un curso aplica. PUESTO = desde la ' +
      'fecha de asignación del puesto actual, que es cuando un puesto trae sus cursos ' +
      'obligatorios. EMPRESA = desde la contratación, como se calculaba antes. Sobre el corte ' +
      '01 AGO 26 la mediana pasa de 796 días a 329.'],
    ['SIN_FECHA_CONTRATACION', 'EXCLUIR', 'texto',
      'Qué hacer con quien está en el padrón pero no tiene fecha de contratación en ninguna ' +
      'fuente (1,139 de 12,278 en el corte 01 AGO 26, casi siempre altas posteriores al corte ' +
      'del Detalle Colaborador). EXCLUIR = sale del tablero, y Control deja constancia de ' +
      'cuántos fueron. ANTIGUEDAD_CERO = entra pero sin cursos, así que aparece con 0 de 0. ' +
      'TODOS = recibe el plan completo. No cambia el avance en ningún caso, solo el conteo de ' +
      'colaboradores. Decisión 10.'],
    ['DIAS_POR_MES', '30', 'numero',
      'Conversión del "Rango de meses para cursar" del plan a días. Un curso aplica cuando ' +
      'dias_laborados >= minimo_del_rango * este valor.'],
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

  // Las 15 regiones oficiales de Cobranza (PDF de lógicas, página 1).
  // El orden es el del documento, y es el que usa el tablero cuando no ordena por avance.
  Regiones: [
    ['TORREON', 1], ['CULIACAN', 2], ['HERMOSILLO', 3], ['MEXICALI', 4], ['LEON', 5],
    ['MONTERREY', 6], ['TOLUCA', 7], ['GUADALAJARA', 8], ['QUERETARO', 9],
    ['CUAUTITLAN IZCALLI', 10], ['PUEBLA', 11], ['VERACRUZ', 12], ['IXTAPALUCA', 13],
    ['VILLAHERMOSA', 14], ['MERIDA', 15],
  ],

  // Cuatro centros del catálogo CENTROS-TIPOCENTROS apuntan a regiones que no
  // están entre las 15 oficiales. Decisión 7: se mapean a su región base y se
  // avisa al dueño del catálogo para que lo corrija en la fuente.
  MapaRegiones: [
    ['CULIACAN DIV I', 'CULIACAN', 'Fuera de las 15 oficiales. Corregir en CENTROS-TIPOCENTROS.'],
    ['IZTAPALAPA DIV III', 'IXTAPALUCA', 'Fuera de las 15 oficiales. Corregir en CENTROS-TIPOCENTROS.'],
    ['LEON DIV II', 'LEON', 'Fuera de las 15 oficiales. Corregir en CENTROS-TIPOCENTROS.'],
    ['QUERETARO DIV IV', 'QUERETARO', 'Fuera de las 15 oficiales. Corregir en CENTROS-TIPOCENTROS.'],
  ],

  // El cruce plan ↔ finalizaciones ya compara por nombre normalizado (sin
  // acentos, mayúsculas, un solo espacio), así que los desajustes de
  // "Entorno Laboral Ético" vs "entorno laboral ético" se resuelven solos y no
  // necesitan renglón aquí. Esta pestaña es para lo que la normalización no
  // alcanza: cursos que cambiaron de nombre, o que salieron del plan.
  AliasCursos: [
    ['Socialización del Código de Ética', 'Socialización del Código de Ética Para Líderes', 'ALIAS',
      'En las finalizaciones se llama "…Para Líderes". Es el mismo curso: lo tienen 1,525 personas ' +
      'y todas ocupan uno de los 8 puestos del plan gerencial, ninguna fuera. Con el alias pasa de ' +
      '0% a 42.4% de avance.'],
  ],

  // "Formación de Conductores Cobranza 2026" no es un curso: es el nombre de la
  // especialización que se compone de estos tres (PDF de lógicas, página 1).
  Agrupaciones: [
    ['Formación de Conductores Cobranza 2026', 'Responsabilidad al volante Cobranza'],
    ['Formación de Conductores Cobranza 2026', 'Sesión Virtual de Conducción preventiva en Cobranza'],
    ['Formación de Conductores Cobranza 2026', 'Práctica de Conductor al volante Cobranza'],
  ],

  // La pestaña Cursos_asignados del PDT gerencial marca con 1 qué nivel recibe
  // cada curso, pero los encabezados de esas columnas no son nombres de puesto.
  // Esta tabla es el puente. Los dos renglones marcados "por confirmar" son mi
  // lectura, no un dato de la fuente.
  NivelesGerencial: [
    ['JEFE DE OPERACION COBRANZA', 'Jefes y Coordinadores', ''],
    ['JEFE DE PROMOCION DOMICILIARIA', 'Jefes y Coordinadores', ''],
    ['ENTRENAMIENTO', 'Jefes y Coordinadores', 'Por confirmar con el dueño del PDT.'],
    ['GERENTE DE OPERACION COBRANZA', 'Gerente Operación', ''],
    ['GERENTE DE ZONA DE COBRANZA', 'Gerente de Zona/Gte Sr', ''],
    ['ENTRENAMIENTO ZONA', 'Gerente de Zona/Gte Sr', 'Por confirmar con el dueño del PDT.'],
    ['GERENTE REGIONAL DE OPERACION COBRANZA', 'Gerente Regional', ''],
    ['GERENTE DIVISIONAL DE COBRANZA', 'Gerente Divisional o Director de Área', ''],
  ],

  // Los 12 centros del Centro de Impresión de Cobranza (PDF de lógicas, página 2).
  // Los puestos 743 y 721 en estos centros quedan fuera de la especialización de
  // conductores. La misma lista viene en la columna "Centros que no aplican" del
  // PDT gerencial; se siembra aquí para poder validar que las dos coincidan.
  ExcepcionImpresion: [
    ['500306', '743, 721', ''], ['521902', '743, 721', ''], ['504704', '743, 721', ''],
    ['501004', '743, 721', ''], ['503605', '743, 721', ''], ['509104', '743, 721', ''],
    ['501105', '743, 721', ''], ['504307', '743, 721', ''], ['507703', '743, 721', ''],
    ['509505', '743, 721', ''], ['504804', '743, 721', ''], ['517002', '743, 721', ''],
  ],

  // Cómo se reconoce cada archivo dentro de la carpeta de datos crudos. Los
  // patrones son estilo glob y no distinguen mayúsculas, para que los sufijos
  // tipo "(12)" o los rangos de fecha en el nombre no rompan nada.
  Fuentes: [
    ['detalle_colaborador', '*detalle?colaborador*.xlsx', 'SI', '',
      'Primera pestaña. Aporta la fecha de contratación y la de asignación de puesto. El "?" ' +
      'cubre tanto "Detalle Colaborador" como "Detalle_Colaborador": el archivo ya cambió de ' +
      'nombre una vez.'],
    ['planta_posiciones', 'planta de cobranza por posiciones*.xlsx', 'SI', '(fecha más reciente)',
      'Padrón del área. La pestaña se elige por fecha; el encabezado real se busca por ' +
      '"Número de trabajador", no se asume en la fila 1.'],
    ['centros_tipocentros', 'planta de cobranza por posiciones*.xlsx', 'SI', 'CENTROS-TIPOCENTROS',
      'Catálogo Centro → Región Cobranza. Va en el mismo archivo que planta_posiciones.'],
    ['planta_centro', 'planta de cobranza por centro*.xlsx', 'NO', '(fecha más reciente)',
      'Solo auditoría. No participa en ningún cruce.'],
    ['pdt_operacion', '*operaci?n*.xlsx', 'SI', '(4 pestañas)',
      'Cursos_asignados, Colaboradores_asignados, Cursos_especificos, Colaboradores_especificos.'],
    ['pdt_gerencial', '*gerencial*.xlsx', 'SI', '(4 pestañas)',
      'Mismas 4 pestañas, más la matriz de niveles en Cursos_asignados.'],
    ['finalizaciones', 'cobranza*p*.csv', 'SI', '',
      'Uno o varios cortes parciales (P1, P2, P3...). Se concentran todos los que haya.'],
  ],
});
