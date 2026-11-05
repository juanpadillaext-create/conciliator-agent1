/**
 * JournalEntryVoucher.gs
 * Módulo de Contabilidad / ERP para generación de Journal Entry Vouchers (JEV).
 * Diseñado específicamente para Sociedad 6202 (Delivery Hero Dmarts Chile SpA).
 * Genera asientos de diario contable balanceados (Debe == Haber) para la conciliación
 * de Facturas (DTE), Órdenes de Compra (PO) y Recepciones de Bodega (GR/IR).
 */

const JEV_CONFIG = {
  SOCIEDAD_DEFAULT: '6202',
  SOCIEDAD_NOMBRE: 'Delivery Hero Dmarts Chile SpA',
  MONEDA_DEFAULT: 'CLP',
  CENTRO_COSTO_DEFAULT: 'CD_36_CD_Chile',
  IVA_TASA: 0.19, // IVA Chile 19%

  // Plan de Cuentas Contable Estándar SAP / ERP Retail
  CUENTAS: {
    // Pasivo / Cuentas por Pagar Proveedores
    PROVEEDORES_NACIONALES: {
      codigo: '21040000',
      nombre: 'Proveedores Nacionales Comerciales',
      tipo: 'PASIVO'
    },
    // Cuenta Transitoria de Compensación Entrada de Mercaderías / Recepción de Facturas (GR/IR)
    COMPENSACION_EM_RF: {
      codigo: '11070000',
      nombre: 'Compensación EM/RF Mercadería Bodega',
      tipo: 'ACTIVO_TRANSITORIO'
    },
    // Cuentas de Resultados / Gastos por Variaciones
    DESVIACION_PRECIO_COMPRA: {
      codigo: '51020100',
      nombre: 'Desviación en Precio de Compra (PPV)',
      tipo: 'RESULTADO_GASTO'
    },
    // Activo / Reclamo Pendiente por Faltante Físico (Nota de Crédito por Cobrar)
    RECLAMO_FALTANTE_RECEPCION: {
      codigo: '11090200',
      nombre: 'Reclamo Pendiente NC - Faltante Bodega',
      tipo: 'ACTIVO_EXIGIBLE'
    },
    // Activo / Reclamo por Artículos No Solicitados
    RECLAMO_ITEM_NO_ORDENADO: {
      codigo: '11090300',
      nombre: 'Reclamo Pendiente NC - SKU No en OC',
      tipo: 'ACTIVO_EXIGIBLE'
    },
    // Pasivo / Retención Preventiva por Aforo Comercial
    RETENCION_AFORO_COMERCIAL: {
      codigo: '21090100',
      nombre: 'Retenciones por Aforo Comercial Proveedor',
      tipo: 'PASIVO_RETENCION'
    },
    // Impuestos / Crédito Fiscal
    IVA_CREDITO_FISCAL: {
      codigo: '11080101',
      nombre: 'IVA Crédito Fiscal Operacional (19%)',
      tipo: 'ACTIVO_IMPUESTO'
    }
  }
};

/**
 * Genera el Journal Entry Voucher (JEV) completo a partir del resultado de conciliación.
 * @param {Object} reconResult Objeto generado por CruceEngine o el asistente de conciliación.
 * @param {Object} options Opciones de configuración del asiento contable.
 * @returns {Object} Estructura completa del comprobante contable (Header, Lines, Totals).
 */
function generarJournalEntryVoucher(reconResult, options) {
  if (!reconResult) {
    throw new Error('No se proporcionaron datos de conciliación para generar el JEV.');
  }

  options = options || {};
  const res = reconResult.resumen || reconResult;
  const lineasDetalle = reconResult.lineas || [];

  const companyCode = options.companyCode || JEV_CONFIG.SOCIEDAD_DEFAULT;
  const costCenter = options.costCenter || JEV_CONFIG.CENTRO_COSTO_DEFAULT;
  const includeTax = options.includeTax !== false;
  const postingDate = options.postingDate || formatearFechaIso(new Date());
  const docDate = res.fecha_emision ? String(res.fecha_emision).slice(0, 10) : postingDate;
  const voucherId = options.voucherId || `JEV-${companyCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${res.folio_factura || '0000'}`;

  // Extraer montos netos clave
  const facturadoNeto = Math.round(Number(res.total_facturado_neto || 0));
  const recepcionadoNeto = Math.round(Number(res.total_recepcionado_neto || 0));
  const descalcePrecio = Math.round(Number(res.total_descalce_precio || 0));
  const faltanteRecepcion = Math.round(Number(res.total_faltante_recepcion || 0));
  const noEnOc = Math.round(Number(res.total_no_en_oc || 0));
  const montoReclamarTotal = Math.round(Number(res.total_monto_a_reclamar || res.total_monto_reclamar || 0));

  // Cálculo de Aforo si aplica (alineado con sap_report_3wm.monto_aforo y SheetsAPI)
  let montoRetencionAforo = 0;
  if (options.aplicarAforo) {
    const rawAforo = (res.aforo_info && (res.aforo_info.monto_retenido_aforo || res.aforo_info.monto_aforo || res.aforo_info.monto_aforado))
      || res.monto_retenido_aforo
      || res.monto_aforo
      || res.monto_aforado
      || (res.sap_3wm && res.sap_3wm.monto_aforo)
      || 0;
    montoRetencionAforo = Math.round(Number(rawAforo));
  }

  const lines = [];
  let itemCounter = 1;

  // -------------------------------------------------------------
  // DÉBITOS (APLICACIÓN DEL GASTO / ACTIVO / RECLAMOS)
  // -------------------------------------------------------------

  // 1. Débito a Compensación EM/RF (Entrada de Mercancías Conforme)
  if (recepcionadoNeto > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.COMPENSACION_EM_RF.codigo,
      account_name: JEV_CONFIG.CUENTAS.COMPENSACION_EM_RF.nombre,
      dc_indicator: 'D', // Débito
      debit: recepcionadoNeto,
      credit: 0,
      cost_center: costCenter,
      assignment: `PO:${res.po_referencia || res.po_number || '-'}`,
      item_text: `Recepción Mercadería Conforme Folio ${res.folio_factura}`
    });
  }

  // 2. Desviación en Precio de Compra (PPV - Sobreprecio o Favorable)
  if (descalcePrecio > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.codigo,
      account_name: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.nombre,
      dc_indicator: 'D',
      debit: descalcePrecio,
      credit: 0,
      cost_center: costCenter,
      assignment: `PO:${res.po_referencia || res.po_number || '-'}`,
      item_text: `Sobreprecio Unitario Factura vs OC ${res.po_referencia || res.po_number || ''}`
    });
  } else if (descalcePrecio < 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.codigo,
      account_name: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.nombre + ' (Favorable)',
      dc_indicator: 'C',
      debit: 0,
      credit: Math.abs(descalcePrecio),
      cost_center: costCenter,
      assignment: `PO:${res.po_referencia || res.po_number || '-'}`,
      item_text: `Variación Favorable Costo Factura vs OC ${res.po_referencia || res.po_number || ''}`
    });
  }

  // 3. Débito a Reclamo Faltante Físico de Recepción (Bodega)
  if (faltanteRecepcion > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.RECLAMO_FALTANTE_RECEPCION.codigo,
      account_name: JEV_CONFIG.CUENTAS.RECLAMO_FALTANTE_RECEPCION.nombre,
      dc_indicator: 'D',
      debit: faltanteRecepcion,
      credit: 0,
      cost_center: costCenter,
      assignment: `FOLIO:${res.folio_factura}`,
      item_text: `Reclamo NC Faltante Físico Bodega ${res.almacen || ''}`
    });
  }

  // 4. Débito a Reclamo Ítems No Ordenados en OC
  if (noEnOc > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.RECLAMO_ITEM_NO_ORDENADO.codigo,
      account_name: JEV_CONFIG.CUENTAS.RECLAMO_ITEM_NO_ORDENADO.nombre,
      dc_indicator: 'D',
      debit: noEnOc,
      credit: 0,
      cost_center: costCenter,
      assignment: `FOLIO:${res.folio_factura}`,
      item_text: `Reclamo NC Ítems no pedidos en OC ${res.po_referencia || res.po_number || ''}`
    });
  }

  // Si no hubo desglose detallado de discrepancias pero hay monto reclamar
  const sumaDesgloses = descalcePrecio + faltanteRecepcion + noEnOc;
  const remanenteReclamar = montoReclamarTotal - sumaDesgloses;
  if (remanenteReclamar > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.RECLAMO_FALTANTE_RECEPCION.codigo,
      account_name: JEV_CONFIG.CUENTAS.RECLAMO_FALTANTE_RECEPCION.nombre,
      dc_indicator: 'D',
      debit: remanenteReclamar,
      credit: 0,
      cost_center: costCenter,
      assignment: `FOLIO:${res.folio_factura}`,
      item_text: `Ajuste Diferencia Liquidación Reclamo NC`
    });
  }

  // 5. Débito por IVA Crédito Fiscal (19% sobre el Neto Total Facturado)
  let montoIva = 0;
  if (includeTax) {
    montoIva = Math.round(facturadoNeto * JEV_CONFIG.IVA_TASA);
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.IVA_CREDITO_FISCAL.codigo,
      account_name: JEV_CONFIG.CUENTAS.IVA_CREDITO_FISCAL.nombre,
      dc_indicator: 'D',
      debit: montoIva,
      credit: 0,
      cost_center: '',
      assignment: `DTE:${res.folio_factura}`,
      item_text: `IVA Crédito Fiscal (19%) DTE Folio ${res.folio_factura}`
    });
  }

  // -------------------------------------------------------------
  // CRÉDITOS (OBLIGACIÓN CON EL PROVEEDOR / PASIVOS)
  // -------------------------------------------------------------

  const totalBrutoFactura = includeTax ? (facturadoNeto + montoIva) : facturadoNeto;

  if (montoRetencionAforo > 0) {
    // Si aplica retención de aforo, se desdobla el pasivo:
    const saldoLiquidoProveedor = Math.max(0, totalBrutoFactura - montoRetencionAforo);

    // 6a. Crédito a Proveedores Nacionales (Saldo Líquido Aprobado a Pago)
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.PROVEEDORES_NACIONALES.codigo,
      account_name: JEV_CONFIG.CUENTAS.PROVEEDORES_NACIONALES.nombre,
      dc_indicator: 'C', // Crédito
      debit: 0,
      credit: saldoLiquidoProveedor,
      cost_center: '',
      assignment: `RUT:${res.proveedor_rut || ''}`,
      item_text: `Factura ${res.folio_factura} Liq. Pago - ${res.proveedor_nombre || ''}`
    });

    // 6b. Crédito a Retención Aforo Comercial
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.RETENCION_AFORO_COMERCIAL.codigo,
      account_name: JEV_CONFIG.CUENTAS.RETENCION_AFORO_COMERCIAL.nombre,
      dc_indicator: 'C',
      debit: 0,
      credit: montoRetencionAforo,
      cost_center: costCenter,
      assignment: `AFORO:${res.proveedor_rut || ''}`,
      item_text: `Retención Preventiva Aforo Comercial 6202`
    });

  } else {
    // 6. Crédito Completo a Proveedores Nacionales por el Bruto Factura
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.PROVEEDORES_NACIONALES.codigo,
      account_name: JEV_CONFIG.CUENTAS.PROVEEDORES_NACIONALES.nombre,
      dc_indicator: 'C',
      debit: 0,
      credit: totalBrutoFactura,
      cost_center: '',
      assignment: `RUT:${res.proveedor_rut || ''}`,
      item_text: `Factura ${res.folio_factura} - ${res.proveedor_nombre || 'Proveedor'}`
    });
  }

  // -------------------------------------------------------------
  // VALIDACIÓN ESTRICTA DE CUADRATURA (DEBE == HABER)
  // -------------------------------------------------------------
  let totalDebits = 0;
  let totalCredits = 0;
  lines.forEach(l => {
    totalDebits += Number(l.debit || 0);
    totalCredits += Number(l.credit || 0);
  });

  const diferencia = Math.abs(totalDebits - totalCredits);
  const isBalanced = diferencia === 0;

  // Si existe un desajuste menor por redondeo de impuestos (<= $2 CLP), se ajusta en PPV
  if (!isBalanced && diferencia <= 2 && lines.length > 0) {
    const ajusteLine = lines.find(l => l.account === JEV_CONFIG.CUENTAS.COMPENSACION_EM_RF.codigo) || lines[0];
    if (totalDebits < totalCredits) {
      ajusteLine.debit += (totalCredits - totalDebits);
    } else {
      ajusteLine.debit -= (totalDebits - totalCredits);
    }
    totalDebits = totalCredits;
  }

  let activeEmail = 'axteroid-conciliator@pedidosya.com';
  try {
    if (typeof Session !== 'undefined' && Session.getActiveUser) {
      activeEmail = Session.getActiveUser().getEmail() || activeEmail;
    }
  } catch (eAuth) {
    // Modo ejecución en segundo plano (Trigger horario)
  }

  return {
    success: true,
    header: {
      voucher_id: voucherId,
      company_code: companyCode,
      company_name: JEV_CONFIG.SOCIEDAD_NOMBRE,
      document_date: docDate,
      posting_date: postingDate,
      currency: JEV_CONFIG.MONEDA_DEFAULT,
      doc_type: 'KR', // Tipo de Documento SAP
      reference: `FOL:${res.folio_factura || '-'} PO:${res.po_referencia || res.po_number || '-'}`,
      header_text: `Conciliacion Dmarts Folio ${res.folio_factura} - ${res.proveedor_nombre || ''}`.slice(0, 50),
      created_by: activeEmail,
      source_system: 'AXTEROID_DMARTS_CONCILIATOR'
    },
    totals: {
      total_debits: totalDebits,
      total_credits: totalCredits,
      difference: Math.abs(totalDebits - totalCredits),
      is_balanced: (Math.abs(totalDebits - totalCredits) === 0),
      currency: JEV_CONFIG.MONEDA_DEFAULT
    },
    lines: lines,
    audit_summary: {
      facturado_neto: facturadoNeto,
      recepcionado_neto: recepcionadoNeto,
      monto_a_reclamar: montoReclamarTotal,
      monto_iva: montoIva,
      total_bruto: totalBrutoFactura,
      proveedor_rut: res.proveedor_rut,
      proveedor_nombre: res.proveedor_nombre,
      po_number: res.po_referencia || res.po_number,
      folio_factura: res.folio_factura
    }
  };
}

/**
 * Convierte un Journal Entry Voucher a formato CSV compatible con la carga masiva en SAP / ERP.
 * @param {Object} jev Objeto retornado por generarJournalEntryVoucher()
 * @returns {string} Texto CSV listo para descarga.
 */
function exportarJevCsv(jev) {
  if (!jev || !jev.lines) {
    throw new Error('Objeto JEV inválido para exportación.');
  }

  const h = jev.header;
  const rows = [];

  // Metadatos de cabecera SAP / ERP
  rows.push(['# JOURNAL ENTRY VOUCHER (JEV) - SOCIEDAD 6202 (DELIVERY HERO CHILE)'].join(';'));
  rows.push([`Voucher_ID:;${h.voucher_id};Sociedad:;${h.company_code};Moneda:;${h.currency}`].join(';'));
  rows.push([`Fecha_Contabilizacion:;${h.posting_date};Fecha_Documento:;${h.document_date};Clase_Doc:;${h.doc_type}`].join(';'));
  rows.push([`Referencia:;${h.reference};Texto_Cabecera:;${h.header_text}`].join(';'));
  rows.push([`Total_Debitos:;$ ${Math.round(jev.totals.total_debits)};Total_Creditos:;$ ${Math.round(jev.totals.total_credits)};Cuadrado:;${jev.totals.is_balanced ? 'SI' : 'NO'}`].join(';'));
  rows.push(['']);

  // Columnas para importador contable
  rows.push(['Item;Indicador_DC;Cuenta_Mayor;Nombre_Cuenta;Debe_CLP;Haber_CLP;Centro_Costo;Asignacion;Texto_Posicion'].join(';'));

  jev.lines.forEach(l => {
    rows.push([
      l.item,
      l.dc_indicator,
      `"${l.account}"`,
      `"${l.account_name}"`,
      Math.round(l.debit),
      Math.round(l.credit),
      `"${l.cost_center || ''}"`,
      `"${l.assignment || ''}"`,
      `"${(l.item_text || '').replace(/"/g, '""')}"`
    ].join(';'));
  });

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Función auxiliar para formatear fechas a YYYY-MM-DD.
 */
function formatearFechaIso(dateObj) {
  const d = dateObj ? new Date(dateObj) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
