/**
 * scripts/merge_and_build_master_index.js
 * Combina el índice cosechado de Axteroid + BigQuery con las órdenes de compra y facturas
 * curadas del sistema (PO520168, PO519527, PO521534, PO517979, PO502855, etc.).
 */

const fs = require('fs');
const path = require('path');

// 1. Cargar índice actual
const indiceActual = JSON.parse(fs.readFileSync('tests/indice_completo_pos_facturas.json', 'utf8'));
console.log(`Cargadas ${indiceActual.length} POs del índice cosechado.`);

// Mapa por base_digits
const poMap = new Map();
indiceActual.forEach(p => {
  poMap.set(p.base_digits, p);
});

// 2. Curated POs y facturas locales de AxteroidAPI.gs / Codigo.gs
const curatedPos = [
  {
    po_number: "PO520168",
    base_digits: "520168",
    supplier_name: "Coca-Cola Embonor - Bebestibles - Ambiente",
    supplier_tax_id: "93281000-K",
    warehouse_name: "CH_18_Valdivia (Sociedad 6202)",
    order_status: "done",
    created_date: "2026-09-25",
    received_date: "2026-09-25",
    total_ordenado_neto: 1616783,
    total_recepcionado_neto: 1486291,
    total_facturado_neto: 1547145,
    total_facturado_total: 1986421,
    diferencia_preliminar: 48061,
    facturas: [
      { folio: "105214259", type: "CL33", supplier_name: "Coca-Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 160295, monto_total: 204846, id: "do_AAABoNcB-Pq_ZKOk", order_reference: "0000520168" },
      { folio: "105214260", type: "CL33", supplier_name: "Coca-Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 207957, monto_total: 269948, id: "do_AAABoNcB-UlUqh9u", order_reference: "0000520168" },
      { folio: "105214261", type: "CL33", supplier_name: "Coca-Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 426731, monto_total: 552100, id: "do_AAABoNcB-XdrxEe2", order_reference: "0000520168" },
      { folio: "105214262", type: "CL33", supplier_name: "Coca-Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 458638, monto_total: 580714, id: "do_AAABoNcB-aQth6lQ", order_reference: "0000520168" },
      { folio: "105214263", type: "CL33", supplier_name: "Coca-Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 290111, monto_total: 374234, id: "do_AAABoNcB-dh6WzFR", order_reference: "0000520168" },
      { folio: "105214264", type: "CL33", supplier_name: "Coca-Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 3413, monto_total: 4559, id: "do_AAABoNcB-gC7OH5i", order_reference: "0000520168" },
      { folio: "17233113", type: "CL61", supplier_name: "COCA-COLA EMBONOR S.A.", supplier_tax_id: "93281000-K", date: "2026-09-25", monto_neto: 3413, monto_total: 4559, id: "do_AAABoNpo8MUyfoGQ", order_reference: "0000520168" }
    ]
  },
  {
    po_number: "PO519527",
    base_digits: "519527",
    supplier_name: "Ideal S.A. (Grupo Bimbo)",
    supplier_tax_id: "82623500-4",
    warehouse_name: "CH_24_El Belloto",
    order_status: "done",
    created_date: "2026-09-25",
    received_date: "2026-09-25",
    total_ordenado_neto: 1181837,
    total_recepcionado_neto: 996268,
    total_facturado_neto: 1033571,
    total_facturado_total: 1229948,
    diferencia_preliminar: 37303,
    facturas: [
      { folio: "56458220", type: "CL33", supplier_name: "Ideal S.A. (Grupo Bimbo)", supplier_tax_id: "82623500-4", date: "2026-09-25", monto_neto: 1033571, monto_total: 1229948, id: "do_AAABoNmiZ3502o7z", order_reference: "519527" }
    ]
  },
  {
    po_number: "PO521534",
    base_digits: "521534",
    supplier_name: "Coca-Cola Embonor S.A.",
    supplier_tax_id: "93281000-K",
    warehouse_name: "CH_8_Vina del Mar",
    order_status: "done",
    created_date: "2026-09-30",
    received_date: "2026-09-30",
    total_ordenado_neto: 2433481,
    total_recepcionado_neto: 1827308,
    total_facturado_neto: 2433481,
    total_facturado_total: 2895842,
    diferencia_preliminar: 606173,
    facturas: [
      { folio: "105275600", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 357471, monto_total: 491118, id: "do_AAABoPDUOUIBkxMc", order_reference: "0000521534" },
      { folio: "105275601", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 136777, monto_total: 204279, id: "do_AAABoPDUOXlpu9FC", order_reference: "0000521534" },
      { folio: "105275602", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 34844, monto_total: 46991, id: "do_AAABoPDUbcP1knBA", order_reference: "0000521534" },
      { folio: "105275603", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 413439, monto_total: 522773, id: "do_AAABoPDUbfl899yJ", order_reference: "0000521534" },
      { folio: "105275604", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 695468, monto_total: 896939, id: "do_AAABoPDUOaXZbdxF", order_reference: "0000521534" },
      { folio: "105275605", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 166643, monto_total: 204136, id: "do_AAABoPDUbiVoxQMw", order_reference: "0000521534" },
      { folio: "105275606", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 277986, monto_total: 352065, id: "do_AAABoPDUblJ--tLK", order_reference: "0000521534" },
      { folio: "105275607", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 122979, monto_total: 158076, id: "do_AAABoPDURlT_jkxu", order_reference: "0000521534" },
      { folio: "105275608", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 144911, monto_total: 185966, id: "do_AAABoPDUbn_HbAKX", order_reference: "0000521534" },
      { folio: "105275609", type: "CL33", supplier_name: "Coca Cola Embonor S.A.", supplier_tax_id: "93281000-K", date: "2026-09-30", monto_neto: 36589, monto_total: 54687, id: "do_AAABoPDUbqdD-9ZI", order_reference: "0000521534" }
    ]
  },
  {
    po_number: "PO521015",
    base_digits: "521015",
    supplier_name: "Ideal S.A. (Grupo Bimbo)",
    supplier_tax_id: "90297000-0",
    warehouse_name: "CH_34_Manuel Montt",
    order_status: "done",
    created_date: "2026-09-29",
    received_date: "2026-09-29",
    total_ordenado_neto: 2029303,
    total_recepcionado_neto: 1789977,
    total_facturado_neto: 2009229,
    total_facturado_total: 2390981,
    diferencia_preliminar: 219252,
    facturas: [
      { folio: "56500937", type: "CL33", supplier_name: "Ideal S.A.", supplier_tax_id: "90297000-0", date: "2026-09-29", monto_neto: 40440, monto_total: 48124, id: "do_AAABoO3N9aiEZzoM", order_reference: "521015" },
      { folio: "56500972", type: "CL33", supplier_name: "Ideal S.A.", supplier_tax_id: "90297000-0", date: "2026-09-29", monto_neto: 1968789, monto_total: 2342857, id: "do_AAABoO3pE68cnwlF", order_reference: "521015" }
    ]
  },
  {
    po_number: "PO517979",
    base_digits: "517979",
    supplier_name: "Empresas Carozzi S.A.",
    supplier_tax_id: "96591040-9",
    warehouse_name: "CH_36_CD_Chile (Sociedad 6202)",
    order_status: "done",
    created_date: "2026-09-22",
    received_date: "2026-09-22",
    total_ordenado_neto: 28619421,
    total_recepcionado_neto: 12388682,
    total_facturado_neto: 21066269,
    total_facturado_total: 25068860,
    diferencia_preliminar: 8677587,
    facturas: [
      { folio: "22586652", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 4666846, monto_total: 5589553, id: "do_AAABoMZcZiOh4a_m", order_reference: "0000517979" },
      { folio: "22586653", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 2079070, monto_total: 2474093, id: "do_AAABoMZcZ6fiXqds", order_reference: "0000517979" },
      { folio: "22586654", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 2138351, monto_total: 2544638, id: "do_AAABoMZcZsG5Uvja", order_reference: "0000517979" },
      { folio: "22586655", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 4959044, monto_total: 5901262, id: "do_AAABoMZcZnyZFDO1", order_reference: "0000517979" },
      { folio: "22586656", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 2676104, monto_total: 3184564, id: "do_AAABoMZcaF_fZEAe", order_reference: "0000517979" },
      { folio: "22586657", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 2096468, monto_total: 2494797, id: "do_AAABoMZcaFMU5WY9", order_reference: "0000517979" },
      { folio: "22586658", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 2558509, monto_total: 3044626, id: "do_AAABoMZcaE9GJ8iu", order_reference: "0000517979" },
      { folio: "22586659", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-22", monto_neto: 894377, monto_total: 1064309, id: "do_AAABoMZclE77AkTd", order_reference: "0000517979" }
    ]
  },
  {
    po_number: "PO521257",
    base_digits: "521257",
    supplier_name: "Empresas Carozzi S.A.",
    supplier_tax_id: "96591040-9",
    warehouse_name: "CH_36_CD_Chile (Sociedad 6202)",
    order_status: "done",
    created_date: "2026-09-30",
    received_date: "2026-09-30",
    total_ordenado_neto: 30471635,
    total_recepcionado_neto: 20463359,
    total_facturado_neto: 20649142,
    total_facturado_total: 24572488,
    diferencia_preliminar: 185783,
    facturas: [
      { folio: "22591482", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 5227449, monto_total: 6220664, id: "do_AAABoO9OfcdbUvtR", order_reference: "0000521257" },
      { folio: "22591483", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 2271329, monto_total: 2720616, id: "do_AAABoO9OfT88HV_t", order_reference: "0000521257" },
      { folio: "22591484", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 664070, monto_total: 790243, id: "do_AAABoO9OqE_UahOn", order_reference: "0000521257" },
      { folio: "22591485", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 6531950, monto_total: 7773021, id: "do_AAABoO9OqUZqb7GI", order_reference: "0000521257" },
      { folio: "22591486", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 1845858, monto_total: 2196571, id: "do_AAABoO9OqefmrNmV", order_reference: "0000521257" },
      { folio: "22591487", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 3056565, monto_total: 3637312, id: "do_AAABoO9Oqjkfayk7", order_reference: "0000521257" },
      { folio: "22591488", type: "CL33", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", date: "2026-09-30", monto_neto: 1261921, monto_total: 1501686, id: "do_AAABoO9OqrKXigHH", order_reference: "0000521257" }
    ]
  },
  {
    po_number: "PO502855",
    base_digits: "502855",
    supplier_name: "Unilever Chile Ltda.",
    supplier_tax_id: "82062100-K",
    warehouse_name: "CH_36_CD_Chile (Sociedad 6202)",
    order_status: "done",
    created_date: "2026-09-15",
    received_date: "2026-09-15",
    total_ordenado_neto: 154112069,
    total_recepcionado_neto: 76111725,
    total_facturado_neto: 76111725,
    total_facturado_total: 90572953,
    diferencia_preliminar: 78000345,
    facturas: [
      { folio: "1849201", type: "CL33", supplier_name: "Unilever Chile Ltda.", supplier_tax_id: "82062100-K", date: "2026-09-15", monto_neto: 76111725, monto_total: 90572953, id: "ax_1849201", order_reference: "PO502855" }
    ]
  }
];

// 3. Fusionar curated POs en el mapa
curatedPos.forEach(c => {
  const existing = poMap.get(c.base_digits);
  if (existing) {
    // Si ya existe, combinar facturas sin duplicar folios
    const currentFacs = existing.facturas || [];
    c.facturas.forEach(f => {
      if (!currentFacs.some(cf => cf.folio === f.folio)) {
        currentFacs.push(f);
      }
    });
    existing.facturas = currentFacs;
    existing.total_facturas = currentFacs.length;
    existing.total_facturado_neto = currentFacs.reduce((s, x) => s + Number(x.monto_neto || 0), 0);
    existing.total_facturado_total = currentFacs.reduce((s, x) => s + Number(x.monto_total || 0), 0);
    if (c.total_ordenado_neto) existing.total_ordenado_neto = c.total_ordenado_neto;
    if (c.total_recepcionado_neto) existing.total_recepcionado_neto = c.total_recepcionado_neto;
    if (c.diferencia_preliminar) existing.diferencia_preliminar = c.diferencia_preliminar;
  } else {
    c.total_facturas = c.facturas.length;
    poMap.set(c.base_digits, c);
  }
});

const listaCompleta = Array.from(poMap.values());

// Ordenar: primero las que tienen más facturas, luego por fecha/monto
listaCompleta.sort((a, b) => {
  if (b.total_facturas !== a.total_facturas) return b.total_facturas - a.total_facturas;
  return Number(b.total_ordenado_neto || 0) - Number(a.total_ordenado_neto || 0);
});

console.log(`Total POs combinadas: ${listaCompleta.length}`);
console.log(`POs con facturas vinculadas: ${listaCompleta.filter(p => p.total_facturas > 0).length}`);

// Guardar tests/indice_completo_pos_facturas.json
fs.writeFileSync('tests/indice_completo_pos_facturas.json', JSON.stringify(listaCompleta, null, 2), 'utf8');

// Generar apps-script-webapp/IndicePoFacturas.gs
const posParaGs = listaCompleta.filter(p => p.total_facturas > 0 || Number(p.total_ordenado_neto || 0) > 300000);
console.log(`Exportando ${posParaGs.length} POs a apps-script-webapp/IndicePoFacturas.gs...`);

const gsContent = `/**
 * IndicePoFacturas.gs
 * Módulo de Índice Universal de Órdenes de Compra y sus Facturas Respectivas.
 * Delivery Hero Stores Chile SpA (Sociedad SAP 6202) / Dmarts Chile.
 * Contiene ${posParaGs.length} Órdenes de Compra con todas sus Facturas Electrónicas asociadas.
 */

const INDICE_MAESTRO_POS_FACTURAS = ${JSON.stringify(posParaGs, null, 2)};

/**
 * RPC: Consulta el catálogo completo de Órdenes de Compra indexadas con sus facturas.
 * @param {Object} filtros { busqueda, proveedor, almacen, solo_diferencias, solo_con_facturas, page, limit }
 */
function apiGetIndexedPoList(filtros) {
  try {
    filtros = filtros || {};
    let lista = [...INDICE_MAESTRO_POS_FACTURAS];

    // 1. Filtro por término libre (PO, Folio, Proveedor, RUT)
    if (filtros.busqueda) {
      const q = String(filtros.busqueda).toUpperCase().trim();
      const rawDigits = q.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
      lista = lista.filter(po => {
        const matchPo = po.po_number.toUpperCase().includes(q) || (rawDigits && po.base_digits.includes(rawDigits));
        const matchProv = (po.supplier_name || '').toUpperCase().includes(q);
        const matchRut = (po.supplier_tax_id || '').toUpperCase().includes(q);
        const matchWh = (po.warehouse_name || '').toUpperCase().includes(q);
        const matchFac = (po.facturas || []).some(f => f.folio.includes(q) || (rawDigits && f.folio.includes(rawDigits)));
        return matchPo || matchProv || matchRut || matchWh || matchFac;
      });
    }

    // 2. Filtro por proveedor
    if (filtros.proveedor) {
      const p = String(filtros.proveedor).toUpperCase().trim();
      lista = lista.filter(po => (po.supplier_name || '').toUpperCase().includes(p));
    }

    // 3. Filtro por almacén
    if (filtros.almacen) {
      const w = String(filtros.almacen).toUpperCase().trim();
      lista = lista.filter(po => (po.warehouse_name || '').toUpperCase().includes(w));
    }

    // 4. Filtro solo con facturas
    if (filtros.solo_con_facturas) {
      lista = lista.filter(po => po.total_facturas > 0);
    }

    // 5. Filtro solo discrepancias
    if (filtros.solo_diferencias) {
      lista = lista.filter(po => Math.abs(po.diferencia_preliminar) > 100);
    }

    const page = parseInt(filtros.page) || 1;
    const limit = parseInt(filtros.limit) || 25;
    const totalCount = lista.length;
    const startIndex = (page - 1) * limit;
    const paginated = lista.slice(startIndex, startIndex + limit);

    return {
      success: true,
      total_pos: totalCount,
      page: page,
      limit: limit,
      total_pages: Math.ceil(totalCount / limit),
      pos: paginated
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * RPC: Obtiene una Orden de Compra indexada con todas sus facturas por número o folio.
 */
function apiGetIndexedPoDetail(poNumber) {
  try {
    if (!poNumber) return { success: false, error: 'Número de PO requerido.' };
    const raw = String(poNumber).toUpperCase().trim();
    const digits = raw.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');

    const found = INDICE_MAESTRO_POS_FACTURAS.find(p => 
      p.po_number.toUpperCase() === raw || 
      p.base_digits === digits ||
      (p.facturas || []).some(f => f.folio === raw || f.folio === digits)
    );

    if (found) {
      return { success: true, po: found };
    }

    return { success: false, error: 'Orden de Compra no encontrada en el índice.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
`;

fs.writeFileSync('apps-script-webapp/IndicePoFacturas.gs', gsContent, 'utf8');
console.log('✅ apps-script-webapp/IndicePoFacturas.gs actualizado exitosamente.');
