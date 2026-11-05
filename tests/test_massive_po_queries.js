const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Cargar BigQueryAPI.gs en entorno sandbox
const bqCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/BigQueryAPI.gs'), 'utf8');

let executedQueries = [];
const sandbox = {
  Logger: console,
  console: console,
  Math: Math,
  Number: Number,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  Array: Array,
  Set: Set,
  Object: Object,
  String: String,
  Boolean: Boolean
};

vm.createContext(sandbox);
vm.runInContext(bqCode, sandbox);

// Sobrescribir executeBigQuerySql DESPUÉS de compilar el script
sandbox.executeBigQuerySql = function(sql) {
  executedQueries.push(sql);

  // Si consulta sap_report_3wm
  if (sql.includes('sap_report_3wm')) {
    return [
      {
        company_code: '6202',
        vendor_id: '96591040-9',
        todas_pos_relacionadas: 'PO521257, PO524332',
        total_invoice_associated_cost: '25000000',
        total_po_amount: '20000000',
        total_difference: '5000000',
        documento_aforo: '10009988',
        monto_aforo: '5000000',
        status_aforo: 'APLICADO_SAP_3WM'
      }
    ];
  }

  // Consulta oficial masiva del bot
  if (sql.includes('purchase_orders_sku_level')) {
    return [
      // PO 521257 - Ítem Unitario
      {
        po_number: 'PO521257',
        store_name: 'CH_36_CD_Chile',
        sku_id: 'SKU_GALLETAS',
        barcode: '780123456789',
        product_name: 'Galletas Costa 100g',
        product_type: 'UNIDAD',
        received_qty_final: 100,
        unit_cost_after_discount_lc_final: 500,
        internal_tax_lc: 0,
        total_amount_lc: 50000
      },
      // PO 524332 - Ítem Pesable
      {
        po_number: 'PO524332',
        store_name: 'CH_36_CD_Chile',
        sku_id: 'SKU_QUESO_GAUDA',
        barcode: '780987654321',
        product_name: 'Queso Gauda Trozo Kg',
        product_type: 'PESABLE',
        received_qty_final: 25.5,
        unit_cost_after_discount_lc_final: 6200,
        internal_tax_lc: 0,
        total_amount_lc: 158100
      }
    ];
  }

  return [];
};

let errors = [];

// 1. Test llamada masiva con múltiples POs
executedQueries = [];
const massRes = vm.runInContext('getMassivePurchaseOrders(["PO521257", "524332"])', sandbox);

console.log('=== TEST 1: Consulta Masiva de POs ===');
console.log('Total queries ejecutadas en BQ:', executedQueries.length);
if (executedQueries.length !== 2) {
  errors.push(`Esperaba exactamente 2 queries masivas (1 bot + 1 sap 3wm), se ejecutaron ${executedQueries.length}`);
}

const botQuery = executedQueries.find(q => q.includes('purchase_orders_sku_level'));
if (!botQuery) {
  errors.push('No se encontró la query oficial del bot entre las consultas ejecutadas.');
} else {
  if (!botQuery.includes("'PO521257'") || !botQuery.includes("'524332'")) {
    errors.push('La query masiva del bot no contenía todas las POs en su filtro IN.');
  }
}

if (!massRes['521257'] || !massRes['PO521257']) {
  errors.push('PO 521257 no fue indexada correctamente en el resultado.');
} else {
  const p1 = massRes['521257'];
  console.log('PO 521257 Total:', p1.total_recepcionado_neto, '| Ítems:', p1.items.length);
  if (p1.total_recepcionado_neto !== 50000) {
    errors.push(`PO 521257 total_recepcionado_neto esperado 50000, obtenido ${p1.total_recepcionado_neto}`);
  }
  if (p1.items[0].product_type !== 'UNIDAD') {
    errors.push(`PO 521257 product_type esperado UNIDAD, obtenido ${p1.items[0].product_type}`);
  }
}

if (!massRes['524332'] || !massRes['PO524332']) {
  errors.push('PO 524332 no fue indexada correctamente en el resultado.');
} else {
  const p2 = massRes['524332'];
  console.log('PO 524332 Total:', p2.total_recepcionado_neto, '| Ítems:', p2.items.length);
  if (p2.total_recepcionado_neto !== 158100) {
    errors.push(`PO 524332 total_recepcionado_neto esperado 158100, obtenido ${p2.total_recepcionado_neto}`);
  }
  if (p2.items[0].product_type !== 'PESABLE' || p2.items[0].is_weightable !== true) {
    errors.push(`PO 524332 product_type esperado PESABLE/true, obtenido ${p2.items[0].product_type}/${p2.items[0].is_weightable}`);
  }
}

// 2. Test getPurchaseOrderItems (debe redirigir a getMassivePurchaseOrders)
executedQueries = [];
const singleRes = vm.runInContext('getPurchaseOrderItems("PO521257")', sandbox);
console.log('\n=== TEST 2: getPurchaseOrderItems delegado ===');
console.log('PO encontrada:', singleRes.po_found, '| Order ID:', singleRes.po_order_id, '| Total:', singleRes.total_recepcionado_neto);

if (!singleRes || !singleRes.po_found || singleRes.total_recepcionado_neto !== 50000) {
  errors.push('getPurchaseOrderItems no devolvió los datos correctos delegando a la consulta masiva.');
}

// 3. Test queryMultiplePurchaseOrdersSummary
executedQueries = [];
const summaryRes = vm.runInContext('queryMultiplePurchaseOrdersSummary(["521257", "524332"])', sandbox);
console.log('\n=== TEST 3: queryMultiplePurchaseOrdersSummary delegado ===');
console.log('Total POs en resumen:', summaryRes.length);
if (summaryRes.length !== 2) {
  errors.push(`queryMultiplePurchaseOrdersSummary esperaba 2 POs, devolvió ${summaryRes.length}`);
}

if (errors.length > 0) {
  console.error('\n❌ ERRORES EN VALIDACIÓN DE CONSULTAS MASIVAS:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log('\n✅ TODAS LAS PRUEBAS DE CONSULTA MASIVA PASARON EXITOSAMENTE!');
}
