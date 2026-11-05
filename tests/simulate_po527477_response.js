const fs = require('fs');
const vm = require('vm');
const path = require('path');

const bqCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/BigQueryAPI.gs'), 'utf8');
const axCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/AxteroidAPI.gs'), 'utf8');
const codCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/Codigo.gs'), 'utf8');

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
  Boolean: Boolean,
  Date: Date,
  RegExp: RegExp,
  Utilities: {
    sleep: () => {}
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: () => null,
      setProperty: () => {}
    })
  },
  UrlFetchApp: {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ results: [] })
    })
  }
};

vm.createContext(sandbox);
vm.runInContext(bqCode, sandbox);
vm.runInContext(axCode, sandbox);
vm.runInContext(codCode, sandbox);

// Asignar el mock de executeBigQuerySql para simular la respuesta de BigQuery para 527477
sandbox.executeBigQuerySql = function(sql) {
  if (sql.includes('sap_report_3wm')) {
    return [
      {
        company_code: '6202',
        vendor_id: '81094100-6',
        todas_pos_relacionadas: 'PO527477',
        total_invoice_associated_cost: '4850000',
        total_po_amount: '4825000',
        total_difference: '25000',
        documento_aforo: '50001234',
        monto_aforo: '25000',
        status_aforo: 'APLICADO_SAP_3WM'
      }
    ];
  }
  if (sql.includes('purchase_orders_sku_level')) {
    return [
      {
        po_number: 'PO527477',
        store_name: 'CH_36_CD_Chile',
        sku_id: 'SKU_COLUN_QUESO',
        barcode: '780123450001',
        product_name: 'Queso Mantecoso Laminado 500g',
        product_type: 'PESABLE',
        received_qty_final: 50.0,
        unit_cost_after_discount_lc_final: 5500,
        internal_tax_lc: 0,
        total_amount_lc: 275000
      },
      {
        po_number: 'PO527477',
        store_name: 'CH_36_CD_Chile',
        sku_id: 'SKU_COLUN_LECHE',
        barcode: '780123450002',
        product_name: 'Leche Entera 1L Tetra',
        product_type: 'UNIDAD',
        received_qty_final: 2000,
        unit_cost_after_discount_lc_final: 750,
        internal_tax_lc: 0,
        total_amount_lc: 1500000
      }
    ];
  }
  return [];
};

console.log('--- TEST: Consulta de PO 527477 simulando BigQuery ---');
const res = vm.runInContext('apiSearchPoWithInvoices("527477")', sandbox);
console.log(JSON.stringify(res, null, 2));
