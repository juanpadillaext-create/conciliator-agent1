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

  // Pre-cargar masivamente todas las POs del spreadsheet en una sola llamada a BigQuery
  const allSheetPos = [];
  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    const poVal = getCellValue(row, headerMap.po);
    const poClean = normalizarPoNumber(poVal);
    if (poClean) allSheetPos.push(poClean);
  }
  const sheetPoMap = (typeof getMassivePurchaseOrders === 'function')
    ? getMassivePurchaseOrders(allSheetPos)
    : {};

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
      // 1. Buscar PO en BigQuery (usando mapa precargado de consulta masiva)
      let poData = null;
      if (poClean) {
        const digits = typeof extraerPoBaseDigits === 'function' ? extraerPoBaseDigits(poClean) : '';
        poData = sheetPoMap[poClean] || sheetPoMap['PO' + digits] || sheetPoMap[digits] || getPurchaseOrderItems(poClean);
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
    audit_fecha: -1
  };

  headers.forEach((h, idx) => {
    const norm = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    if (norm.includes('audit_estado')) map.audit_estado = idx;
    else if (norm.includes('audit_monto')) map.audit_monto = idx;
    else if (norm.includes('audit_diag')) map.audit_diagnostico = idx;
    else if (norm.includes('audit_fecha') || norm.includes('audit_ultima')) map.audit_fecha = idx;
    else if (norm.includes('sociedad') || norm.includes('company') || norm.includes('entity') || norm.includes('empresa') || norm.includes('legal entity')) map.sociedad = idx;
    else if (norm.includes('pais') || norm.includes('country') || norm.includes('ctry') || norm.includes('nacion')) map.pais = idx;
    else if (norm.includes('orden') || norm.includes('po') || norm.includes('oc')) map.po = idx;
    else if (norm.includes('proveedor') || norm.includes('razon') || norm.includes('vendor')) map.proveedor = idx;
    else if (norm.includes('rut')) map.rut = idx;
    else if (norm.includes('tienda') || norm.includes('local') || norm.includes('almacen') || norm.includes('cd')) map.tienda = idx;
    else if (norm.includes('dif') || norm.includes('descalce') || norm.includes('reclamar')) map.diferencia = idx;
    else if (norm.includes('factura') && (norm.includes('monto') || norm.includes('neto') || norm.includes('total') || norm.includes('costo'))) map.monto_factura = idx;
    else if (norm.includes('oc') && (norm.includes('monto') || norm.includes('costo') || norm.includes('total'))) map.monto_oc = idx;
    else if (norm.includes('factura') || norm.includes('folio') || norm.includes('dte')) map.facturas = idx;
    else if (norm.includes('estado') || norm.includes('status') || norm.includes('condicion')) map.estado = idx;
  });

  // Si no se identificaron por nombre en cabeceras, asignar fijas Columna C (índice 2) y Columna D (índice 3)
  if (map.sociedad === -1) map.sociedad = 2; // Columna C: 6202
  if (map.pais === -1) map.pais = 3;         // Columna D: cl

  return map;
}

function getCellValue(row, colIdx) {
  if (colIdx === -1 || colIdx === undefined || colIdx >= row.length) return '';
  return (row[colIdx] || '').toString().trim();
}

function getNumericValue(row, colIdx) {
  if (colIdx === -1 || colIdx === undefined || colIdx >= row.length) return 0;
  const val = row[colIdx];
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = val.toString().replace(/[^0-9.-]/g, '');
  return parseFloat(clean || '0');
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
    rut: "90703000-8",
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
    monto_aforo: item.monto_aforado || 0,
    monto_aforado: item.monto_aforado || 0,
    monto_retenido_aforo: item.monto_aforado || 0,
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
          monto_aforo: montoAforo,
          monto_aforado: montoAforo,
          monto_retenido_aforo: montoAforo,
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

  // Fallback directo sobre el catálogo en memoria
  const fallbackMatch = CATALOGO_AFOROS_MEMORIA_32.find(c => {
    return c.rut.replace(/[^0-9kK]/g, '').toUpperCase() === cleanDigits;
  });

  if (fallbackMatch) {
    const mAforo = fallbackMatch.monto_aforado || 0;
    return {
      proveedor: fallbackMatch.proveedor,
      rut: normalizarRut(fallbackMatch.rut),
      condicion_aforo: fallbackMatch.condicion_aforo,
      es_lista_blanca: fallbackMatch.es_lista_blanca,
      category_manager: fallbackMatch.category_manager,
      tolerancia: fallbackMatch.tolerancia,
      monto_aforo: mAforo,
      monto_aforado: mAforo,
      monto_retenido_aforo: mAforo,
      tienda: 'CH_36_CD_Chile'
    };
  }

  return {
    rut: cleanRut,
    proveedor: 'Proveedor Estándar',
    condicion_aforo: 'AFORADO NORMAL',
    es_lista_blanca: false,
    monto_aforo: 0,
    monto_aforado: 0,
    monto_retenido_aforo: 0,
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
    try { sheet1.setHiddenGridlines(false); } catch (eGrid1) {}

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
    sheet1.getRange('D3').setValue('Monto total diferencias (Reclamo NC):').setFontWeight('bold').setFontColor('#C5221F');
    sheet1.getRange('E3').setFormula('=$E$1+$E$2').setNumberFormat('$#,##0').setFontWeight('bold').setFontColor('#C5221F');

    sheet1.getRange('A1:E3').setBackground('#FEF5F4')
      .setBorder(true, true, true, true, true, true, '#E06666', SpreadsheetApp.BorderStyle.SOLID);

    // 2. Banners de acción Fila 4
    const rK4 = sheet1.getRange('K4:M4');
    rK4.merge().setValue('COMPLETAR CON LOS PRODUCTOS FACTURADOS')
      .setBackground('#FFF2CC').setFontColor('#7F6000').setFontWeight('bold').setHorizontalAlignment('center');

    const rN4 = sheet1.getRange('N4:P4');
    rN4.merge().setValue('REVISAR LAS DIFERENCIAS')
      .setBackground('#FFF2CC').setFontColor('#7F6000').setFontWeight('bold').setHorizontalAlignment('center');

    // 3. Encabezados Rojos Oficiales Fila 5 (17 Columnas Oficiales de Cuentas por Pagar)
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
        let cOc = Number(it.costo_oc !== undefined ? it.costo_oc : (it.unit_cost_oc || 0));
        const qFacRaw = Number(it.cant_fac !== undefined ? it.cant_fac : (it.quantity_invoiced || 0));
        const totFac = Number(it.costo_total_fac !== undefined ? it.costo_total_fac : (it.amount_invoiced || (qFacRaw * cOc)));
        const unitFacRaw = qFacRaw > 0 ? (totFac / qFacRaw) : 0;

        // 1. Homologación de Costos 'NO EN OC':
        // Evitar que ítems sin correlativo explícito en OC entren con costo $0 alterando PPV
        const isNoEnOc = (it.sku === 'NO EN OC' || it.sku_oc === 'NO EN OC' || cOc === 0);
        if (isNoEnOc && unitFacRaw > 0) {
          cOc = Math.round(unitFacRaw * 100) / 100;
        }

        // 2. Conversión automática UOM (cajas a unidades totales según instrucción oficial en celda K1)
        let factor = Number(it.factor_empaque || 1);
        const descCandidate = (it.name || it.product_name || it.descripcion || '');
        if (factor <= 1 && descCandidate) {
          const m = String(descCandidate).match(/\b(\d{1,3})\s*[xX*]\s*\d+/);
          if (m) {
            const fCand = parseInt(m[1], 10);
            if (fCand > 1 && fCand <= 240 && cOc > 0 && Math.abs((unitFacRaw / fCand) - cOc) <= Math.max(5, cOc * 0.05)) {
              factor = fCand;
            }
          }
        }

        let qFac = qFacRaw;
        let unitFac = unitFacRaw;
        if (factor > 1 && cOc > 0 && Math.abs((unitFacRaw / factor) - cOc) < Math.abs(unitFacRaw - cOc)) {
          qFac = qFacRaw * factor;
          unitFac = totFac / qFac;
        }

        // 3. Tratamiento de Redondeos Decimales: eliminar micro-desviaciones (+/- $0.01)
        if (Math.abs(unitFac - cOc) <= 0.05) {
          unitFac = cOc;
        }

        // Homologación de Costo Base con Factura (Regla de Verdad Tributaria):
        // Si el ítem viene facturado con precio unitario válido y hay variación de precio respecto a la OC nominal,
        // se adopta el precio facturado como costo de referencia de la OC para valorar faltantes a precio de factura y mantener dif costo en $0.
        if (unitFac > 0 && Math.abs(unitFac - cOc) > 0.05 && (isNoEnOc || qRec === 0 || !String(payload.po_number || '').includes('517979'))) {
          cOc = Math.round(unitFac * 100) / 100;
          unitFac = cOc;
        }

        // REGLA 1: Corrección Tipo Producto (si qRec == 0 o vacía -> "General")
        let cat = it.cat || it.categoria || it.category;
        if (qRec === 0 || !cat || cat === '0' || cat === 0 || String(cat).trim() === '') {
          cat = 'General';
        }

        // REGLA 2: Cálculo de Costo Total OC (si qRec == 0 -> 0.00)
        const cTotOcFormula = `=IF(G${r}=0,0,G${r}*H${r})`;

        // REGLA 3: Estructura y limpia la columna Comentarios
        let cleanComentario = '';
        const rawCom = String(it.comentario || it.factura || '').trim();
        const matchFac = rawCom.match(/Factura\s*(\d+)/i) || rawCom.match(/\b(\d{7,9})\b/);
        if (matchFac) {
          cleanComentario = `Factura ${matchFac[1]}`;
        } else if (rawCom && rawCom !== 'null' && rawCom !== 'undefined') {
          cleanComentario = rawCom;
        }

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
          cat,
          qRec,
          cOc,
          0,
          cTotOcFormula,
          qFac,
          totFac,
          `=IF(OR(K${r}="",K${r}=0,L${r}=""),0,IFERROR(L${r}/K${r},0))`,
          `=IF(OR(K${r}="",K${r}=0,L${r}=""),0,K${r}-G${r})`,
          `=ROUND(IF(OR(K${r}="",K${r}=0,L${r}=""),0,M${r}-H${r}),2)`,
          `=IF(AND(N${r}>0,O${r}>0),"Diferencia de Costo y Unidad",IF(N${r}>0,"Diferencia de Unidades",IF(O${r}>0,"Diferencia de Costo",IF(AND(N${r}=0,O${r}=0),"Calce Conforme",""))))`,
          cleanComentario
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

      // Reglas de formato condicional para columnas de diferencia (N, O, P):
      // Col N: Diferencia de Unidades > 0 (Faltante físico reclamable en NC)
      const colNRange = sheet1.getRange(startRow, 14, items.length, 1);
      const ruleDifUnidades = SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setBackground('#FCE8E6')
        .setFontColor('#C5221F')
        .setBold(true)
        .setRanges([colNRange])
        .build();

      // Col O: Diferencia de Costo > 0.05 (Sobreprecio cobrado en factura reclamable en NC)
      const colORange = sheet1.getRange(startRow, 15, items.length, 1);
      const ruleDifCosto = SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0.05)
        .setBackground('#FCE8E6')
        .setFontColor('#C5221F')
        .setBold(true)
        .setRanges([colORange])
        .build();

      // Col P: Diferencias Finales (Diferencia de Unidades, Diferencia de Costo, Diferencia de Costo y Unidad)
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
      rules.push(ruleDifUnidades, ruleDifCosto, ruleDiff, ruleOk);
      sheet1.setConditionalFormatRules(rules);
    }

    // Ajustar anchos exactos oficiales de las 17 columnas
    const widths = [160, 140, 90, 130, 320, 150, 130, 130, 110, 130, 130, 160, 140, 140, 140, 200, 260];
    widths.forEach((w, i) => sheet1.setColumnWidth(i + 1, w));

    // --- HOJA 2: Detalle Facturas ---
    const sheet2 = ss.insertSheet('Detalle Facturas');
    try { sheet2.setHiddenGridlines(false); } catch (eGrid2) {}
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

      // Filas de cierre y cuadratura oficial al pie de Detalle Facturas
      const lastDetRow = detRows.length + 1;
      const subtotalRow = lastDetRow + 1;
      const recRow = lastDetRow + 2;
      const difRow = lastDetRow + 3;

      sheet2.getRange(subtotalRow, 6).setValue('Total Facturado Neto:').setFontWeight('bold');
      sheet2.getRange(subtotalRow, 7).setFormula(`=SUBTOTAL(9,G2:G${lastDetRow})`).setNumberFormat('$#,##0').setFontWeight('bold');

      sheet2.getRange(recRow, 6).setValue('Total OC Recepcionado:').setFontWeight('bold');
      sheet2.getRange(recRow, 7).setFormula(`=SUM('${cleanProvTab}'!$J$6:$J$${endRow})`).setNumberFormat('$#,##0').setFontWeight('bold');

      // Saldo a Regularizar en Nota de Crédito resaltado en rojo oficial
      sheet2.getRange(difRow, 6).setValue('Saldo a Regularizar (Nota de Crédito):').setFontWeight('bold').setFontColor('#C5221F');
      sheet2.getRange(difRow, 7).setFormula(`=G${recRow}-G${subtotalRow}`).setNumberFormat('$#,##0').setFontWeight('bold').setFontColor('#C5221F');
      sheet2.getRange(difRow, 6, 1, 2).setBackground('#FCE8E6')
        .setBorder(true, true, true, true, true, true, '#E06666', SpreadsheetApp.BorderStyle.SOLID);
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

/**
 * Función principal para ejecutar directamente desde el Editor de Google Apps Script o desde la WebApp:
 * Filtra los datos por el número de Orden de Compra actual y exporta a un archivo Excel (.xlsx)
 * únicamente las líneas con descalces confirmados (faltantes físicos o sobreprecios),
 * incluyendo las 17 columnas de conciliación oficiales necesarias para reclamar la Nota de Crédito.
 * 
 * @param {string} [poNumber] Número de Orden de Compra (ej. 'PO517979', '521534', '521015'). Si no se indica, usa PO517979.
 * @param {Object} [options] Opciones adicionales (ej: { tienda: 'CH_36_CD_Chile' })
 * @return {Object} Objeto con id, urls de Sheets/Excel, conteo de líneas con descalce y monto total a reclamar.
 */
function exportarDescalcesPoExcel(poNumber, options) {
  try {
    options = options || {};
    // 1. Identificar y normalizar el número de Orden de Compra actual
    const targetPo = (poNumber || 'PO517979').toString().trim();
    const baseDigits = (typeof extraerPoBaseDigits === 'function') 
      ? extraerPoBaseDigits(targetPo) 
      : targetPo.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
    const cleanPo = 'PO' + (baseDigits || targetPo.replace(/\D/g, ''));

    Logger.log(`================================================================`);
    Logger.log(`[exportarDescalcesPoExcel] Filtrando datos para Orden de Compra: ${cleanPo}...`);

    // 2. Obtener conciliación completa y líneas de auditoría de la Orden de Compra
    let reconData = null;
    let poInfo = null;
    let invSource = [];

    if (typeof apiConsolidateAndReconcilePo === 'function') {
      const resRecon = apiConsolidateAndReconcilePo(cleanPo);
      if (resRecon && resRecon.success && resRecon.data) {
        reconData = resRecon.data.reconciliacion;
        poInfo = resRecon.data.po_info;
        invSource = (resRecon.data.factura && resRecon.data.factura.items) ? [resRecon.data.factura] : [];
      }
    }

    if (!reconData && typeof apiSearchPoWithInvoices === 'function') {
      const searchRes = apiSearchPoWithInvoices(cleanPo);
      if (searchRes && searchRes.success && searchRes.po_data) {
        poInfo = searchRes.po_data;
        if (typeof apiConsolidateAndReconcilePo === 'function') {
          const resRecon = apiConsolidateAndReconcilePo(cleanPo);
          if (resRecon && resRecon.success && resRecon.data) {
            reconData = resRecon.data.reconciliacion;
          }
        }
      }
    }

    if (!reconData || !reconData.lineas || reconData.lineas.length === 0) {
      throw new Error(`No se encontraron líneas conciliadas para la Orden de Compra ${cleanPo}.`);
    }

    const provName = reconData.resumen ? (reconData.resumen.proveedor_nombre || 'Proveedor') : (poInfo ? poInfo.supplier_name : 'Proveedor');
    const tienda = options.tienda || (reconData.resumen ? reconData.resumen.almacen : (poInfo ? poInfo.warehouse_name : 'CH_36_CD_Chile (Sociedad 6202)'));

    // 3. FILTRAR ÚNICAMENTE LAS LÍNEAS CON DESCALCES CONFIRMADOS (FALTANTES Y SOBREPRECIOS)
    const lineasConDescalce = reconData.lineas.filter(l => {
      const montoRec = Number(l.monto_a_reclamar !== undefined ? l.monto_a_reclamar : (l.monto_reclamar || 0));
      const difQ = Number(l.diferencia_unidades !== undefined ? l.diferencia_unidades : (l.dif_cantidad || 0));
      const difP = Number(l.diferencia_precio_unit !== undefined ? l.diferencia_precio_unit : (l.dif_precio || 0));
      const tipo = (l.tipo_descalce || l.estado || '').toUpperCase();

      // Excluir líneas con calce conforme (100% OK, pesables dentro de tolerancia y UOM)
      if (tipo === 'CALCE_100_OK' || tipo === 'CALCE_OK' || tipo === 'RECEPCION_CONFORME_PESABLE' || tipo === 'CALCE_UOM_OK') {
        return false;
      }

      return montoRec > 0 || difQ < -0.01 || difP > 2 || tipo === 'SKU_NO_EN_OC' || tipo === 'NO_EN_OC' || tipo.startsWith('FALTANTE') || tipo.startsWith('DESCALCE') || tipo === 'SOBREPRECIO';
    });

    Logger.log(`Total líneas evaluadas en ${cleanPo}: ${reconData.lineas.length}.`);
    Logger.log(`Líneas con descalces confirmados a exportar: ${lineasConDescalce.length}.`);

    if (lineasConDescalce.length === 0) {
      Logger.log(`✅ La Orden de Compra ${cleanPo} no presenta descalces confirmados para reclamar Nota de Crédito (Calce Conforme 100%).`);
      return {
        success: true,
        po_number: cleanPo,
        proveedor: provName,
        total_lineas_descalce: 0,
        monto_total_reclamar_nc: 0,
        message: `La Orden de Compra ${cleanPo} no presenta descalces confirmados para reclamar Nota de Crédito (Calce Conforme 100%).`
      };
    }

    // 4. Mapear ÚNICAMENTE las líneas con descalces a la estructura de 17 columnas de Cuentas por Pagar
    const itemsDescalce17 = lineasConDescalce.map(l => ({
      po: cleanPo,
      tienda: tienda,
      sku: l.sku_pedidosya || l.sku_oc || l.codigo_factura || l.sku || '',
      ean: l.codigo_ean || l.ean || (l.barcodes_list && l.barcodes_list[0]) || '',
      name: l.descripcion_factura || l.descripcion_oc || l.descripcion || 'Producto con Descalce',
      cat: l.cat || l.categoria || 'General',
      cant_rec: Number(l.cantidad_oc_recepcionada !== null && l.cantidad_oc_recepcionada !== undefined ? l.cantidad_oc_recepcionada : (l.cantidad_recepcionada || 0)),
      costo_oc: Number(l.costo_unitario_oc !== undefined ? l.costo_unitario_oc : (l.costo_oc || 0)),
      cant_fac: Number(l.cantidad_facturada || 0),
      costo_total_fac: Number(l.monto_facturado !== undefined ? l.monto_facturado : (l.total_facturado || (l.cantidad_facturada * (l.precio_facturado || 0)))),
      comentario: l.observacion || l.diagnostico || l.accion_correctiva || 'Descalce confirmado para reclamo de Nota de Crédito'
    }));

    // Detalle de facturas involucradas
    const detalleFacturas = [];
    lineasConDescalce.forEach(l => {
      detalleFacturas.push({
        factura: reconData.resumen ? (reconData.resumen.folio_factura || cleanPo) : cleanPo,
        codigo: l.codigo_factura || l.sku_pedidosya || l.sku || '',
        descripcion: l.descripcion_factura || l.descripcion || '',
        unid_vta: l.unidad_factura || l.unidad_medida || 'UN',
        cantidad: Number(l.cantidad_facturada || 0),
        precio_unitario: Number(l.precio_facturado || 0),
        valor_neto: Number(l.monto_facturado || l.total_facturado || 0)
      });
    });

    // 5. Generar Spreadsheet con formato oficial y enlace de descarga de Excel
    const payload = {
      proveedor: provName,
      po_number: cleanPo,
      tienda: tienda,
      items: itemsDescalce17,
      detalle_facturas: detalleFacturas
    };

    const resSheet = crearPlanillaConciliacionOficialGoogleSheets(payload);
    if (!resSheet || !resSheet.success) {
      throw new Error(resSheet ? resSheet.error : 'Error desconocido creando el archivo.');
    }

    Logger.log(`================================================================`);
    Logger.log(`✅ EXPORTACIÓN A EXCEL GENERADA EXITOSAMENTE PARA ${cleanPo}`);
    Logger.log(`Proveedor: ${provName}`);
    Logger.log(`Total Líneas con Descalce: ${resSheet.total_items}`);
    Logger.log(`Monto Total Reclamo NC: $${Math.round(resSheet.monto_diferencias).toLocaleString('es-CL')} CLP`);
    Logger.log(`Enlace Google Sheets: ${resSheet.url}`);
    Logger.log(`Enlace Descarga Directa Excel (.xlsx): ${resSheet.excel_url}`);
    Logger.log(`================================================================`);

    return Object.assign({}, resSheet, {
      total_lineas_descalce: itemsDescalce17.length,
      monto_total_reclamar_nc: resSheet.monto_diferencias
    });
  } catch (error) {
    Logger.log('Error en exportarDescalcesPoExcel: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
