/**
 * BigQueryAPI.gs
 * Módulo de integración con BigQuery para consultar órdenes de compra y recepciones en Dmarts Chile.
 * Soporta tanto el servicio avanzado BigQuery como llamadas REST nativas con OAuth token.
 */

const BQ_CONFIG = {
  BILLING_PROJECT_ID: 'peya-chile',
  DATASET_PO: 'peya-data-origins-pro.cl_dmarts.purchase_orders',
  COMPANY_CODE: '6202',    // Sociedad SAP 6202 - Delivery Hero Stores Chile SpA
  COUNTRY_CODE: 'cl',      // Chile
  GLOBAL_ENTITY_ID: 'PY_CL'
};

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
 * Normaliza cualquier formato de Orden de Compra extrayendo el número base de 6 dígitos.
 * Soporta PO523489, 523489, 000052348939 (Agrosuper con tienda), 5238316 (Colún con tienda), 0000523945, etc.
 * @param {string|number} poStr Texto o número de OC
 * @return {string} Dígitos base de la OC (ej: '523489')
 */
function extraerPoBaseDigits(poStr) {
  if (!poStr) return '';
  const clean = String(poStr).trim().toUpperCase();
  if (/^45\d{8}$/.test(clean)) return clean; // SAP 10 dígitos legacy
  const m = clean.match(/(?:PO|OC|0+)?([3-58]\d{5})/);
  if (m) return m[1];
  return clean.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
}

/**
 * Consulta el detalle completo de una Orden de Compra y sus SKUs recepcionados,
 * enriqueciendo cada ítem con el código interno del proveedor (supplier_sku), RUT del proveedor y barcodes (EAN).
 * @param {string} poNumber Número de orden de compra (ej: 'PO521257', '521257', '000052348939')
 */
function getPurchaseOrderItems(poNumber) {
  if (!poNumber) return null;
  
  const cleanPo = poNumber.toString().trim().toUpperCase();
  const rawNumber = cleanPo.replace(/^PO/, '').replace(/^0+/, '');
  const baseDigits = extraerPoBaseDigits(cleanPo) || rawNumber;
  const withPrefix = 'PO' + baseDigits;

  // Consulta enriquecida cruzando la OC con el catálogo de proveedores para traer supplier_sku y RUT
  const sql = `
    WITH po_items AS (
      SELECT 
        po.po_order_id,
        po.warehouse_id,
        po.warehouse.warehouse_name,
        po.supplier_id,
        po.supplier_name,
        po.order_status,
        po.created_localtime_at,
        po.received_localtime_at,
        p.sku_id,
        p.product_name,
        p.quantity_ordered,
        p.quantity_delivered,
        p.item_values_lc.unit_cost_lc as cost_unit_lc,
        p.item_values_lc.amt_ordered_lc as amt_ordered_lc,
        p.item_values_lc.amt_delivered_lc as amt_delivered_lc,
        ROUND(COALESCE(p.item_values_lc.amt_ordered_lc, 0) - COALESCE(p.item_values_lc.amt_delivered_lc, 0), 2) AS dif_ml,
        ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(p.product.barcodes)), ', ') as barcodes_str
      FROM \`${BQ_CONFIG.DATASET_PO}\` po,
      UNNEST(po.products_purchased) as p
      WHERE po.created_localtime_at >= '2025-01-01'
        AND po.country_code = 'cl'
        AND (
          po.po_order_id = '${withPrefix}' 
          OR po.po_order_id = '${baseDigits}' 
          OR po.po_order_id LIKE '%${baseDigits}'
          OR po.po_order_id = 'PO${rawNumber}'
          OR po.po_order_id = '${rawNumber}'
        )
    ),
    supplier_info AS (
      SELECT 
        ps.sku, 
        ANY_VALUE(s.supplier_sku) as supplier_sku,
        ANY_VALUE(s.supplier_tax_id) as supplier_tax_id
      FROM \`peya-data-origins-pro.cl_dmarts.products_suppliers\` ps,
      UNNEST(ps.suppliers) as s
      WHERE ps.country_code = 'cl' 
        AND ps.sku IN (SELECT DISTINCT sku_id FROM po_items)
      GROUP BY ps.sku
    )
    SELECT 
      poi.*,
      si.supplier_sku,
      si.supplier_tax_id
    FROM po_items poi
    LEFT JOIN supplier_info si ON poi.sku_id = si.sku
    ORDER BY poi.product_name ASC;
  `;

  let rows = [];
  try {
    rows = executeBigQuerySql(sql);
  } catch (e) {
    Logger.log('Aviso consultando BigQuery para PO ' + poNumber + ': ' + e.message);
  }

  if (!rows || rows.length === 0) {
    if (typeof getAuditedPoData === 'function') {
      const auditPo = getAuditedPoData(poNumber) || getAuditedPoData(baseDigits);
      if (auditPo) return auditPo;
    }
    return {
      po_found: false,
      po_number: poNumber,
      base_digits: baseDigits,
      items: []
    };
  }

  const poHeader = rows[0];
  const firstTaxId = (rows.find(r => r.supplier_tax_id && r.supplier_tax_id.toString().trim()) || {}).supplier_tax_id || null;
  const totOrd = rows.reduce((s, r) => s + (parseFloat(r.amt_ordered_lc) || 0), 0);
  const totRec = rows.reduce((s, r) => s + (parseFloat(r.amt_delivered_lc) || 0), 0);
  const difMlHeader = Math.round(totOrd - totRec);

  return {
    po_found: true,
    po_order_id: poHeader.po_order_id,
    warehouse_name: poHeader.warehouse_name,
    supplier_name: poHeader.supplier_name,
    supplier_tax_id: firstTaxId,
    order_status: poHeader.order_status,
    created_at: poHeader.created_localtime_at,
    received_at: poHeader.received_localtime_at,
    base_digits: baseDigits,
    total_ordenado_neto: Math.round(totOrd),
    total_recepcionado_neto: Math.round(totRec),
    diferencia_ml: difMlHeader,
    diferencia_preliminar_clp: difMlHeader,
    items: rows.map(r => {
      const itOrd = parseFloat(r.amt_ordered_lc || '0');
      const itRec = r.amt_delivered_lc !== null && r.amt_delivered_lc !== undefined ? parseFloat(r.amt_delivered_lc) : null;
      const itDif = r.dif_ml !== undefined && r.dif_ml !== null ? parseFloat(r.dif_ml) : (itRec !== null ? Math.round((itOrd - itRec) * 100) / 100 : null);
      return {
        sku_id: r.sku_id,
        product_name: r.product_name,
        supplier_sku: r.supplier_sku || null,
        quantity_ordered: parseInt(r.quantity_ordered || '0', 10),
        quantity_delivered: r.quantity_delivered !== null && r.quantity_delivered !== undefined ? parseInt(r.quantity_delivered, 10) : null,
        cost_unit_lc: parseFloat(r.cost_unit_lc || '0'),
        amt_ordered_lc: itOrd,
        amt_delivered_lc: itRec,
        dif_ml: itDif,
        diferencia_ml: itDif,
        barcodes: (r.barcodes_str || '').split(',').map(b => b.trim()).filter(Boolean)
      };
    })
  };
}

/**
 * Busca productos y su homologación completa (SKU PedidosYa, EAN y Código Factura Proveedor)
 * junto con la ubicación física en almacén Dmart (Pasillo, Rack, Estante).
 * @param {string} term Término de búsqueda (SKU, EAN, Cód. Factura o Nombre)
 * @param {string} supplierTaxId RUT opcional del proveedor (ej: '96591040-9')
 * @param {number} maxRows Límite de resultados
 */
function searchProductHomologation(term, supplierTaxId, maxRows) {
  const cleanTerm = (term || '').trim().replace(/'/g, "\\'");
  const limit = maxRows || 100;
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
    FROM \`peya-data-origins-pro.cl_dmarts.products_suppliers\` ps
    JOIN \`peya-data-origins-pro.cl_dmarts.qc_catalog_products\` cat 
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
 * Obtiene el catálogo maestro de homologación para exportación masiva o consulta tabular.
 * @param {string} supplierTaxId RUT opcional del proveedor
 * @param {number} limit Límite de filas
 */
function getMasterHomologation(supplierTaxId, limit) {
  const maxLimit = limit || 2000;
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
    FROM \`peya-data-origins-pro.cl_dmarts.products_suppliers\` ps
    JOIN \`peya-data-origins-pro.cl_dmarts.qc_catalog_products\` cat 
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
 * Busca Órdenes de Compra (POs) en BigQuery que contengan un SKU, código de barras (EAN), o descripción de producto.
 * Permite buscar directamente por código de producto y traer todas las OCs y facturas asociadas.
 * @param {string} term SKU, EAN o descripción del producto
 * @param {number} maxRows Límite de POs a retornar (por defecto 10)
 */
function findPosBySkuOrBarcode(term, maxRows) {
  if (!term) return [];
  const cleanTerm = term.trim().replace(/'/g, "\\'");
  const limit = maxRows || 10;

  const sql = `
    SELECT DISTINCT
      po.po_order_id,
      po.supplier_name,
      p.sku_id,
      p.product_name,
      ARRAY_TO_STRING(ARRAY(SELECT b.barcode FROM UNNEST(p.product.barcodes) b), ', ') as barcode
    FROM \`peya-data-origins-pro.cl_dmarts.purchase_orders\` po,
    UNNEST(po.products_purchased) as p
    WHERE po.created_localtime_at >= '2025-01-01'
      AND po.country_code = 'cl'
      AND (
        p.sku_id = '${cleanTerm}'
        OR p.sku_id LIKE '%${cleanTerm}%'
        OR EXISTS (SELECT 1 FROM UNNEST(p.product.barcodes) b WHERE b.barcode = '${cleanTerm}' OR b.barcode LIKE '%${cleanTerm}%')
        OR LOWER(p.product_name) LIKE LOWER('%${cleanTerm}%')
      )
    ORDER BY po.po_order_id DESC
    LIMIT ${limit};
  `;

  let bqResults = [];
  try {
    bqResults = executeBigQuerySql(sql) || [];
  } catch (e) {
    Logger.log('Aviso buscando POs por SKU en BigQuery: ' + e.message);
  }

  if (bqResults && bqResults.length > 0) {
    return bqResults;
  }

  // Fallback de alta velocidad: Buscar en datasets locales auditados (PO518183, PO517979, PO521534, PO521015)
  try {
    const termLower = cleanTerm.toLowerCase();
    const auditedList = [];
    if (typeof PO518183_AUDIT_DATA !== 'undefined') auditedList.push(PO518183_AUDIT_DATA);
    if (typeof PO517979_AUDIT_DATA !== 'undefined') auditedList.push(PO517979_AUDIT_DATA);
    if (typeof PO521534_AUDIT_DATA !== 'undefined') auditedList.push(PO521534_AUDIT_DATA);
    if (typeof PO521015_AUDIT_DATA !== 'undefined') auditedList.push(PO521015_AUDIT_DATA);

    const matches = [];
    for (let a = 0; a < auditedList.length; a++) {
      const aData = auditedList[a];
      const items = aData.all_po_items || aData.items || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = (it.sku_id || it.codigo || it.sku || '').toString().toLowerCase();
        const p = (it.product_name || it.descripcion || it.nombre || '').toString().toLowerCase();
        const b = (it.barcode || it.ean || '').toString().toLowerCase();

        if (s.includes(termLower) || p.includes(termLower) || (b && b.includes(termLower))) {
          matches.push({
            po_order_id: aData.po_order_id,
            supplier_name: aData.supplier_name,
            sku_id: it.sku_id || it.codigo || it.sku,
            product_name: it.product_name || it.descripcion || it.nombre,
            barcode: it.barcode || it.ean || ''
          });
          break; // Una coincidencia por PO
        }
      }
      if (matches.length >= limit) break;
    }
    if (matches.length > 0) return matches;
  } catch (eLocal) {
    Logger.log('Aviso en búsqueda local por SKU: ' + eLocal.message);
  }

  return [];
}
