/**
 * SheetsAPI.gs
 * Módulo para la integración bidireccional y alimentación diaria entre la Web App
 * y el Google Spreadsheet maestro de casos de conciliación (Tribu e Image).
 * 
 * Spreadsheet ID: 1duL91e3BFgAIeUXjhWhZsEcVgha_ZZZ38xbN0W2ibjo
 */

const SHEETS_CONFIG = {
  DEFAULT_SPREADSHEET_ID: '1duL91e3BFgAIeUXjhWhZsEcVgha_ZZZ38xbN0W2ibjo',
  DEFAULT_GID: '0',
  AFOROS_SPREADSHEET_ID: '1do-TBEM_QbNoVzWxns7-2nfGTLXvHFTaaruI-1E-KrI',
  AFOROS_GID: '805283264'
};

/**
 * Obtiene el ID del Spreadsheet de Casos configurado.
 */
function getActiveSpreadsheetId() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('CASES_SPREADSHEET_ID') || SHEETS_CONFIG.DEFAULT_SPREADSHEET_ID;
}

/**
 * Obtiene el ID del Spreadsheet de Aforos Chile configurado.
 */
function getActiveAforosSpreadsheetId() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('AFOROS_SPREADSHEET_ID') || SHEETS_CONFIG.AFOROS_SPREADSHEET_ID;
}

/**
 * Abre el Spreadsheet maestro de casos y obtiene la hoja principal.
 */
function openMasterCasesSheet(customId) {
  const sheetId = customId || getActiveSpreadsheetId();
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    return ss.getSheets()[0]; // Primera hoja (gid=0)
  } catch (e) {
    throw new Error(`No se pudo abrir el Google Spreadsheet (${sheetId}): ${e.message}. Asegúrate de tener permisos en este archivo.`);
  }
}

/**
 * Variable global en memoria para caché del índice de DIF MONEDA LOCAL (Bot 6202).
 */
var _cachedBotIndex = null;

/**
 * Construye e indexa en memoria las diferencias oficiales por Orden de Compra (PO)
 * desde la hoja 'Bot' del Spreadsheet oficial de Finanzas (1duL91e3BFgAIeUXjhWhZsEcVgha_ZZZ38xbN0W2ibjo).
 * Extrae la columna 'total_difference' (DIF MONEDA LOCAL), Category Manager, Tienda, Analista 3WM y Aforo.
 */
function getSpreadsheetBotIndex(forceRefresh) {
  if (_cachedBotIndex && !forceRefresh) return _cachedBotIndex;

  const index = {};
  try {
    const sheet = openMasterCasesSheet();
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return index;

    const rawHeaders = data[0].map(h => (h || '').toString().trim().toLowerCase());
    const idxSociedad = rawHeaders.indexOf('company_code');
    const idxPais = rawHeaders.indexOf('country_code');
    const idxPo = rawHeaders.indexOf('purchase_order');
    const idxPo1 = rawHeaders.indexOf('po1');
    const idxOrdenes = rawHeaders.indexOf('ordenes de compra');
    const idxDifMl = rawHeaders.indexOf('total_difference'); // DIF MONEDA LOCAL OFICIAL
    const idxDifPct = rawHeaders.indexOf('total_difference_pct');
    const idxTotFac = rawHeaders.indexOf('total_invoice_associated_cost');
    const idxTotPo = rawHeaders.indexOf('total_po_amount');
    const idxTotNc = rawHeaders.indexOf('total_credit_note_amount');
    const idxCatman = rawHeaders.indexOf('category manager');
    const idxTienda = rawHeaders.indexOf('tienda');
    const idxCond = rawHeaders.indexOf('pesable/autorizado');
    const idxAnalista = rawHeaders.indexOf('analista_3wm');
    const idxStatusAforo = rawHeaders.indexOf('status_aforo');
    const idxStatus = rawHeaders.indexOf('status');
    const idxAFavor = rawHeaders.indexOf('a favor');
    const idxMes = rawHeaders.indexOf('mes');
    const idxVendorName = rawHeaders.indexOf('vendor_name');
    const idxVendorId = rawHeaders.indexOf('vendor_id');
    const idxDocNumber = rawHeaders.indexOf('document_number');

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      // Filtro estricto: Sociedad SAP 6202 y País Chile (cl)
      const soc = (idxSociedad !== -1 ? String(row[idxSociedad] || '') : '').trim();
      const pais = (idxPais !== -1 ? String(row[idxPais] || '') : '').toLowerCase().trim();
      if (soc && !soc.includes('6202')) continue;
      if (pais && pais !== 'cl' && !pais.includes('chile')) continue;

      const difMlVal = idxDifMl !== -1 ? parseNumericValueFlex(row[idxDifMl]) : 0;
      const difPctVal = idxDifPct !== -1 ? parseNumericValueFlex(row[idxDifPct]) : 0;
      const totFacVal = idxTotFac !== -1 ? parseNumericValueFlex(row[idxTotFac]) : 0;
      const totPoVal = idxTotPo !== -1 ? parseNumericValueFlex(row[idxTotPo]) : 0;
      const totNcVal = idxTotNc !== -1 ? parseNumericValueFlex(row[idxTotNc]) : 0;
      const catmanVal = idxCatman !== -1 ? String(row[idxCatman] || '').trim() : '';
      const tiendaVal = idxTienda !== -1 ? String(row[idxTienda] || '').trim() : '';
      const condVal = idxCond !== -1 ? String(row[idxCond] || '').trim() : '';
      const analistaVal = idxAnalista !== -1 ? String(row[idxAnalista] || '').trim() : '';
      const statusAforoVal = idxStatusAforo !== -1 ? String(row[idxStatusAforo] || '').trim() : '';
      const statusVal = idxStatus !== -1 ? String(row[idxStatus] || '').trim() : '';
      const aFavorVal = idxAFavor !== -1 ? String(row[idxAFavor] || '').trim() : '';
      const mesVal = idxMes !== -1 ? String(row[idxMes] || '').trim() : '';
      const vendorNameVal = idxVendorName !== -1 ? String(row[idxVendorName] || '').trim() : '';
      const vendorIdVal = idxVendorId !== -1 ? String(row[idxVendorId] || '').trim() : '';
      const docNumVal = idxDocNumber !== -1 ? String(row[idxDocNumber] || '').trim() : '';

      const entry = {
        found: true,
        dif_moneda_local: difMlVal,
        total_difference: difMlVal,
        total_difference_pct: difPctVal,
        total_invoice_associated_cost: totFacVal,
        total_po_amount: totPoVal,
        total_credit_note_amount: totNcVal,
        category_manager: catmanVal,
        tienda: tiendaVal,
        pesable_autorizado: condVal,
        analista_3wm: analistaVal,
        status_aforo: statusAforoVal,
        status: statusVal,
        a_favor: aFavorVal,
        mes: mesVal,
        vendor_name: vendorNameVal,
        vendor_id: vendorIdVal,
        document_number: docNumVal,
        row_index: r + 1,
        source: 'SPREADSHEET_BOT_CHILE_6202'
      };

      // Mapear por todas las referencias posibles de PO en la fila
      const poCandidates = [];
      if (idxPo !== -1 && row[idxPo]) poCandidates.push(String(row[idxPo]));
      if (idxPo1 !== -1 && row[idxPo1]) poCandidates.push(String(row[idxPo1]));
      if (idxOrdenes !== -1 && row[idxOrdenes]) poCandidates.push(String(row[idxOrdenes]));

      poCandidates.forEach(cand => {
        const d = cand.replace(/\D/g, '');
        if (d && d.length >= 4) {
          if (!index[d]) {
            index[d] = { ...entry, po_number: 'PO' + d };
          }
          if (!index['PO' + d]) {
            index['PO' + d] = { ...entry, po_number: 'PO' + d };
          }
        }
      });

      // Mapear también por número de documento / folio si existe
      if (docNumVal && /^\d+$/.test(docNumVal)) {
        if (!index['DOC_' + docNumVal]) {
          index['DOC_' + docNumVal] = entry;
        }
      }
    }

    _cachedBotIndex = index;
  } catch (e) {
    Logger.log('Aviso cargando índice de DIF ML de Spreadsheet Bot: ' + e.message);
  }

  return index;
}

/**
 * Consulta en tiempo real la DIFERENCIA EN MONEDA LOCAL (DIF ML) y metadatos
 * de una Orden de Compra desde el Google Spreadsheet oficial (hoja Bot).
 * @param {string} poNumber Número de PO (ej: 'PO518183', '518183', 'PO518483')
 * @returns {Object|null} Datos de DIF ML del Spreadsheet o null si no se encuentra
 */
function obtenerDifMonedaLocalPorPo(poNumber) {
  if (!poNumber) return null;
  const rawDigits = poNumber.toString().replace(/\D/g, '');
  if (!rawDigits) return null;

  // 1. Intentar leer desde ScriptCache para respuesta instantánea (0ms)
  const cacheKey = 'DIF_ML_' + rawDigits;
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (eCache) {}

  // 2. Consultar índice del Spreadsheet Bot
  const index = getSpreadsheetBotIndex();
  const match = index[rawDigits] || index['PO' + rawDigits];
  if (match) {
    try {
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(match), 900); // 15 minutos de caché
    } catch (eSave) {}
    return match;
  }

  return null;
}

/**
 * Parsea números de forma flexible soportando formato chileno (1.250.000,50 o 58.200,00),
 * notación científica (3,04E+05) y formato internacional.
 */
function parseNumericValueFlex(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = val.toString().trim();
  if (/[eE][+-]?\d+/.test(s)) {
    const num = parseFloat(s.replace(',', '.'));
    if (!isNaN(num)) return Math.round(num);
  }
  let clean = s;
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const n = parseFloat(clean.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Lee todos los casos registrados en el Google Spreadsheet.
 * Detecta dinámicamente las cabeceras (PO, Proveedor, RUT, Tienda, Montos, Facturas).
 */
function getCasesFromSpreadsheet(customId) {
  let sheet;
  try {
    sheet = openMasterCasesSheet(customId);
  } catch (e) {
    Logger.log(`Aviso: No se pudo abrir Spreadsheet de Casos: ${e.message}`);
    return {
      spreadsheet_id: customId || getActiveSpreadsheetId(),
      spreadsheet_name: 'Casos Tribu e Image (Sin conexión)',
      total_casos: 0,
      casos: []
    };
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return {
      spreadsheet_id: sheet.getParent().getId(),
      spreadsheet_name: sheet.getParent().getName(),
      total_casos: 0,
      casos: []
    };
  }

  // 1. Encontrar la fila de cabeceras (primera fila no vacía con al menos 3 columnas)
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const nonEmpties = data[r].filter(c => c !== null && c !== '').length;
    if (nonEmpties >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = data[headerRowIndex].map(h => (h || '').toString().trim());
  const headerMap = mapHeadersFlexibly(rawHeaders);

  const casos = [];
  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    // Ignorar filas totalmente vacías
    if (!row.some(cell => cell !== null && cell !== '')) continue;

    // FILTRO ESTRICTO CHILE (Instrucción de negocio):
    // Columna C debe ser '6202' (Sociedad Delivery Hero Stores Chile) y Columna D debe ser 'cl' (País Chile)
    const colCIdx = headerMap.sociedad !== -1 ? headerMap.sociedad : 2;
    const colDIdx = headerMap.pais !== -1 ? headerMap.pais : 3;
    const valColC = getCellValue(row, colCIdx).toLowerCase().trim();
    const valColD = getCellValue(row, colDIdx).toLowerCase().trim();

    const esSociedad6202 = valColC.includes('6202');
    const esPaisChile = valColD === 'cl' || valColD.includes('cl') || valColD.includes('chile');

    // Descartar si no corresponde a Chile (ej. otros países de la corporación)
    if (!esSociedad6202 || !esPaisChile) {
      continue;
    }

    const poVal = getCellValue(row, headerMap.po);
    const provVal = getCellValue(row, headerMap.proveedor);
    const rutVal = getCellValue(row, headerMap.rut);
    const tiendaVal = getCellValue(row, headerMap.tienda);
    const facNetoVal = getNumericValue(row, headerMap.monto_factura);
    const ocNetoVal = getNumericValue(row, headerMap.monto_oc);
    const difVal = getNumericValue(row, headerMap.diferencia);
    const facturasRef = getCellValue(row, headerMap.facturas);
    const estadoSheet = getCellValue(row, headerMap.estado);
    const auditEstado = getCellValue(row, headerMap.audit_estado);
    const auditMonto = getNumericValue(row, headerMap.audit_monto);
    const auditDiag = getCellValue(row, headerMap.audit_diagnostico);
    const auditFecha = getCellValue(row, headerMap.audit_fecha);

    if (poVal || provVal || facturasRef) {
      casos.push({
        row_index: r + 1,
        sociedad: valColC || '6202',
        pais: valColD || 'cl',
        po_number: normalizarPoNumber(poVal),
        proveedor: provVal || 'Por identificar',
        rut: normalizarRut(rutVal),
        tienda: tiendaVal || 'CH_36_CD_Chile',
        monto_factura: facNetoVal,
        monto_oc: ocNetoVal,
        diferencia_reportada: difVal,
        facturas_referenciadas: facturasRef,
        estado_original: estadoSheet || 'PENDIENTE',
        // Columnas de auditoría automática escritas por la App
        auditoria_app: {
          estado: auditEstado || 'NO_AUDITADO',
          monto_reclamar: auditMonto || 0,
          diagnostico: auditDiag || '',
          fecha: auditFecha || ''
        }
      });
    }
  }

  return {
    spreadsheet_id: sheet.getParent().getId(),
    spreadsheet_name: sheet.getParent().getName(),
    total_casos: casos.length,
    casos: casos
  };
}

/**
 * RUTINA DE ALIMENTACIÓN Y SINCRONIZACIÓN AUTOMÁTICA CON EL SPREADSHEET:
 * 1. Lee cada caso del Spreadsheet.
 * 2. Cruza con Axteroid (DTEs) y BigQuery (recepciones físicas de bodega).
 * 3. Escribe de vuelta en el Spreadsheet las columnas de auditoría:
 *    [Audit_Estado], [Audit_Monto_NC_CLP], [Audit_Diagnostico], [Audit_Fecha].
 */
function syncAndFeedSpreadsheet(customId) {
  const sheet = openMasterCasesSheet(customId);
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    throw new Error('El spreadsheet no contiene datos suficientes para sincronizar.');
  }

  // 1. Detectar cabeceras
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    if (data[r].filter(c => c !== null && c !== '').length >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = data[headerRowIndex].map(h => (h || '').toString().trim());
  let headerMap = mapHeadersFlexibly(rawHeaders);

  // Asegurar que existan las columnas de auditoría escrita por la App
  const auditHeadersNeeded = [
    { key: 'audit_estado', name: 'Audit_Estado_Axteroid' },
    { key: 'audit_monto', name: 'Audit_Monto_NC_CLP' },
    { key: 'audit_diagnostico', name: 'Audit_Diagnostico_Causa_Raiz' },
    { key: 'audit_fecha', name: 'Audit_Ultima_Actualizacion' }
  ];

  let currentNumCols = rawHeaders.length;
  auditHeadersNeeded.forEach(h => {
    if (headerMap[h.key] === -1) {
      currentNumCols++;
      sheet.getRange(headerRowIndex + 1, currentNumCols).setValue(h.name);
      sheet.getRange(headerRowIndex + 1, currentNumCols)
        .setBackground('#1e293b')
        .setFontColor('#38bdf8')
        .setFontWeight('bold');
      headerMap[h.key] = currentNumCols - 1;
    }
  });

  // 2. Procesar cada fila de caso
  let casosActualizados = 0;
  let totalDescalceCalculado = 0;
  const nowStr = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];

    // FILTRO ESTRICTO CHILE (Instrucción de negocio):
    // Columna C debe ser '6202' (Sociedad Delivery Hero Stores Chile) y Columna D debe ser 'cl' (País Chile)
    const colCIdx = headerMap.sociedad !== -1 ? headerMap.sociedad : 2;
    const colDIdx = headerMap.pais !== -1 ? headerMap.pais : 3;
    const valColC = getCellValue(row, colCIdx).toLowerCase().trim();
    const valColD = getCellValue(row, colDIdx).toLowerCase().trim();

    const esSociedad6202 = valColC.includes('6202');
    const esPaisChile = valColD === 'cl' || valColD.includes('cl') || valColD.includes('chile');

    // Descartar si no corresponde a Chile
    if (!esSociedad6202 || !esPaisChile) {
      continue;
    }

    const poVal = getCellValue(row, headerMap.po);
    const rutVal = getCellValue(row, headerMap.rut);
    const facturasVal = getCellValue(row, headerMap.facturas);

    if (!poVal && !facturasVal) continue;

    const poClean = normalizarPoNumber(poVal);
    let estadoAudit = 'PENDIENTE';
    let montoNc = 0;
    let diagnostico = '';

    try {
      // 1. Buscar PO en BigQuery
      let poData = null;
      if (poClean) {
        poData = getPurchaseOrderItems(poClean);
      }

      // 2. Buscar facturas en Axteroid asociadas a la PO o RUT
      let invoices = [];
      if (poClean) {
        const searchRes = searchAxteroidDocs({ order_reference: poClean });
        invoices = searchRes.documents || [];
      } else if (facturasVal) {
        const folios = facturasVal.toString().match(/\d{6,10}/g) || [];
        for (let f of folios.slice(0, 3)) {
          const resF = searchAxteroidDocs({ serial: f });
          if (resF.documents && resF.documents.length > 0) {
            invoices.push(resF.documents[0]);
          }
        }
      }

      if (!poData || !poData.po_found) {
        estadoAudit = 'OC_NO_ENCONTRADA_BQ';
        montoNc = getNumericValue(row, headerMap.monto_factura) || getNumericValue(row, headerMap.diferencia);
        diagnostico = `La Orden de Compra ${poClean || 'N/A'} no registra recepciones en BigQuery. Retener pago completo.`;
      } else if (invoices.length === 0) {
        estadoAudit = 'FACTURA_NO_EN_AXTEROID';
        diagnostico = `OC ${poClean} encontrada en bodega, pero sus facturas aún no ingresan a Axteroid.`;
      } else {
        // Ejecutar cruce de las facturas encontradas
        let totalReclamarCaso = 0;
        const diagList = [];

        invoices.forEach(inv => {
          try {
            const xmlText = fetchAxteroidXml(inv.id);
            const dteData = parseDteXml(xmlText);
            const cruce = ejecutarCruceSkuPorSku(dteData, poData);
            if (cruce && cruce.resumen) {
              totalReclamarCaso += (cruce.resumen.total_monto_a_reclamar || 0);
              if (cruce.resumen.total_monto_a_reclamar > 0) {
                diagList.push(`Fac ${inv.serial}: $${Math.round(cruce.resumen.total_monto_a_reclamar).toLocaleString('es-CL')} (${cruce.resumen.estado_general})`);
              }
            }
          } catch (e) {
            diagList.push(`Fac ${inv.serial}: error al parsear XML (${e.message})`);
          }
        });

        montoNc = totalReclamarCaso;
        totalDescalceCalculado += montoNc;

        if (montoNc > 0) {
          estadoAudit = 'DESCALCE_CONFIRMADO';
          diagnostico = diagList.join(' | ') || `Diferencia de $${Math.round(montoNc).toLocaleString('es-CL')} CLP confirmada en recepción. Solicitar NC.`;
        } else {
          estadoAudit = 'CONCILIADO_OK';
          diagnostico = 'Calce perfecto 100% entre facturas y recepción física en bodega. Aprobado para pago.';
        }
      }

      // 3. Escribir resultados en el Spreadsheet
      const rowNum = r + 1;
      sheet.getRange(rowNum, headerMap.audit_estado + 1).setValue(estadoAudit);
      sheet.getRange(rowNum, headerMap.audit_monto + 1).setValue(montoNc);
      sheet.getRange(rowNum, headerMap.audit_diagnostico + 1).setValue(diagnostico);
      sheet.getRange(rowNum, headerMap.audit_fecha + 1).setValue(nowStr);

      casosActualizados++;
    } catch (errFila) {
      Logger.log(`Error sincronizando fila ${r + 1}: ${errFila.message}`);
    }
  }

  return {
    casos_procesados: casosActualizados,
    descalce_total_clp: totalDescalceCalculado,
    fecha_actualizacion: nowStr,
    spreadsheet_id: sheet.getParent().getId()
  };
}

/**
 * Inserta o actualiza un caso individual directamente en el Google Spreadsheet maestro.
 * Aplica el filtro estricto de Chile: Col C = 6202, Col D = cl.
 */
function appendOrUpdateCaseInSpreadsheet(caseObj) {
  if (!caseObj) throw new Error('Datos de caso no proporcionados.');

  const sheet = openMasterCasesSheet();
  const data = sheet.getDataRange().getValues();

  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const nonEmpties = data[r].filter(c => c !== null && c !== '').length;
    if (nonEmpties >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = data[headerRowIndex].map(h => (h || '').toString().trim());
  const headerMap = mapHeadersFlexibly(rawHeaders);
  const nowStr = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  const targetPo = normalizarPoNumber(caseObj.po_number);

  const colCIdx = headerMap.sociedad !== -1 ? headerMap.sociedad : 2;
  const colDIdx = headerMap.pais !== -1 ? headerMap.pais : 3;

  // Buscar si ya existe la fila de la PO en los registros de Chile (6202 / cl)
  let targetRow = -1;
  if (targetPo) {
    for (let r = headerRowIndex + 1; r < data.length; r++) {
      const row = data[r];
      const valColC = getCellValue(row, colCIdx).toLowerCase().trim();
      const valColD = getCellValue(row, colDIdx).toLowerCase().trim();
      if (!valColC.includes('6202') || (!valColD.includes('cl') && !valColD.includes('chile'))) continue;

      const rowPo = normalizarPoNumber(getCellValue(row, headerMap.po));
      if (rowPo && rowPo === targetPo) {
        targetRow = r + 1;
        break;
      }
    }
  }

  if (targetRow !== -1) {
    // Actualizar columnas en la fila existente
    if (headerMap.audit_estado !== -1) sheet.getRange(targetRow, headerMap.audit_estado + 1).setValue(caseObj.estado_audit || 'DESCALCE_CONFIRMADO');
    if (headerMap.audit_monto !== -1) sheet.getRange(targetRow, headerMap.audit_monto + 1).setValue(caseObj.monto_reclamar || 0);
    if (headerMap.audit_diagnostico !== -1) sheet.getRange(targetRow, headerMap.audit_diagnostico + 1).setValue(caseObj.diagnostico || '');
    if (headerMap.audit_fecha !== -1) sheet.getRange(targetRow, headerMap.audit_fecha + 1).setValue(nowStr);
    if (caseObj.facturas && headerMap.facturas !== -1) {
      const currFac = getCellValue(data[targetRow - 1], headerMap.facturas);
      if (!currFac.includes(caseObj.facturas)) {
        sheet.getRange(targetRow, headerMap.facturas + 1).setValue(currFac ? `${currFac}, ${caseObj.facturas}` : caseObj.facturas);
      }
    }

    return {
      success: true,
      action: 'updated',
      row: targetRow,
      po: targetPo,
      message: `Caso ${targetPo} actualizado exitosamente en fila ${targetRow} del Google Spreadsheet (6202 / CL).`
    };
  } else {
    // Insertar nueva fila al final del Spreadsheet con Sociedad 6202 y País CL
    const newRow = new Array(Math.max(rawHeaders.length, 14)).fill('');
    newRow[colCIdx] = '6202';
    newRow[colDIdx] = 'cl';
    if (headerMap.po !== -1) newRow[headerMap.po] = targetPo;
    if (headerMap.proveedor !== -1) newRow[headerMap.proveedor] = caseObj.proveedor || '';
    if (headerMap.rut !== -1) newRow[headerMap.rut] = normalizarRut(caseObj.rut);
    if (headerMap.tienda !== -1) newRow[headerMap.tienda] = caseObj.tienda || 'CH_36_CD_Chile';
    if (headerMap.monto_factura !== -1) newRow[headerMap.monto_factura] = caseObj.monto_factura || 0;
    if (headerMap.monto_oc !== -1) newRow[headerMap.monto_oc] = caseObj.monto_oc || 0;
    if (headerMap.diferencia !== -1) newRow[headerMap.diferencia] = caseObj.diferencia || (caseObj.monto_factura - caseObj.monto_oc);
    if (headerMap.facturas !== -1) newRow[headerMap.facturas] = caseObj.facturas || '';
    if (headerMap.estado !== -1) newRow[headerMap.estado] = 'RECLAMO_REGISTRADO';
    if (headerMap.audit_estado !== -1) newRow[headerMap.audit_estado] = caseObj.estado_audit || 'DESCALCE_CONFIRMADO';
    if (headerMap.audit_monto !== -1) newRow[headerMap.audit_monto] = caseObj.monto_reclamar || 0;
    if (headerMap.audit_diagnostico !== -1) newRow[headerMap.audit_diagnostico] = caseObj.diagnostico || '';
    if (headerMap.audit_fecha !== -1) newRow[headerMap.audit_fecha] = nowStr;

    sheet.appendRow(newRow);
    const lastRow = sheet.getLastRow();
    return {
      success: true,
      action: 'appended',
      row: lastRow,
      po: targetPo,
      message: `Caso ${targetPo} registrado exitosamente como nueva fila ${lastRow} en el Google Spreadsheet (6202 / CL).`
    };
  }
}

/**
 * Mapeo inteligente y tolerante a fallos de los nombres de columnas del Spreadsheet.
 */
function mapHeadersFlexibly(headers) {
  const map = {
    po: -1,
    proveedor: -1,
    rut: -1,
    sociedad: -1,
    pais: -1,
    tienda: -1,
    monto_factura: -1,
    monto_oc: -1,
    diferencia: -1,
    facturas: -1,
    estado: -1,
    audit_estado: -1,
    audit_monto: -1,
    audit_diagnostico: -1,
    audit_fecha: -1,
    catman: -1,
    status_aforo: -1,
    analista: -1,
    pesable: -1
  };

  headers.forEach((h, idx) => {
    const raw = (h || '').toString().toLowerCase().trim();
    const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    if (norm.includes('audit_estado')) map.audit_estado = idx;
    else if (norm.includes('audit_monto')) map.audit_monto = idx;
    else if (norm.includes('audit_diag')) map.audit_diagnostico = idx;
    else if (norm.includes('audit_fecha') || norm.includes('audit_ultima')) map.audit_fecha = idx;
    else if (norm.includes('sociedad') || norm.includes('company_code') || norm.includes('company') || norm.includes('entity')) map.sociedad = idx;
    else if (norm.includes('pais') || norm.includes('country_code') || norm.includes('country')) map.pais = idx;
    else if (norm === 'total_difference' || norm === 'dif_ml' || norm === 'diferencia_ml') map.diferencia = idx; // Prioridad 1: DIF MONEDA LOCAL
    else if (map.diferencia === -1 && (norm.includes('dif') || norm.includes('descalce') || norm.includes('reclamar')) && !norm.includes('pct') && !norm.includes('euro')) map.diferencia = idx;
    else if (norm === 'purchase_order' || norm === 'po1' || norm === 'ordenes de compra') map.po = idx; // Prioridad 1: PO exacta
    else if (map.po === -1 && (norm.includes('orden') || norm.includes('po') || norm.includes('oc')) && !norm.includes('flag') && !norm.includes('amount') && !norm.includes('status')) map.po = idx;
    else if (norm.includes('category manager') || norm.includes('catman')) map.catman = idx;
    else if (norm.includes('proveedor') || norm.includes('vendor_name') || norm.includes('razon') || norm.includes('vendor')) map.proveedor = idx;
    else if (norm.includes('rut') || norm.includes('vendor_id')) map.rut = idx;
    else if (norm.includes('tienda') || norm.includes('local') || norm.includes('almacen') || norm.includes('cd')) map.tienda = idx;
    else if (norm.includes('total_invoice_associated_cost') || (norm.includes('factura') && (norm.includes('monto') || norm.includes('neto') || norm.includes('costo')))) map.monto_factura = idx;
    else if (norm.includes('total_po_amount') || (norm.includes('oc') && (norm.includes('monto') || norm.includes('costo')))) map.monto_oc = idx;
    else if (norm.includes('document_number') || norm.includes('factura') || norm.includes('folio') || norm.includes('dte')) map.facturas = idx;
    else if (norm.includes('status_aforo')) map.status_aforo = idx;
    else if (norm.includes('analista_3wm')) map.analista = idx;
    else if (norm.includes('pesable/autorizado')) map.pesable = idx;
    else if (norm.includes('estado') || norm.includes('status') || norm.includes('condicion')) map.estado = idx;
  });

  // Fallbacks fijos para la hoja Bot estándar
  if (map.sociedad === -1) map.sociedad = 2; // Columna C: 6202
  if (map.pais === -1) map.pais = 3;         // Columna D: cl
  if (map.diferencia === -1 && headers.length > 55) map.diferencia = 55; // Columna BD: total_difference

  return map;
}

function getCellValue(row, colIdx) {
  if (colIdx === -1 || colIdx === undefined || colIdx >= row.length) return '';
  return (row[colIdx] || '').toString().trim();
}

function getNumericValue(row, colIdx) {
  if (colIdx === -1 || colIdx === undefined || colIdx >= row.length) return 0;
  return parseNumericValueFlex(row[colIdx]);
}

function normalizarPoNumber(val) {
  if (!val) return '';
  const str = val.toString().trim().toUpperCase();
  const digits = str.replace(/[^0-9]/g, '');
  return digits ? `PO${digits}` : str;
}

function normalizarRut(val) {
  if (!val) return '';
  return val.toString().trim().toUpperCase().replace(/[^0-9K-]/g, '');
}

/**
 * ============================================================================
 * MÓDULO TABLA DE AFOROS CHILE (Spreadsheet ID: 1do-TBEM_QbNoVzWxns7-2nfGTLXvHFTaaruI-1E-KrI)
 * GID: 805283264
 * Lee las condiciones de aforo en vivo, montos retenidos y proveedores de Lista Blanca.
 * Incorpora CARGA EN MEMORIA POR DEFECTO con los 32 proveedores clave de Chile
 * (Carozzi, Nestlé, Andina, Agrosuper, Ideal, Bredenmaster, etc.) y sus Category Managers.
 * ============================================================================
 */

/**
 * Catálogo Maestro Oficial de los 32 Proveedores Clave de Chile en memoria.
 * Asegura operatividad 100% inmediata y autónoma sin depender de archivos externos.
 */
const CATALOGO_AFOROS_MEMORIA_32 = [
  // 1. Constanza Urra (Snacks, Panadería, Desayuno, Huevos)
  {
    proveedor: "Nestlé Chile S.A.",
    rut: "96557910-9",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "33.8%",
    category_manager: "Constanza Urra",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Ideal S.A. (Grupo Bimbo)",
    rut: "82623500-4",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "3.87%",
    category_manager: "Constanza Urra",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Evercrisp Snack Productos de Chile S.A.",
    rut: "94528000-K",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "1.57%",
    category_manager: "Constanza Urra",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Avícola y Comercial El Toco Ltda.",
    rut: "78383730-7",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "1.03%",
    category_manager: "Constanza Urra",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Proa SpA",
    rut: "92117000-9",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.65%",
    category_manager: "Constanza Urra",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Importadora Café Do Brasil (ICB S.A.)",
    rut: "93178000-K",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.04%",
    category_manager: "Constanza Urra",
    tienda: "CH_36_CD_Chile"
  },

  // 2. Javiera Rogers (Bebidas, Cervezas, Abarrotes)
  {
    proveedor: "Coca-Cola Embonor S.A.",
    rut: "93281000-K",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "26.36%",
    category_manager: "Javiera Rogers",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Embotelladora Andina S.A.",
    rut: "91144000-8",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "23.87%",
    category_manager: "Javiera Rogers",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Comercial CCU S.A.",
    rut: "99554560-8",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-7.04%",
    category_manager: "Javiera Rogers",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Distribución y Excelencia S.A. (Dysa)",
    rut: "96568970-2",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "1.25%",
    category_manager: "Javiera Rogers",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Tresmontes S.A.",
    rut: "76388064-8",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.36%",
    category_manager: "Javiera Rogers",
    tienda: "CH_36_CD_Chile"
  },

  // 3. Daniela Reyes (Carozzi / Galletas / Pastas)
  {
    proveedor: "Empresas Carozzi S.A.",
    rut: "96591040-9",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "17.72%",
    category_manager: "Daniela Reyes",
    tienda: "CH_36_CD_Chile"
  },

  // 4. Maria Paz Devés (Carnes, Frescos, Cecinas, Lácteos, Congelados)
  {
    proveedor: "Agrosuper Comercializadora Ltda.",
    rut: "79984240-8",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "4.94%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Consorcio Industrial de Alimentos S.A. (CIAL)",
    rut: "80186300-0",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-8.73%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Cooperativa Agrícola y Lechera La Unión (Colun)",
    rut: "81094100-6",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-2.58%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Comercial Santa Elena S.A.",
    rut: "84472400-4",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "1.76%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Comercializadora Agropecuaria Embrio Chile S.A.",
    rut: "99540130-4",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "2.44%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Productos Fernández S.A. (PF)",
    rut: "91004000-6",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-0.89%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Ariztía Comercial Ltda.",
    rut: "83614800-2",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-0.4%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Carnes Ñuble S.A.",
    rut: "96518070-2",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.04%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Alimentos y Frutos S.A. (Minuto Verde)",
    rut: "96557910-9",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.49%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Watt's S.A.",
    rut: "76455830-8",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.05%",
    category_manager: "Maria Paz Devés",
    tienda: "CH_36_CD_Chile"
  },

  // 5. Daniela Catilao (Panadería, Frutas/Verduras, Pesables)
  {
    proveedor: "Bredenmaster SpA",
    rut: "96606310-6",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "2.91%",
    category_manager: "Daniela Catilao",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Comercializadora JJ & Alimentos SpA",
    rut: "77183217-2",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.4%",
    category_manager: "Daniela Catilao",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Comercializadora y Exportadora Exofrut SpA",
    rut: "78231878-0",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.1%",
    category_manager: "Daniela Catilao",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Comercializadora Bambus SpA",
    rut: "78185379-8",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-0.01%",
    category_manager: "Daniela Catilao",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Punto Azul S.A.",
    rut: "77961510-3",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-0.24%",
    category_manager: "Daniela Catilao",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Proveedor Genérico Frutas y Verduras",
    rut: "77999000-1",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-0.88%",
    category_manager: "Daniela Catilao",
    tienda: "CH_36_CD_Chile"
  },

  // 6. Nicolas Lopez (Higiene, Aseo, Cuidado Personal, Abarrotes)
  {
    proveedor: "Softys Chile SpA (CMPC)",
    rut: "96529310-8",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "2%",
    category_manager: "Nicolas Lopez",
    tienda: "CH_36_CD_Chile"
  },
  {
    proveedor: "Promerco S.A.",
    rut: "79684790-5",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "1.64%",
    category_manager: "Nicolas Lopez",
    tienda: "CH_36_CD_Chile"
  },

  // 7. Joaquin Mardones (Non-Food / Cuidado Personal / P&G)
  {
    proveedor: "Procter & Gamble Chile Ltda. (P&G)",
    rut: "96656660-4",
    condicion_aforo: "NO AFORADO POR SOLICITUD DE COMERCIAL",
    es_lista_blanca: true,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "0.46%",
    category_manager: "Joaquin Mardones",
    tienda: "CH_36_CD_Chile"
  },

  // 8. Francisco Alvarez (Carnes / Especialidades)
  {
    proveedor: "Los Cabros Asociados SpA",
    rut: "76934499-3",
    condicion_aforo: "CONDICIONADO POR PESABLES (Tolerancia Dinámica)",
    es_lista_blanca: false,
    monto_aforado: 0,
    monto_total_observado: 0,
    tolerancia: "-6.99%",
    category_manager: "Francisco Alvarez",
    tienda: "CH_36_CD_Chile"
  }
];

/**
 * Genera el paquete de datos del catálogo oficial por defecto en memoria.
 */
function getCatalogoAforosPorDefecto(customId) {
  const records = CATALOGO_AFOROS_MEMORIA_32.map((item, idx) => ({
    row_index: idx + 1,
    proveedor: item.proveedor,
    rut: normalizarRut(item.rut),
    condicion_aforo: item.condicion_aforo,
    es_lista_blanca: item.es_lista_blanca,
    monto_aforado: item.monto_aforado || 0,
    monto_total_observado: item.monto_total_observado || 0,
    tolerancia: item.tolerancia || '0%',
    category_manager: item.category_manager,
    tienda: item.tienda || 'CH_36_CD_Chile'
  }));

  const listaBlancaCount = records.filter(r => r.es_lista_blanca).length;

  return {
    spreadsheet_id: customId || getActiveAforosSpreadsheetId(),
    sheet_name: 'Aforos Chile (Catálogo Maestro 32 Proveedores)',
    total_proveedores: records.length,
    monto_total_aforado: 0,
    lista_blanca_count: listaBlancaCount,
    records: records,
    origen: 'MEMORIA_POR_DEFECTO'
  };
}

/**
 * Abre la hoja de Aforos Chile buscando por GID o nombre.
 */
function openAforosChileSheet(customId, customGid) {
  const sheetId = customId || getActiveAforosSpreadsheetId();
  const gidTarget = (customGid !== undefined && customGid !== null) ? customGid.toString() : SHEETS_CONFIG.AFOROS_GID;
  
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheets = ss.getSheets();
    
    // 1. Buscar por GID exacto
    const target = sheets.find(s => s.getSheetId().toString() === gidTarget);
    if (target) return target;

    // 2. Fallback: buscar hoja que contenga "Aforo"
    const aforoSheet = sheets.find(s => s.getName().toLowerCase().includes('aforo'));
    if (aforoSheet) return aforoSheet;

    // 3. Fallback: primera hoja
    return sheets[0];
  } catch (e) {
    throw new Error(`No se pudo abrir el Spreadsheet de Aforos Chile (${sheetId}): ${e.message}`);
  }
}

/**
 * Lee la tabla completa de Aforos Chile.
 * Si el archivo no existe, falla la conexión o no responde, carga de inmediato
 * en memoria el catálogo maestro de los 32 proveedores clave de Chile.
 */
function getAforosChileData(customId, customGid) {
  try {
    const sheet = openAforosChileSheet(customId, customGid);
    if (!sheet) {
      Logger.log('Aforos: Hoja no disponible. Cargando catálogo maestro en memoria por defecto.');
      return getCatalogoAforosPorDefecto(customId);
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      Logger.log('Aforos: Hoja sin registros. Cargando catálogo maestro en memoria por defecto.');
      return getCatalogoAforosPorDefecto(customId);
    }

    // 1. Detectar fila de cabeceras
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(10, data.length); r++) {
      const nonEmpties = data[r].filter(c => c !== null && c !== '').length;
      if (nonEmpties >= 2) {
        headerRowIndex = r;
        break;
      }
    }

    const rawHeaders = data[headerRowIndex].map(h => (h || '').toString().trim());
    const headerMap = mapAforosHeadersFlexibly(rawHeaders);

    const records = [];
    let montoTotalAforado = 0;
    let listaBlancaCount = 0;

    for (let r = headerRowIndex + 1; r < data.length; r++) {
      const row = data[r];
      if (!row.some(cell => cell !== null && cell !== '')) continue;

      const provName = getCellValue(row, headerMap.proveedor);
      const rutVal = getCellValue(row, headerMap.rut);
      const condVal = getCellValue(row, headerMap.condicion);
      const montoAforo = getNumericValue(row, headerMap.monto_aforo);
      const montoTotal = getNumericValue(row, headerMap.monto_total);
      const cmVal = getCellValue(row, headerMap.cm);
      const tiendaVal = getCellValue(row, headerMap.tienda);
      const tolerVal = getCellValue(row, headerMap.tolerancia);

      if (provName || rutVal) {
        const condUpper = (condVal || '').toUpperCase();
        const esListaBlanca = condUpper.includes('NO AFORADO') || 
                              condUpper.includes('LISTA BLANCA') || 
                              condUpper.includes('WHITELIST') || 
                              condUpper.includes('COMERCIAL');

        if (esListaBlanca) listaBlancaCount++;
        montoTotalAforado += montoAforo;

        records.push({
          row_index: r + 1,
          proveedor: provName || 'Sin Nombre',
          rut: normalizarRut(rutVal),
          condicion_aforo: condVal || 'AFORADO NORMAL',
          es_lista_blanca: esListaBlanca,
          monto_aforado: montoAforo,
          monto_total_observado: montoTotal,
          tolerancia: tolerVal || '0%',
          category_manager: cmVal || 'Sin Asignar',
          tienda: tiendaVal || 'CH_36_CD_Chile'
        });
      }
    }

    if (records.length === 0) {
      Logger.log('Aforos: 0 registros válidos en la hoja. Cargando catálogo maestro en memoria por defecto.');
      return getCatalogoAforosPorDefecto(customId);
    }

    return {
      spreadsheet_id: sheet.getParent().getId(),
      sheet_name: sheet.getName(),
      total_proveedores: records.length,
      monto_total_aforado: montoTotalAforado,
      lista_blanca_count: listaBlancaCount,
      records: records,
      origen: 'GOOGLE_SHEETS'
    };
  } catch (e) {
    Logger.log(`Aviso: Error conectando con Google Sheets (${customId || SHEETS_CONFIG.AFOROS_SPREADSHEET_ID}): ${e.message}. Activando catálogo maestro de 32 proveedores en memoria.`);
    return getCatalogoAforosPorDefecto(customId);
  }
}

/**
 * Consulta rápida de la condición de aforo de un proveedor por RUT.
 * @param {string} rut RUT del proveedor
 */
function obtenerCondicionAforoProveedor(rut) {
  if (!rut) return null;
  const cleanRut = normalizarRut(rut);
  const cleanDigits = cleanRut.replace(/[^0-9kK]/g, '').toUpperCase();

  // Prioridad 1: Consulta instantánea en catálogo de memoria (0ms, sin bloqueos de red ni permisos)
  if (typeof CATALOGO_AFOROS_MEMORIA_32 !== 'undefined' && Array.isArray(CATALOGO_AFOROS_MEMORIA_32)) {
    const memMatch = CATALOGO_AFOROS_MEMORIA_32.find(c => {
      return (c.rut || '').replace(/[^0-9kK]/g, '').toUpperCase() === cleanDigits;
    });
    if (memMatch) {
      return {
        proveedor: memMatch.proveedor,
        rut: normalizarRut(memMatch.rut),
        condicion_aforo: memMatch.condicion_aforo,
        es_lista_blanca: memMatch.es_lista_blanca,
        category_manager: memMatch.category_manager,
        tolerancia: memMatch.tolerancia,
        monto_aforado: 0,
        tienda: 'CH_36_CD_Chile'
      };
    }
  }

  // Prioridad 2: Consulta dinámica a Google Sheets solo si no estaba en el catálogo precargado
  try {
    const data = getAforosChileData();
    if (data && data.records) {
      const found = data.records.find(r => {
        if (!r.rut) return false;
        const rDigits = r.rut.replace(/[^0-9kK]/g, '').toUpperCase();
        return rDigits === cleanDigits;
      });
      if (found) return found;
    }
  } catch (e) {
    Logger.log(`Error consultando aforo para RUT ${rut}: ${e.message}`);
  }


  return {
    rut: cleanRut,
    proveedor: 'Proveedor Estándar',
    condicion_aforo: 'AFORADO NORMAL',
    es_lista_blanca: false,
    monto_aforado: 0,
    tolerancia: '0%',
    category_manager: 'Sin Asignar',
    tienda: 'CH_36_CD_Chile'
  };
}

/**
 * Mapeo inteligente y flexible de cabeceras para la Tabla de Aforos Chile.
 */
function mapAforosHeadersFlexibly(headers) {
  const map = {
    proveedor: -1,
    rut: -1,
    condicion: -1,
    monto_aforo: -1,
    monto_total: -1,
    tolerancia: -1,
    cm: -1,
    tienda: -1
  };

  headers.forEach((h, idx) => {
    const norm = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    if (norm.includes('condicion') || norm.includes('regla') || norm.includes('tipo aforo') || norm.includes('estado aforo')) map.condicion = idx;
    else if (norm.includes('aforo') && (norm.includes('monto') || norm.includes('ml') || norm.includes('retenido') || norm.includes('retencion'))) map.monto_aforo = idx;
    else if (norm.includes('total') || norm.includes('facturado')) map.monto_total = idx;
    else if (norm.includes('proveedor') || norm.includes('razon') || norm.includes('vendor') || norm.includes('supplier')) map.proveedor = idx;
    else if (norm.includes('rut') || norm.includes('tax_id')) map.rut = idx;
    else if (norm.includes('category') || norm.includes('cm') || norm.includes('comercial') || norm.includes('responsable')) map.cm = idx;
    else if (norm.includes('tienda') || norm.includes('local') || norm.includes('almacen') || norm.includes('cd')) map.tienda = idx;
    else if (norm.includes('tolerancia') || norm.includes('%')) map.tolerancia = idx;
  });

  return map;
}

/**
 * Crea un Google Spreadsheet nativo en Google Drive con el formato corporativo oficial
 * de Cuentas por Pagar / Finanzas D-Marts Chile (idéntico a la plantilla modelo):
 * https://docs.google.com/spreadsheets/d/1tV8no7qLQI_6dVMoqN8dMGJdb0E4rYTE/edit?gid=1066181932#gid=1066181932
 *
 * @param {Object} payload - Contiene proveedor, po_number, items y detalle_facturas
 * @return {Object} { success: true, url: string, id: string, name: string }
 */
/**
 * Genera una planilla Google Spreadsheet nativa en Google Drive con el formato oficial
 * idéntico al de Cuentas por Pagar / Finanzas D-Marts Chile:
 * https://docs.google.com/spreadsheets/d/1tV8no7qLQI_6dVMoqN8dMGJdb0E4rYTE/edit?gid=1066181932#gid=1066181932
 *
 * @param {Object} payload - Contiene proveedor, po_number, tienda, items y detalle_facturas
 * @return {Object} { success: true, spreadsheet_id: string, url: string, name: string, total_items: number, total_diferencias: number, monto_diferencias: number }
 */
function crearPlanillaConciliacionOficialGoogleSheets(payload) {
  try {
    payload = payload || {};
    const provName = payload.proveedor || 'Proveedor';
    const cleanProvTab = provName.replace(/[^\w\s]/gi, '').substring(0, 25).trim() || 'Conciliación';
    const poNumber = payload.po_number || 'OC';
    const tienda = payload.tienda || 'CH_36_CD_Chile (Sociedad 6202)';
    let items = payload.items || [];
    let detalleFacturas = payload.detalle_facturas || [];

    // Normalizar items y detalle_facturas recibidos directamente desde la conciliación activa en Step 3
    if (!Array.isArray(items)) items = [];
    if (!Array.isArray(detalleFacturas)) detalleFacturas = [];

    const ssName = `Conciliación Finanzas_${cleanProvTab}_${poNumber}_${Utilities.formatDate(new Date(), 'America/Santiago', 'yyyyMMdd_HHmm')}`;
    const ss = SpreadsheetApp.create(ssName);
    
    // --- HOJA 1: Conciliación SKU x SKU (Nombre Proveedor) ---
    const sheet1 = ss.getSheets()[0];
    sheet1.setName(cleanProvTab);
    sheet1.setGridlines(true);

    const numRows = Math.max(items.length, 1);
    const startRow = 6;
    const endRow = startRow + numRows - 1;

    // 1. Resumen y control financiero A1:E3
    sheet1.getRange('A1').setValue('Orden de Compra:').setFontWeight('bold');
    sheet1.getRange('B1').setValue(poNumber).setFontWeight('bold').setHorizontalAlignment('center');
    sheet1.getRange('D1').setValue('Monto por diferencia de unidades:').setFontWeight('bold');
    sheet1.getRange('E1').setFormula(`=SUMPRODUCT(($H$6:$H$${endRow})*($N$6:$N$${endRow}))`).setNumberFormat('$#,##0');

    sheet1.getRange('K1').setValue('EN CASO DE HABER FACTURADO POR CAJA, FAVOR DE COLOCAR LAS UNIDADES TOTALES Y EL COSTO TOTAL FACTURADO')
      .setFontColor('#FF0000').setFontWeight('bold');

    sheet1.getRange('A2').setValue('Monto Aforado:').setFontWeight('bold');
    sheet1.getRange('B2').setFormula('=-$E$3').setNumberFormat('$#,##0');
    sheet1.getRange('D2').setValue('Monto por diferencia de costo:').setFontWeight('bold');
    sheet1.getRange('E2').setFormula(`=SUMPRODUCT(($M$6:$M$${endRow})*($K$6:$K$${endRow}))-SUMPRODUCT(($H$6:$H$${endRow})*($K$6:$K$${endRow}))`).setNumberFormat('$#,##0');

    sheet1.getRange('A3').setValue('Diferencia sin identificar:').setFontWeight('bold');
    sheet1.getRange('B3').setFormula('=$B$2+$E$3').setNumberFormat('$#,##0');
    sheet1.getRange('D3').setValue('Monto total diferencias:').setFontWeight('bold');
    sheet1.getRange('E3').setFormula('=$E$1+$E$2').setNumberFormat('$#,##0');

    sheet1.getRange('A1:E3').setBackground('#FEF5F4')
      .setBorder(true, true, true, true, true, true, '#E06666', SpreadsheetApp.BorderStyle.SOLID);

    // 2. Banners de acción Fila 4
    const rK4 = sheet1.getRange('K4:M4');
    rK4.merge().setValue('COMPLETAR CON LOS PRODUCTOS FACTURADOS')
      .setBackground('#FFF2CC').setFontColor('#7F6000').setFontWeight('bold').setHorizontalAlignment('center');

    const rN4 = sheet1.getRange('N4:P4');
    rN4.merge().setValue('REVISAR LAS DIFERENCIAS')
      .setBackground('#FFF2CC').setFontColor('#7F6000').setFontWeight('bold').setHorizontalAlignment('center');

    // 3. Encabezados Rojos Oficiales Fila 5
    const headers = [
      'Órdenes de Compra', 'Tienda', 'SKU', 'EAN', 'Nombre de Producto', 'Tipo Producto',
      'Unidades Recepcionadas', 'Costo Unitario OC', 'Impuesto Interno', 'Costo Total OC',
      'Unidades Facturadas', 'Costo Total Facturado (SIN IVA)', 'Costo Unitario Facturado (SIN IVA)',
      'Diferencia de Unidades', 'Diferencia de Costo', 'Diferencias Finales', 'Comentarios'
    ];
    sheet1.getRange(5, 1, 1, headers.length).setValues([headers])
      .setBackground('#C00000').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
    sheet1.setRowHeight(5, 28);

    // Congelar filas de cabecera (1 a 5)
    sheet1.setFrozenRows(5);

    let totalDiferenciasDetectadas = 0;
    let montoTotalNcEstimado = 0;

    // 4. Filas de Datos y Fórmulas
    if (items.length > 0) {
      const rowValues = [];

      items.forEach((it, idx) => {
        const r = startRow + idx;
        const qRec = Number(it.cant_rec !== undefined ? it.cant_rec : (it.quantity_received || 0));
        const cOc = Number(it.costo_oc !== undefined ? it.costo_oc : (it.unit_cost_oc || 0));
        const qFac = Number(it.cant_fac !== undefined ? it.cant_fac : (it.quantity_invoiced || 0));
        const totFac = Number(it.costo_total_fac !== undefined ? it.costo_total_fac : (it.amount_invoiced || (qFac * cOc)));
        const unitFac = qFac > 0 ? (totFac / qFac) : 0;

        if (qFac > qRec || unitFac > cOc) {
          totalDiferenciasDetectadas++;
          montoTotalNcEstimado += Math.max(0, qFac - qRec) * cOc + Math.max(0, unitFac - cOc) * qRec;
        }

        rowValues.push([
          it.po || poNumber,
          it.tienda || tienda,
          it.sku || '',
          it.ean || '',
          it.name || it.product_name || '',
          it.cat || it.categoria || it.category || 'General',
          qRec,
          cOc,
          0,
          `=G${r}*H${r}`,
          qFac,
          totFac,
          `=IF(OR(K${r}="",K${r}=0,L${r}=""),0,IFERROR(L${r}/K${r},0))`,
          `=IF(OR(K${r}="",K${r}=0,L${r}=""),0,K${r}-G${r})`,
          `=ROUND(IF(OR(K${r}="",K${r}=0,L${r}=""),0,M${r}-H${r}),2)`,
          `=IF(AND(N${r}>0,O${r}>0),"Diferencia de Costo y Unidad",IF(N${r}>0,"Diferencia de Unidades",IF(O${r}>0,"Diferencia de Costo",IF(AND(N${r}=0,O${r}=0),"Calce Conforme",""))))`,
          it.comentario || ''
        ]);
      });

      const dataRange = sheet1.getRange(startRow, 1, items.length, 17);
      dataRange.setValues(rowValues);
      
      // Aplicar formatos numéricos
      sheet1.getRange(startRow, 7, items.length, 1).setNumberFormat('#,##0');
      sheet1.getRange(startRow, 8, items.length, 2).setNumberFormat('$#,##0.00');
      sheet1.getRange(startRow, 10, items.length, 1).setNumberFormat('$#,##0');
      sheet1.getRange(startRow, 11, items.length, 1).setNumberFormat('#,##0');
      sheet1.getRange(startRow, 12, items.length, 1).setNumberFormat('$#,##0');
      sheet1.getRange(startRow, 13, items.length, 1).setNumberFormat('$#,##0.00');
      sheet1.getRange(startRow, 14, items.length, 1).setNumberFormat('#,##0');
      sheet1.getRange(startRow, 15, items.length, 1).setNumberFormat('$#,##0.00');

      dataRange.setBorder(true, true, true, true, true, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);

      // Reglas de formato condicional para la columna P (Diferencias Finales)
      const colPRange = sheet1.getRange(startRow, 16, items.length, 1);
      const ruleDiff = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('Diferencia')
        .setBackground('#FCE8E6')
        .setFontColor('#C5221F')
        .setBold(true)
        .setRanges([colPRange])
        .build();

      const ruleOk = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('Calce Conforme')
        .setBackground('#E6F4EA')
        .setFontColor('#137333')
        .setRanges([colPRange])
        .build();

      const rules = sheet1.getConditionalFormatRules();
      rules.push(ruleDiff, ruleOk);
      sheet1.setConditionalFormatRules(rules);
    }

    // Ajustar anchos exactos
    const widths = [160, 140, 90, 130, 320, 150, 130, 130, 110, 130, 130, 160, 140, 140, 140, 200, 260];
    widths.forEach((w, i) => sheet1.setColumnWidth(i + 1, w));

    // --- HOJA 2: Detalle Facturas ---
    const sheet2 = ss.insertSheet('Detalle Facturas');
    sheet2.setGridlines(true);
    sheet2.setFrozenRows(1);

    const detHeaders = ['Nº Factura', 'Código Producto', 'Descripción', 'Unid. Vta', 'Cantidad', 'Precio Unitario', 'Valor Neto'];
    sheet2.getRange(1, 1, 1, detHeaders.length).setValues([detHeaders])
      .setBackground('#4F81BD').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
    sheet2.setRowHeight(1, 26);

    if (detalleFacturas.length > 0) {
      const detRows = detalleFacturas.map(d => [
        d.factura || '',
        d.codigo || '',
        d.descripcion || '',
        d.unid_vta || 'UN',
        Number(d.cantidad || 0),
        Number(d.precio_unitario || 0),
        Number(d.valor_neto || 0)
      ]);
      const detRange = sheet2.getRange(2, 1, detRows.length, 7);
      detRange.setValues(detRows);
      sheet2.getRange(2, 5, detRows.length, 1).setNumberFormat('#,##0');
      sheet2.getRange(2, 6, detRows.length, 1).setNumberFormat('$#,##0.00');
      sheet2.getRange(2, 7, detRows.length, 1).setNumberFormat('$#,##0');
      detRange.setBorder(true, true, true, true, true, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);
    }

    const detWidths = [120, 140, 320, 100, 110, 130, 140];
    detWidths.forEach((w, i) => sheet2.setColumnWidth(i + 1, w));

    // Intentar configurar permisos de acceso por enlace (solo lectura) para entrega expedita al proveedor
    try {
      const driveFile = DriveApp.getFileById(ss.getId());
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {
      Logger.log('Aviso permisos Drive (ignorado por directiva de dominio): ' + eShare.message);
    }

    const foliosAuditados = [];
    if (detalleFacturas && detalleFacturas.length > 0) {
      detalleFacturas.forEach(df => {
        const folStr = String(df.factura || '').trim();
        if (folStr && !foliosAuditados.includes(folStr)) {
          foliosAuditados.push(folStr);
        }
      });
    }

    const excelUrl = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx`;

    return {
      success: true,
      spreadsheet_id: ss.getId(),
      url: ss.getUrl(),
      excel_url: excelUrl,
      name: ss.getName(),
      proveedor: provName,
      po_number: poNumber,
      tienda: tienda,
      total_items: items.length,
      total_diferencias: totalDiferenciasDetectadas,
      monto_diferencias: Math.round(montoTotalNcEstimado),
      folios_facturas: foliosAuditados,
      fecha_creacion: Utilities.formatDate(new Date(), 'America/Santiago', 'dd/MM/yyyy HH:mm')
    };
  } catch (err) {
    Logger.log('Error creando Spreadsheet oficial de Finanzas: ' + err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
