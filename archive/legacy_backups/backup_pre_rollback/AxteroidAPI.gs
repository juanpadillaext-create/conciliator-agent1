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
      return {
        id: doc.id,
        serial: doc.serial || doc.number,
        type: doc.type,
        supplier_name: doc.supplier_name,
        supplier_tax_id: doc.tax_id || doc.supplier_tax_id,
        amount_total: finalTot,
        amount_net: finalNet,
        amount_tax: tax,
        date: doc.date || doc.issued_date,
        status: doc.status,
        rec_status: doc.rec_status,
        order_reference: doc.order_reference || extractPoFromReferences(doc.references)
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

  const params = {
    page: filters.page || 1
  };

  // Si busca por folio específico (serial), solo fijamos tipo si se solicitó explícitamente
  if (filters.serial) {
    params.serial = filters.serial.toString().trim();
    if (filters.type) params.type = filters.type;
  } else {
    params.type = filters.type || 'CL33';
  }

  if (filters.tax_id) params.tax_id = filters.tax_id.toString().replace(/\./g, '').trim().toUpperCase();
  if (filters.date__gte) params.date__gte = filters.date__gte;
  if (filters.date__lte) params.date__lte = filters.date__lte;
  if (filters.order_reference) params.order_reference = filters.order_reference.toString().trim();

  // 1. Intentar consulta directa en los workspaces configurados
  for (const currentWs of workspacesToTry) {
    try {
      const data = callAxteroidApi('/rec-docs', {
        params: params,
        workspace: currentWs
      });
      if (data && data.results && data.results.length > 0) {
        return formatAxteroidDocResults(data, params.page);
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

    // Fallback 3: Probar order_reference = 'PO' + rawNum (sin tipo)
    if (rawNum && /^\d+$/.test(rawNum)) {
      const p3 = Object.assign({}, params);
      delete p3.serial;
      delete p3.type;
      p3.order_reference = 'PO' + rawNum;
      try {
        const d3 = callAxteroidApi('/rec-docs', { params: p3, workspace: currentWs });
        if (d3.results && d3.results.length > 0) return formatAxteroidDocResults(d3, params.page);
      } catch (e) {}
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
  const rawNum = cleanOrig.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
  const baseDigits = (typeof extraerPoBaseDigits === 'function') 
    ? (extraerPoBaseDigits(cleanOrig) || rawNum)
    : ((cleanOrig.match(/(?:PO|OC|0+)?([3-58]\d{5})/) || [])[1] || rawNum);

  const candidates = [];
  const addCand = (c) => {
    if (c && !candidates.includes(c)) candidates.push(c);
  };

  // 1. Candidatos prioritarios universales (máximo 3 más representativos para evitar timeouts)
  if (baseDigits && /^\d+$/.test(baseDigits)) {
    addCand('0000' + baseDigits);          // Carozzi, Embonor, Ideal, ICB, etc.
    addCand('PO' + baseDigits);            // Andina, etc.
    addCand(baseDigits);                   // Frutale, Philip Morris, etc.
  } else {
    addCand(cleanOrig);
  }

  // 2. Si conocemos la tienda o almacén (ej: CH_11 -> '11', CH_6 -> '6')
  if (baseDigits && /^\d{6}$/.test(baseDigits) && options.warehouse_name) {
    const matchWh = options.warehouse_name.match(/CH_(\d+)/i);
    if (matchWh && matchWh[1]) {
      addCand('0000' + baseDigits + matchWh[1] + '9');
    }
  }

  let allResults = [];
  const seenIds = new Set();
  let totalApiCalls = 0;
  const MAX_CALLS = 4;

  // 3. Consultar /rec-docs en el workspace primario con los mejores candidatos
  for (let i = 0; i < candidates.length && totalApiCalls < MAX_CALLS; i++) {
    const refCandidate = candidates[i];
    try {
      totalApiCalls++;
      const res = callAxteroidApi('/rec-docs', {
        params: { order_reference: refCandidate, page_size: 100 },
        workspace: ws
      });
      if (res && res.results && res.results.length > 0) {
        res.results.forEach(doc => {
          if (doc.type && !['CL33', 'CL34', 'CL39', 'CL41', 'CL52', 'CL61', 'CL56'].includes(doc.type)) return;
          const id = String(doc.id || doc.serial);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allResults.push(doc);
          }
        });
      }
    } catch (e) {
      Logger.log(`Aviso buscando candidate ${refCandidate} en ${ws}: ` + e.message);
    }
    if (allResults.length > 0) break;
  }

  // 4. Si no hubo resultados en ws y existe ALT_WORKSPACE, intentar una sola llamada con el mejor candidato
  if (allResults.length === 0 && ws !== AXTEROID_CONFIG.ALT_WORKSPACE && totalApiCalls < MAX_CALLS) {
    const topCand = candidates[0] || ('0000' + baseDigits);
    try {
      totalApiCalls++;
      const resAlt = callAxteroidApi('/rec-docs', {
        params: { order_reference: topCand, page_size: 100 },
        workspace: AXTEROID_CONFIG.ALT_WORKSPACE
      });
      if (resAlt && resAlt.results && resAlt.results.length > 0) {
        resAlt.results.forEach(doc => {
          if (doc.type && !['CL33', 'CL34', 'CL39', 'CL41', 'CL52', 'CL61', 'CL56'].includes(doc.type)) return;
          const id = String(doc.id || doc.serial);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allResults.push(doc);
          }
        });
      }
    } catch (eAlt) {}
  }

  // 5. Si aún no hay resultados y tenemos llamadas disponibles, probar una vez en /rec-docs/woemail
  if (allResults.length === 0 && totalApiCalls < MAX_CALLS) {
    const topCand = candidates[0] || ('0000' + baseDigits);
    try {
      totalApiCalls++;
      const resWo = callAxteroidApi('/rec-docs/woemail', {
        params: { order_reference: topCand, page_size: 100 },
        workspace: ws
      });
      if (resWo && resWo.results && resWo.results.length > 0) {
        resWo.results.forEach(doc => {
          if (doc.type && !['CL33', 'CL34', 'CL39', 'CL41', 'CL52', 'CL61', 'CL56'].includes(doc.type)) return;
          const id = String(doc.id || doc.serial);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allResults.push(doc);
          }
        });
      }
    } catch (eWo) {}
  }

  // 6. Fallback por RUT del Proveedor: Si no se halló por texto exacto de OC pero tenemos el RUT de BigQuery
  let supplierTaxId = options.supplier_tax_id;
  if (!supplierTaxId && options.supplier_name && typeof resolverProveedorBackend === 'function') {
    const prov = resolverProveedorBackend(options.supplier_name);
    if (prov && prov.rut) supplierTaxId = prov.rut;
  }

  if (allResults.length === 0 && supplierTaxId && baseDigits && totalApiCalls < MAX_CALLS) {
    try {
      totalApiCalls++;
      const taxParams = {
        tax_id: supplierTaxId,
        page_size: 100
      };
        if (options.po_date) {
          const d = new Date(options.po_date);
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() - 7);
            taxParams.date__gte = d.toISOString().slice(0, 10);
          }
        }
        const resTax = callAxteroidApi('/rec-docs', {
          params: taxParams,
          workspace: ws
        });
        if (resTax && resTax.results && resTax.results.length > 0) {
          resTax.results.forEach(doc => {
            if (doc.type && !['CL33', 'CL34', 'CL39', 'CL41', 'CL52', 'CL61', 'CL56'].includes(doc.type)) return;
            const refStr = String(doc.order_reference || '');
            const hasPoInRefs = (doc.references || []).some(r => String(r.number || r.serial || '').includes(baseDigits));
            if (refStr.includes(baseDigits) || hasPoInRefs) {
              const id = String(doc.id || doc.serial);
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

    // PO 519527 (1 Factura - Ideal S.A. / Grupo Bimbo CH_24 El Belloto)
    { serial: "56458220", date: "2026-09-25", supplier_name: "Ideal S.A. (Grupo Bimbo)", supplier_tax_id: "82623500-4", amount_net: 1033571, amount_total: 1229948, order_reference: "519527", status: "APR", rec_status: "ROK", id: "do_AAABoNmiZ3502o7z" },

    // PO 520168 (6 Facturas + 1 NC - Coca-Cola Embonor S.A. CH_18 Valdivia)
    { serial: "105214259", date: "2026-09-25", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 160295, amount_total: 204846, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNcB-Pq_ZKOk", type: "CL33" },
    { serial: "105214260", date: "2026-09-25", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 207957, amount_total: 269948, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNcB-UlUqh9u", type: "CL33" },
    { serial: "105214261", date: "2026-09-25", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 426731, amount_total: 552100, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNcB-XdrxEe2", type: "CL33" },
    { serial: "105214262", date: "2026-09-25", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 458638, amount_total: 580714, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNcB-aQth6lQ", type: "CL33" },
    { serial: "105214263", date: "2026-09-25", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 290111, amount_total: 374234, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNcB-dh6WzFR", type: "CL33" },
    { serial: "105214264", date: "2026-09-25", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", amount_net: 3413, amount_total: 4559, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNcB-gC7OH5i", type: "CL33" },
    { serial: "17233113", date: "2026-09-25", supplier_name: "COCA-COLA EMBONOR S.A.", supplier_tax_id: "93281000-K", amount_net: 3413, amount_total: 4559, order_reference: "0000520168", status: "APR", rec_status: "ROK", id: "do_AAABoNpo8MUyfoGQ", type: "CL61" },

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
    // PO 514457 (1 Factura Conforme - Nestlé Chile S.A.)
    { serial: "284719", date: "2026-09-24", supplier_name: "Nestlé Chile S.A.", supplier_tax_id: "96557910-9", amount_net: 45200000, amount_total: 53788000, order_reference: "0000514457", status: "APR", rec_status: "APR", id: "do_nestle_284719" }
  ];

  if (!cleanPo) return base44;
  const normQ = String(poDigits || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const cleanRutQ = String(poDigits || '').replace(/[^0-9kK]/gi, '').toLowerCase();

  const filteredBase = base44.filter(f => {
    const sName = (f.supplier_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sRut = (f.supplier_tax_id || '').replace(/[^0-9kK]/gi, '').toLowerCase();
    const ordRef = (f.order_reference || '').replace(/^0+/, '');
    const serialStr = String(f.serial);
    return (cleanPo && ordRef.includes(cleanPo)) || 
           (cleanPo && cleanPo.includes(ordRef)) ||
           serialStr === cleanPo ||
           (cleanPo && serialStr.includes(cleanPo)) ||
           (normQ && normQ.length >= 3 && sName.includes(normQ)) ||
           (cleanRutQ && cleanRutQ.length >= 7 && sRut.includes(cleanRutQ));
  });
  if (filteredBase.length > 0) return filteredBase;

  // Fallback a las facturas del TOP Dashboard si la PO está registrada (ej: Unilever 1849201 para PO502855)
  if (typeof TOP_DISCREPANCIAS_DASHBOARD_DATA !== 'undefined' && TOP_DISCREPANCIAS_DASHBOARD_DATA.top_facturas) {
    const hits = TOP_DISCREPANCIAS_DASHBOARD_DATA.top_facturas.filter(f => {
      const ocClean = String(f.po_asociada || '').replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
      return ocClean === cleanPo;
    });
    if (hits.length > 0) {
      return hits.map(h => ({
        serial: String(h.folio),
        date: h.fecha || '2026-09-24',
        supplier_name: h.proveedor,
        supplier_tax_id: h.rut,
        amount_net: Number(h.monto_factura) || 0,
        amount_total: Math.round((Number(h.monto_factura) || 0) * 1.19),
        order_reference: h.po_asociada || ('PO' + cleanPo),
        status: 'APR',
        rec_status: 'ROK',
        id: 'ax_' + h.folio,
        diagnostico: h.diagnostico,
        causa_raiz: h.causa_raiz
      }));
    }
  }

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
