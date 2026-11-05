/**
 * BigQueryAPI.gs
 * Módulo de integración con BigQuery para consultar órdenes de compra y recepciones en Dmarts Chile.
 * Soporta tanto el servicio avanzado BigQuery como llamadas REST nativas con OAuth token.
 */

const BQ_CONFIG = {
  BILLING_PROJECT_ID: 'peya-chile',
  // Tabla principal a nivel SKU (Datamart Dmarts Oficial)
  TABLE_PO_SKU_LEVEL: 'peya-datamarts-pro.dm_dmarts.purchase_orders_sku_level',
  DATASET_PO_SKU_LEVEL: 'peya-datamarts-pro.dm_dmarts.purchase_orders_sku_level',
  TABLE_PO_SKU_LEVEL_ALT: 'peya-datamarts-pro.dm_dmarts.dmarts_purchase_orders_sku_level',
  // Tabla dimensional complementaria de productos y proveedores
  TABLE_DIM_VENDOR_PRODUCT: 'peya-bi-tools-pro.il_qcommerce.dim_vendor_product',
  DATASET_DIM_VENDOR_PRODUCT: 'peya-bi-tools-pro.il_qcommerce.dim_vendor_product',
  // Tabla de consolidación Factura vs POs (3WM SAP Fintech Oficial)
  TABLE_SAP_REPORT_3WM: 'peya-datamarts-pro.dm_fintech.sap_report_3wm',
  DATASET_SAP_3WM: 'peya-datamarts-pro.dm_fintech.sap_report_3wm',
  // Tablas legacy de origen (fallback)
  DATASET_PO: 'peya-data-origins-pro.cl_dmarts.purchase_orders',
  DATASET_HOMOLOGATION: 'peya-data-origins-pro.cl_dmarts.products_suppliers',
  DATASET_CATALOG: 'peya-data-origins-pro.cl_dmarts.products',
  COMPANY_CODE: '6202',    // Sociedad SAP 6202 - Delivery Hero Stores Chile SpA
  COUNTRY_CODE: 'cl',      // Chile
  COUNTRY_NAME: 'Chile',
  GLOBAL_ENTITY_ID: 'PY_CL',
  // Políticas de Caché Inteligente alineadas al SLA de refresco de cada tabla en BigQuery
  CACHE_TTL_SECONDS: {
    PO_SKU_LEVEL: 14400,       // 4 horas (SLA de dm_dmarts.purchase_orders_sku_level: cada 4-6h)
    DIM_VENDOR_PRODUCT: 21600, // 6 horas máx CacheService (SLA de il_qcommerce.dim_vendor_product: 24h)
    SAP_3WM: 21600,            // 6 horas máx CacheService (SLA de dm_fintech.sap_report_3wm: 24h)
    METADATA_CHECK: 900        // 15 minutos para verificación de INFORMATION_SCHEMA (0 bytes scan)
  }
};

// Versión del esquema de caché de POs. Subirla invalida las entradas guardadas con una valorización anterior
// (d2: lo recepcionado de las OC leídas del origen incluye el descuento de la OC y el impuesto interno;
//  d3: los items traen la cantidad y el monto ordenados para emparejar líneas de factura por monto).
const BQ_CACHE_SCHEMA = 'd3';

// Caché en memoria de ejecución y telemetría de ahorro de consumo BigQuery
const BQ_RUNTIME_PO_CACHE = {};
const BQ_RUNTIME_SUMMARY_CACHE = {};
const BQ_RUNTIME_SAP3WM_CACHE = {};
const BQ_TELEMETRY = {
  queries_executed: 0,
  queries_saved_by_cache: 0,
  pos_served_from_cache: 0,
  pos_queried_live: 0,
  origin_fallback_hits: 0,
  last_query_at: null
};

/**
 * Obtiene instancia de CacheService de forma segura (compatible con entornos de prueba).
 */
function _getBqScriptCache() {
  try {
    if (typeof CacheService !== 'undefined' && CacheService.getScriptCache) {
      return CacheService.getScriptCache();
    }
  } catch (e) {}
  return null;
}

/**
 * Obtiene la versión actual de invalidación de caché en función de los refrescos detectados en BigQuery.
 */
function _getBqCacheEpoch() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('BQ_CACHE_EPOCH') || 'v1';
  } catch (e) {
    return 'v1';
  }
}

/**
 * Purga manualmente toda la caché inteligente de BigQuery para forzar lectura en vivo.
 */
function purgeBigQuerySmartCache() {
  const newEpoch = 'v' + new Date().getTime();
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BQ_CACHE_EPOCH', newEpoch);
    props.setProperty('BQ_LAST_MANUAL_PURGE', new Date().toISOString());
  } catch (e) {}
  const cache = _getBqScriptCache();
  if (cache) {
    try {
      cache.remove('BQ_TABLES_FRESHNESS_STATUS');
    } catch (e) {}
  }
  Object.keys(BQ_RUNTIME_PO_CACHE).forEach(k => delete BQ_RUNTIME_PO_CACHE[k]);
  Object.keys(BQ_RUNTIME_SUMMARY_CACHE).forEach(k => delete BQ_RUNTIME_SUMMARY_CACHE[k]);
  Object.keys(BQ_RUNTIME_SAP3WM_CACHE).forEach(k => delete BQ_RUNTIME_SAP3WM_CACHE[k]);
  return {
    success: true,
    new_epoch: newEpoch,
    purged_at: new Date().toISOString()
  };
}

/**
 * Lee una PO desde la caché inteligente (Memoria -> CacheService).
 */
function _getCachedPoItem(prefix, digits) {
  if (!digits) return null;
  const epoch = _getBqCacheEpoch();
  const key = `BQ_${epoch}_${BQ_CACHE_SCHEMA}_${prefix}_${digits}`;
  if (prefix === 'FULL' && BQ_RUNTIME_PO_CACHE[key]) {
    BQ_TELEMETRY.pos_served_from_cache++;
    return BQ_RUNTIME_PO_CACHE[key];
  }
  if (prefix === 'SUM' && BQ_RUNTIME_SUMMARY_CACHE[key]) {
    BQ_TELEMETRY.pos_served_from_cache++;
    return BQ_RUNTIME_SUMMARY_CACHE[key];
  }
  const cache = _getBqScriptCache();
  if (cache) {
    try {
      const raw = cache.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (prefix === 'FULL') BQ_RUNTIME_PO_CACHE[key] = parsed;
        if (prefix === 'SUM') BQ_RUNTIME_SUMMARY_CACHE[key] = parsed;
        BQ_TELEMETRY.pos_served_from_cache++;
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Guarda una PO en la caché inteligente (Memoria + CacheService con límite de 95KB por clave).
 */
function _setCachedPoItem(prefix, digits, data, ttlSeconds) {
  if (!digits || !data) return;
  const epoch = _getBqCacheEpoch();
  const key = `BQ_${epoch}_${BQ_CACHE_SCHEMA}_${prefix}_${digits}`;
  if (prefix === 'FULL') BQ_RUNTIME_PO_CACHE[key] = data;
  if (prefix === 'SUM') BQ_RUNTIME_SUMMARY_CACHE[key] = data;
  const cache = _getBqScriptCache();
  if (cache) {
    try {
      const serialized = JSON.stringify(data);
      if (serialized.length < 95000) {
        cache.put(key, serialized, ttlSeconds || BQ_CONFIG.CACHE_TTL_SECONDS.PO_SKU_LEVEL);
      }
    } catch (e) {}
  }
}

/**
 * Consulta en BigQuery los metadatos de última actualización (`INFORMATION_SCHEMA` / `__TABLES__`)
 * de las 3 tablas principales y la tabla de origen. Esta consulta lee metadatos de catálogo
 * (0 bytes de datos escaneados) y permite invalidar automáticamente la caché solo cuando BigQuery se refresca.
 * @param {boolean} forceCheck Si es true, omite la caché de 15 minutos de metadatos
 */
function getBigQueryTablesFreshnessStatus(forceCheck) {
  const cache = _getBqScriptCache();
  if (!forceCheck && cache) {
    try {
      const cachedStatus = cache.get('BQ_TABLES_FRESHNESS_STATUS');
      if (cachedStatus) {
        const parsed = JSON.parse(cachedStatus);
        parsed.telemetry = getBigQueryConsumptionTelemetry();
        return parsed;
      }
    } catch (e) {}
  }

  const tablesCatalog = [
    {
      id: 'purchase_orders_sku_level',
      full_name: BQ_CONFIG.TABLE_PO_SKU_LEVEL,
      role: 'OC y Recepción Física SKU (GR)',
      cadence_label: 'Cada 4–6 horas (3–4x día)',
      cache_ttl_hours: 4,
      last_modified_iso: null,
      row_count: null,
      status: 'ACTIVA_CACHE_INTELIGENTE'
    },
    {
      id: 'dim_vendor_product',
      full_name: BQ_CONFIG.TABLE_DIM_VENDOR_PRODUCT,
      role: 'Homologación Proveedor / EAN y Pesables (kg/gr)',
      cadence_label: 'Diaria (Batch Nocturno 24h)',
      cache_ttl_hours: 6,
      last_modified_iso: null,
      row_count: null,
      status: 'ACTIVA_CACHE_INTELIGENTE'
    },
    {
      id: 'sap_report_3wm',
      full_name: BQ_CONFIG.TABLE_SAP_REPORT_3WM,
      role: 'Consolidación SAP 3WM & Aforos Sociedad 6202',
      cadence_label: 'Diaria (Post-Cierre SAP 24h)',
      cache_ttl_hours: 6,
      last_modified_iso: null,
      row_count: null,
      status: 'ACTIVA_CACHE_INTELIGENTE'
    },
    {
      id: 'cl_dmarts_purchase_orders',
      full_name: BQ_CONFIG.DATASET_PO,
      role: 'Respaldo en Vivo OCs del Día (Data Origins)',
      cadence_label: 'Tiempo casi real (15–60 min)',
      cache_ttl_hours: 1,
      last_modified_iso: null,
      row_count: null,
      status: 'RESPALDO_TIEMPO_REAL'
    }
  ];

  // Intentar leer last_modified_time desde metadatos de BigQuery (0 bytes de escaneo de tabla)
  const metaSql = `
    SELECT
      'purchase_orders_sku_level' AS tbl_id,
      TIMESTAMP_MILLIS(last_modified_time) AS last_modified_ts,
      row_count
    FROM \`peya-datamarts-pro.dm_dmarts.__TABLES__\`
    WHERE table_id = 'purchase_orders_sku_level'
    UNION ALL
    SELECT
      'sap_report_3wm' AS tbl_id,
      TIMESTAMP_MILLIS(last_modified_time) AS last_modified_ts,
      row_count
    FROM \`peya-datamarts-pro.dm_fintech.__TABLES__\`
    WHERE table_id = 'sap_report_3wm'
  `;

  try {
    const metaRows = executeBigQuerySql(metaSql);
    if (metaRows && Array.isArray(metaRows) && metaRows.length > 0) {
      const props = PropertiesService.getScriptProperties();
      const prevSignature = props.getProperty('BQ_LAST_MODIFIED_SIGNATURE') || '';
      const sigParts = [];

      metaRows.forEach(r => {
        const target = tablesCatalog.find(t => t.id === r.tbl_id);
        if (target && r.last_modified_ts) {
          target.last_modified_iso = String(r.last_modified_ts);
          target.row_count = Number(r.row_count) || null;
          sigParts.push(`${r.tbl_id}:${r.last_modified_ts}`);
        }
      });

      const newSignature = sigParts.sort().join('|');
      if (newSignature && prevSignature && newSignature !== prevSignature) {
        // Las tablas se refrescaron en BigQuery -> rotar epoch de caché automáticamente
        props.setProperty('BQ_CACHE_EPOCH', 'v' + new Date().getTime());
        Logger.log('🔄 [BigQuery Smart Cache] Nuevo refresco detectado en BigQuery (' + newSignature + '). Caché rotada automáticamente.');
      }
      if (newSignature) {
        props.setProperty('BQ_LAST_MODIFIED_SIGNATURE', newSignature);
      }
    }
  } catch (eMeta) {
    Logger.log('Aviso consultando metadatos __TABLES__ de BigQuery: ' + eMeta.message);
  }

  const result = {
    checked_at: new Date().toISOString(),
    cache_epoch: _getBqCacheEpoch(),
    tables: tablesCatalog,
    telemetry: getBigQueryConsumptionTelemetry()
  };

  if (cache) {
    try {
      cache.put('BQ_TABLES_FRESHNESS_STATUS', JSON.stringify(result), BQ_CONFIG.CACHE_TTL_SECONDS.METADATA_CHECK);
    } catch (e) {}
  }

  return result;
}

/**
 * Devuelve las métricas de ahorro de consumo de BigQuery y estado de caché.
 */
function getBigQueryConsumptionTelemetry() {
  let persistedStats = {};
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('BQ_TELEMETRY_STATS');
    if (raw) persistedStats = JSON.parse(raw);
  } catch (e) {}

  const queriesExec = (Number(persistedStats.queries_executed) || 0) + BQ_RUNTIME_TELEMETRY_DELTA.queries_executed;
  const queriesSaved = (Number(persistedStats.queries_saved_by_cache) || 0) + BQ_RUNTIME_TELEMETRY_DELTA.queries_saved_by_cache;
  const posCached = (Number(persistedStats.pos_served_from_cache) || 0) + BQ_TELEMETRY.pos_served_from_cache;
  const posLive = (Number(persistedStats.pos_queried_live) || 0) + BQ_TELEMETRY.pos_queried_live;
  const originHits = (Number(persistedStats.origin_fallback_hits) || 0) + BQ_TELEMETRY.origin_fallback_hits;
  const totalLookups = posCached + posLive;
  const cacheHitPct = totalLookups > 0 ? Math.round((posCached / totalLookups) * 100) : 100;

  return {
    queries_executed: queriesExec,
    queries_saved_by_cache: queriesSaved,
    pos_served_from_cache: posCached,
    pos_queried_live: posLive,
    origin_fallback_hits: originHits,
    cache_hit_rate_pct: cacheHitPct,
    last_query_at: BQ_TELEMETRY.last_query_at || persistedStats.last_query_at || null
  };
}

const BQ_RUNTIME_TELEMETRY_DELTA = {
  queries_executed: 0,
  queries_saved_by_cache: 0
};

function _flushBqTelemetry() {
  try {
    const props = PropertiesService.getScriptProperties();
    const current = getBigQueryConsumptionTelemetry();
    props.setProperty('BQ_TELEMETRY_STATS', JSON.stringify(current));
    BQ_RUNTIME_TELEMETRY_DELTA.queries_executed = 0;
    BQ_RUNTIME_TELEMETRY_DELTA.queries_saved_by_cache = 0;
    BQ_TELEMETRY.pos_served_from_cache = 0;
    BQ_TELEMETRY.pos_queried_live = 0;
    BQ_TELEMETRY.origin_fallback_hits = 0;
  } catch (e) {}
}

/**
 * Ejecuta una consulta SQL en BigQuery devolviendo un array de objetos con las filas resultantes.
 * @param {string} sql Consulta SQL en dialecto estándar
 * @param {string} projectId ID de proyecto para facturación de la query
 */
function executeBigQuerySql(sql, projectId) {
  const billingProject = projectId || BQ_CONFIG.BILLING_PROJECT_ID;

  // Método 1: Intentar Servicio Avanzado de BigQuery si está habilitado en GAS
  if (typeof BigQuery !== 'undefined' && BigQuery.Jobs && BigQuery.Jobs.query) {
    try {
      const request = {
        query: sql,
        useLegacySql: false,
        timeoutMs: 15000
      };
      let response = BigQuery.Jobs.query(request, billingProject);
      if (response && response.jobComplete === false && response.jobReference && response.jobReference.jobId) {
        let retries = 0;
        while (!response.jobComplete && retries < 8) {
          Utilities.sleep(1000);
          response = BigQuery.Jobs.getQueryResults(billingProject, response.jobReference.jobId);
          retries++;
        }
      }
      return parseBqAdvancedResponse(response);
    } catch (e) {
      Logger.log('Fallo servicio avanzado BigQuery, intentando fallback REST: ' + e.message);
    }
  }

  // Método 2: Fallback vía BigQuery REST API con ScriptApp.getOAuthToken()
  return executeBigQueryRestApi(sql, billingProject);
}

/**
 * Fallback directo mediante la REST API de Google Cloud BigQuery.
 */
function executeBigQueryRestApi(sql, billingProject) {
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${billingProject}/queries`;
  const token = ScriptApp.getOAuthToken();

  const payload = {
    query: sql,
    useLegacySql: false,
    timeoutMs: 15000
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  let content = JSON.parse(response.getContentText());

  if (code >= 400 || content.error) {
    const errMsg = content.error ? content.error.message : response.getContentText();
    throw new Error(`Error en BigQuery REST API (${code}): ${errMsg}`);
  }

  // Si la consulta sigue procesándose (jobComplete: false), hacer polling
  if (content && content.jobComplete === false && content.jobReference && content.jobReference.jobId) {
    const pollUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${billingProject}/queries/${content.jobReference.jobId}`;
    const pollOptions = {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    };
    let retries = 0;
    while (content.jobComplete === false && retries < 8) {
      Utilities.sleep(1000);
      const pollRes = UrlFetchApp.fetch(pollUrl, pollOptions);
      content = JSON.parse(pollRes.getContentText());
      retries++;
    }
  }

  return parseBqRestResponse(content);
}

/**
 * Parsea la respuesta de BigQuery (tanto REST API como Servicio Avanzado)
 * convirtiendo el esquema de campos y filas en una lista de objetos JS limpios.
 */
function parseBqRestResponse(content) {
  if (!content || !content.rows || !content.schema || !content.schema.fields) {
    return [];
  }
  const fields = content.schema.fields.map(f => f.name);
  return content.rows.map(row => {
    const obj = {};
    if (row.f && Array.isArray(row.f)) {
      row.f.forEach((cell, idx) => {
        obj[fields[idx]] = cell.v;
      });
    }
    return obj;
  });
}

function parseBqAdvancedResponse(response) {
  return parseBqRestResponse(response);
}

/**
 * Normalización ÚNICA de números de Orden de Compra (reutilizada por Axteroid, BigQuery y Sheets).
 * Orden: 1) quita prefijo PO/OC, 2) quita prefijo de proveedor 002 (ej. Avícola El Toco: 002529067),
 * 3) quita ceros a la izquierda.  'PO529067' | '002529067' | '0000529067' => '529067'
 * @param {string|number} raw
 * @return {string}
 */
function normalizePo(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  s = s.replace(/^(PO|OC)/, '');
  s = s.replace(/^002(?=[1-9]\d{4,}$)/, '');
  s = s.replace(/^0+/, '');
  return s;
}

/**
 * Expresión SQL equivalente a normalizePo() para una columna (misma lógica en BigQuery).
 * @param {string} col Nombre de columna (ej: 'po_number', 'po.po_order_id')
 */
function normalizePoSql(col) {
  return "REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(TRIM(CAST(" + col + " AS STRING))), r'^(PO|OC)', ''), r'^002([1-9][0-9]{4,})$', r'\1'), r'^0+', '')";
}

/**
 * Extrae el número base de 6 dígitos de una OC. Usa normalizePo() y, si el resultado no es de 6 dígitos
 * (ej: Agrosuper 000052348939 o Colún 5238316 con sufijo de tienda), extrae el patrón base.
 * @param {string|number} poStr Texto o número de OC
 * @return {string} Dígitos base de la OC (ej: '523489')
 */
function extraerPoBaseDigits(poStr) {
  if (!poStr) return '';
  const clean = String(poStr).trim().toUpperCase().replace(/\s+/g, '');
  if (/^45\d{8}$/.test(clean)) return clean; // SAP 10 dígitos legacy
  const norm = normalizePo(clean);
  if (/^\d{6}$/.test(norm)) return norm;
  const m = clean.match(/(?:PO|OC|ORDEN|0+)?([3-58]\d{5})/);
  if (m) return m[1];
  return norm.replace(/^ORDEN/, '').replace(/^0+/, '');
}

/**
 * Consulta en lote la tabla oficial de consolidación Factura vs POs (SAP 3WM Fintech)
 * para un conjunto de números base de PO de la Sociedad 6202 (Chile).
 * @param {Array<string>} digitsList Lista de números base de PO (ej: ['521257', '527477'])
 * @returns {Object.<string, Object>} Mapa de resultados 3WM indexado por dígito base
 */
function getSap3wmReportMassive(digitsList) {
  if (!digitsList || digitsList.length === 0) return {};
  const cleanDigits = Array.from(new Set(digitsList.map(d => String(d).replace(/\D/g, '').trim()).filter(Boolean)));
  if (cleanDigits.length === 0) return {};

  const inDigitsSql = cleanDigits.map(d => `'${d}'`).join(', ');
  const sql = `
    SELECT
      company_code,
      vendor_id,
      todas_pos_relacionadas,
      total_invoice_associated_cost,
      total_po_amount,
      total_difference,
      documento_aforo,
      monto_aforo,
      status_aforo
    FROM \`${BQ_CONFIG.TABLE_SAP_REPORT_3WM}\`
    WHERE company_code = '${BQ_CONFIG.COMPANY_CODE}'
      AND ${normalizePoSql('todas_pos_relacionadas')} IN (${inDigitsSql})
    ORDER BY total_po_amount DESC;
  `;

  const sapMap = {};
  try {
    const rows = executeBigQuerySql(sql);
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        const rawPos = String(r.todas_pos_relacionadas || '');
        const matches = rawPos.match(/\d{5,10}/g) || [];
        matches.forEach(d => {
          const cleanD = extraerPoBaseDigits(d) || d;
          if (cleanD && !sapMap[cleanD]) {
            sapMap[cleanD] = {
              found: true,
              company_code: r.company_code,
              vendor_id: r.vendor_id,
              todas_pos_relacionadas: r.todas_pos_relacionadas,
              total_invoice_associated_cost: parseFloat(r.total_invoice_associated_cost || '0') || 0,
              total_po_amount: parseFloat(r.total_po_amount || '0') || 0,
              total_difference: parseFloat(r.total_difference || '0') || 0,
              documento_aforo: r.documento_aforo || null,
              monto_aforo: parseFloat(r.monto_aforo || '0') || 0,
              status_aforo: r.status_aforo || null
            };
          }
        });
      });
    }
  } catch (e) {
    Logger.log('Aviso consultando sap_report_3wm masivo: ' + e.message);
  }

  return sapMap;
}

/**
 * Consulta la tabla oficial de consolidación Factura vs POs (SAP 3WM Fintech)
 * para Sociedad 6202 (Chile) por número de PO o Folio.
 * Redirige a la consulta masiva para evitar consultas individuales aisladas.
 * @param {string} poNumber Número de Orden de Compra (ej: '527477', 'PO527477')
 * @returns {Object|null} Resumen contable 3WM registrado en SAP
 */
function getSap3wmReportByPo(poNumber) {
  if (!poNumber) return null;
  const clean = String(poNumber).trim().toUpperCase().replace(/\s+/g, '');
  const digits = extraerPoBaseDigits(clean) || clean.replace(/\D/g, '');
  if (!digits) return null;
  const map = getSap3wmReportMassive([digits]);
  return map[digits] || null;
}

/**
 * Consulta MASIVA oficial de Órdenes de Compra y SKUs recepcionados en BigQuery.
 * Ejecuta en un solo job la consulta oficial del bot de automatización normalizada por país ('Chile') y POs,
 * convirtiendo automáticamente pesables (kg vs gr) y consolidando con SAP 3WM en lote.
 * 
 * @param {Array<string>|string} poNumbersList Lista o número de POs a conciliar
 * @returns {Object.<string, Object>} Diccionario de POs indexado por po_number y dígitos base
 */
function getMassivePurchaseOrders(poNumbersList, options) {
  options = options || {};
  const forceRefresh = Boolean(options.forceRefresh);
  const rawList = Array.isArray(poNumbersList) ? poNumbersList : [poNumbersList];
  const candidateSet = new Set();
  const digitsSet = new Set();
  const resultMap = {};

  rawList.forEach(p => {
    if (!p) return;
    const clean = String(p).trim().toUpperCase().replace(/\s+/g, '');
    const rawNum = clean.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
    const digits = extraerPoBaseDigits(clean) || rawNum;

    // 0. Consultar Caché Inteligente por PO antes de armar la query a BigQuery
    if (!forceRefresh && digits) {
      const cachedPo = _getCachedPoItem('FULL', digits);
      if (cachedPo && cachedPo.po_found) {
        resultMap[clean] = cachedPo;
        resultMap['PO' + digits] = cachedPo;
        resultMap[digits] = cachedPo;
        resultMap['0000' + digits] = cachedPo;
        return;
      }
    }

    if (clean) candidateSet.add(clean);
    if (digits) {
      digitsSet.add(digits);
      candidateSet.add(digits);
      candidateSet.add('PO' + digits);
      candidateSet.add('0000' + digits);
      candidateSet.add('PO0000' + digits);
      candidateSet.add(digits.padStart(10, '0'));
    }
    if (rawNum) {
      candidateSet.add(rawNum);
      candidateSet.add('PO' + rawNum);
    }
  });

  const inValues = Array.from(candidateSet).filter(Boolean);
  if (inValues.length === 0) {
    if (Object.keys(resultMap).length > 0) {
      BQ_RUNTIME_TELEMETRY_DELTA.queries_saved_by_cache++;
      _flushBqTelemetry();
    }
    return resultMap;
  }

  BQ_TELEMETRY.pos_queried_live += digitsSet.size;
  BQ_RUNTIME_TELEMETRY_DELTA.queries_executed++;
  BQ_TELEMETRY.last_query_at = new Date().toISOString();

  const inValuesSql = inValues.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
  const inDigitsSql = Array.from(digitsSet).filter(Boolean).map(d => `'${d.replace(/'/g, "\\'")}'`).join(', ');

  // 1. Obtener consolidación contable SAP 3WM en lote
  const sap3wmMap = getSap3wmReportMassive(Array.from(digitsSet));

  // 2. Consulta oficial masiva del bot (dmarts.purchase_orders_sku_level + il_qcommerce.dim_vendor_product)
  const sqlBot = `
    WITH po_sku AS (
      SELECT
        po_number,
        store_name,
        sku_id,
        barcode,
        product_name,
        IFNULL(received_qty, 0) AS received_qty,
        IFNULL(ordered_qty, 0) AS ordered_qty,
        unit_cost_after_discount_lc,
        IFNULL(internal_tax_lc, 0) AS internal_tax_lc,
        country_name
      FROM \`${BQ_CONFIG.TABLE_PO_SKU_LEVEL}\`
      WHERE po_creation_date >= DATE('2024-01-01')
        AND country_name = 'Chile'
        AND (
          po_number IN (${inValuesSql})
          ${inDigitsSql ? `OR ${normalizePoSql('po_number')} IN (${inDigitsSql})` : ''}
        )
    ),
    sku_weightable AS (
      SELECT DISTINCT
        sku,
        is_weightable,
        barcodes AS EAN
      FROM \`${BQ_CONFIG.TABLE_DIM_VENDOR_PRODUCT}\`
    ),
    sku_final AS (
      SELECT
        p.* EXCEPT (sku_id),
        p.sku_id,
        s.EAN,
        -- Normalización para pesables (kg vs gr)
        CASE WHEN s.is_weightable = TRUE THEN p.received_qty / 1000 ELSE p.received_qty END AS received_qty_final,
        CASE WHEN s.is_weightable = TRUE THEN p.ordered_qty / 1000 ELSE p.ordered_qty END AS ordered_qty_final,
        CASE WHEN s.is_weightable = TRUE THEN p.unit_cost_after_discount_lc * 1000 ELSE p.unit_cost_after_discount_lc END AS unit_cost_after_discount_lc_final,
        CASE WHEN s.is_weightable = TRUE THEN p.internal_tax_lc * 1000 ELSE p.internal_tax_lc END AS internal_tax_lc_final,
        CASE WHEN s.is_weightable = TRUE THEN 'PESABLE' ELSE 'UNIDAD' END AS product_type
      FROM po_sku p
      LEFT JOIN sku_weightable s ON p.sku_id = s.sku
    )
    SELECT
      po_number,
      store_name,
      sku_id,
      IFNULL(barcode, EAN) AS barcode,
      product_name,
      product_type,
      received_qty_final,
      ordered_qty_final,
      unit_cost_after_discount_lc_final,
      internal_tax_lc_final AS internal_tax_lc,
      ROUND((IFNULL(unit_cost_after_discount_lc_final, 0) + IFNULL(internal_tax_lc_final, 0)) * IFNULL(received_qty_final, 0), 2) AS total_amount_lc
    FROM sku_final
    WHERE country_name = 'Chile'
      AND (
        po_number IN (${inValuesSql})
        ${inDigitsSql ? `OR ${normalizePoSql('po_number')} IN (${inDigitsSql})` : ''}
      )
  `;

  let rows = [];
  try {
    rows = executeBigQuerySql(sqlBot);
  } catch (eBq) {
    Logger.log('Aviso consultando lote de POs en BigQuery: ' + eBq.message);
  }

  // 3. Agrupar filas devueltas por PO
  const poGroups = {};
  rows.forEach(r => {
    const rawPo = String(r.po_number || '').trim().toUpperCase();
    const digits = extraerPoBaseDigits(rawPo) || rawPo.replace(/\D/g, '');
    const key = digits || rawPo;
    if (!poGroups[key]) {
      poGroups[key] = {
        po_number: rawPo,
        digits: digits,
        rows: []
      };
    }
    poGroups[key].rows.push(r);
  });

  Object.keys(poGroups).forEach(key => {
    const group = poGroups[key];
    const poRows = group.rows;
    const poHeader = poRows[0];
    const digits = group.digits;
    const formattedPo = 'PO' + (digits || group.po_number);

    const sap3wm = (digits && sap3wmMap[digits]) || null;
    const sapDiff = (sap3wm && sap3wm.total_difference !== null && sap3wm.total_difference !== undefined)
      ? Math.round(sap3wm.total_difference)
      : null;
    const sapMontoAforo = (sap3wm && sap3wm.monto_aforo) ? Math.round(sap3wm.monto_aforo) : 0;
    const sapDocAforo = (sap3wm && sap3wm.documento_aforo) || null;
    const sapStatusAforo = (sap3wm && sap3wm.status_aforo) || (sapMontoAforo > 0 ? 'APLICADO_SAP_3WM' : 'NO_APLICA');

    // Totales calculados a partir de los datos normalizados
    const totalRec = poRows.reduce((sum, r) => sum + (parseFloat(r.total_amount_lc) || 0), 0);
    const totalOrd = totalRec;
    const diffFinal = (sapDiff !== null) ? sapDiff : 0;

    const items = poRows.map(r => {
      const qDel = parseFloat(r.received_qty_final || '0') || 0;
      const costUnit = parseFloat(r.unit_cost_after_discount_lc_final || '0') || 0;
      const internalTax = parseFloat(r.internal_tax_lc || '0') || 0;
      const totAmount = parseFloat(r.total_amount_lc || '0') || Math.round((costUnit + internalTax) * qDel * 100) / 100;
      const rawBarcode = r.barcode || '';
      const productType = r.product_type || 'UNIDAD';
      // Cantidad y monto ORDENADOS (con descuento, sin impuesto): sirven para emparejar líneas de factura con la OC por monto
      const qOrdReal = parseFloat(r.ordered_qty_final || '0') || 0;

      return {
        po_number: r.po_number || formattedPo,
        store_name: r.store_name || 'CH_36_CD_Chile',
        sku_id: r.sku_id,
        barcode: rawBarcode || null,
        product_name: r.product_name,
        product_type: productType,
        is_weightable: productType === 'PESABLE',
        ordered_qty_real: qOrdReal,
        ordered_amount_after_discount: Math.round(qOrdReal * costUnit * 100) / 100,
        received_qty_final: qDel,
        unit_cost_after_discount_lc_final: costUnit,
        internal_tax_lc: internalTax,
        total_amount_lc: totAmount,
        supplier_sku: null,
        quantity_ordered: qDel,
        quantity_delivered: qDel,
        cost_unit_lc: costUnit,
        amt_ordered_lc: totAmount,
        amt_delivered_lc: totAmount,
        dif_ml: 0,
        diferencia_ml: 0,
        barcodes: rawBarcode ? [rawBarcode] : []
      };
    });

    const poEntry = {
      po_found: true,
      po_order_id: formattedPo,
      po_number: group.po_number || formattedPo,
      warehouse_name: poHeader.store_name || 'CH_36_CD_Chile',
      store_name: poHeader.store_name || 'CH_36_CD_Chile',
      supplier_name: 'Proveedor',
      supplier_tax_id: (sap3wm && sap3wm.vendor_id) || null,
      order_status: 'DELIVERED',
      created_at: null,
      received_at: null,
      base_digits: digits,
      invoice_numbers: [],
      total_ordenado_neto: Math.round(totalOrd),
      total_recepcionado_neto: Math.round(totalRec),
      amt_ordered_lc: Math.round(totalOrd),
      amt_delivered_lc: Math.round(totalRec),
      diferencia_preliminar_clp: diffFinal,
      dif_ml: diffFinal,
      diferencia_ml: diffFinal,
      monto_aforo: sapMontoAforo,
      documento_aforo: sapDocAforo,
      status_aforo: sapStatusAforo,
      aforo_info: sap3wm ? {
        aplica_aforo: sapMontoAforo > 0 || Boolean(sapDocAforo),
        condicion_aforo: sapStatusAforo,
        monto_aforo: sapMontoAforo,
        monto_aforado: sapMontoAforo,
        monto_retenido_aforo: sapMontoAforo,
        documento_aforo: sapDocAforo,
        status_aforo: sapStatusAforo,
        total_difference_sap: sap3wm.total_difference
      } : null,
      sap_3wm: sap3wm,
      items: items
    };

    resultMap[group.po_number] = poEntry;
    resultMap[formattedPo] = poEntry;
    if (digits) {
      resultMap[digits] = poEntry;
      resultMap['0000' + digits] = poEntry;
      _setCachedPoItem('FULL', digits, poEntry, BQ_CONFIG.CACHE_TTL_SECONDS.PO_SKU_LEVEL);
    }
  });

  // 4. Fallback en Tiempo Real a Data Origins (peya-data-origins-pro.cl_dmarts.purchase_orders)
  // para OCs recién recepcionadas en el día que aún no entran al batch de 4-6h de purchase_orders_sku_level
  const missingDigits = Array.from(digitsSet).filter(d => d && !resultMap[d]);
  if (missingDigits.length > 0) {
    try {
      const originFallbackMap = getOriginPurchaseOrdersFallback(missingDigits, sap3wmMap);
      Object.keys(originFallbackMap).forEach(k => {
        resultMap[k] = originFallbackMap[k];
      });
    } catch (eOrig) {
      Logger.log('Aviso en fallback de tiempo real cl_dmarts.purchase_orders: ' + eOrig.message);
    }
  }

  _flushBqTelemetry();
  return resultMap;
}

/**
 * Fallback en tiempo casi real a la tabla de origen `peya-data-origins-pro.cl_dmarts.purchase_orders`
 * cuando una OC del mismo día aún no se ha materializado en `dm_dmarts.purchase_orders_sku_level`.
 */
function getOriginPurchaseOrdersFallback(missingDigitsList, sap3wmMap) {
  if (!missingDigitsList || missingDigitsList.length === 0) return {};
  sap3wmMap = sap3wmMap || {};
  const candList = [];
  const inDigitsList = [];
  missingDigitsList.forEach(d => {
    candList.push(`'${d}'`, `'PO${d}'`, `'0000${d}'`, `'002${d}'`, `'OC${d}'`);
    inDigitsList.push(`'${d}'`);
  });
  const inOrigSql = Array.from(new Set(candList)).join(', ');
  const inDigitsSql = Array.from(new Set(inDigitsList)).join(', ');

  const sqlOrigin = `
    SELECT
      po.po_order_id AS po_number,
      po.warehouse.warehouse_name AS store_name,
      po.supplier_name,
      p.sku_id,
      p.product_name,
      IFNULL(p.quantity_ordered, 0) AS quantity_ordered,
      IFNULL(p.quantity_delivered, 0) AS received_qty_final,
      -- Costo CON descuento de la OC (igual que dm_dmarts.purchase_orders_sku_level). unit_cost_lc es el costo SIN descuento
      -- y amt_delivered_lc también viene sin descuento: usarlos sobrestimaba lo recepcionado por el descuento comercial.
      CAST(IFNULL(p.item_values_lc.unit_cost_after_discount_lc, IFNULL(p.item_values_lc.unit_cost_lc, 0)) AS FLOAT64) AS unit_cost_after_discount_lc_final,
      CAST(IFNULL(p.internal_tax, 0) AS FLOAT64) AS internal_tax_lc,
      (CAST(IFNULL(p.item_values_lc.unit_cost_after_discount_lc, IFNULL(p.item_values_lc.unit_cost_lc, 0)) AS FLOAT64)
        + CAST(IFNULL(p.internal_tax, 0) AS FLOAT64)) * IFNULL(p.quantity_delivered, 0) AS total_amount_lc,
      ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(p.product.barcodes)), ', ') AS barcode
    FROM \`${BQ_CONFIG.DATASET_PO}\` po,
    UNNEST(po.products_purchased) AS p
    WHERE po.created_localtime_at >= '2024-01-01'
      AND po.country_code = 'cl'
      AND (
        po.po_order_id IN (${inOrigSql})
        ${inDigitsSql ? `OR ${normalizePoSql('po.po_order_id')} IN (${inDigitsSql})` : ''}
      )
  `;

  const rows = executeBigQuerySql(sqlOrigin);
  if (!rows || rows.length === 0) return {};

  const groups = {};
  rows.forEach(r => {
    const rawPo = String(r.po_number || '').trim().toUpperCase();
    const digits = extraerPoBaseDigits(rawPo) || rawPo.replace(/\D/g, '');
    const key = digits || rawPo;
    if (!groups[key]) groups[key] = { po_number: rawPo, digits: digits, rows: [] };
    groups[key].rows.push(r);
  });

  const out = {};
  Object.keys(groups).forEach(key => {
    const g = groups[key];
    const poRows = g.rows;
    const h = poRows[0];
    const digits = g.digits;
    const formattedPo = 'PO' + (digits || g.po_number);
    const sap3wm = (digits && sap3wmMap[digits]) || null;
    const totalRec = poRows.reduce((s, r) => s + (parseFloat(r.total_amount_lc) || 0), 0);

    const items = poRows.map(r => {
      const qDel = parseFloat(r.received_qty_final || '0') || 0;
      const costUnit = parseFloat(r.unit_cost_after_discount_lc_final || '0') || 0;
      const internalTax = parseFloat(r.internal_tax_lc || '0') || 0;
      const totAmount = parseFloat(r.total_amount_lc || '0') || Math.round((costUnit + internalTax) * qDel);
      const qOrdReal = parseFloat(r.quantity_ordered || '0') || 0;
      return {
        po_number: formattedPo,
        store_name: r.store_name || 'CH_36_CD_Chile',
        sku_id: r.sku_id,
        barcode: r.barcode || null,
        product_name: r.product_name,
        product_type: 'UNIDAD',
        is_weightable: false,
        ordered_qty_real: qOrdReal,
        ordered_amount_after_discount: Math.round(qOrdReal * costUnit * 100) / 100,
        received_qty_final: qDel,
        unit_cost_after_discount_lc_final: costUnit,
        internal_tax_lc: internalTax,
        total_amount_lc: totAmount,
        supplier_sku: null,
        quantity_ordered: parseFloat(r.quantity_ordered || '0') || qDel,
        quantity_delivered: qDel,
        cost_unit_lc: costUnit,
        amt_ordered_lc: totAmount,
        amt_delivered_lc: totAmount,
        dif_ml: 0,
        diferencia_ml: 0,
        barcodes: r.barcode ? [r.barcode] : []
      };
    });

    const entry = {
      po_found: true,
      source_table: BQ_CONFIG.DATASET_PO,
      po_order_id: formattedPo,
      po_number: formattedPo,
      warehouse_name: h.store_name || 'CH_36_CD_Chile',
      store_name: h.store_name || 'CH_36_CD_Chile',
      supplier_name: h.supplier_name || 'Proveedor',
      supplier_tax_id: (sap3wm && sap3wm.vendor_id) || null,
      order_status: 'DELIVERED',
      base_digits: digits,
      invoice_numbers: [],
      total_ordenado_neto: Math.round(totalRec),
      total_recepcionado_neto: Math.round(totalRec),
      amt_ordered_lc: Math.round(totalRec),
      amt_delivered_lc: Math.round(totalRec),
      diferencia_preliminar_clp: (sap3wm && sap3wm.total_difference) ? Math.round(sap3wm.total_difference) : 0,
      dif_ml: (sap3wm && sap3wm.total_difference) ? Math.round(sap3wm.total_difference) : 0,
      diferencia_ml: (sap3wm && sap3wm.total_difference) ? Math.round(sap3wm.total_difference) : 0,
      monto_aforo: (sap3wm && sap3wm.monto_aforo) ? Math.round(sap3wm.monto_aforo) : 0,
      documento_aforo: (sap3wm && sap3wm.documento_aforo) || null,
      status_aforo: (sap3wm && sap3wm.status_aforo) || 'NO_APLICA',
      sap_3wm: sap3wm,
      items: items
    };

    BQ_TELEMETRY.origin_fallback_hits++;
    out[formattedPo] = entry;
    if (digits) {
      out[digits] = entry;
      out['0000' + digits] = entry;
      _setCachedPoItem('FULL', digits, entry, 3600);
    }
  });

  return out;
}

/**
 * Consulta el detalle completo de una Orden de Compra y sus SKUs recepcionados.
 * Redirige a la consulta MASIVA oficial del bot para garantizar la normalización de pesables
 * y eliminar todas las consultas individuales aisladas.
 * @param {string} poNumber Número de orden de compra (ej: 'PO521257', '521257')
 */
function getPurchaseOrderItems(poNumber) {
  if (!poNumber) return null;
  const clean = String(poNumber).trim().toUpperCase().replace(/\s+/g, '');
  const digits = extraerPoBaseDigits(clean) || clean.replace(/\D/g, '');
  
  const map = getMassivePurchaseOrders([poNumber]);
  return map[clean] || map['PO' + digits] || map[digits] || {
    po_found: false,
    po_number: poNumber,
    base_digits: digits,
    items: [],
    sap_3wm: null
  };
}

/**
 * Busca productos y su homologación completa (SKU PedidosYa, EAN y Código Factura Proveedor)
 * priorizando la tabla maestra `peya-bi-tools-pro.il_qcommerce.dim_vendor_product` con respaldo en `products_suppliers`.
 * @param {string} term Término de búsqueda (SKU, EAN, Cód. Factura o Nombre)
 * @param {string} supplierTaxId RUT opcional del proveedor (ej: '96591040-9')
 * @param {number} maxRows Límite de resultados
 */
function searchProductHomologation(term, supplierTaxId, maxRows) {
  const cleanTerm = (term || '').trim().replace(/'/g, "\\'");
  const limit = maxRows || 100;

  // 1. Priorizar tabla maestra oficial: peya-bi-tools-pro.il_qcommerce.dim_vendor_product
  let vpWhere = ["vp.vendor_Product_id IS NOT NULL"];
  if (supplierTaxId) {
    const cleanTaxId = supplierTaxId.trim().replace(/'/g, "\\'");
    vpWhere.push(`vp.vendor_rut = '${cleanTaxId}'`);
  }
  if (cleanTerm) {
    const isNumericOnly = /^\d+$/.test(cleanTerm);
    if (isNumericOnly) {
      vpWhere.push(`(
        vp.vendor_Product_id = '${cleanTerm}'
        OR vp.sku = '${cleanTerm}'
        OR vp.barcode = '${cleanTerm}'
        OR vp.barcode LIKE '%${cleanTerm}%'
      )`);
    } else {
      vpWhere.push(`(
        LOWER(vp.sku) = LOWER('${cleanTerm}')
        OR LOWER(vp.vendor_Product_id) = LOWER('${cleanTerm}')
        OR LOWER(vp.product_name) LIKE LOWER('%${cleanTerm}%')
      )`);
    }
  }

  const sqlDimVendor = `
    SELECT 
      vp.sku as sku_pedidosya,
      ANY_VALUE(vp.product_name) as descripcion_pedidosya,
      vp.vendor_name as proveedor,
      vp.vendor_rut as rut_proveedor,
      vp.vendor_Product_id as codigo_factura_proveedor,
      STRING_AGG(DISTINCT vp.barcode, ', ') as ean_barcodes
    FROM \`${BQ_CONFIG.DATASET_DIM_VENDOR_PRODUCT}\` vp
    WHERE ${vpWhere.join(' AND ')}
    GROUP BY vp.sku, vp.vendor_name, vp.vendor_rut, vp.vendor_Product_id
    ORDER BY descripcion_pedidosya ASC
    LIMIT ${limit};
  `;

  try {
    const rowsVp = executeBigQuerySql(sqlDimVendor);
    if (rowsVp && rowsVp.length > 0) return rowsVp;
  } catch (eVp) {
    Logger.log('Aviso consultando dim_vendor_product en searchProductHomologation: ' + eVp.message);
  }

  // 2. Respaldo en tabla origen legacy: peya-data-origins-pro.cl_dmarts.products_suppliers
  let whereClauses = ["ps.country_code = 'cl'", "s.supplier_sku IS NOT NULL"];

  if (supplierTaxId) {
    const cleanTaxId = supplierTaxId.trim().replace(/'/g, "\\'");
    whereClauses.push(`s.supplier_tax_id = '${cleanTaxId}'`);
  }

  if (cleanTerm) {
    const isNumericOnly = /^\d+$/.test(cleanTerm);
    if (isNumericOnly) {
      whereClauses.push(`(
        s.supplier_sku = '${cleanTerm}'
        OR ps.sku = '${cleanTerm}'
        OR EXISTS(SELECT 1 FROM UNNEST(cat.barcodes) b WHERE b.barcode = '${cleanTerm}' OR b.barcode LIKE '%${cleanTerm}%')
      )`);
    } else {
      whereClauses.push(`(
        LOWER(ps.sku) = LOWER('${cleanTerm}')
        OR LOWER(s.supplier_sku) = LOWER('${cleanTerm}')
        OR LOWER(ps.name) LIKE LOWER('%${cleanTerm}%')
      )`);
    }
  }

  const sql = `
    SELECT 
      ps.sku as sku_pedidosya,
      ANY_VALUE(ps.name) as descripcion_pedidosya,
      s.supplier_name as proveedor,
      s.supplier_tax_id as rut_proveedor,
      s.supplier_sku as codigo_factura_proveedor,
      ANY_VALUE(ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(cat.barcodes)), ', ')) as ean_barcodes
    FROM \`${BQ_CONFIG.DATASET_HOMOLOGATION}\` ps
    JOIN \`${BQ_CONFIG.DATASET_CATALOG}\` cat 
      ON ps.sku = cat.sku AND cat.country_code = 'cl',
    UNNEST(ps.suppliers) as s
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY ps.sku, s.supplier_name, s.supplier_tax_id, s.supplier_sku
    ORDER BY descripcion_pedidosya ASC
    LIMIT ${limit};
  `;

  return executeBigQuerySql(sql);
}

/**
 * Obtiene el catálogo maestro de homologación para exportación masiva o consulta tabular,
 * priorizando `peya-bi-tools-pro.il_qcommerce.dim_vendor_product`.
 * @param {string} supplierTaxId RUT opcional del proveedor
 * @param {number} limit Límite de filas
 */
function getMasterHomologation(supplierTaxId, limit) {
  const maxLimit = limit || 2000;

  let vpWhere = ["vp.vendor_Product_id IS NOT NULL"];
  if (supplierTaxId) {
    const cleanTaxId = supplierTaxId.trim().replace(/'/g, "\\'");
    vpWhere.push(`vp.vendor_rut = '${cleanTaxId}'`);
  }

  const sqlDimVendor = `
    SELECT 
      vp.sku as sku_pedidosya,
      ANY_VALUE(vp.product_name) as descripcion_pedidosya,
      vp.vendor_name as proveedor,
      vp.vendor_rut as rut_proveedor,
      vp.vendor_Product_id as codigo_factura_proveedor,
      STRING_AGG(DISTINCT vp.barcode, ', ') as ean_barcodes
    FROM \`${BQ_CONFIG.DATASET_DIM_VENDOR_PRODUCT}\` vp
    WHERE ${vpWhere.join(' AND ')}
    GROUP BY vp.sku, vp.vendor_name, vp.vendor_rut, vp.vendor_Product_id
    ORDER BY vp.vendor_name ASC, descripcion_pedidosya ASC
    LIMIT ${maxLimit};
  `;

  try {
    const rowsVp = executeBigQuerySql(sqlDimVendor);
    if (rowsVp && rowsVp.length > 0) return rowsVp;
  } catch (eVp) {
    Logger.log('Aviso consultando dim_vendor_product en getMasterHomologation: ' + eVp.message);
  }

  let whereClauses = ["ps.country_code = 'cl'", "s.supplier_sku IS NOT NULL"];

  if (supplierTaxId) {
    const cleanTaxId = supplierTaxId.trim().replace(/'/g, "\\'");
    whereClauses.push(`s.supplier_tax_id = '${cleanTaxId}'`);
  }

  const sql = `
    SELECT 
      ps.sku as sku_pedidosya,
      ANY_VALUE(ps.name) as descripcion_pedidosya,
      s.supplier_name as proveedor,
      s.supplier_tax_id as rut_proveedor,
      s.supplier_sku as codigo_factura_proveedor,
      ANY_VALUE(ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(cat.barcodes)), ', ')) as ean_barcodes
    FROM \`${BQ_CONFIG.DATASET_HOMOLOGATION}\` ps
    JOIN \`${BQ_CONFIG.DATASET_CATALOG}\` cat 
      ON ps.sku = cat.sku AND cat.country_code = 'cl',
    UNNEST(ps.suppliers) as s
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY ps.sku, s.supplier_name, s.supplier_tax_id, s.supplier_sku
    ORDER BY s.supplier_name ASC, descripcion_pedidosya ASC
    LIMIT ${maxLimit};
  `;

  return executeBigQuerySql(sql);
}

/**
 * Consulta en BigQuery el TOP de Órdenes de Compra con mayores diferencias entre
 * lo ordenado, lo entregado físicamente y el reporte SAP 3WM (`purchase_orders_sku_level` + `dim_vendor_product` + `sap_report_3wm`).
 */
function queryTopDiscrepanciesDashboard() {
  const sqlUnified = `
    WITH vp_vendor AS (
      SELECT
        CAST(vendor_id AS STRING) AS vendor_id_str,
        ANY_VALUE(vendor_rut) AS supplier_tax_id
      FROM \`${BQ_CONFIG.DATASET_DIM_VENDOR_PRODUCT}\`
      WHERE vendor_rut IS NOT NULL
      GROUP BY CAST(vendor_id AS STRING)
    ),
    po_agg AS (
      SELECT 
        CAST(po.po_order_id AS STRING) AS po_order_id,
        ANY_VALUE(po.warehouse_name) AS warehouse_name,
        ANY_VALUE(po.supplier_name) AS supplier_name,
        ANY_VALUE(vp.supplier_tax_id) AS supplier_tax_id,
        ANY_VALUE(po.order_status) AS order_status,
        ROUND(SUM(po.quantity_ordered * po.Unit_cost_ordered), 0) AS amt_ordered_lc,
        ROUND(SUM(IFNULL(po.quantity_delivered, 0) * IFNULL(po.unit_price_delivered, po.Unit_cost_ordered)), 0) AS amt_delivered_lc,
        ROUND(SUM((po.quantity_ordered * po.Unit_cost_ordered) - (IFNULL(po.quantity_delivered, 0) * IFNULL(po.unit_price_delivered, po.Unit_cost_ordered))), 0) AS descalce_monto_clp,
        SUM(po.quantity_ordered) AS quantity_ordered,
        SUM(po.quantity_delivered) AS quantity_delivered
      FROM \`${BQ_CONFIG.DATASET_PO_SKU_LEVEL}\` po
      LEFT JOIN vp_vendor vp
        ON CAST(po.supplier_id AS STRING) = vp.vendor_id_str
      WHERE po.country_id = 2
        AND DATE(po.created_localtime_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      GROUP BY CAST(po.po_order_id AS STRING)
      HAVING descalce_monto_clp > 0
    ),
    sap_agg AS (
      SELECT
        ${normalizePoSql('po_number')} AS po_digits,
        MAX(SAFE_CAST(total_difference AS FLOAT64)) AS sap_total_difference,
        MAX(SAFE_CAST(monto_aforo AS FLOAT64)) AS sap_monto_aforo,
        ANY_VALUE(CAST(documento_aforo AS STRING)) AS documento_aforo,
        ANY_VALUE(CAST(status_aforo AS STRING)) AS status_aforo
      FROM \`${BQ_CONFIG.DATASET_SAP_3WM}\`
      GROUP BY po_digits
    )
    SELECT
      p.po_order_id,
      p.warehouse_name,
      p.supplier_name,
      p.supplier_tax_id,
      p.order_status,
      p.amt_ordered_lc,
      p.amt_delivered_lc,
      p.descalce_monto_clp,
      COALESCE(ROUND(s.sap_total_difference, 0), p.descalce_monto_clp) AS dif_ml,
      COALESCE(ROUND(s.sap_monto_aforo, 0), 0) AS monto_aforo,
      s.documento_aforo,
      s.status_aforo,
      p.quantity_ordered,
      p.quantity_delivered
    FROM po_agg p
    LEFT JOIN sap_agg s
      ON ${normalizePoSql('p.po_order_id')} = s.po_digits
    ORDER BY descalce_monto_clp DESC
    LIMIT 100;
  `;

  try {
    const rowsUnified = executeBigQuerySql(sqlUnified);
    if (rowsUnified && rowsUnified.length > 0) {
      const totalRiesgo = rowsUnified.reduce((acc, r) => acc + (Number(r.descalce_monto_clp) || 0), 0);
      return {
        kpis: {
          monto_total_riesgo: totalRiesgo,
          top_po: rowsUnified[0].po_order_id,
          top_po_desc: rowsUnified[0].supplier_name,
          top_proveedor: rowsUnified[0].supplier_name
        },
        top_pos: rowsUnified
      };
    }
  } catch (eUnified) {
    Logger.log('Aviso consultando top discrepancies unificado en BigQuery: ' + eUnified.message);
  }

  return null;
}

/**
 * Consulta un conjunto de POs en BigQuery de forma agregada a nivel de cabecera de OC.
 * Optimizado para enriquecer lotes masivos de cientos o miles de facturas en una sola pasada rápida.
 * @param {Array<string>} poDigitsList Lista de números de PO
 */
function queryMultiplePurchaseOrdersSummary(poDigitsList, options) {
  if (!poDigitsList || poDigitsList.length === 0) return [];
  options = options || {};
  const forceRefresh = Boolean(options.forceRefresh);

  const candidateSet = new Set();
  const digitsSet = new Set();
  const results = [];
  const seen = new Set();

  poDigitsList.forEach(p => {
    if (!p) return;
    const clean = String(p).trim().toUpperCase().replace(/\s+/g, '');
    const rawNum = clean.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
    const digits = extraerPoBaseDigits(clean) || rawNum;

    // 0. Verificar primero en la Caché Inteligente (Ahorro de Consumo BigQuery)
    if (!forceRefresh && digits) {
      const cachedSum = _getCachedPoItem('SUM', digits) || _getCachedPoItem('FULL', digits);
      if (cachedSum && cachedSum.po_order_id && !seen.has(cachedSum.po_order_id)) {
        seen.add(cachedSum.po_order_id);
        results.push({
          po_order_id: cachedSum.po_order_id,
          warehouse_name: cachedSum.warehouse_name,
          supplier_name: cachedSum.supplier_name,
          order_status: cachedSum.order_status,
          total_ordenado_neto: cachedSum.total_ordenado_neto,
          total_recepcionado_neto: cachedSum.total_recepcionado_neto,
          descalce_monto_clp: Math.abs(cachedSum.dif_ml || 0),
          dif_ml: cachedSum.dif_ml || 0,
          monto_aforo: cachedSum.monto_aforo || 0,
          documento_aforo: cachedSum.documento_aforo || null,
          status_aforo: cachedSum.status_aforo || null
        });
        return;
      }
    }

    if (clean) candidateSet.add(clean);
    if (digits) {
      digitsSet.add(digits);
      candidateSet.add(digits);
      candidateSet.add('PO' + digits);
      candidateSet.add('0000' + digits);
    }
  });

  const inDigits = Array.from(digitsSet).filter(Boolean);
  if (inDigits.length === 0) {
    if (results.length > 0) {
      BQ_RUNTIME_TELEMETRY_DELTA.queries_saved_by_cache++;
      _flushBqTelemetry();
    }
    return results;
  }

  BQ_TELEMETRY.pos_queried_live += inDigits.length;
  BQ_RUNTIME_TELEMETRY_DELTA.queries_executed++;
  BQ_TELEMETRY.last_query_at = new Date().toISOString();

  const sap3wmMap = getSap3wmReportMassive(inDigits);
  const inValuesSql = Array.from(candidateSet).filter(Boolean).map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
  const inDigitsSql = inDigits.map(d => `'${d.replace(/'/g, "\\'")}'`).join(', ');

  const sqlAgg = `
    WITH po_sku AS (
      SELECT
        CAST(po_number AS STRING) AS po_number,
        store_name,
        sku_id,
        IFNULL(received_qty, 0) AS received_qty,
        unit_cost_after_discount_lc,
        IFNULL(internal_tax_lc, 0) AS internal_tax_lc
      FROM \`${BQ_CONFIG.TABLE_PO_SKU_LEVEL}\`
      WHERE po_creation_date >= DATE('2024-01-01')
        AND country_name = 'Chile'
        AND (
          po_number IN (${inValuesSql})
          OR ${normalizePoSql('po_number')} IN (${inDigitsSql})
        )
    ),
    sku_weightable AS (
      SELECT DISTINCT
        sku,
        is_weightable
      FROM \`${BQ_CONFIG.TABLE_DIM_VENDOR_PRODUCT}\`
    ),
    sku_norm AS (
      SELECT
        p.po_number,
        p.store_name,
        CASE WHEN s.is_weightable = TRUE THEN p.received_qty / 1000 ELSE p.received_qty END AS received_qty_final,
        CASE WHEN s.is_weightable = TRUE THEN p.unit_cost_after_discount_lc * 1000 ELSE p.unit_cost_after_discount_lc END AS unit_cost_final,
        CASE WHEN s.is_weightable = TRUE THEN p.internal_tax_lc * 1000 ELSE p.internal_tax_lc END AS internal_tax_final
      FROM po_sku p
      LEFT JOIN sku_weightable s ON p.sku_id = s.sku
    )
    SELECT
      po_number,
      ANY_VALUE(store_name) AS store_name,
      ROUND(SUM((IFNULL(unit_cost_final, 0) + IFNULL(internal_tax_final, 0)) * IFNULL(received_qty_final, 0)), 0) AS total_recepcionado_neto
    FROM sku_norm
    GROUP BY po_number
  `;

  try {
    const rows = executeBigQuerySql(sqlAgg);
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        const rawPo = String(r.po_number || '').trim().toUpperCase();
        const digits = extraerPoBaseDigits(rawPo) || rawPo.replace(/\D/g, '');
        const formattedPo = 'PO' + (digits || rawPo);
        if (seen.has(formattedPo)) return;
        seen.add(formattedPo);

        const sap3wm = (digits && sap3wmMap[digits]) || null;
        const totRec = Math.round(parseFloat(r.total_recepcionado_neto || '0') || 0);
        const sapDiff = (sap3wm && sap3wm.total_difference !== null && sap3wm.total_difference !== undefined)
          ? Math.round(sap3wm.total_difference)
          : 0;
        const sapMontoAforo = (sap3wm && sap3wm.monto_aforo) ? Math.round(sap3wm.monto_aforo) : 0;
        const sapDocAforo = (sap3wm && sap3wm.documento_aforo) || null;
        const sapStatusAforo = (sap3wm && sap3wm.status_aforo) || (sapMontoAforo > 0 ? 'APLICADO_SAP_3WM' : 'NO_APLICA');

        const summaryObj = {
          po_order_id: formattedPo,
          warehouse_name: r.store_name || 'CH_36_CD_Chile (Sociedad 6202)',
          supplier_name: 'Proveedor',
          order_status: 'DELIVERED',
          total_ordenado_neto: totRec,
          total_recepcionado_neto: totRec,
          descalce_monto_clp: Math.abs(sapDiff),
          dif_ml: sapDiff,
          monto_aforo: sapMontoAforo,
          documento_aforo: sapDocAforo,
          status_aforo: sapStatusAforo
        };
        results.push(summaryObj);
        if (digits) {
          _setCachedPoItem('SUM', digits, summaryObj, BQ_CONFIG.CACHE_TTL_SECONDS.PO_SKU_LEVEL);
        }
      });
      // Las OC que el datamart aún no tiene (p. ej. creadas hoy) se leen del origen, con la MISMA valorización
      // (costo con descuento + impuesto interno), para que el Paso 1 coincida con los Pasos 2 y 3.
      try {
        const yaDevueltas = new Set(results.map(r => extraerPoBaseDigits(r.po_order_id)));
        const faltantes = inDigits.filter(d => !yaDevueltas.has(d));
        if (faltantes.length > 0) {
          const desdeOrigen = getOriginPurchaseOrdersFallback(faltantes, sap3wmMap);
          faltantes.forEach(d => {
            const po = desdeOrigen[d];
            if (!po || !po.po_order_id || seen.has(po.po_order_id)) return;
            seen.add(po.po_order_id);
            results.push({
              po_order_id: po.po_order_id,
              warehouse_name: po.warehouse_name,
              supplier_name: po.supplier_name,
              order_status: po.order_status,
              total_ordenado_neto: po.total_ordenado_neto,
              total_recepcionado_neto: po.total_recepcionado_neto,
              descalce_monto_clp: Math.abs(po.dif_ml || 0),
              dif_ml: po.dif_ml || 0,
              monto_aforo: po.monto_aforo || 0,
              documento_aforo: po.documento_aforo || null,
              status_aforo: po.status_aforo || null
            });
          });
        }
      } catch (eOrigenResumen) {
        Logger.log('Aviso en respaldo al origen del resumen de POs: ' + eOrigenResumen.message);
      }
      _flushBqTelemetry();
      return results;
    }
  } catch (eAgg) {
    Logger.log('Aviso en consulta agregada de POs en BigQuery, usando fallback: ' + eAgg.message);
  }

  const poMap = getMassivePurchaseOrders(poDigitsList);
  Object.values(poMap).forEach(po => {
    if (po && po.po_order_id && !seen.has(po.po_order_id)) {
      seen.add(po.po_order_id);
      results.push({
        po_order_id: po.po_order_id,
        warehouse_name: po.warehouse_name,
        supplier_name: po.supplier_name,
        order_status: po.order_status,
        total_ordenado_neto: po.total_ordenado_neto,
        total_recepcionado_neto: po.total_recepcionado_neto,
        descalce_monto_clp: Math.abs(po.dif_ml || 0),
        dif_ml: po.dif_ml || 0,
        monto_aforo: po.monto_aforo || 0,
        documento_aforo: po.documento_aforo || null,
        status_aforo: po.status_aforo || null
      });
    }
  });

  return results;
}
