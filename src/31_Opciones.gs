/**
 * Traduce la hoja de Catálogos al objeto de opciones que consume el motor.
 *
 * Existe para que 30_Motor.gs no sepa nada de hojas de cálculo: recibe funciones
 * ya resueltas y valores ya convertidos. Cambiar dónde viven las reglas —de una
 * hoja a otra fuente— se hace aquí y el motor ni se entera.
 */

function opcionesDelCorte_(periodo, fechaCorte) {
  const excepciones = catalogo_('ExcepcionImpresion');

  return {
    periodo: periodo || periodoActivo_(),
    fechaCorte: fechaCorte || fechaCorteActiva_(),

    padron: textoClave_(parametro_('PADRON', 'PLANTA')) === 'DETALLE' ? 'DETALLE' : 'PLANTA',
    respetarMatriz: parametroSiNo_('RESPETAR_MATRIZ_GERENCIAL', true),
    deduplicar: parametroSiNo_('DEDUPLICAR_FINALIZACIONES', true),
    soloOperacion: parametroSiNo_('FILTRAR_CATEGORIA_OPERACION', false),
    diasPorMes: parametroNumero_('DIAS_POR_MES', 30),
    nuevoIngresoDias: parametroNumero_('NUEVO_INGRESO_DIAS', 90),
    sinFechaContratacion: sinFechaContratacion_(),
    baseAntiguedad: baseAntiguedad_(),

    // Funciones, no tablas: el motor pregunta y el catálogo responde.
    regionOficial: regionOficial_,
    reglaCurso: reglaCurso_,
    agrupacionDe: agrupacionDe_,
    nombresDeAgrupacion: nombresDeAgrupacion_(),
    nivelGerencial: nivelGerencial_,
    esFamiliaDeCentros: esFamiliaDeCentros_,

    /**
     * Los centros donde este puesto queda exceptuado de la especialización.
     * El catálogo manda sobre a qué puestos aplica: el PDF dice 743 y 721, y el
     * PDT lista un tercer puesto en la misma pestaña sin decir que le toque.
     */
    centrosExceptuados: function (codigoPuesto, puestoClave) {
      const codigo = String(codigoPuesto || '').trim();
      if (!codigo) return [];
      return excepciones
        .filter((fila) => String(fila.puestos).split(/[,;]/)
          .map((p) => p.trim())
          .filter(Boolean)
          .indexOf(codigo) !== -1)
        .map((fila) => soloDigitos_(fila.centro))
        .filter(Boolean);
    },
  };
}

/**
 * Desde cuándo se cuenta la antigüedad que decide si un curso aplica.
 *
 *   PUESTO   (por omisión) desde que la persona tomó el puesto actual. Casi todo
 *            puesto trae cursos obligatorios al asignarse, así que esta es la
 *            fecha de referencia real.
 *   EMPRESA  desde la contratación, como se calculaba antes.
 *
 * No es un matiz: sobre el corte de agosto la mediana pasa de 796 días en la
 * empresa a 329 en el puesto, y con umbrales de 1, 4, 6 y 12 meses eso cambia
 * qué cursos le tocan a mucha gente.
 */
function baseAntiguedad_() {
  return textoClave_(parametro_('BASE_ANTIGUEDAD', 'PUESTO')) === 'EMPRESA' ? 'EMPRESA' : 'PUESTO';
}

/**
 * Qué hacer con quien no tiene fecha de contratación en ninguna fuente.
 *
 * En el corte de agosto son 1,139 de 12,278 (9.3%), casi siempre altas
 * posteriores al corte del Detalle Colaborador. Sin antigüedad no se puede
 * decidir qué cursos le tocan, así que hay tres lecturas y ninguna es
 * obviamente la correcta:
 *
 *   EXCLUIR          (por omisión) salen del tablero y Control deja constancia
 *                    de cuántos fueron. Se eligió porque las otras dos dejan
 *                    1,168 personas visibles con "0 de 0 cursos", que es lo
 *                    primero que va a preguntar quien filtre por su centro.
 *   ANTIGUEDAD_CERO  entran, pero en la práctica sin cursos: el plan de
 *                    operación no tiene ninguno con rango mínimo 0.
 *   TODOS            reciben el plan completo. Infla pendientes.
 *
 * Ninguna de las tres mueve el avance —esas personas aportan 0 asignados y 0
 * completados—, solo el conteo de colaboradores.
 */
function sinFechaContratacion_() {
  const valor = textoClave_(parametro_('SIN_FECHA_CONTRATACION', 'EXCLUIR'));
  return ['ANTIGUEDAD_CERO', 'TODOS'].indexOf(valor) !== -1 ? valor : 'EXCLUIR';
}
