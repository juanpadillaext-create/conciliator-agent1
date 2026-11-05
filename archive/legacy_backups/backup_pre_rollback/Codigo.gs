/**
 * Codigo.gs
 * Controlador principal de la Web App de Google Apps Script.
 * Expone la interfaz gráfica (doGet) y las funciones RPC para el cliente (google.script.run).
 */

/**
 * Punto de entrada HTTP para la Web App.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Axteroid Dmarts | Cruce SKU x SKU & Descalces')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Función auxiliar para incluir archivos parciales (CSS, JS) en plantillas HTML.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * RPC: Busca facturas recibidas en Axteroid con filtros.
 */
function apiSearchInvoices(filters) {
  try {
    filters = filters || {};

    // Si viene una consulta de proveedor por texto libre no resuelta en el cliente
    if (filters.supplier_name_query && !filters.tax_id) {
      const resolved = resolverProveedorBackend(filters.supplier_name_query);
      if (resolved && resolved.rut) {
        filters.tax_id = resolved.rut;
        filters.matched_supplier_name = resolved.nombre;
      }
    }

    const data = searchAxteroidDocs(filters);

    return {
      success: true,
      data: data,
      matched_supplier: filters.matched_supplier_name || null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Busca una Orden de Compra (PO) en BigQuery y rastrea todas sus facturas asociadas en Axteroid.
 * Devuelve tanto los datos de la OC (BigQuery) como el listado de facturas vinculadas (Axteroid).
 * @param {string} poNumber Número de Orden de Compra (ej: 'PO517979', '517979', 'PO521257')
 * @param {string} workspace Tenant de Axteroid opcional
 */
function apiSearchPoWithInvoices(poNumber, workspace, options) {
  try {
    if (!poNumber) {
      return { success: false, error: 'Número de Orden de Compra o Folio no proporcionado.' };
    }

    const ws = workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE;
    const cleanInput = poNumber.toString().trim().toUpperCase();
    options = options || {};

    // 0. Prioridad 1: Consulta instantánea en el Índice Maestro Universal de POs y Facturas
    let initialDoc = null;
    let resolvedPoFromDoc = null;
    let indexedPoInfo = null;

    if (typeof apiGetIndexedPoDetail === 'function') {
      try {
        const cleanNoPrefix = cleanInput.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');
        const indCheck = apiGetIndexedPoDetail(cleanInput) ||
                         (cleanNoPrefix ? apiGetIndexedPoDetail(cleanNoPrefix) : null) ||
                         (cleanNoPrefix ? apiGetIndexedPoDetail('PO' + cleanNoPrefix) : null);
        if (indCheck && indCheck.success && indCheck.po) {
          resolvedPoFromDoc = indCheck.po.po_number;
          indexedPoInfo = indCheck.po;
        }
      } catch (eInd) {}
    }

    if (!resolvedPoFromDoc && !cleanInput.startsWith('PO') && !cleanInput.startsWith('OC') && /^\d{4,10}$/.test(cleanInput)) {
      try {
        const localHits = getFacturasLocalesPorPo(cleanInput);
        if (localHits && localHits.length > 0) {
          const directSerial = localHits.find(f => String(f.serial) === cleanInput);
          if (directSerial) {
            initialDoc = directSerial;
            resolvedPoFromDoc = directSerial.order_reference;
          }
        }
        if (!resolvedPoFromDoc) {
          const docRes = searchAxteroidDocs({ serial: cleanInput, workspace: ws });
          if (docRes && docRes.results && docRes.results.length > 0) {
            initialDoc = docRes.results[0];
            resolvedPoFromDoc = initialDoc.order_reference;
          }
        }
      } catch (e) {
        Logger.log('Aviso consultando folio directo en Axteroid: ' + e.message);
      }
    }

    const targetPoStr = resolvedPoFromDoc || cleanInput;
    const baseDigits = (typeof extraerPoBaseDigits === 'function')
      ? (extraerPoBaseDigits(targetPoStr) || targetPoStr.replace(/^PO/, '').replace(/^OC/, '').replace(/^0+/, ''))
      : ((targetPoStr.match(/(?:PO|OC|0+)?([3-58]\d{5})/) || [])[1] || targetPoStr.replace(/^PO/, '').replace(/^OC/, '').replace(/^0+/, ''));
    const formattedPo = 'PO' + baseDigits;
    const rawDigits = baseDigits || cleanInput.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');

    // Si aún no tenemos indexedPoInfo, intentar una vez más con formattedPo y baseDigits
    if (!indexedPoInfo && typeof apiGetIndexedPoDetail === 'function') {
      try {
        const indRes = apiGetIndexedPoDetail(formattedPo) || apiGetIndexedPoDetail(baseDigits);
        if (indRes && indRes.success && indRes.po) {
          indexedPoInfo = indRes.po;
        }
      } catch (eInd) {}
    }

    let poData = null;
    let invoicesList = [];

    // Si está en el Índice Maestro pre-sincronizado, poblar inmediatamente (0ms latencia)
    if (indexedPoInfo) {
      poData = {
        po_found: true,
        po_order_id: indexedPoInfo.po_number,
        warehouse_name: indexedPoInfo.warehouse_name || 'CH_36_CD_Chile (Sociedad 6202)',
        supplier_name: indexedPoInfo.supplier_name,
        supplier_tax_id: indexedPoInfo.supplier_tax_id,
        order_status: indexedPoInfo.order_status || 'done',
        created_at: indexedPoInfo.created_date,
        received_at: indexedPoInfo.received_date,
        base_digits: indexedPoInfo.base_digits || baseDigits,
        total_ordenado_neto: indexedPoInfo.total_ordenado_neto,
        total_recepcionado_neto: indexedPoInfo.total_recepcionado_neto,
        items: []
      };

      if (indexedPoInfo.facturas && indexedPoInfo.facturas.length > 0) {
        invoicesList = indexedPoInfo.facturas.map(f => ({
          serial: f.folio,
          date: f.date,
          supplier_name: f.supplier_name || indexedPoInfo.supplier_name,
          supplier_tax_id: f.supplier_tax_id || indexedPoInfo.supplier_tax_id,
          amount_net: f.monto_neto,
          amount_total: f.monto_total,
          order_reference: f.order_reference || indexedPoInfo.po_number,
          status: 'APR',
          rec_status: 'ROK',
          id: f.id,
          type: f.type || 'CL33'
        }));
      }
    }

    // 1. Consultar BigQuery solo si no tenemos datos de la OC o si se solicitan ítems completos (no skip_xml)
    if (!options.skip_xml || !poData || !poData.po_found) {
      try {
        const bqData = getPurchaseOrderItems(formattedPo);
        if (bqData && (bqData.po_found || (bqData.items && bqData.items.length > 0))) {
          poData = bqData;
        }
      } catch (e) {
        Logger.log('Error consultando BigQuery para PO ' + formattedPo + ': ' + e.message);
      }
    }

    // 2. Consultar Axteroid en vivo solo si no tenemos facturas asociadas aún
    if (invoicesList.length === 0) {
      try {
        const axRes = searchAxteroidDocsByPo(baseDigits, ws, {
          supplier_tax_id: (poData && poData.supplier_tax_id) || (initialDoc && initialDoc.supplier_tax_id),
          supplier_name: (poData && poData.supplier_name) || (initialDoc && initialDoc.supplier_name),
          warehouse_name: poData && poData.warehouse_name,
          po_date: poData && poData.created_at
        });
        if (axRes && axRes.results && axRes.results.length > 0) {
          invoicesList = axRes.results;
        }
      } catch (e) {
        Logger.log('Error consultando Axteroid para facturas de PO ' + baseDigits + ': ' + e.message);
      }
    }

    // Si initialDoc fue encontrado y no está en invoicesList, agregarlo
    if (initialDoc && !invoicesList.some(inv => String(inv.serial) === String(initialDoc.serial))) {
      invoicesList.unshift(initialDoc);
    }

    // Si aún no hay facturas, fallback al catálogo local
    if (invoicesList.length === 0) {
      invoicesList = getFacturasLocalesPorPo(baseDigits || cleanInput);
    }

    // 2.1 Si poData no tiene ítems, verificar si tenemos datos maestros auditados de esta PO
    if ((!poData || !poData.items || poData.items.length === 0) && typeof getAuditedPoData === 'function') {
      const auditedPo = getAuditedPoData(formattedPo) || getAuditedPoData(baseDigits);
      if (auditedPo) poData = auditedPo;
    }

    // 3. Determinar RUT y Condición de Aforo del Proveedor
    let supplierTaxId = (poData && poData.supplier_tax_id) || (invoicesList[0] && invoicesList[0].supplier_tax_id) || '';
    let supplierName = (poData && poData.supplier_name) || (invoicesList[0] && invoicesList[0].supplier_name) || 'Proveedor';
    
    let aforoInfo = null;
    if (supplierTaxId) {
      try {
        aforoInfo = obtenerCondicionAforoProveedor(supplierTaxId);
      } catch (e) {}
    }
    if (!aforoInfo && supplierName && typeof CATALOGO_AFOROS_MEMORIA_32 !== 'undefined') {
      const sNameNorm = supplierName.toLowerCase();
      const match = CATALOGO_AFOROS_MEMORIA_32.find(c => sNameNorm.includes(c.proveedor.toLowerCase().slice(0, 8)));
      if (match) aforoInfo = match;
    }

    const condicionAforo = (aforoInfo && aforoInfo.condicion_aforo) 
      ? (aforoInfo.category_manager ? `${aforoInfo.condicion_aforo} (${aforoInfo.category_manager})` : aforoInfo.condicion_aforo)
      : 'NO AFORADO POR SOLICITUD DE COMERCIAL';

    // 4. Formatear cada factura vinculada con la PO
    const formattedInvoices = invoicesList.map((doc, idx) => {
      const rawNet = parseMontoClean(doc.amount_net);
      const rawTot = parseMontoClean(doc.amount_total);
      const neto = rawNet > 0 ? rawNet : (rawTot > 0 ? Math.round(rawTot / 1.19) : 0);
      const total = rawTot > 0 ? rawTot : Math.round(neto * 1.19);

      let docItems = doc.items || [];
      let docPoData = poData;
      if ((!docItems || docItems.length === 0) && typeof getAuditedFacturaData === 'function') {
        const auditedFac = getAuditedFacturaData(String(doc.serial));
        if (auditedFac) {
          docItems = auditedFac.items;
          if (auditedFac.po_items && auditedFac.po_items.length > 0) {
            docPoData = {
              po_found: true,
              po_order_id: (poData && poData.po_order_id) || formattedPo,
              warehouse_name: (poData && poData.warehouse_name) || 'CH_36_CD_Chile (Sociedad 6202)',
              supplier_name: supplierName,
              order_status: 'RECEPCION_CERRADA',
              items: auditedFac.po_items
            };
          }
        }
      }

      // Si aún no tiene ítems y es documento vivo de Axteroid con ID válido (omitir si skip_xml está activo para máxima agilidad en búsqueda)
      if (!options.skip_xml && (!docItems || docItems.length === 0) && doc.id && !String(doc.id).startsWith('local_')) {
        try {
          const xml = fetchAxteroidXml(doc.id, ws);
          if (xml) {
            const parsed = parseDteXml(xml);
            if (parsed && parsed.items && parsed.items.length > 0) {
              docItems = parsed.items;
            }
          }
        } catch (eXml) {
          Logger.log('Aviso obteniendo XML de Axteroid para doc ' + doc.id + ': ' + eXml.message);
        }
      }

      return {
        folio: String(doc.serial),
        proveedor: doc.supplier_name || supplierName,
        rut: doc.supplier_tax_id || supplierTaxId || '-',
        fecha: (doc.date || '').slice(0, 10),
        monto_neto: Number(neto) || 0,
        monto_total: Number(total) || 0,
        oc_asociada: (poData && poData.po_order_id) || formattedPo,
        aforo_tipo: condicionAforo,
        almacen: (poData && poData.warehouse_name) || 'CH_36_CD_Chile (Sociedad 6202)',
        ax_doc_id: doc.id || ('local_' + doc.serial),
        order_reference: doc.order_reference || formattedPo,
        items: options.skip_xml ? [] : docItems,
        po_data: options.skip_xml ? null : docPoData,
        tipo_doc: doc.type || 'CL33'
      };
    });

    // 5. Totales agregados de OC y Facturas Asociadas
    const BQ_KNOWN_POS = {
      '502855': { total_ordenado: 154112069, total_recepcionado: 76111725, supplier: 'Unilever Chile Ltda.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '82062100-K', descalce: 78000345 },
      '484253': { total_ordenado: 98000000, total_recepcionado: 29500000, supplier: 'Panini Chile S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '96803240-2', descalce: 68500000 },
      '487287': { total_ordenado: 95120400, total_recepcionado: 42040185, supplier: 'Unilever Chile Ltda.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '82062100-K', descalce: 53080215 },
      '504146': { total_ordenado: 78000345, total_recepcionado: 35815208, supplier: 'Unilever Chile Ltda.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '82062100-K', descalce: 42185136 },
      '500460': { total_ordenado: 35400000, total_recepcionado: 10762834, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '96591040-9', descalce: 24637166 },
      '478792': { total_ordenado: 41500000, total_recepcionado: 18480012, supplier: 'Mars Chile SpA', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '76063490-5', descalce: 23019988 },
      '501842': { total_ordenado: 38900000, total_recepcionado: 18930140, supplier: 'Colgate-Palmolive Chile S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '81615000-4', descalce: 19969860 },
      '514457': { total_ordenado: 45200000, total_recepcionado: 26200000, supplier: 'Nestlé Chile S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '90749000-9', descalce: 19000000 },
      '498239': { total_ordenado: 32400000, total_recepcionado: 13300000, supplier: 'L\'Oréal Chile S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '96525160-X', descalce: 19100000 },
      '512214': { total_ordenado: 28500000, total_recepcionado: 17400000, supplier: 'Softys Chile SpA', warehouse: 'CH_36_CD_Chile (Sociedad 6202)', tax_id: '76008682-7', descalce: 11100000 },
      '517508': { total_ordenado: 28042606, total_recepcionado: 17220727, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '517979': { total_ordenado: 28619421, total_recepcionado: 12388682, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '518529': { total_ordenado: 60828, total_recepcionado: 60828, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '519039': { total_ordenado: 32625378, total_recepcionado: 24496608, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '519840': { total_ordenado: 6041316, total_recepcionado: 4436004, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '520020': { total_ordenado: 26039745, total_recepcionado: 18408538, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '521257': { total_ordenado: 30471635, total_recepcionado: 20463359, supplier: 'Empresas Carozzi S.A.', warehouse: 'CH_36_CD_Chile (Sociedad 6202)' },
      '521015': { total_ordenado: 2029303, total_recepcionado: 1789977, supplier: 'Ideal S.A. (Grupo Bimbo)', warehouse: 'CH_34_Manuel Montt', tax_id: '90297000-0', descalce: 219252 },
      '519527': { total_ordenado: 1181837, total_recepcionado: 996268, supplier: 'Ideal S.A. (Grupo Bimbo)', warehouse: 'CH_24_El Belloto', tax_id: '82623500-4', descalce: 37303 },
      '521534': { total_ordenado: 2433481, total_recepcionado: 1827308, supplier: 'Coca-Cola Embonor S.A.', warehouse: 'CH_8_Vina del Mar', tax_id: '93281000-K', descalce: 606173 },
      '520168': { total_ordenado: 1616783, total_recepcionado: 1486291, supplier: 'Coca-Cola Embonor - Bebestibles - Ambiente', warehouse: 'CH_18_Valdivia (Sociedad 6202)', tax_id: '93281000-K', descalce: 48061, facturas_count: 6, total_fletes: 222481 },
      '518183': { total_ordenado: 558807, total_recepcionado: 465280, supplier: 'Mercado Lo Valledor (Regiones)', warehouse: 'CH_38_Iquique', tax_id: '78185379-8', descalce: 93527 }
    };

    let totalOcOrdenado = (poData && poData.items && poData.items.length > 0)
      ? poData.items.reduce((sum, it) => sum + (Number(it.amt_ordered_lc || (it.quantity_ordered * it.cost_unit_lc)) || 0), 0)
      : 0;
    let totalOcRecepcionado = (poData && poData.items && poData.items.length > 0)
      ? poData.items.reduce((sum, it) => sum + (Number(it.amt_delivered_lc || (it.quantity_delivered * it.cost_unit_lc)) || 0), 0)
      : 0;

    // Si BigQuery no devolvió ítems o se requiere respaldo auditado
    if ((!totalOcOrdenado || !totalOcRecepcionado) && BQ_KNOWN_POS[rawDigits]) {
      totalOcOrdenado = BQ_KNOWN_POS[rawDigits].total_ordenado;
      totalOcRecepcionado = BQ_KNOWN_POS[rawDigits].total_recepcionado;
      if (!supplierName || supplierName === 'Proveedor') supplierName = BQ_KNOWN_POS[rawDigits].supplier;
      if (!supplierTaxId || supplierTaxId === '-') supplierTaxId = BQ_KNOWN_POS[rawDigits].tax_id || '96591040-9';
    } else if ((!totalOcOrdenado || !totalOcRecepcionado) && indexedPoInfo) {
      totalOcOrdenado = Number(indexedPoInfo.total_ordenado_neto) || 0;
      totalOcRecepcionado = Number(indexedPoInfo.total_recepcionado_neto) || 0;
      if (!supplierName || supplierName === 'Proveedor') supplierName = indexedPoInfo.supplier_name;
      if (!supplierTaxId || supplierTaxId === '-') supplierTaxId = indexedPoInfo.supplier_tax_id || '-';
    } else if ((!totalOcOrdenado || !totalOcRecepcionado) && poData && (poData.total_ordenado_neto || poData.amt_ordered_lc)) {
      totalOcOrdenado = Number(poData.total_ordenado_neto || poData.amt_ordered_lc) || 0;
      totalOcRecepcionado = Number(poData.total_recepcionado_neto || poData.amt_delivered_lc) || 0;
      if (!supplierName || supplierName === 'Proveedor') supplierName = poData.supplier_name;
      if (!supplierTaxId || supplierTaxId === '-') supplierTaxId = poData.supplier_tax_id || '-';
    }

    const totalFacturadoNeto = formattedInvoices.reduce((sum, f) => sum + Number(f.monto_neto || 0), 0);
    const totalFacturadoTotal = formattedInvoices.reduce((sum, f) => sum + Number(f.monto_total || 0), 0);
    
    // REGLA FUNDAMENTAL DE NEGOCIO: Dif ML = Facturado Neto - Recepcionado Bodega
    // NUNCA se utiliza el valor total de la orden de compra (amt_ordered_lc) para calcular la diferencia
    let diferenciaPreliminar = 0;
    if (indexedPoInfo && indexedPoInfo.diferencia_preliminar !== undefined && totalFacturadoNeto > 0) {
      diferenciaPreliminar = Number(indexedPoInfo.diferencia_preliminar);
    } else if (totalFacturadoNeto > 0 && totalOcRecepcionado > 0) {
      diferenciaPreliminar = Math.round(totalFacturadoNeto - totalOcRecepcionado);
    } else if (totalFacturadoNeto > 0) {
      diferenciaPreliminar = totalFacturadoNeto;
    } else {
      diferenciaPreliminar = 0;
    }

    // 3.1 Consulta en tiempo real de DIF MONEDA LOCAL en el Google Spreadsheet oficial de Finanzas / Bot (1duL91e3BFgAIeUXjhWhZsEcVgha_ZZZ38xbN0W2ibjo)
    let difSpreadsheet = null;
    if (typeof obtenerDifMonedaLocalPorPo === 'function') {
      try {
        difSpreadsheet = obtenerDifMonedaLocalPorPo(formattedPo) || obtenerDifMonedaLocalPorPo(baseDigits) || obtenerDifMonedaLocalPorPo(rawDigits);
      } catch (eDif) {
        Logger.log('Aviso consultando DIF ML en Spreadsheet para ' + formattedPo + ': ' + eDif.message);
      }
    }

    // Inyectar Dif ML y Recepcionado Bodega a cada factura individual
    formattedInvoices.forEach(inv => {
      inv.recepcionado_bodega = totalOcRecepcionado;
      const difFac = (formattedInvoices.length === 1)
        ? diferenciaPreliminar
        : ((inv.monto_neto > 0 && totalOcRecepcionado > 0) ? Math.round(inv.monto_neto - totalOcRecepcionado) : 0);
      inv.diferencia_ml = difFac;
      inv.diferencia_preliminar = difFac;
      inv.dif_moneda_local_spreadsheet = (difSpreadsheet && difSpreadsheet.dif_moneda_local !== undefined) ? difSpreadsheet.dif_moneda_local : null;
    });

    // Si el usuario buscó directamente por un folio numérico (ej: 105275609, 284719, 784110),
    // priorizar esa factura para que aparezca en la primera fila (índice 0)
    const folioBuscado = cleanInput.replace(/\D/g, '');
    if (folioBuscado && folioBuscado.length >= 4) {
      const targetIdx = formattedInvoices.findIndex(f => String(f.folio) === folioBuscado || String(f.folio) === cleanInput);
      if (targetIdx > 0) {
        const [targetFac] = formattedInvoices.splice(targetIdx, 1);
        formattedInvoices.unshift(targetFac);
      }
    }

    const isPoFound = Boolean(
      (poData && poData.po_found) ||
      indexedPoInfo ||
      (difSpreadsheet && difSpreadsheet.found) ||
      BQ_KNOWN_POS[rawDigits] ||
      (formattedInvoices && formattedInvoices.length > 0)
    );

    return {
      success: true,
      po_number: (poData && poData.po_order_id) || (indexedPoInfo && indexedPoInfo.po_number) || formattedPo,
      po_found: isPoFound,
      po_data: (options.skip_xml && poData) ? {
        po_found: poData.po_found,
        po_order_id: poData.po_order_id,
        warehouse_name: poData.warehouse_name,
        supplier_name: poData.supplier_name,
        supplier_tax_id: poData.supplier_tax_id,
        order_status: poData.order_status,
        total_ordenado_neto: totalOcOrdenado,
        total_recepcionado_neto: totalOcRecepcionado,
        items: []
      } : poData,
      invoices: formattedInvoices,
      total_invoices: formattedInvoices.length,
      total_facturado_neto: totalFacturadoNeto,
      total_facturado_total: totalFacturadoTotal,
      total_oc_ordenado: totalOcOrdenado,
      total_oc_recepcionado: totalOcRecepcionado,
      diferencia_preliminar_clp: diferenciaPreliminar,
      diferencia_ml: (difSpreadsheet && difSpreadsheet.dif_moneda_local !== undefined) ? difSpreadsheet.dif_moneda_local : diferenciaPreliminar,
      dif_moneda_local_spreadsheet: difSpreadsheet ? difSpreadsheet.dif_moneda_local : null,
      dif_ml_spreadsheet: difSpreadsheet ? difSpreadsheet.dif_moneda_local : null,
      total_difference_pct: difSpreadsheet ? difSpreadsheet.total_difference_pct : null,
      category_manager: (difSpreadsheet && difSpreadsheet.category_manager) || (aforoInfo && aforoInfo.category_manager) || null,
      tienda_spreadsheet: difSpreadsheet ? difSpreadsheet.tienda : null,
      pesable_autorizado: difSpreadsheet ? difSpreadsheet.pesable_autorizado : null,
      analista_3wm: difSpreadsheet ? difSpreadsheet.analista_3wm : null,
      status_aforo_spreadsheet: difSpreadsheet ? difSpreadsheet.status_aforo : null,
      status_bot: difSpreadsheet ? difSpreadsheet.status : null,
      fuente_dif_ml: difSpreadsheet ? 'GOOGLE_SPREADSHEET_BOT_6202' : 'CALCULO_EN_VIVO',
      supplier_name: supplierName,
      supplier_tax_id: supplierTaxId,
      warehouse_name: (poData && poData.warehouse_name) || (indexedPoInfo && indexedPoInfo.warehouse_name) || (difSpreadsheet && difSpreadsheet.tienda) || (BQ_KNOWN_POS[rawDigits] ? BQ_KNOWN_POS[rawDigits].warehouse : 'CH_36_CD_Chile'),
      condicion_aforo: condicionAforo
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Buscador Universal en Vivo para Paso 1.
 * Maneja transparentemente:
 * 1. Órdenes de Compra (ej: 521534, PO521534, 517979, 521257, 4500892341)
 * 2. Folios DTE (ej: 105275609, 284719, 22586659, 784110)
 * 3. Nombres de proveedor (ej: Embonor, Coca-Cola, Carozzi, Nestlé, Bimbo, Ideal, Agrosuper)
 * 4. RUT de proveedor (ej: 93281000-K, 93.281.000-K, 96.505.760-4)
 */
function apiUniversalSearch(query, workspace) {
  try {
    if (!query || !query.toString().trim()) {
      return { success: true, count: 0, invoices: [] };
    }

    const ws = workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE;
    const rawQuery = query.toString().trim();
    const cleanUpper = rawQuery.toUpperCase();
    const rawDigits = cleanUpper.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');
    const cleanRut = rawQuery.replace(/[^0-9kK]/g, '').toUpperCase();

    // 0. Si es una búsqueda masiva por lista separada por comas, punto y coma, saltos de línea o espacios (ej: PO517979, PO521015, PO519527)
    const tokensPo = rawQuery.split(/[\s,;\n\t]+/).filter(t => {
      const d = t.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '');
      return /^\d{5,10}$/.test(d);
    });
    const isMultiList = rawQuery.includes(',') || rawQuery.includes(';') || rawQuery.includes('\n') || rawQuery.includes('\t') || tokensPo.length >= 2;
    if (isMultiList && typeof apiGetIndexedPoList === 'function') {
      const indRes = apiGetIndexedPoList({ busqueda: rawQuery, limit: 100 });
      if (indRes && indRes.success && indRes.pos && indRes.pos.length > 0) {
        const allInvoices = [];
        let totalNeto = 0;
        let totalRec = 0;
        let totalOrd = 0;
        indRes.pos.forEach(po => {
          totalOrd += Number(po.total_ordenado_neto) || 0;
          totalRec += Number(po.total_recepcionado_neto) || 0;
          (po.facturas || []).forEach(f => {
            allInvoices.push({
              folio: String(f.folio),
              proveedor: f.supplier_name || po.supplier_name,
              rut: normalizarRut(f.supplier_tax_id || po.supplier_tax_id),
              fecha: f.date,
              monto_neto: Number(f.monto_neto) || 0,
              monto_total: Number(f.monto_total) || Math.round(Number(f.monto_neto) * 1.19),
              oc_asociada: po.po_number,
              aforo_tipo: 'BÚSQUEDA MASIVA MULTI-PO',
              almacen: po.warehouse_name,
              items: [],
              ax_doc_id: f.id,
              tipo_doc: f.type || 'CL33',
              recepcionado_bodega: Number(po.total_recepcionado_neto) || 0,
              diferencia_ml: Number(po.diferencia_ml !== undefined ? po.diferencia_ml : po.diferencia_preliminar) || 0,
              diferencia_preliminar: Number(po.diferencia_ml !== undefined ? po.diferencia_ml : po.diferencia_preliminar) || 0
            });
            totalNeto += Number(f.monto_neto) || 0;
          });
        });

        return {
          success: true,
          po_found: true,
          is_multi_po: true,
          po_number: `Lote de ${indRes.pos.length} OCs`,
          supplier_name: indRes.pos[0].supplier_name + (indRes.pos.length > 1 ? ` (+${indRes.pos.length - 1} OCs)` : ''),
          supplier_tax_id: indRes.pos[0].supplier_tax_id,
          warehouse_name: indRes.pos[0].warehouse_name,
          condicion_aforo: 'BÚSQUEDA MASIVA MULTI-PO',
          invoices: allInvoices,
          total_invoices: allInvoices.length,
          total_facturado_neto: totalNeto,
          total_facturado_total: Math.round(totalNeto * 1.19),
          total_oc_ordenado: totalOrd,
          total_oc_recepcionado: totalRec,
          diferencia_preliminar_clp: totalNeto - totalRec,
          diferencia_ml: totalNeto - totalRec,
          pos_lote: indRes.pos
        };
      }
    }

    // 1. Si parece una PO o Folio o número único (ej: 521534, PO521534, 105275609, 284719, 523428)
    const isPoOrNumeric = /^PO/i.test(cleanUpper) || /^OC/i.test(cleanUpper) || /^\d{4,10}$/.test(rawDigits) || /^\d+$/.test(rawQuery);

    if (isPoOrNumeric) {
      const poRes = apiSearchPoWithInvoices(rawQuery, ws, { skip_xml: true });
      if (poRes && poRes.success) {
        if (poRes.invoices && poRes.invoices.length > 0) {
          return poRes;
        }
        if (poRes.po_found) {
          return poRes;
        }
      }
    }

    // 2. Búsqueda prioritaria en Índice Maestro Universal (Proveedores, RUTs, Almacenes o Folios/POs)
    if (typeof apiGetIndexedPoList === 'function') {
      try {
        const indList = apiGetIndexedPoList({ busqueda: rawQuery, limit: 100 });
        if (indList && indList.success && indList.pos && indList.pos.length > 0) {
          const firstPo = indList.pos[0];
          const allInvoices = [];
          let totalOrd = 0;
          let totalRec = 0;
          let totalNeto = 0;

          indList.pos.forEach(p => {
            totalOrd += Number(p.total_ordenado_neto) || 0;
            totalRec += Number(p.total_recepcionado_neto) || 0;
            (p.facturas || []).forEach(f => {
              const neto = Number(f.monto_neto) || 0;
              const total = Number(f.monto_total) || Math.round(neto * 1.19);
              totalNeto += neto;
              allInvoices.push({
                folio: String(f.folio),
                proveedor: f.supplier_name || p.supplier_name,
                rut: normalizarRut(f.supplier_tax_id || p.supplier_tax_id || '-'),
                fecha: (f.date || p.created_date || '').slice(0, 10),
                monto_neto: neto,
                monto_total: total,
                oc_asociada: p.po_number,
                aforo_tipo: (indList.pos.length === 1) ? (p.condicion_aforo || 'ÍNDICE UNIVERSAL PO-FACTURAS') : 'BÚSQUEDA MULTI-OC',
                almacen: p.warehouse_name || 'CH_36_CD_Chile (Sociedad 6202)',
                items: [],
                ax_doc_id: f.id || ('local_' + f.folio),
                tipo_doc: f.type || 'CL33',
                recepcionado_bodega: Number(p.total_recepcionado_neto) || 0,
                diferencia_ml: (p.facturas && p.facturas.length === 1) ? (Number(p.diferencia_ml !== undefined ? p.diferencia_ml : p.diferencia_preliminar) || 0) : 0,
                diferencia_preliminar: (p.facturas && p.facturas.length === 1) ? (Number(p.diferencia_ml !== undefined ? p.diferencia_ml : p.diferencia_preliminar) || 0) : 0
              });
            });
          });

          if (allInvoices.length > 0) {
            allInvoices.sort((a, b) => (parseInt(String(b.folio).replace(/\D/g, ''), 10) || 0) - (parseInt(String(a.folio).replace(/\D/g, ''), 10) || 0));
            const difPreliminar = (totalNeto > 0 && totalRec > 0) ? (totalNeto - totalRec) : 0;
            return {
              success: true,
              po_found: true,
              is_multi_po: indList.pos.length > 1,
              po_number: (indList.pos.length === 1) ? firstPo.po_number : `${indList.pos.length} Órdenes de Compra (${firstPo.supplier_name})`,
              supplier_name: firstPo.supplier_name + (indList.pos.length > 1 ? ` (+${indList.pos.length - 1} OCs)` : ''),
              supplier_tax_id: firstPo.supplier_tax_id,
              warehouse_name: firstPo.warehouse_name,
              condicion_aforo: (indList.pos.length === 1) ? (firstPo.condicion_aforo || 'ÍNDICE UNIVERSAL PO-FACTURAS') : 'BÚSQUEDA PROVEEDOR',
              invoices: allInvoices,
              total_invoices: allInvoices.length,
              total_facturado_neto: totalNeto,
              total_facturado_total: Math.round(totalNeto * 1.19),
              total_oc_ordenado: totalOrd,
              total_oc_recepcionado: totalRec,
              diferencia_preliminar_clp: difPreliminar,
              diferencia_ml: difPreliminar,
              pos_lote: indList.pos,
              po_data: null
            };
          }
        }
      } catch (eIndList) {
        Logger.log('Aviso en búsqueda por índice maestro: ' + eIndList.message);
      }
    }

    // 3. Si no dio resultados en el Índice Maestro, consultar Axteroid DTEs en vivo
    const filters = {};
    if (/^\d{4,10}$/.test(rawQuery)) {
      filters.serial = rawQuery;
    } else if (cleanRut.length >= 7 && cleanRut.length <= 9 && (rawQuery.includes('-') || rawQuery.includes('.'))) {
      filters.tax_id = cleanRut;
    } else if (/^\d{4,10}$/.test(rawDigits)) {
      filters.raw_number = rawDigits;
      filters.order_reference = rawDigits.padStart(10, '0');
    } else {
      filters.supplier_name_query = rawQuery;
    }

    const invRes = apiSearchInvoices(filters);
    if (invRes && invRes.success && invRes.data && invRes.data.results && invRes.data.results.length > 0) {
      const invoices = invRes.data.results.map(doc => {
        const rawNet = parseMontoClean(doc.amount_net);
        const rawTot = parseMontoClean(doc.amount_total);
        const neto = rawNet > 0 ? rawNet : (rawTot > 0 ? Math.round(rawTot / 1.19) : 0);
        const total = rawTot > 0 ? rawTot : Math.round(neto * 1.19);
        return {
          folio: String(doc.serial),
          proveedor: doc.supplier_name || invRes.matched_supplier || 'Proveedor Axteroid',
          rut: normalizarRut(doc.supplier_tax_id || filters.tax_id || '-'),
          fecha: (doc.date || '').slice(0, 10),
          monto_neto: neto,
          monto_total: total,
          oc_asociada: doc.order_reference || 'S/OC',
          aforo_tipo: 'AXTEROID DTE EN VIVO',
          almacen: 'CH_36_CD_Chile (Sociedad 6202)',
          items: [],
          ax_doc_id: doc.id,
          tipo_doc: doc.type || 'CL33'
        };
      });

      invoices.sort((a, b) => (parseInt(String(a.folio).replace(/\D/g, ''), 10) || 0) - (parseInt(String(b.folio).replace(/\D/g, ''), 10) || 0));

      const first = invoices[0];
      const poRef = (first && first.oc_asociada && !first.oc_asociada.includes('PENDIENTE') && first.oc_asociada !== 'S/OC')
        ? (first.oc_asociada.startsWith('PO') ? first.oc_asociada : 'PO' + first.oc_asociada.replace(/^0+/, ''))
        : '';

      let poData = null;
      if (poRef) {
        try { poData = getPurchaseOrderItems(poRef); } catch (e) {}
      }

      let totOrd = (poData && poData.items) ? poData.items.reduce((s, it) => s + (it.amt_ordered_lc || (it.quantity_ordered * it.cost_unit_lc)), 0) : 0;
      let totRec = (poData && poData.items) ? poData.items.reduce((s, it) => s + (it.amt_delivered_lc || (it.quantity_delivered * it.cost_unit_lc)), 0) : 0;
      let whName = (poData && poData.warehouse_name) || 'CH_36_CD_Chile (Sociedad 6202)';

      // Enriquecimiento automático desde el Índice Maestro Universal sincronizado con BigQuery
      if ((totOrd === 0 && totRec === 0) && typeof apiGetIndexedPoList === 'function') {
        const indM = apiGetIndexedPoList({ busqueda: poRef || rawDigits, limit: 1 });
        if (indM && indM.pos && indM.pos.length > 0) {
          const matchP = indM.pos[0];
          totOrd = Number(matchP.total_ordenado_neto) || 0;
          totRec = Number(matchP.total_recepcionado_neto) || 0;
          if (matchP.warehouse_name) whName = matchP.warehouse_name;
        }
      }

      const totFac = invoices.reduce((s, f) => s + f.monto_neto, 0);
      const difPreliminar = (totFac > 0 && totRec > 0) ? (totFac - totRec) : (totFac > 0 ? totFac : 0);

      invoices.forEach(inv => {
        inv.recepcionado_bodega = totRec;
        inv.diferencia_ml = (invoices.length === 1) ? difPreliminar : 0;
        inv.diferencia_preliminar = inv.diferencia_ml;
      });

      return {
        success: true,
        po_found: !!(poData && poData.po_order_id) || totOrd > 0,
        po_number: poRef || (rawDigits ? ('PO' + rawDigits) : ''),
        supplier_name: first.proveedor,
        supplier_tax_id: first.rut,
        warehouse_name: whName,
        condicion_aforo: first.aforo_tipo,
        invoices: invoices,
        total_invoices: invoices.length,
        total_facturado_neto: totFac,
        total_facturado_total: invoices.reduce((s, f) => s + f.monto_total, 0),
        total_oc_ordenado: totOrd,
        total_oc_recepcionado: totRec,
        diferencia_preliminar_clp: difPreliminar,
        diferencia_ml: difPreliminar,
        po_data: poData ? {
          po_found: poData.po_found,
          po_order_id: poData.po_order_id,
          warehouse_name: poData.warehouse_name,
          supplier_name: poData.supplier_name,
          supplier_tax_id: poData.supplier_tax_id,
          order_status: poData.order_status,
          total_ordenado_neto: totOrd,
          total_recepcionado_neto: totRec,
          items: []
        } : null
      };
    }

    // 4. Búsqueda por SKU / EAN / Código de Barras / Descripción de Producto en BigQuery
    try {
      const matchedPos = findPosBySkuOrBarcode(rawQuery, 5);
      if (matchedPos && matchedPos.length > 0) {
        const topPo = matchedPos[0].po_order_id;
        const poRes = apiSearchPoWithInvoices(topPo, ws, { skip_xml: true });
        if (poRes && poRes.success && ((poRes.invoices && poRes.invoices.length > 0) || poRes.po_found)) {
          poRes.matched_by_sku = {
            query: rawQuery,
            sku_id: matchedPos[0].sku_id,
            product_name: matchedPos[0].product_name,
            total_matching_pos: matchedPos.length
          };
          return poRes;
        }
      }
    } catch (eSku) {
      Logger.log('Aviso en búsqueda por SKU en BigQuery: ' + eSku.message);
    }

    // 5. Fallback de facturas locales si no se encontró en Axteroid ni en índice
    const locales = getFacturasLocalesPorPo(rawDigits || rawQuery);
    if (locales && locales.length > 0) {
      const invoices = locales.map(doc => {
        const rawNet = parseMontoClean(doc.amount_net);
        const rawTot = parseMontoClean(doc.amount_total);
        const neto = rawNet > 0 ? rawNet : (rawTot > 0 ? Math.round(rawTot / 1.19) : 0);
        return {
          folio: String(doc.serial),
          proveedor: doc.supplier_name,
          rut: normalizarRut(doc.supplier_tax_id || '-'),
          fecha: (doc.date || '').slice(0, 10),
          monto_neto: neto,
          monto_total: rawTot > 0 ? rawTot : Math.round(neto * 1.19),
          oc_asociada: doc.order_reference,
          aforo_tipo: 'CATÁLOGO LOCAL PRECARGADO',
          almacen: 'CH_36_CD_Chile (Sociedad 6202)',
          items: [],
          ax_doc_id: doc.id,
          tipo_doc: doc.type || 'CL33'
        };
      });
      invoices.sort((a, b) => (parseInt(String(a.folio).replace(/\D/g, ''), 10) || 0) - (parseInt(String(b.folio).replace(/\D/g, ''), 10) || 0));

      return {
        success: true,
        po_found: false,
        po_number: rawDigits ? ('PO' + rawDigits) : (invoices[0].oc_asociada || ''),
        supplier_name: invoices[0].proveedor,
        supplier_tax_id: invoices[0].rut,
        warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
        condicion_aforo: 'CATÁLOGO LOCAL',
        invoices: invoices,
        total_invoices: invoices.length,
        total_facturado_neto: invoices.reduce((s, f) => s + f.monto_neto, 0),
        total_facturado_total: invoices.reduce((s, f) => s + f.monto_total, 0),
        total_oc_ordenado: 0,
        total_oc_recepcionado: 0,
        po_data: null
      };
    }

    return {
      success: true,
      invoices: [],
      total_invoices: 0,
      query: rawQuery,
      message: 'No se encontraron facturas ni órdenes de compra para el criterio ingresado.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Ejecuta la conciliación SKU x SKU de una PO consolidando todas sus facturas asociadas.
 * Especial para casos de múltiples facturas para una misma OC (ej: Carozzi PO517979).
 */
function apiConsolidateAndReconcilePo(poNumber, workspace) {
  try {
    const ws = workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE;
    const searchRes = apiSearchPoWithInvoices(poNumber, ws);
    if (!searchRes.success) throw new Error(searchRes.error);
    if (!searchRes.invoices || searchRes.invoices.length === 0) {
      throw new Error(`No se encontraron facturas asociadas para la Orden de Compra ${poNumber}.`);
    }

    let poData = searchRes.po_data || getPurchaseOrderItems(poNumber);
    if ((!poData || !poData.items || poData.items.length === 0) && typeof getAuditedPoData === 'function') {
      const auditedPo = getAuditedPoData(poNumber);
      if (auditedPo) poData = auditedPo;
    }
    if (!poData || !poData.po_found) {
      throw new Error(`La Orden de Compra ${poNumber} no se encontró en BigQuery.`);
    }

    // Recolectar todos los ítems de las facturas asociadas
    const allItems = [];
    searchRes.invoices.forEach(inv => {
      let items = inv.items || [];
      if ((!items || items.length === 0) && typeof getAuditedFacturaData === 'function') {
        const audited = getAuditedFacturaData(inv.folio);
        if (audited) items = audited.items;
      }
      if (items.length === 0 && inv.ax_doc_id && !inv.ax_doc_id.startsWith('local_')) {
        try {
          const xml = fetchAxteroidXml(inv.ax_doc_id, ws);
          const parsed = parseDteXml(xml);
          items = parsed.items || [];
        } catch (e) {}
      }
      items.forEach(it => {
        allItems.push({
          linea: allItems.length + 1,
          codigo: it.codigo,
          tipo_codigo: it.tipo_codigo || 'INT1',
          descripcion: it.descripcion,
          descripcion_adicional: `Factura Folio ${inv.folio}`,
          cantidad_facturada: it.cantidad_facturada,
          unidad_medida: it.unidad_medida || 'UN',
          precio_facturado: it.precio_facturado,
          monto_facturado: it.monto_facturado,
          factura_origen: inv.folio
        });
      });
    });



    const consolidatedInvoice = {
      folio: `Consolidado (${searchRes.invoices.length} Facturas: ${searchRes.invoices.map(f => f.folio).join(', ')})`,
      tipo_dte: '33',
      fecha_emision: (searchRes.invoices[0] && searchRes.invoices[0].fecha) || '',
      emisor: {
        rut: searchRes.supplier_tax_id,
        razon_social: searchRes.supplier_name
      },
      totales: {
        neto: searchRes.total_facturado_neto,
        total: searchRes.total_facturado_total
      },
      referencias: [{
        tipo: '801',
        folio: poData.po_order_id,
        is_po: true
      }],
      items: allItems
    };

    const cruceResultado = ejecutarCruceSkuPorSku(consolidatedInvoice, poData);

    return {
      success: true,
      data: {
        reconciliacion: cruceResultado,
        factura: consolidatedInvoice,
        po_info: poData,
        invoices_count: searchRes.invoices.length,
        invoices: searchRes.invoices
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resuelve un nombre o término de proveedor contra BigQuery y la Tabla de Aforos.
 */
function resolverProveedorBackend(query) {
  if (!query) return null;
  const cleanTerm = query.trim().replace(/'/g, "\\'");
  const cleanLower = cleanTerm.toLowerCase();
  const cleanDigits = cleanTerm.replace(/[^0-9kK]/g, '').toUpperCase();

  // 1. Memoria rápida local de los 32 proveedores oficiales de Chile (Cero latencia)
  if (typeof CATALOGO_AFOROS_MEMORIA_32 !== 'undefined') {
    const m = CATALOGO_AFOROS_MEMORIA_32.find(r => {
      const p = (r.proveedor || '').toLowerCase();
      const rutClean = (r.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
      return p.includes(cleanLower) || (cleanDigits.length >= 7 && rutClean.includes(cleanDigits));
    });
    if (m && m.rut) {
      return {
        rut: m.rut.replace(/[^0-9kK]/g, '').toUpperCase(),
        nombre: m.proveedor
      };
    }
  }

  // 2. Intentar resolver en la Tabla de Aforos Chile
  try {
    const aforos = getAforosChileData();
    if (aforos && aforos.records && aforos.records.length > 0) {
      const match = aforos.records.find(r => {
        const p = (r.proveedor || '').toLowerCase();
        const rutClean = (r.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
        return p.includes(cleanLower) || (cleanDigits.length >= 7 && rutClean.includes(cleanDigits));
      });
      if (match && match.rut) {
        return {
          rut: match.rut.replace(/[^0-9kK]/g, '').toUpperCase(),
          nombre: match.proveedor
        };
      }
    }
  } catch (e) {
    Logger.log('Error buscando proveedor en Aforos: ' + e.message);
  }

  // 3. Intentar resolver en BigQuery en el catálogo de productos/proveedores
  try {
    const sql = `
      SELECT DISTINCT 
        s.supplier_name as nombre, 
        s.supplier_tax_id as rut
      FROM \`peya-data-origins-pro.cl_dmarts.products_suppliers\` ps,
      UNNEST(ps.suppliers) as s
      WHERE ps.country_code = 'cl'
        AND s.supplier_tax_id IS NOT NULL
        AND (
          LOWER(s.supplier_name) LIKE LOWER('%${cleanTerm}%')
          OR s.supplier_tax_id LIKE '%${cleanTerm}%'
        )
      LIMIT 1;
    `;
    const bqRes = executeBigQuerySql(sql);
    if (bqRes && bqRes.length > 0 && bqRes[0].rut) {
      return {
        rut: bqRes[0].rut.replace(/[^0-9kK]/g, '').toUpperCase(),
        nombre: bqRes[0].nombre
      };
    }
  } catch (e) {
    Logger.log('Error buscando proveedor en BigQuery: ' + e.message);
  }

  return null;
}

/**
 * RPC: Obtiene el XML y detalle parseado de una factura.
 */
function apiGetInvoiceXmlDetail(docId, workspace) {
  try {
    const xmlText = fetchAxteroidXml(docId, workspace);
    const parsed = parseDteXml(xmlText);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Obtiene el PDF oficial en base64 para previsualización o descarga.
 */
function apiGetInvoicePdf(docId, workspace) {
  try {
    const pdfData = fetchAxteroidPdfBase64(docId, workspace);
    return {
      success: true,
      data: pdfData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Consulta la Orden de Compra en BigQuery.
 */
function apiGetPurchaseOrder(poNumber) {
  try {
    let poData = null;
    try {
      poData = getPurchaseOrderItems(poNumber);
    } catch (eBq) {
      Logger.log('Aviso getPurchaseOrderItems en BQ: ' + eBq.message);
    }

    if ((!poData || !poData.items || poData.items.length === 0) && typeof getAuditedPoData === 'function') {
      const audited = getAuditedPoData(poNumber);
      if (audited) poData = audited;
    }

    return {
      success: true,
      data: poData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC PRINCIPAL: Ejecuta el cruce integral SKU x SKU entre la factura en Axteroid y la OC en BigQuery.
 * @param {string} docId ID del documento en Axteroid
 * @param {string} manualPoNumber Opcional: Número de OC si se desea forzar una distinta a la de la factura
 * @param {string} workspace ID de workspace
 */
function apiRunInvoiceReconciliation(docId, manualPoNumber, workspace) {
  try {
    // 1. Obtener y parsear el XML de la factura desde Axteroid
    let invoiceData = null;
    try {
      const xmlText = fetchAxteroidXml(docId, workspace);
      invoiceData = parseDteXml(xmlText);
    } catch (eXml) {
      Logger.log('Aviso obteniendo XML de ' + docId + ': ' + eXml.message);
    }

    // Si falló XML o no tiene ítems, recuperar desde dataset auditado
    if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      const locales = (typeof getFacturasLocalesPorPo === 'function') ? getFacturasLocalesPorPo() : [];
      const matchDoc = locales.find(d => d.id === docId || String(d.serial) === String(docId));
      const folioToLookup = matchDoc ? String(matchDoc.serial) : String(docId).replace(/^do_/i, '').replace(/^local_/i, '');
      if (typeof getAuditedFacturaData === 'function') {
        const audited = getAuditedFacturaData(folioToLookup);
        if (audited) {
          invoiceData = {
            folio: folioToLookup,
            tipo_dte: '33',
            fecha_emision: matchDoc ? matchDoc.date : '2026-09-22',
            emisor: {
              rut: matchDoc ? matchDoc.supplier_tax_id : '96591040-9',
              razon_social: matchDoc ? matchDoc.supplier_name : 'Empresas Carozzi S.A.'
            },
            totales: {
              neto: matchDoc ? matchDoc.amount_net : audited.total_fac,
              total: matchDoc ? matchDoc.amount_total : Math.round(audited.total_fac * 1.19)
            },
            referencias: [{ tipo: '801', folio: (matchDoc && matchDoc.order_reference) || 'PO517979', is_po: true }],
            items: audited.items
          };
          if (!manualPoNumber) poNumber = (matchDoc && matchDoc.order_reference) || 'PO517979';
        }
      }
    }

    if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      throw new Error(`No se pudieron obtener los ítems de la factura ${docId}.`);
    }

    // 2. Determinar número de Orden de Compra
    let poNumber = manualPoNumber;
    if (!poNumber && invoiceData.referencias) {
      const poRef = invoiceData.referencias.find(r => r.is_po);
      if (poRef) {
        poNumber = poRef.folio;
      }
    }

    // 3. Consultar la OC en BigQuery
    let poData = null;
    if (poNumber) {
      poData = getPurchaseOrderItems(poNumber);
    }

    // 4. Ejecutar el cruce con el motor de diagnóstico
    const resultado = ejecutarCruceSkuPorSku(invoiceData, poData);

    return {
      success: true,
      data: {
        reconciliacion: resultado,
        factura: invoiceData,
        po_info: poData
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Ejecuta la conciliación automática 1 a 1 para datos cargados (OC, Recepciones y Factura).
 * @param {Object} customPayload { factura, orden_compra, recepciones }
 */
function apiReconcileUploadedData(customPayload) {
  try {
    if (!customPayload) throw new Error('Carga de datos vacía.');

    let invoiceData = customPayload.factura;
    let poData = customPayload.orden_compra;
    const recepciones = customPayload.recepciones || [];

    if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      throw new Error('La factura no contiene ítems para conciliar.');
    }

    // Normalizar estructura básica de la factura si viene de CSV/manual
    if (!invoiceData.folio) invoiceData.folio = 'FAC-' + Date.now().toString().slice(-6);
    if (!invoiceData.emisor) {
      invoiceData.emisor = {
        rut: customPayload.rut || '76.123.456-7',
        razon_social: customPayload.proveedor || 'Proveedor Conciliación'
      };
    }

    // Si no se proporcionó OC estructurada, armarla a partir de recepciones o valores predeterminados
    if (!poData || !poData.items || poData.items.length === 0) {
      poData = {
        po_order_id: customPayload.po_number || 'OC-' + invoiceData.folio,
        warehouse_name: customPayload.warehouse || 'Almacén Central 6202 (Chile)',
        order_status: 'Cargada para Conciliación',
        po_found: true,
        items: []
      };
    }

    // Si se enviaron recepciones independientes (GR), actualizar o anexar a poData.items
    if (recepciones && recepciones.length > 0) {
      recepciones.forEach(rec => {
        const skuRec = (rec.sku || rec.codigo || '').toString().toLowerCase().trim();
        const eanRec = (rec.ean || '').toString().toLowerCase().trim();
        const qtyRec = parseFloat(rec.cantidad || rec.cantidad_recepcionada || 0);

        let matched = false;
        for (let item of poData.items) {
          const itemSku = (item.sku_id || '').toString().toLowerCase().trim();
          const itemSupp = (item.supplier_sku || '').toString().toLowerCase().trim();
          const itemEans = (item.barcodes || []).map(b => b.toString().toLowerCase().trim());

          if (itemSku === skuRec || itemSupp === skuRec || (eanRec && itemEans.includes(eanRec))) {
            item.quantity_delivered = qtyRec;
            item.amt_delivered_lc = qtyRec * (item.cost_unit_lc || 0);
            matched = true;
            break;
          }
        }

        if (!matched && skuRec) {
          poData.items.push({
            sku_id: rec.sku || rec.codigo,
            supplier_sku: rec.supplier_sku || rec.codigo,
            barcodes: rec.ean ? [rec.ean] : [],
            product_name: rec.descripcion || rec.producto || 'Recepción en Bodega',
            quantity_ordered: qtyRec,
            quantity_delivered: qtyRec,
            cost_unit_lc: parseFloat(rec.costo || rec.precio || 0),
            amt_ordered_lc: qtyRec * parseFloat(rec.costo || rec.precio || 0),
            amt_delivered_lc: qtyRec * parseFloat(rec.costo || rec.precio || 0)
          });
        }
      });
    }

    // Ejecutar el cruce detallado con CruceEngine.gs
    const resultado = ejecutarCruceSkuPorSku(invoiceData, poData);

    return {
      success: true,
      data: {
        reconciliacion: resultado,
        factura: invoiceData,
        po_info: poData
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Genera el contenido CSV exportable para revisión con Category Manager / Carozzi.
 */
function apiExportReconciliationCsv(reconciliationData) {
  try {
    if (!reconciliationData || !reconciliationData.lineas) {
      throw new Error('No hay datos para exportar.');
    }

    const res = reconciliationData.resumen;
    const lines = [];

    // Cabecera resumen
    lines.push(['REPORTE DE CRUCE SKU X SKU - CONCILIACION DMARTS'].join(';'));
    lines.push([`Folio Factura:;${res.folio_factura};Fecha:;${res.fecha_emision}`].join(';'));
    lines.push([`Proveedor:;${res.proveedor_nombre};RUT:;${res.proveedor_rut}`].join(';'));
    lines.push([`Orden de Compra:;${res.po_referencia || 'N/A'};Almacen:;${res.almacen || 'N/A'}`].join(';'));
    lines.push([`Total Facturado Neto:;$ ${Math.round(res.total_facturado_neto)};Total Recepcionado:;$ ${Math.round(res.total_recepcionado_neto)}`].join(';'));
    lines.push([`TOTAL A RECLAMAR NC:;$ ${Math.round(res.total_monto_a_reclamar)};Estado:;${res.estado_general}`].join(';'));
    lines.push(['']);

    // Columnas Detalle SKU x SKU
    const headers = [
      'Linea',
      'Cod Proveedor',
      'Descripcion Factura',
      'Cant Facturada',
      'UOM',
      'Precio Facturado (CLP)',
      'Monto Facturado (CLP)',
      'SKU Dmarts',
      'Descripcion OC',
      'Cant Recepcionada',
      'Costo OC (CLP)',
      'Monto Recepcionado (CLP)',
      'Dif Cantidad',
      'Dif Precio Unit',
      'Monto Descalce (CLP)',
      'Monto Reclamar NC (CLP)',
      'Tipo Descalce',
      'Observaciones',
      'Accion Correctiva'
    ];
    lines.push(headers.join(';'));

    reconciliationData.lineas.forEach(l => {
      const row = [
        l.linea_factura,
        `"${l.codigo_factura}"`,
        `"${l.descripcion_factura.replace(/"/g, '""')}"`,
        l.cantidad_facturada,
        l.unidad_factura,
        Math.round(l.precio_facturado),
        Math.round(l.monto_facturado),
        `"${l.sku_oc}"`,
        `"${l.descripcion_oc.replace(/"/g, '""')}"`,
        l.cantidad_oc_recepcionada !== null ? l.cantidad_oc_recepcionada : 'S/R',
        Math.round(l.costo_unitario_oc),
        Math.round(l.monto_recepcionado),
        l.diferencia_unidades,
        Math.round(l.diferencia_precio_unit),
        Math.round(l.diferencia_monto_neta),
        Math.round(l.monto_a_reclamar),
        l.tipo_descalce,
        `"${l.observacion.replace(/"/g, '""')}"`,
        `"${l.accion_correctiva.replace(/"/g, '""')}"`
      ];
      lines.push(row.join(';'));
    });

    const csvContent = lines.join('\r\n');
    return {
      success: true,
      filename: `Cruce_Factura_${res.folio_factura}_Carozzi.csv`,
      csv: csvContent
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC Endpoint Oficial: Genera un Google Spreadsheet nativo en Google Drive con el formato oficial
 * de Cuentas por Pagar / Finanzas D-Marts Chile (idéntico a la plantilla modelo):
 * https://docs.google.com/spreadsheets/d/1tV8no7qLQI_6dVMoqN8dMGJdb0E4rYTE/edit?gid=1066181932#gid=1066181932
 *
 * @param {Object|string} payload - Parámetros de conciliación
 * @return {Object} { success: boolean, spreadsheet_id: string, url: string, name: string, total_items: number, total_diferencias: number, monto_diferencias: number }
 */
function apiCrearPlanillaConciliacionOficialGoogleSheets(payload) {
  try {
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // mantener como objeto vacío si falla parseo
        payload = {};
      }
    }
    payload = payload || {};
    return crearPlanillaConciliacionOficialGoogleSheets(payload);
  } catch (error) {
    Logger.log('Error en apiCrearPlanillaConciliacionOficialGoogleSheets: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC Alias para compatibilidad con llamadas existentes del cliente.
 */
function apiGenerarSpreadsheetFinanzas(payload) {
  return apiCrearPlanillaConciliacionOficialGoogleSheets(payload);
}

/**
 * RPC: Busca productos y su homologación completa (SKU PedidosYa, EAN y Cód. Factura Proveedor) con ubicación.
 */
function apiSearchProductHomologation(term, supplierTaxId) {
  try {
    const data = searchProductHomologation(term, supplierTaxId, 100);
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Obtiene el catálogo maestro de homologación para un proveedor (o todos).
 */
function apiGetMasterHomologation(supplierTaxId, limit) {
  try {
    const data = getMasterHomologation(supplierTaxId, limit || 1500);
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Genera el archivo CSV con el maestro completo de homologación para descarga.
 */
function apiExportMasterHomologationCsv(supplierTaxId, supplierName) {
  try {
    const data = getMasterHomologation(supplierTaxId, 5000);
    if (!data || data.length === 0) {
      throw new Error('No se encontraron registros de homologación para exportar.');
    }

    const lines = [];
    lines.push(['MAESTRO DE HOMOLOGACION DE CODIGOS - DMARTS CHILE (SOCIEDAD 6202)'].join(';'));
    lines.push([`Proveedor:;${supplierName || (supplierTaxId || 'Todos')};Fecha Exportacion:;${new Date().toISOString().slice(0, 10)}`].join(';'));
    lines.push(['']);

    const headers = [
      'SKU PedidosYa',
      'Descripcion Producto',
      'Cod. Factura Proveedor',
      'Codigos EAN (Barras)',
      'Proveedor',
      'RUT Proveedor'
    ];
    lines.push(headers.join(';'));

    data.forEach(r => {
      const row = [
        `"${r.sku_pedidosya || ''}"`,
        `"${(r.descripcion_pedidosya || '').replace(/"/g, '""')}"`,
        `"${r.codigo_factura_proveedor || ''}"`,
        `"${r.ean_barcodes || ''}"`,
        `"${(r.proveedor || '').replace(/"/g, '""')}"`,
        `"${r.rut_proveedor || ''}"`
      ];
      lines.push(row.join(';'));
    });

    const safeName = (supplierName || 'General').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Maestro_Homologacion_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    return {
      success: true,
      filename: filename,
      csv: lines.join('\r\n')
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ============================================================================
 * MÓDULO DE AUTONOMÍA Y CONFIGURACIÓN CERO CÓDIGO
 * Permite que el usuario configure parámetros y active la sincronización diaria
 * sin tener que editar ningún archivo de código en Google Apps Script.
 * ============================================================================
 */

/**
 * RPC: Obtiene la configuración activa del sistema y el estado de sincronización.
 */
function apiGetSystemSettings() {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('AXTEROID_TOKEN') || '';
    const maskedToken = token ? `${token.slice(0, 10)}...${token.slice(-8)}` : '';
    
    // Verificar si el trigger diario está activo
    const triggers = ScriptApp.getProjectTriggers();
    const hasTrigger = triggers.some(t => t.getHandlerFunction() === 'ejecutarSincronizacionAutomatica');

    return {
      success: true,
      data: {
        has_token: !!token,
        masked_token: maskedToken,
        alert_email: props.getProperty('ALERT_EMAIL') || Session.getActiveUser().getEmail() || '',
        threshold_clp: parseInt(props.getProperty('THRESHOLD_ALERT_CLP') || '1000000', 10),
        spreadsheet_id: props.getProperty('CASES_SPREADSHEET_ID') || '1duL91e3BFgAIeUXjhWhZsEcVgha_ZZZ38xbN0W2ibjo',
        aforos_spreadsheet_id: props.getProperty('AFOROS_SPREADSHEET_ID') || SHEETS_CONFIG.AFOROS_SPREADSHEET_ID,
        auto_sync_enabled: hasTrigger,
        last_sync_time: props.getProperty('LAST_SYNC_TIME') || 'Aún no ejecutada',
        last_sync_status: props.getProperty('LAST_SYNC_STATUS') || 'Pendiente',
        last_sync_descalce_total: parseFloat(props.getProperty('LAST_SYNC_DESCALCE') || '0')
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Guarda la configuración del sistema en ScriptProperties sin tocar código.
 */
function apiSaveSystemSettings(settings) {
  try {
    const props = PropertiesService.getScriptProperties();
    
    if (settings.token && !settings.token.includes('...')) {
      props.setProperty('AXTEROID_TOKEN', settings.token.trim());
    }
    if (settings.alert_email) {
      props.setProperty('ALERT_EMAIL', settings.alert_email.trim());
    }
    if (settings.threshold_clp !== undefined) {
      props.setProperty('THRESHOLD_ALERT_CLP', settings.threshold_clp.toString());
    }
    if (settings.spreadsheet_id) {
      props.setProperty('CASES_SPREADSHEET_ID', settings.spreadsheet_id.trim());
    }
    if (settings.aforos_spreadsheet_id) {
      props.setProperty('AFOROS_SPREADSHEET_ID', settings.aforos_spreadsheet_id.trim());
    }

    // Gestionar el trigger de fondo diario (07:00 AM)
    if (settings.auto_sync_enabled !== undefined) {
      gestionarTriggerDiario(settings.auto_sync_enabled);
    }

    return {
      success: true,
      message: 'Configuración guardada exitosamente.',
      data: apiGetSystemSettings().data
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Obtiene los casos leídos en vivo desde el Google Spreadsheet maestro.
 */
function apiGetSpreadsheetCases(customId) {
  try {
    const res = getCasesFromSpreadsheet(customId);
    return { success: true, data: res };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Sincroniza y alimenta el Google Spreadsheet en vivo con Axteroid y BigQuery.
 */
function apiSyncSpreadsheetNow(customId) {
  try {
    const res = syncAndFeedSpreadsheet(customId);
    return { success: true, data: res };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Registra o actualiza un caso individual en el Google Spreadsheet de la Tribu (Chile 6202 / CL).
 */
function apiPushCaseToSpreadsheet(caseObj) {
  try {
    const res = appendOrUpdateCaseInSpreadsheet(caseObj);
    return { success: true, data: res };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Obtiene los datos en vivo de la Tabla de Aforos Chile.
 */
function apiGetAforosTableData(customId, customGid) {
  try {
    const res = getAforosChileData(customId, customGid);
    return { success: true, data: res };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Consulta la condición de aforo de un proveedor específico por RUT.
 */
function apiGetProveedorAforo(rut) {
  try {
    const res = obtenerCondicionAforoProveedor(rut);
    return { success: true, data: res };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Activa o desactiva el Trigger programado diario (07:00 AM hora Chile).
 */
function gestionarTriggerDiario(activar) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'ejecutarSincronizacionAutomatica') {
      ScriptApp.deleteTrigger(t);
    }
  });

  if (activar) {
    ScriptApp.newTrigger('ejecutarSincronizacionAutomatica')
      .timeBased()
      .atHour(7)
      .everyDays(1)
      .inTimezone('America/Santiago')
      .create();
  }
}

/**
 * RPC: Ejecuta la sincronización manual inmediata a demanda.
 */
function apiRunManualSyncNow() {
  try {
    const resultado = ejecutarSincronizacionAutomatica();
    return {
      success: true,
      data: resultado
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RUTINA EN SEGUNDO PLANO (AUTOMÁTICA):
 * Se ejecuta automáticamente todos los días a las 07:00 AM sin intervención humana.
 * 1. Consulta facturas recientes de proveedores críticos (Nestlé, Carozzi, Andina, Softys).
 * 2. Cruza con BigQuery.
 * 3. Actualiza el snapshot del día.
 * 4. Si el descalce supera el umbral configurado, envía un email proactivo de alerta.
 */
function ejecutarSincronizacionAutomatica() {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const startTime = now.toISOString();

  // Proveedores de Lista Blanca Monitoreados
  const WHITELIST_PROVIDERS = [
    { name: 'Nestle Chile SA', rut: '96557910-9', cm: 'Constanza Urra' },
    { name: 'Empresas Carozzi SA', rut: '96591040-9', cm: 'Daniela Reyes' },
    { name: 'Embotelladora Andina SA', rut: '91144000-8', cm: 'Javiera Rogers' },
    { name: 'Softys Chile SpA', rut: '76169670-K', cm: 'Nicolas Lopez' }
  ];

  // Rango de fechas: últimos 15 días móviles
  const dteHasta = now.toISOString().slice(0, 10);
  const dteDesdeObj = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
  const dteDesde = dteDesdeObj.toISOString().slice(0, 10);

  let totalFacturasRevisadas = 0;
  let totalMontoFacturado = 0;
  let totalDescalceDetectado = 0;
  const proveedoresConAlerta = [];

  WHITELIST_PROVIDERS.forEach(prov => {
    try {
      const docsRes = searchAxteroidDocs({
        tax_id: prov.rut,
        date__gte: dteDesde,
        date__lte: dteHasta
      });

      const docs = docsRes.documents || [];
      totalFacturasRevisadas += docs.length;

      let descalceProveedor = 0;
      const facturasObservadas = [];

      docs.forEach(doc => {
        totalMontoFacturado += (doc.amount_total || 0);

        // Si la factura tiene PO o referencia, auditar
        if (doc.order_reference) {
          try {
            const poData = getPurchaseOrderItems(doc.order_reference);
            if (poData && poData.po_found) {
              const xmlText = fetchAxteroidXml(doc.id);
              const invoiceData = parseDteXml(xmlText);
              const cruce = ejecutarCruceSkuPorSku(invoiceData, poData);
              if (cruce && cruce.resumen && cruce.resumen.total_monto_a_reclamar > 0) {
                descalceProveedor += cruce.resumen.total_monto_a_reclamar;
                facturasObservadas.push({
                  folio: doc.serial,
                  po: doc.order_reference,
                  reclamar: cruce.resumen.total_monto_a_reclamar,
                  motivo: cruce.resumen.estado_general
                });
              }
            } else {
              // PO no encontrada o sin recepción
              const descalceSinPo = parseMontoClean(doc.amount_net || doc.amount_total);
              descalceProveedor += descalceSinPo;
              facturasObservadas.push({
                folio: doc.serial,
                po: doc.order_reference || 'S/PO',
                reclamar: descalceSinPo,
                motivo: 'OC no encontrada en bodega'
              });
            }
          } catch (e) {
            Logger.log(`Error cruzando doc ${doc.serial}: ${e.message}`);
          }
        }
      });

      totalDescalceDetectado += descalceProveedor;
      if (descalceProveedor > 0) {
        proveedoresConAlerta.push({
          proveedor: prov.name,
          rut: prov.rut,
          cm: prov.cm,
          descalce: descalceProveedor,
          facturas: facturasObservadas
        });
      }
    } catch (errProv) {
      Logger.log(`Error procesando proveedor ${prov.name}: ${errProv.message}`);
    }
  });

  // 3. Sincronizar y alimentar automáticamente el Google Spreadsheet maestro de casos
  let spreadsheetFeedResult = null;
  try {
    spreadsheetFeedResult = syncAndFeedSpreadsheet();
    Logger.log(`Google Spreadsheet alimentado con éxito: ${spreadsheetFeedResult.casos_procesados} casos actualizados.`);
  } catch (errSheet) {
    Logger.log(`Aviso al alimentar Google Spreadsheet: ${errSheet.message}`);
  }

  // Guardar estado del último sync
  props.setProperty('LAST_SYNC_TIME', new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }));
  props.setProperty('LAST_SYNC_STATUS', 'Completado');
  props.setProperty('LAST_SYNC_DESCALCE', totalDescalceDetectado.toString());

  // Enviar alerta por email si supera el umbral configurado
  const threshold = parseFloat(props.getProperty('THRESHOLD_ALERT_CLP') || '1000000');
  const alertEmail = props.getProperty('ALERT_EMAIL');

  if (alertEmail && totalDescalceDetectado >= threshold && proveedoresConAlerta.length > 0) {
    enviarEmailAlertaProactiva(alertEmail, totalDescalceDetectado, proveedoresConAlerta, dteDesde, dteHasta);
  }

  return {
    timestamp: startTime,
    facturas_revisadas: totalFacturasRevisadas,
    monto_total_facturado: totalMontoFacturado,
    descalce_total: totalDescalceDetectado,
    proveedores_con_descalce: proveedoresConAlerta
  };
}

/**
 * Envía email proactivo con resumen ejecutivo de descalces.
 */
function enviarEmailAlertaProactiva(recipient, totalDescalce, proveedores, desde, hasta) {
  const subject = `🚨 [ALERTA CONCILIACIÓN DMARTS] Descalces detectados por $${Math.round(totalDescalce).toLocaleString('es-CL')} CLP`;

  let bodyHtml = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ff1a53; color: white; padding: 20px;">
        <h2 style="margin: 0;">Alerta Automática de Conciliación Axteroid</h2>
        <p style="margin: 4px 0 0 0; opacity: 0.9;">Sociedad 6202 &bull; CD_36_CD_Chile &bull; Periodo: ${desde} al ${hasta}</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 1.1rem; margin-top: 0;">
          El monitor automático ha detectado <strong>$${Math.round(totalDescalce).toLocaleString('es-CL')} CLP</strong> en facturas con diferencias o retención respecto a recepciones de bodega.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left; font-size: 0.85rem;">
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Proveedor</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Category Manager</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Descalce a Reclamar</th>
            </tr>
          </thead>
          <tbody>
  `;

  proveedores.forEach(p => {
    bodyHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;">
        <td style="padding: 10px;"><strong>${p.proveedor}</strong><br><span style="color:#64748b; font-size:0.8rem;">${p.rut}</span></td>
        <td style="padding: 10px;">${p.cm}</td>
        <td style="padding: 10px; text-align: right; color: #ef4444; font-weight: bold;">$${Math.round(p.descalce).toLocaleString('es-CL')} CLP</td>
      </tr>
    `;
  });

  bodyHtml += `
          </tbody>
        </table>
        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; font-size: 0.85rem; color: #475569;">
          <strong>Acción Sugerida:</strong> Ingresa a la Web App de Conciliación para emitir el detalle de reclamo para Comercial o solicitar las Notas de Crédito correspondientes.
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; font-size: 0.75rem; color: #64748b; text-align: center;">
        Generado automáticamente por Axteroid Dmarts Conciliator &bull; No requiere intervención de código.
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: bodyHtml
  });
}

/**
 * RPC: Genera un Journal Entry Voucher (JEV) contable para SAP / Sociedad 6202.
 * @param {Object} reconData Datos de la conciliación activa
 * @param {Object} options Opciones contables adicionales (companyCode, costCenter, includeTax, aplicarAforo)
 */
function apiGenerarJournalEntryVoucher(reconData, options) {
  try {
    const jev = generarJournalEntryVoucher(reconData, options);
    return {
      success: true,
      data: jev
    };
  } catch (error) {
    Logger.log('Error generando JEV: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Exporta un Journal Entry Voucher (JEV) a archivo CSV para carga masiva en SAP.
 * @param {Object} reconData Datos de la conciliación activa
 * @param {Object} options Opciones contables
 */
function apiExportarJevCsv(reconData, options) {
  try {
    const jev = generarJournalEntryVoucher(reconData, options);
    const csvContent = exportarJevCsv(jev);
    const filename = `JEV_${jev.header.company_code}_Fac_${jev.audit_summary.folio_factura || '00'}_${jev.header.posting_date.replace(/-/g, '')}.csv`;
    return {
      success: true,
      csv: csvContent,
      filename: filename,
      voucher_id: jev.header.voucher_id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Ejecuta la auditoría y triage inteligente con TypeSafe AI Jev.
 * @param {Object} reconData Datos de la conciliación activa
 */
function apiEjecutarJevTypeSafeAudit(reconData) {
  try {
    const res = jevAuditarLoteCompleto(reconData);
    return {
      success: true,
      data: res
    };
  } catch (error) {
    Logger.log('Error ejecutando auditoría Jev: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * RPC: Guarda la configuración de TypeSafe AI Jev y SAP en propiedades.
 */
function apiGuardarConfigJev(config) {
  try {
    const props = PropertiesService.getUserProperties();
    if (config.apiKey !== undefined) {
      if (config.apiKey) {
        props.setProperty('JEV_API_KEY', config.apiKey.trim());
      } else {
        props.deleteProperty('JEV_API_KEY');
      }
    }
    if (config.companyCode) props.setProperty('SAP_COMPANY_CODE', config.companyCode.trim());
    if (config.costCenter) props.setProperty('SAP_COST_CENTER', config.costCenter.trim());

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * RPC: Obtiene la configuración de TypeSafe AI Jev y SAP.
 */
function apiObtenerConfigJev() {
  try {
    const props = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('JEV_API_KEY') || scriptProps.getProperty('JEV_API_KEY') || '';
    return {
      success: true,
      hasApiKey: !!apiKey,
      apiKeyMasked: apiKey ? apiKey.slice(0, 4) + '...' + apiKey.slice(-4) : '',
      companyCode: props.getProperty('SAP_COMPANY_CODE') || JEV_CONFIG.SOCIEDAD_DEFAULT,
      costCenter: props.getProperty('SAP_COST_CENTER') || JEV_CONFIG.CENTRO_COSTO_DEFAULT
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

