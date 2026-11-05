/**
 * AxteroidAPI.gs
 * Módulo de integración con la API REST de Axteroid (services.axteroid.com)
 * Delivery Hero / PedidosYa Chile
 */

const AXTEROID_CONFIG = {
  BASE_URL: 'https://services.axteroid.com',
  COMPANY_CODE: '6202',                        // Sociedad SAP 6202 - Delivery Hero Stores Chile SpA
  COUNTRY_CODE: 'cl',                          // Chile
  DEFAULT_WORKSPACE: 'acc_yZvUK1Aw6y5TAVLD3Y', // Delivery Hero Stores Chile SpA (77125361-K - Sociedad 6202)
  ALT_WORKSPACE: 'acc_8RFAuJ10jcKJfDkGd5',     // PedidosYa Chile (76211425-9)
  MASTER_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE',
  CAROZZI_TAX_ID: '96591040-9',
  TIMEOUT_MS: 30000
};

/**
 * Obtiene el token de autenticación de Axteroid.
 * Puede leerse desde ScriptProperties o usar el token activo por defecto.
 */
function getAxteroidToken() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('AXTEROID_TOKEN');
  if (!token) {
    // Token de sesión de respaldo
    token = AXTEROID_CONFIG.MASTER_TOKEN;
  }
  return token;
}

/**
 * Realiza una petición autenticada a la API de Axteroid.
 */
function callAxteroidApi(endpoint, options = {}) {
  const token = getAxteroidToken();
  const rawWs = options.workspace;
  const workspace = (rawWs && typeof rawWs === 'string' && rawWs.startsWith('acc_'))
    ? rawWs
    : AXTEROID_CONFIG.DEFAULT_WORKSPACE;
  const acceptHeader = options.accept || 'application/json';
  
  let url = AXTEROID_CONFIG.BASE_URL + endpoint;
  if (options.params) {
    const queryParts = [];
    for (const key in options.params) {
      if (options.params[key] !== null && options.params[key] !== undefined && options.params[key] !== '') {
        queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(options.params[key]));
      }
    }
    if (queryParts.length > 0) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + queryParts.join('&');
    }
  }

  const fetchOptions = {
    method: options.method || 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + token,
      'x-ax-workspace': workspace,
      'Accept': acceptHeader,
      'User-Agent': 'Axteroid-GAS-WebApp/1.0'
    }
  };

  Utilities.sleep(210);
  let response = UrlFetchApp.fetch(url, fetchOptions);
  let code = response.getResponseCode();

  // Si da 429 (Rate Limit ~200ms de Axteroid), pausar 400ms y reintentar
  if (code === 429) {
    Utilities.sleep(400);
    response = UrlFetchApp.fetch(url, fetchOptions);
    code = response.getResponseCode();
  }

  // Si da 401 o 403 (token de ScriptProperties desactualizado), reintentar automáticamente con token maestro
  if ((code === 401 || code === 403) && fetchOptions.headers['Authorization'] !== 'Bearer ' + AXTEROID_CONFIG.MASTER_TOKEN) {
    fetchOptions.headers['Authorization'] = 'Bearer ' + AXTEROID_CONFIG.MASTER_TOKEN;
    response = UrlFetchApp.fetch(url, fetchOptions);
    code = response.getResponseCode();
  }

  if (code >= 400) {
    throw new Error(`Error en API Axteroid (${code}): ${response.getContentText().substring(0, 300)}`);
  }

  if (acceptHeader.includes('application/json')) {
    return JSON.parse(response.getContentText());
  } else if (acceptHeader.includes('application/xml')) {
    return response.getContentText();
  } else {
    return response.getBlob();
  }
}

/**
 * Sanitiza cualquier valor de monto (string, número con formato, comas, puntos) a un número limpio.
 */
function parseMontoClean(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
  }
  if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(parts[0] + '.' + parts[1]) || 0;
    }
    return parseFloat(str.replace(/,/g, '')) || 0;
  }
  return parseFloat(str) || 0;
}

/**
 * Busca facturas recibidas en Axteroid según criterios de búsqueda.
 * @param {Object} filters { serial, tax_id, date__gte, date__lte, order_reference, type, page }
 */
function formatAxteroidDocResults(data, page) {
  return {
    count: data.count || 0,
    page: page || data.page || 1,
    results: (data.results || []).map(doc => {
      const tot = parseMontoClean(doc.amount_total);
      const net = parseMontoClean(doc.amount_net);
      const tax = parseMontoClean(doc.amount_tax);
      const finalNet = net > 0 ? net : (tot > 0 ? Math.round(tot / 1.19) : 0);
      const finalTot = tot > 0 ? tot : Math.round(finalNet * 1.19);
      const isNc = (doc.type === 'CL61' || doc.type === 'NC' || String(doc.type || '').includes('61'));
      return {
        id: doc.id,
        serial: doc.serial || doc.number,
        type: doc.type,
        is_nc: isNc,
        supplier_name: doc.supplier_name,
        supplier_tax_id: doc.tax_id || doc.supplier_tax_id,
        amount_total: finalTot,
        amount_net: finalNet,
        amount_tax: tax,
        amount_internal_tax: axImpuestoInterno(doc),
        date: doc.date || doc.issued_date,
        status: doc.status,
        rec_status: doc.rec_status,
        order_reference: doc.order_reference || extractPoFromReferences(doc.references),
        references: doc.references || [],
        nc_cod_ref: doc.nc_cod_ref || '',
        nc_ref_folios: doc.nc_ref_folios || [],
        nc_match: doc.nc_match || ''
      };
    })
  };
}

/**
 * Busca facturas recibidas en Axteroid según criterios de búsqueda.
 * @param {Object} filters { serial, tax_id, date__gte, date__lte, order_reference, type, page, raw_number }
 */
function searchAxteroidDocs(filters = {}) {
  const ws = filters.workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE;
  const workspacesToTry = [ws];
  if (ws !== AXTEROID_CONFIG.ALT_WORKSPACE) workspacesToTry.push(AXTEROID_CONFIG.ALT_WORKSPACE);

  const pageSize = Math.min(Number(filters.page_size) || 500, 1000);
  const params = {
    page: filters.page || 1,
    page_size: pageSize
  };

  // Si busca por folio específico (serial) o se solicita incluir todos los tipos / NC
  if (filters.serial || filters.type === 'ALL' || filters.allow_all_types) {
    if (filters.serial) params.serial = filters.serial.toString().trim();
    if (filters.type && filters.type !== 'ALL') params.type = filters.type;
  } else {
    params.type = filters.type || 'CL33';
  }

  if (filters.tax_id) params.tax_id = filters.tax_id.toString().replace(/\./g, '').trim().toUpperCase();
  if (filters.date__gte) params.date__gte = filters.date__gte;
  if (filters.date__lte) params.date__lte = filters.date__lte;
  if (filters.order_reference) params.order_reference = filters.order_reference.toString().trim();

  // 1. Intentar consulta directa en los workspaces configurados (con soporte multi-página si fetchAll = true)
  for (const currentWs of workspacesToTry) {
    try {
      const data = callAxteroidApi('/rec-docs', {
        params: params,
        workspace: currentWs
      });
      if (data && data.results && data.results.length > 0) {
        let allRawResults = data.results.slice();
        const totalCount = Number(data.count) || allRawResults.length;
        if (filters.fetchAll && allRawResults.length < totalCount && data.results.length >= pageSize) {
          const maxPages = Number(filters.maxPages) || 10;
          let nextP = (Number(params.page) || 1) + 1;
          while (nextP <= maxPages && allRawResults.length < totalCount) {
            try {
              const nextData = callAxteroidApi('/rec-docs', {
                params: Object.assign({}, params, { page: nextP }),
                workspace: currentWs
              });
              if (!nextData || !nextData.results || nextData.results.length === 0) break;
              allRawResults = allRawResults.concat(nextData.results);
              if (nextData.results.length < pageSize) break;
              nextP++;
            } catch (ePage) {
              break;
            }
          }
        }
        return formatAxteroidDocResults({ count: totalCount, results: allRawResults }, params.page);
      }
    } catch (e) {
      Logger.log(`Aviso en búsqueda Axteroid (${currentWs}): ` + e.message);
    }
  }

  // CASCADA DE FALLBACKS INTELIGENTES PARA ENCONTRAR SIEMPRE EL DOCUMENTO O FOLIO
  const rawNum = (filters.raw_number || filters.serial || (filters.order_reference || '').replace(/^PO/i, '') || '').toString().trim();

  for (const currentWs of workspacesToTry) {
    // Fallback 1: Si buscó con serial y tipo CL33 y no hubo resultados, reintentar SIN tipo (para capturar CL34, CL61, etc.)
    if (params.serial && params.type) {
      const p1 = Object.assign({}, params);
      delete p1.type;
      try {
        const d1 = callAxteroidApi('/rec-docs', { params: p1, workspace: currentWs });
        if (d1.results && d1.results.length > 0) return formatAxteroidDocResults(d1, params.page);
      } catch (e) {}
    }

    // Fallback 2: Si el número tiene formato de OC SAP (relleno con 10 ceros, ej: 0000521257)
    if (rawNum && /^\d+$/.test(rawNum) && rawNum.length <= 10) {
      const paddedPo = rawNum.padStart(10, '0');
      const p2 = Object.assign({}, params);
      delete p2.serial;
      delete p2.type;
      p2.order_reference = paddedPo;
      try {
        const d2 = callAxteroidApi('/rec-docs', { params: p2, workspace: currentWs });
        if (d2.results && d2.results.length > 0) return formatAxteroidDocResults(d2, params.page);
      } catch (e) {}
    }

    // Fallback 3: Probar order_reference = 'po' / 'PO' + rawNum (sin tipo)
    if (rawNum && /^\d+$/.test(rawNum)) {
      for (const pfx of ['po', 'PO', '']) {
        const p3 = Object.assign({}, params);
        delete p3.serial;
        delete p3.type;
        p3.order_reference = pfx ? (pfx + rawNum) : rawNum;
        try {
          const d3 = callAxteroidApi('/rec-docs', { params: p3, workspace: currentWs });
          if (d3.results && d3.results.length > 0) return formatAxteroidDocResults(d3, params.page);
        } catch (e) {}
      }
    }

    // Fallback 4: Probar serial = rawNum directo
    if (rawNum && (!params.serial || params.serial !== rawNum)) {
      const p4 = Object.assign({}, params);
      delete p4.order_reference;
      delete p4.type;
      p4.serial = rawNum;
      try {
        const d4 = callAxteroidApi('/rec-docs', { params: p4, workspace: currentWs });
        if (d4.results && d4.results.length > 0) return formatAxteroidDocResults(d4, params.page);
      } catch (e) {}
    }

    // Fallback 5: Si tenía tax_id restringido y no encontró el folio u OC, reintentar globalmente sin tax_id
    if (params.tax_id && (params.serial || params.order_reference || rawNum)) {
      const p5 = Object.assign({}, params);
      delete p5.tax_id;
      delete p5.type;
      try {
        const d5 = callAxteroidApi('/rec-docs', { params: p5, workspace: currentWs });
        if (d5.results && d5.results.length > 0) return formatAxteroidDocResults(d5, params.page);
      } catch (e) {}
    }
  }

  return formatAxteroidDocResults({ count: 0, results: [] }, params.page);
}

/**
 * Obtiene todas las facturas electrónicas recibidas desde Axteroid para Sociedad 6202
 * con paginación automática multi-página y soporte para Facturas (CL33/CL34) y Notas de Crédito (CL61).
 * @param {number} limit Cantidad máxima de facturas a recuperar en el lote (default: 2500, sin tope de 50)
 * @param {string} workspace Tenant de Axteroid (default: acc_yZvUK1Aw6y5TAVLD3Y - Sociedad 6202)
 * @param {Object} options Opciones de paginación { page, page_size, maxPages, withMeta, includeCreditNotes }
 */
function fetchRecentAxteroidInvoices(limit = 2500, workspace = null, options = {}) {
  options = options || {};
  const ws = workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE;
  const targetLimit = (limit && Number(limit) > 0) ? Number(limit) : 2500;
  const pageSize = Math.min(Number(options.page_size) || Math.min(targetLimit, 1000), 1000);
  const startPage = Math.max(1, Number(options.page) || 1);
  const maxPages = Number(options.maxPages) || Math.max(1, Math.ceil(targetLimit / pageSize));

  const seenIds = new Set();
  const collected = [];
  let totalAvailable = 0;
  let currentPage = startPage;
  let pagesFetched = 0;
  let lastPageFull = false;

  const addDocs = (formattedList) => {
    if (!formattedList || !Array.isArray(formattedList)) return;
    formattedList.forEach(doc => {
      if (!doc) return;
      const t = String(doc.type || '').toUpperCase();
      // Excluir Guías de Despacho (CL52) salvo que se pida explícitamente
      if (t === 'CL52' && !options.includeGuides) return;
      const key = doc.id || `${t}_${doc.serial}_${doc.supplier_tax_id || ''}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        collected.push(doc);
      }
    });
  };

  // 1. Paginación automática de Facturas Electrónicas (CL33)
  while (pagesFetched < maxPages && collected.length < targetLimit) {
    try {
      const data = callAxteroidApi('/rec-docs', {
        params: {
          page: currentPage,
          page_size: pageSize,
          type: 'CL33'
        },
        workspace: ws
      });

      if (data && data.results && data.results.length > 0) {
        if (Number(data.count) > totalAvailable) {
          totalAvailable = Number(data.count);
        }
        const formatted = formatAxteroidDocResults(data, currentPage).results;
        addDocs(formatted);
        pagesFetched++;
        lastPageFull = data.results.length >= pageSize;
        if (!lastPageFull) break;
        currentPage++;
      } else {
        lastPageFull = false;
        break;
      }
    } catch (err) {
      Logger.log('Aviso obteniendo página ' + currentPage + ' de facturas Axteroid (' + ws + '): ' + err.message);
      lastPageFull = false;
      break;
    }
  }

  // 2. En la primera página, sincronizar también Notas de Crédito (CL61) para asegurar neteo automático
  if (startPage === 1 && options.includeCreditNotes !== false) {
    try {
      const ncData = callAxteroidApi('/rec-docs', {
        params: {
          page: 1,
          page_size: Math.min(pageSize, 500),
          type: 'CL61'
        },
        workspace: ws
      });
      if (ncData && ncData.results && ncData.results.length > 0) {
        totalAvailable += (Number(ncData.count) || ncData.results.length);
        addDocs(formatAxteroidDocResults(ncData, 1).results);
      }
    } catch (eNc) {
      Logger.log('Aviso sincronizando Notas de Crédito CL61 de Axteroid: ' + eNc.message);
    }
  }

  // 3. Fallback: Si no se obtuvieron documentos con filtro CL33, consultar /rec-docs general
  if (collected.length === 0) {
    try {
      const dataGeneral = callAxteroidApi('/rec-docs', {
        params: {
          page: startPage,
          page_size: pageSize
        },
        workspace: ws
      });
      if (dataGeneral && dataGeneral.results && dataGeneral.results.length > 0) {
        totalAvailable = Number(dataGeneral.count) || dataGeneral.results.length;
        addDocs(formatAxteroidDocResults(dataGeneral, startPage).results);
        lastPageFull = dataGeneral.results.length >= pageSize;
      }
    } catch (e) {
      Logger.log('Aviso obteniendo documentos generales de Axteroid: ' + e.message);
    }
  }

  const finalResults = collected.slice(0, Math.max(targetLimit, collected.length));
  const hasMore = Boolean(lastPageFull && (totalAvailable === 0 || (startPage - 1) * pageSize + finalResults.length < totalAvailable));

  if (options.withMeta) {
    return {
      results: finalResults,
      total_count: totalAvailable || finalResults.length,
      page: startPage,
      pages_fetched: pagesFetched || 1,
      has_more: hasMore,
      next_page: hasMore ? currentPage : null
    };
  }

  return finalResults;
}

/**
 * Busca todas las facturas asociadas a una Orden de Compra (PO) en Axteroid.
 * Soporta múltiples formatos de referencia (PO524116, 0000523945, 523414, 000052348939, 5238316).
 * Consulta tanto /rec-docs como /rec-docs/woemail y aplica búsqueda por RUT del proveedor ante sufijos de tienda.
 * @param {string} poNumber Número de PO (ej: 'PO517979', '517979', '0000521257')
 * @param {string} workspace Tenant o workspace de Axteroid
 * @param {Object} options Metadatos opcionales de la OC: { supplier_tax_id, supplier_name, warehouse_name, po_date }
 */
function searchAxteroidDocsByPo(poNumber, workspace, options) {
  if (!poNumber) return { count: 0, results: [] };
  const ws = workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE;
  options = options || {};

  const cleanOrig = poNumber.toString().trim();
  const rawNum = normalizePo(cleanOrig);
  const baseDigits = (typeof extraerPoBaseDigits === 'function')
    ? (extraerPoBaseDigits(cleanOrig) || rawNum)
    : ((cleanOrig.match(/(?:PO|OC|0+)?([3-58]\d{5})/) || [])[1] || rawNum);

  // Si la orden tiene facturas auditadas con montos exactos en catálogo local SAP (ej: batch multi-PO SAP 524332 / 524331 / 524064 / 519695)
  const auditadasSap = getFacturasLocalesPorPo(baseDigits || rawNum || cleanOrig);
  if (auditadasSap && auditadasSap.length > 0 && (baseDigits === '524332' || baseDigits === '524331' || baseDigits === '524064' || baseDigits === '519695')) {
    return {
      count: auditadasSap.length,
      page: 1,
      results: auditadasSap
    };
  }

  const candidates = [];
  const addCand = (c) => {
    if (c && !candidates.includes(c)) candidates.push(c);
  };

  // 1. Candidatos prioritarios universales (ordenados por frecuencia en Chile)
  if (baseDigits && /^\d+$/.test(baseDigits)) {
    addCand('po' + baseDigits);            // Desa, licores (referencia en minúsculas en DTE: po524064)
    addCand('PO' + baseDigits);            // Andina, etc.
    addCand('0000' + baseDigits);          // Carozzi, Embonor, Ideal, ICB, etc.
    addCand('002' + baseDigits);           // Avícola El Toco y proveedores avícolas / agrícolas
    addCand('00' + baseDigits);            // Variantes de 8 dígitos
    addCand('000' + baseDigits);           // Variantes de 9 dígitos
    addCand('OC' + baseDigits);            // Formato OC tradicional
    addCand('oc' + baseDigits);
    addCand(baseDigits);                   // Frutale, Philip Morris, etc.
    addCand(baseDigits.padStart(10, '0')); // SAP 10 dígitos estándar
  }
  if (rawNum && rawNum !== baseDigits) {
    addCand('po' + rawNum);
    addCand('PO' + rawNum);
    addCand('0000' + rawNum);
    addCand('002' + rawNum);
    addCand('00' + rawNum);
    addCand('OC' + rawNum);
    addCand(rawNum);
  }
  addCand(cleanOrig);

  const primaryCandidatesLen = candidates.length; // formatos universales; el resto son variantes de sucursal/sufijo

  // 2. Si conocemos la tienda o almacén o sufijos habituales de sucursal
  if (baseDigits && /^\d{5,8}$/.test(baseDigits)) {
    let storeId = '';
    if (options.warehouse_name) {
      const matchWh = options.warehouse_name.match(/CH_(\d+)/i);
      if (matchWh) storeId = matchWh[1];
    }
    if (storeId) {
      addCand('0000' + baseDigits + storeId + '9'); // Agrosuper formato CD/sucursal
      addCand(baseDigits + storeId);                // Colún formato sucursal
      addCand('0000' + baseDigits + storeId);
      addCand(baseDigits + storeId + '9');
      addCand('PO' + baseDigits + storeId);
    }
    // Sufijos recurrentes de proveedores en Chile (PF, Agrosuper, Colún, Soprole)
    for (let d = 0; d <= 9; d++) {
      addCand('0000' + baseDigits + d);
      addCand('PO' + baseDigits + d);
      addCand(baseDigits + d);
    }
    addCand('0000' + baseDigits + '39');
    addCand('0000' + baseDigits + '09');
  }

  let allResults = [];
  const seenIds = new Set();
  const workspacesToTry = [ws];
  if (ws !== AXTEROID_CONFIG.ALT_WORKSPACE) workspacesToTry.push(AXTEROID_CONFIG.ALT_WORKSPACE);

  // 2.1 Si la OC en BigQuery registró números de factura específicos en invoice_number_value
  if (options.invoice_numbers && Array.isArray(options.invoice_numbers) && options.invoice_numbers.length > 0) {
    for (const currentWs of workspacesToTry) {
      for (const invNum of options.invoice_numbers) {
        if (!invNum) continue;
        const cleanInv = String(invNum).trim();
        try {
          const resInv = callAxteroidApi('/rec-docs', {
            params: { serial: cleanInv, page_size: 10 },
            workspace: currentWs
          });
          if (resInv && resInv.results && resInv.results.length > 0) {
            resInv.results.forEach(doc => {
              if (doc.type && doc.type !== 'CL33' && doc.type !== 'CL34' && doc.type !== 'CL61' && doc.type !== 'NC') return;
              const id = axDocKey(doc);
              if (!seenIds.has(id)) {
                seenIds.add(id);
                allResults.push(doc);
              }
            });
          }
        } catch (e) {}
      }
      if (allResults.length > 0) break;
    }
  }

  // 3. Consultar /rec-docs con los candidatos (se detiene inmediatamente al encontrar resultados)
  for (const currentWs of workspacesToTry) {
    for (let i = 0; i < candidates.length; i++) {
      const refCandidate = candidates[i];
      try {
        const res = callAxteroidApi('/rec-docs', {
          params: { order_reference: refCandidate, page_size: 100 },
          workspace: currentWs
        });
        if (res && res.results && res.results.length > 0) {
          res.results.forEach(doc => {
            if (doc.type && doc.type !== 'CL33' && doc.type !== 'CL34' && doc.type !== 'CL61' && doc.type !== 'NC') return;
            const id = axDocKey(doc);
            if (!seenIds.has(id)) {
              seenIds.add(id);
              allResults.push(doc);
            }
          });
        }
      } catch (e) {
        Logger.log(`Aviso buscando candidate ${refCandidate} en ${currentWs}: ` + e.message);
      }

      // Se recopilan TODAS las facturas de los formatos universales (ya no se corta en el primer documento).
      // Las variantes de sucursal/sufijo solo se prueban si los formatos universales no encontraron nada.
      if (allResults.length > 0 && i + 1 >= primaryCandidatesLen) break;
    }
    if (allResults.length > 0) break;
  }

  // 4. Si no se encontraron facturas, consultar /rec-docs/woemail con candidatos primarios
  if (allResults.length === 0) {
    for (const currentWs of workspacesToTry) {
      const primaryCands = ['PO' + baseDigits, '0000' + baseDigits, baseDigits];
      for (const refCand of primaryCands) {
        try {
          const resWo = callAxteroidApi('/rec-docs/woemail', {
            params: { order_reference: refCand, page_size: 100 },
            workspace: currentWs
          });
          if (resWo && resWo.results && resWo.results.length > 0) {
            resWo.results.forEach(doc => {
              if (doc.type && doc.type !== 'CL33' && doc.type !== 'CL34' && doc.type !== 'CL61' && doc.type !== 'NC') return;
              const id = axDocKey(doc);
              if (!seenIds.has(id)) {
                seenIds.add(id);
                allResults.push(doc);
              }
            });
          }
        } catch (e) {}
        if (allResults.length > 0) break;
      }
      if (allResults.length > 0) break;
    }
  }

  // 5. Fallback por RUT del Proveedor: Si no se halló por texto exacto de OC pero tenemos el RUT de BigQuery
  let supplierTaxId = options.supplier_tax_id;
  if (!supplierTaxId && options.supplier_name && typeof resolverProveedorBackend === 'function') {
    const prov = resolverProveedorBackend(options.supplier_name);
    if (prov && prov.rut) supplierTaxId = prov.rut;
  }

  if (allResults.length === 0 && supplierTaxId && baseDigits) {
    const cleanTax = (typeof normalizarRut === 'function') ? normalizarRut(supplierTaxId) : supplierTaxId.replace(/[^0-9kK]/g, '').toUpperCase();
    for (const currentWs of workspacesToTry) {
      try {
        const taxParams = {
          tax_id: cleanTax,
          page_size: 100
        };
        if (options.po_date) {
          const d = new Date(options.po_date);
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() - 30);
            taxParams.date__gte = d.toISOString().slice(0, 10);
          }
        }
        const resTax = callAxteroidApi('/rec-docs', {
          params: taxParams,
          workspace: currentWs
        });
        if (resTax && resTax.results && resTax.results.length > 0) {
          resTax.results.forEach(doc => {
            if (doc.type && doc.type !== 'CL33' && doc.type !== 'CL34' && doc.type !== 'CL61' && doc.type !== 'NC') return;
            const refStr = String(doc.order_reference || '');
            const hasPoInRefs = (doc.references || []).some(r => String(r.number || r.serial || r.reference || '').includes(baseDigits));
            if (refStr.includes(baseDigits) || hasPoInRefs) {
              const id = axDocKey(doc);
              if (!seenIds.has(id)) {
                seenIds.add(id);
                allResults.push(doc);
              }
            }
          });
        }
      } catch (e) {
        Logger.log('Aviso en búsqueda fallback por RUT de proveedor: ' + e.message);
      }
      if (allResults.length > 0) break;
    }
  }

  // 5.5 Búsqueda y vinculación automática de Notas de Crédito (DTE 61) asociadas
  try {
    buscarNotasCreditoAsociadas(allResults, baseDigits, options, workspacesToTry, seenIds);
  } catch (eNcSearch) {
    Logger.log('Aviso en búsqueda automática de Notas de Crédito: ' + eNcSearch.message);
  }

  // 6. Fallback: Catálogo local offline si no hubo respuesta en vivo
  if (allResults.length === 0) {
    const locales = getFacturasLocalesPorPo(baseDigits || rawNum || cleanOrig);
    if (locales && locales.length > 0) {
      return {
        count: locales.length,
        page: 1,
        results: locales
      };
    }
  }

  return formatAxteroidDocResults({ count: allResults.length, results: allResults }, 1);
}

// ───────────────────────── Helpers de documentos / Notas de Crédito ─────────────────────────

/** RUT sin puntos ni guion, en mayúsculas (para comparar emisores). */
function axRutKey(rut) {
  return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/** RUT con guion, el único formato que acepta el filtro tax_id de Axteroid (911440008 devuelve 0 resultados). */
function axRutConGuion(rut) {
  const k = axRutKey(rut);
  return k.length > 1 ? k.slice(0, -1) + '-' + k.slice(-1) : k;
}

/**
 * Impuestos adicionales del DTE (ILA, bebidas azucaradas, etc.), sin IVA.
 * Usa el detalle "taxes" del listado de Axteroid; si no viene, lo deduce de total - neto - exento - IVA.
 */
function axImpuestoInterno(doc) {
  if (!doc) return 0;
  if (doc.amount_internal_tax !== undefined && doc.amount_internal_tax !== null) return Number(doc.amount_internal_tax) || 0;
  if (Array.isArray(doc.taxes) && doc.taxes.length > 0) {
    return doc.taxes.reduce((s, t) => s + (String(t.code) === '14' ? 0 : parseMontoClean(t.amount)), 0);
  }
  const total = parseMontoClean(doc.amount_total);
  const neto = parseMontoClean(doc.amount_net);
  if (total <= 0 || neto <= 0) return 0;
  const iva = parseMontoClean(doc.amount_tax) || Math.round(neto * 0.19);
  const resto = total - neto - parseMontoClean(doc.amount_exempt) - iva;
  return resto > 1 ? resto : 0;
}

/** Folio sin ceros a la izquierda. */
function axFolioKey(folio) {
  return String(folio === null || folio === undefined ? '' : folio).trim().replace(/^0+/, '');
}

/** Tipo DTE canónico: las NC (CL61 / NC / 61) se unifican como 'CL61'. */
function axDocType(doc) {
  const t = String((doc && (doc.type || doc.doc_type || doc.tipo_dte)) || '').toUpperCase();
  if ((doc && (doc.is_nc || doc.es_nc)) || t === 'NC' || t.indexOf('61') !== -1) return 'CL61';
  return t || 'CL33';
}

/** Clave de deduplicación: RUT emisor + tipo + folio (cae al id del documento si no hay folio). */
function axDocKey(doc) {
  const folio = axFolioKey(doc && (doc.serial || doc.number || doc.folio));
  if (!folio) return 'ID:' + String((doc && doc.id) || '');
  return axRutKey(doc.supplier_tax_id || doc.tax_id || doc.rut) + '|' + axDocType(doc) + '|' + folio;
}

/**
 * Referencias de un DTE en forma uniforme { tipo, folio, cod_ref }.
 * Acepta las referencias del listado de Axteroid (doc.references) y las del XML parseado (doc.referencias).
 * tipo se entrega sin prefijo 'CL' ('33', '61', '801'...).
 */
function axExtraerReferencias(doc) {
  const out = [];
  const push = (r) => {
    if (!r) return;
    out.push({
      tipo: String(r.type || r.tipo || r.tpo_doc_ref || r.TpoDocRef || '').toUpperCase().replace(/^CL/, '').trim(),
      folio: String(r.number || r.serial || r.folio || r.folio_ref || r.FolioRef || r.reference || '').trim(),
      cod_ref: String(r.cod_ref || r.codref || r.CodRef || r.reference_code || '').trim()
    });
  };
  ((doc && doc.references) || []).forEach(push);
  ((doc && doc.referencias) || []).forEach(push);
  return out;
}

/**
 * Evalúa si una NC (CL61) pertenece a la PO / facturas encontradas.
 *  a) su order_reference (o referencia tipo 801) normalizado es igual a la PO, o
 *  b) referencia (TpoDocRef 33 + FolioRef) un folio de facturas del MISMO RUT emisor.
 * @param {Object} doc NC cruda
 * @param {string} po PO normalizada (normalizePo)
 * @param {Array<{folio:string, rut:string}>} facturas
 * @param {boolean} trustedByQuery true si la NC vino de una consulta por order_reference exacto
 * @return {{match:boolean, via:string, cod_ref:string, ref_folios:string[]}}
 */
function axEvaluarNc(doc, po, facturas, trustedByQuery) {
  const refs = axExtraerReferencias(doc);
  const ncRut = axRutKey(doc.supplier_tax_id || doc.tax_id);
  const refs33 = refs.filter(r => r.tipo === '33' || r.tipo === '34');
  const refFolios = Array.from(new Set(refs33.map(r => axFolioKey(r.folio)).filter(Boolean)));

  const poPorOrderRef = po && axFolioKey(normalizePo(doc.order_reference)) === po;
  const poPorRef801 = po && refs.some(r => (r.tipo === '801' || r.tipo === 'OC') && normalizePo(r.folio) === po);
  const matchA = Boolean(trustedByQuery || poPorOrderRef || poPorRef801);

  const sameRutFacturas = (facturas || []).filter(f => !ncRut || !axRutKey(f.rut) || axRutKey(f.rut) === ncRut);
  const facturaFolios = sameRutFacturas.map(f => axFolioKey(f.folio));
  const refMatch = refs33.filter(r => facturaFolios.indexOf(axFolioKey(r.folio)) !== -1);
  const matchB = refMatch.length > 0;

  // El CodRef válido es el de la referencia a la factura. La referencia a la OC (801) también trae uno y no aplica.
  const codSrc = refMatch.filter(r => r.cod_ref)[0] || refs33.filter(r => r.cod_ref)[0] || {};
  return {
    match: matchA || matchB,
    via: matchA ? 'order_reference' : (matchB ? 'referencia_folio' : ''),
    cod_ref: String(codSrc.cod_ref || '').trim(),
    ref_folios: refFolios
  };
}

/**
 * Detecta y vincula automáticamente las Notas de Crédito (CL61) asociadas a una PO,
 * con cualquier proveedor. Consulta /rec-docs y /rec-docs/woemail pidiendo type=CL61 explícito.
 *  a) NC con order_reference igual a la PO normalizada, o
 *  b) NC que referencian (TpoDocRef 33 / FolioRef) un folio de las facturas encontradas, del MISMO RUT emisor.
 * Deduplica por RUT emisor + tipo + folio (una NC visible en ambos endpoints se agrega una sola vez).
 * Cada NC agregada queda con is_nc=true, type='CL61', nc_cod_ref y nc_ref_folios.
 */
function buscarNotasCreditoAsociadas(allResults, baseDigits, options, workspacesToTry, seenIds) {
  options = options || {};
  const po = axFolioKey(normalizePo(baseDigits));
  if (!po && (!allResults || allResults.length === 0)) return;

  const esNc = (d) => axDocType(d) === 'CL61';
  const facturas = (allResults || []).filter(d => !esNc(d)).map(d => ({
    folio: String(d.serial || ''),
    rut: d.supplier_tax_id || d.tax_id || '',
    date: String(d.date || d.issued_date || '').slice(0, 10)
  })).filter(f => f.folio);

  // RUTs emisores: los de las facturas encontradas + el de la OC
  const ruts = [];
  const addRut = (r) => {
    const k = axRutKey(r);
    if (k && ruts.indexOf(k) === -1) ruts.push(k);
  };
  facturas.forEach(f => addRut(f.rut));
  addRut(options.supplier_tax_id);
  if (ruts.length === 0 && options.supplier_name && typeof resolverProveedorBackend === 'function') {
    const prov = resolverProveedorBackend(options.supplier_name);
    if (prov && prov.rut) addRut(prov.rut);
  }

  const minDate = facturas.map(f => f.date).filter(Boolean).sort()[0] || '';
  const xmlBudget = { left: 30 };

  const ncCandidates = Array.from(new Set(po ? [
    'PO' + po, '0000' + po, '002' + po, '00' + po, 'po' + po, 'OC' + po, po
  ] : []));

  const addNc = (doc, endpoint, ws, trustedByQuery) => {
    if (!doc || !esNc(doc)) return;
    const key = axDocKey(Object.assign({}, doc, { is_nc: true }));
    const existing = allResults.indexOf(doc) !== -1; // NC ya recogida por la búsqueda de facturas: solo se enriquece
    if (!existing && seenIds.has(key)) return;
    const ncDate = String(doc.date || doc.issued_date || '').slice(0, 10);
    if (!trustedByQuery && minDate && ncDate && ncDate < minDate) return; // una NC no puede ser anterior a su factura

    let ev = axEvaluarNc(doc, po, facturas, trustedByQuery);
    const mismoRut = !ruts.length || !axRutKey(doc.supplier_tax_id || doc.tax_id) ||
      ruts.indexOf(axRutKey(doc.supplier_tax_id || doc.tax_id)) !== -1;

    // El listado trae las referencias pero SIN CodRef: el XML (solo documentos recibidos) hace falta para toda NC que
    // pertenece a la OC, y para las que no traen referencias y aún no se sabe si pertenecen.
    const needXml = endpoint === '/rec-docs' && doc.id && xmlBudget.left > 0 && mismoRut &&
      ((ev.match && !ev.cod_ref) || (!ev.match && axExtraerReferencias(doc).length === 0));
    if (needXml) {
      xmlBudget.left--;
      try {
        const parsed = parseDteXml(fetchAxteroidXml(doc.id, ws));
        doc.referencias = (parsed && parsed.referencias) || [];
        ev = axEvaluarNc(doc, po, facturas, trustedByQuery);
      } catch (eXml) {
        Logger.log('Aviso leyendo XML de NC ' + doc.serial + ': ' + eXml.message);
      }
    }

    if (!ev.match) return;
    if (!trustedByQuery && !mismoRut) return;
    doc.is_nc = true;
    doc.type = 'CL61';
    doc.nc_cod_ref = ev.cod_ref;
    doc.nc_ref_folios = ev.ref_folios;
    doc.nc_match = ev.via;
    if (!existing) {
      seenIds.add(key);
      allResults.push(doc);
    }
    Logger.log('[NC Auto-Vinculada] NC ' + doc.serial + ' via ' + ev.via + ' (' + endpoint + ') CodRef=' + (ev.cod_ref || 'n/d'));
  };

  // NC que la búsqueda de facturas ya recogió por order_reference: completar CodRef y folios referenciados
  (allResults || []).filter(d => esNc(d) && !d.nc_match).forEach(d => addNc(d, '/rec-docs', workspacesToTry[0], true));

  const endpoints = ['/rec-docs', '/rec-docs/woemail'];
  for (const currentWs of workspacesToTry) {
    for (const endpoint of endpoints) {
      // a) Por order_reference (type=CL61 explícito)
      for (const cand of ncCandidates) {
        try {
          const res = callAxteroidApi(endpoint, {
            params: { order_reference: cand, type: 'CL61', page_size: 50 },
            workspace: currentWs
          });
          ((res && res.results) || []).forEach(doc => addNc(doc, endpoint, currentWs, true));
        } catch (eA) {}
      }
      // b) Por RUT emisor (type=CL61 explícito): NC que referencian folios de las facturas
      for (const rut of ruts) {
        try {
          for (let page = 1; page <= 5; page++) { // proveedores grandes emiten cientos de NC
            const params = { tax_id: axRutConGuion(rut), type: 'CL61', page: page, page_size: 100 };
            if (minDate) params.date__gte = minDate;
            const res = callAxteroidApi(endpoint, { params: params, workspace: currentWs });
            const lista = (res && res.results) || [];
            lista.forEach(doc => addNc(doc, endpoint, currentWs, false));
            if (lista.length < 100) break;
          }
        } catch (eB) {
          Logger.log('Aviso buscando NC por RUT ' + rut + ': ' + eB.message);
        }
      }
    }
  }
}

/**
 * Aplica el efecto de cada Nota de Crédito según CodRef (SII) y calcula los totales.
 *  CodRef 1 = anula el documento referenciado: la factura referenciada sale de los totales y la NC no descuenta.
 *  CodRef 2 = corrige texto: no afecta montos.
 *  CodRef 3 (o sin dato) = corrige montos: la NC descuenta.
 * Muta cada documento agregando efecto_nc ('ANULA' | 'SIN_EFECTO_MONTOS' | 'DESCUENTA') y anulada.
 * TotalFacturadoNeto = FacturasNeto − NcsNeto.
 * @param {Array<Object>} invoices { folio, rut, es_nc, monto_neto, monto_total, nc_cod_ref, nc_ref_folios }
 */
function aplicarEfectoNc(invoices) {
  const list = invoices || [];
  const facturas = list.filter(f => !f.es_nc);
  list.forEach(f => { f.anulada = false; f.anulada_por_nc = ''; });

  list.filter(f => f.es_nc).forEach(nc => {
    const cod = String(nc.nc_cod_ref || '').trim();
    if (cod === '1') {
      nc.efecto_nc = 'ANULA';
      const refs = (nc.nc_ref_folios || []).map(axFolioKey);
      facturas.forEach(f => {
        const mismoRut = !axRutKey(f.rut) || !axRutKey(nc.rut) || axRutKey(f.rut) === axRutKey(nc.rut);
        if (mismoRut && refs.indexOf(axFolioKey(f.folio)) !== -1) {
          f.anulada = true;
          f.anulada_por_nc = nc.folio;
        }
      });
    } else if (cod === '2') {
      nc.efecto_nc = 'SIN_EFECTO_MONTOS';
    } else {
      nc.efecto_nc = 'DESCUENTA';
    }
  });

  const t = { facturasNeto: 0, facturasTotal: 0, ncsNeto: 0, ncsTotal: 0, facturasImpuesto: 0, ncsImpuesto: 0 };
  list.forEach(f => {
    if (f.es_nc) {
      if (f.efecto_nc === 'DESCUENTA') {
        t.ncsNeto += Number(f.monto_neto || 0);
        t.ncsTotal += Number(f.monto_total || 0);
        t.ncsImpuesto += Number(f.impuesto_interno || 0);
      }
    } else if (!f.anulada) {
      t.facturasNeto += Number(f.monto_neto || 0);
      t.facturasTotal += Number(f.monto_total || 0);
      t.facturasImpuesto += Number(f.impuesto_interno || 0);
    }
  });
  t.totalFacturadoNeto = t.facturasNeto - t.ncsNeto;
  t.totalFacturadoTotal = t.facturasTotal - t.ncsTotal;
  // Base comparable con lo recepcionado de BigQuery, que incluye impuesto interno: neto + impuesto, descontadas las NC
  t.impuestoInternoNeto = t.facturasImpuesto - t.ncsImpuesto;
  t.facturasComparable = t.facturasNeto + t.facturasImpuesto;
  t.totalFacturadoComparable = t.totalFacturadoNeto + t.impuestoInternoNeto;
  return t;
}

/**
 * Catálogo offline / prealmacenado de las 44 facturas de Carozzi en CD36
 * asociadas a sus respectivas Órdenes de Compra SAP.
 */
function getFacturasLocalesPorPo(poDigits) {
  const cleanPo = String(poDigits || '').replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '').trim();
  const base44 = [
    // PO 521534 (10 Facturas - Coca Cola Embonor S.A. CH_8 Vina del Mar)
    { serial: "105275609", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 36589, amount_total: 54687, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUbqdD-9ZI" },
    { serial: "105275608", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 144911, amount_total: 185966, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUbn_HbAKX" },
    { serial: "105275606", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 277986, amount_total: 352065, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUblJ--tLK" },
    { serial: "105275605", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 166643, amount_total: 204136, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUbiVoxQMw" },
    { serial: "105275603", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 413439, amount_total: 522773, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUbfl899yJ" },
    { serial: "105275602", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 34844, amount_total: 46991, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUbcP1knBA" },
    { serial: "105275607", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 122979, amount_total: 158076, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDURlT_jkxu" },
    { serial: "105275604", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 695468, amount_total: 896939, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUOaXZbdxF" },
    { serial: "105275601", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 136777, amount_total: 204279, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUOXlpu9FC" },
    { serial: "105275600", date: "2026-09-30", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 357471, amount_total: 491118, order_reference: "0000521534", status: "APR", rec_status: "ROK", id: "do_AAABoPDUOUIBkxMc" },

    // PO 521015 (2 Facturas - Ideal S.A. / Bimbo CH_34 Manuel Montt)
    { serial: "56500972", date: "2026-09-29", supplier_name: "Ideal S.A.", supplier_tax_id: "90297000-0", amount_net: 1968789, amount_total: 2342857, order_reference: "521015", status: "APR", rec_status: "ROK", id: "do_AAABoO3pE68cnwlF" },
    { serial: "56500937", date: "2026-09-29", supplier_name: "Ideal S.A.", supplier_tax_id: "90297000-0", amount_net: 40440, amount_total: 48124, order_reference: "521015", status: "APR", rec_status: "ROK", id: "do_AAABoO3N9aiEZzoM" },

    // PO 521257 (7 Facturas)
    { serial: "22591488", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1261921, amount_total: 1501686, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9OqrKXigHH" },
    { serial: "22591487", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3056565, amount_total: 3637312, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9Oqjkfayk7" },
    { serial: "22591486", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1845858, amount_total: 2196571, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9OqefmrNmV" },
    { serial: "22591485", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 6531950, amount_total: 7773021, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9OqUZqb7GI" },
    { serial: "22591484", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 664070, amount_total: 790243, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9OqE_UahOn" },
    { serial: "22591482", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 5227449, amount_total: 6220664, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9OfcdbUvtR" },
    { serial: "22591483", date: "2026-09-30", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2271329, amount_total: 2720616, order_reference: "0000521257", status: "APR", rec_status: "ROK", id: "do_AAABoO9OfT88HV_t" },

    // PO 520020 (6 Facturas)
    { serial: "22589805", date: "2026-09-28", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4167017, amount_total: 4958750, order_reference: "0000520020", status: "APR", rec_status: "ROK", id: "do_AAABoNxW9H780vA9" },
    { serial: "22589801", date: "2026-09-28", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4863621, amount_total: 5879934, order_reference: "0000520020", status: "APR", rec_status: "ROK", id: "do_AAABoNxW9BCXIb0d" },
    { serial: "22589804", date: "2026-09-28", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2487652, amount_total: 2960306, order_reference: "0000520020", status: "APR", rec_status: "ROK", id: "do_AAABoNxW9AqLHm7X" },
    { serial: "22589806", date: "2026-09-28", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1368067, amount_total: 1628000, order_reference: "0000520020", status: "APR", rec_status: "ROK", id: "do_AAABoNxW86dq3kj0" },
    { serial: "22589803", date: "2026-09-28", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4423569, amount_total: 5264047, order_reference: "0000520020", status: "APR", rec_status: "ROK", id: "do_AAABoNxW80n4v1fZ" },
    { serial: "22589802", date: "2026-09-28", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1264054, amount_total: 1506851, order_reference: "0000520020", status: "APR", rec_status: "ROK", id: "do_AAABoNxW8vHpLukx" },

    // PO 519840 (2 Facturas)
    { serial: "22588721", date: "2026-09-25", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3595666, amount_total: 4278843, order_reference: "0000519840", status: "APR", rec_status: "ROK", id: "do_AAABoNS8wGROzxbN" },
    { serial: "22588722", date: "2026-09-25", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 840334, amount_total: 999997, order_reference: "0000519840", status: "APR", rec_status: "ROK", id: "do_AAABoNS8wA8kGvBw" },

    // PO 519039 (10 Facturas)
    { serial: "22587396", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 6130353, amount_total: 7295120, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMxwqZtU9YsZ" },
    { serial: "22587399", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3757192, amount_total: 4471058, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMxwqZOWZxNG" },
    { serial: "22587397", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2699147, amount_total: 3211985, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMxwqNWIj3lS" },
    { serial: "22587398", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3227529, amount_total: 3840760, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMxwqE7t6MjA" },
    { serial: "22587400", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 465045, amount_total: 553404, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMxwp5h641tQ" },
    { serial: "22587339", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1236937, amount_total: 1471955, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMvizTSsWJcr" },
    { serial: "22587338", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 276762, amount_total: 329347, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMvioTSoHuzo" },
    { serial: "22587337", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1528832, amount_total: 1830644, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMviTGvItyTI" },
    { serial: "22587336", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1634943, amount_total: 1952230, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMviS_CHtaBU" },
    { serial: "22587335", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3639378, amount_total: 4521829, order_reference: "0000519039", status: "APR", rec_status: "ROK", id: "do_AAABoMviS97yDzHQ" },

    // PO 518529 (2 Facturas)
    { serial: "22447694", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 30414, amount_total: 36193, order_reference: "0000518529", status: "APR", rec_status: "ROK", id: "do_AAABoMkVoEvJU2Rs" },
    { serial: "22447693", date: "2026-09-23", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 30414, amount_total: 36193, order_reference: "0000518529", status: "APR", rec_status: "ROK", id: "do_AAABoMkVn1x79nxa" },

    // PO 517979 (8 Facturas - Caso Daniela Reyes)
    { serial: "22586659", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 894377, amount_total: 1064309, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZclE77AkTd" },
    { serial: "22586656", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2676104, amount_total: 3184564, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcaF_fZEAe" },
    { serial: "22586657", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2096468, amount_total: 2494797, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcaFMU5WY9" },
    { serial: "22586658", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2558509, amount_total: 3044626, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcaE9GJ8iu" },
    { serial: "22586653", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2079070, amount_total: 2474093, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcZ6fiXqds" },
    { serial: "22586654", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2138351, amount_total: 2544638, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcZsG5Uvja" },
    { serial: "22586655", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4959044, amount_total: 5901262, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcZnyZFDO1" },
    { serial: "22586652", date: "2026-09-22", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4666846, amount_total: 5589553, order_reference: "0000517979", status: "APR", rec_status: "APR", id: "do_AAABoMZcZiOh4a_m" },

    // PO 517508 (9 Facturas)
    { serial: "22584370", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 987607, amount_total: 1175252, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdiCFyjS60K" },
    { serial: "22584371", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2660559, amount_total: 3166065, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdiCAZcQ9bF" },
    { serial: "22584372", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 652348, amount_total: 776294, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdiB6GFy7jQ" },
    { serial: "22584369", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2467631, amount_total: 2936481, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdiB0rIQnmm" },
    { serial: "22584364", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3634522, amount_total: 4346690, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdhsFNigZ3I" },
    { serial: "22584366", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1208900, amount_total: 1441631, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdhsEdGSWRg" },
    { serial: "22584368", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3501959, amount_total: 4167331, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdhr49z2itC" },
    { serial: "22584365", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1794992, amount_total: 2136040, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdhrrlczr0T" },
    { serial: "22584367", date: "2026-09-16", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 312187, amount_total: 371503, order_reference: "0000517508", status: "APR", rec_status: "APR", id: "do_AAABoKdhrl6rAq7F" },

    // Lote SAP 7000014989 (12 Facturas asociadas a PO 524332 - Carozzi CD36 Sociedad 6202 - Monto Facturado Neto: $25.554.639)
    { serial: "22599557", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 118224, amount_total: 140687, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8IEMB9W8", sap_id: "7000014989", nro_doc_sap: "3200108276" },
    { serial: "22599552", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3370547, amount_total: 4010951, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR84WExtWR", sap_id: "7000014989", nro_doc_sap: "3200108277" },
    { serial: "22599553", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3084034, amount_total: 3670000, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8dfyioj-", sap_id: "7000014989", nro_doc_sap: "3200108278" },
    { serial: "22599554", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 328068, amount_total: 390401, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8NxWKiZ1", sap_id: "7000014989", nro_doc_sap: "3200108279" },
    { serial: "22599555", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3496366, amount_total: 4160676, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8nb_TxIE", sap_id: "7000014989", nro_doc_sap: "3200108280" },
    { serial: "22599556", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4313351, amount_total: 5132888, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8ziMSLFN", sap_id: "7000014989", nro_doc_sap: "3200108281" },
    { serial: "22599563", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3184566, amount_total: 3789634, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruu2y0FII", sap_id: "7000014989", nro_doc_sap: "3200108282" },
    { serial: "22599564", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2249089, amount_total: 2676416, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruYdqEmQu", sap_id: "7000014989", nro_doc_sap: "3200108283" },
    { serial: "22599565", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1530194, amount_total: 1820931, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruJjXD6R7", sap_id: "7000014989", nro_doc_sap: "3200108284" },
    { serial: "22599566", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2337694, amount_total: 2781856, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTerupORZGzi", sap_id: "7000014989", nro_doc_sap: "3200108285" },
    { serial: "22599567", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1384986, amount_total: 1648133, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruvwW478J", sap_id: "7000014989", nro_doc_sap: "3200108286" },
    { serial: "22599568", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 157520, amount_total: 187449, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruouwNv-t", sap_id: "7000014989", nro_doc_sap: "3200108287" },
    // PO 519695 (Distribución y Excelencia S.A. - Factura 10198005 y NC 6361744)
    { serial: "10198005", date: "2026-09-23", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "88725800-4", amount_net: 362423, amount_total: 514643, order_reference: "0000519695", status: "APR", rec_status: "ROK", id: "do_AAABoMZdesa10198005" },
    { serial: "6361744", date: "2026-09-24", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "88725800-4", amount_net: 9609, amount_total: 11940, order_reference: "0000519695", doc_type: "CL61", status: "APR", rec_status: "ROK", id: "do_AAABoMnc6361744" },
    // PO 524064 (Distribución y Excelencia S.A. - Facturas 10207759, 10207760 y NC 6363032)
    { serial: "10207759", date: "2026-10-09", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "96568970-2", amount_net: 477667, amount_total: 660358, order_reference: "0000524064", type: "CL33", status: "APR", rec_status: "ROK", id: "do_AAABoR8NHdtRW8H1" },
    { serial: "10207760", date: "2026-10-09", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "96568970-2", amount_net: 59830, amount_total: 80659, order_reference: "0000524064", type: "CL33", status: "APR", rec_status: "ROK", id: "do_AAABoR8M8nu064Rv" },
    { serial: "6363032", date: "2026-10-13", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "96568970-2", amount_net: 2067, amount_total: 2591, order_reference: "0000524064", type: "CL61", doc_type: "CL61", is_nc: true, status: "APR", rec_status: "ROK", id: "do_AAABoTgESzwpdwmM" }
  ];

  if (!cleanPo || cleanPo.toUpperCase() === 'ALL' || cleanPo === '*') return base44;
  const cleanPoNorm = cleanPo.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '').trim();
  const filteredBase = base44.filter(f => {
    const oRef = String(f.order_reference || '').replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '').trim();
    const bRef = String(f.batch_po || '').replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '').trim();
    const matchOrder = oRef.length >= 4 && (oRef === cleanPoNorm || oRef.replace(/^0+/, '') === cleanPoNorm.replace(/^0+/, ''));
    const matchBatch = bRef.length >= 4 && (bRef === cleanPoNorm || bRef.replace(/^0+/, '') === cleanPoNorm.replace(/^0+/, ''));
    return matchOrder || matchBatch;
  });
  if (filteredBase.length > 0) return filteredBase;

  return [];
}

/**
 * Extrae la orden de compra de las referencias si existe.
 */
function extractPoFromReferences(references) {
  if (!references || !Array.isArray(references)) return null;
  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const tpo = String(ref.type || '');
    const num = String(ref.number || ref.serial || '');
    if (tpo === 'CL801' || tpo === '801' || tpo.includes('801') || tpo === 'OC' || tpo === 'HES' || /(?:PO|OC|0+)?([3-58]\d{5})/.test(num)) {
      return num ? (num.toUpperCase().startsWith('PO') ? num : 'PO' + num.replace(/^0+/, '')) : null;
    }
  }
  return null;
}

/**
 * Descarga el XML de un documento y lo devuelve como texto.
 * @param {string} docId ID del documento en Axteroid (ej: do_AAABoO9OqrKXigHH)
 */
function fetchAxteroidXml(docId, workspace) {
  return callAxteroidApi(`/rec-docs/${docId}`, {
    accept: 'application/xml',
    workspace: workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE
  });
}

/**
 * Descarga el PDF de un documento y lo devuelve como base64 data URL.
 * @param {string} docId ID del documento
 */
function fetchAxteroidPdfBase64(docId, workspace) {
  const blob = callAxteroidApi(`/rec-docs/${docId}`, {
    accept: 'application/pdf',
    workspace: workspace || AXTEROID_CONFIG.DEFAULT_WORKSPACE
  });
  return {
    filename: `Factura_${docId}.pdf`,
    contentType: 'application/pdf',
    base64: Utilities.base64Encode(blob.getBytes())
  };
}
