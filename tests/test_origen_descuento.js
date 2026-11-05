/**
 * Regresión: el respaldo al origen (cl_dmarts.purchase_orders) debe valorizar lo recepcionado igual que el datamart:
 * costo CON descuento de la OC + impuesto interno por unidad (antes usaba el costo sin descuento y sin impuesto).
 * Sin red: executeBigQuerySql se simula y se captura el SQL.
 *
 * Ejecutar: node tests/test_origen_descuento.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {
  console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map,
  Logger: { log() {} }, Utilities: { sleep() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'apps-script-webapp', 'BigQueryAPI.gs'), 'utf8'), ctx, { filename: 'BigQueryAPI.gs' });

let sqlCapturado = '';
// Filas como las devolvería BigQuery con la consulta corregida (PO con descuento comercial e impuesto interno)
ctx.executeBigQuerySql = (sql) => {
  sqlCapturado = sql;
  return [
    { po_number: 'PO529067', store_name: 'CH_16_Departamental', supplier_name: 'Cintazul', sku_id: '6J7X40', product_name: 'A', quantity_ordered: '30',
      received_qty_final: '20', unit_cost_after_discount_lc_final: '3927', internal_tax_lc: '0', total_amount_lc: '78540', barcode: '' },
    { po_number: 'PO529067', store_name: 'CH_16_Departamental', supplier_name: 'Cintazul', sku_id: 'ZVEN9F', product_name: 'B', quantity_ordered: '11',
      received_qty_final: '11', unit_cost_after_discount_lc_final: '3084', internal_tax_lc: '563.4468', total_amount_lc: '40122.9', barcode: '' }
  ];
};

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}

const r = ctx.getOriginPurchaseOrdersFallback(['529067'], {});
const po = r['529067'];

test('el SQL usa el costo con descuento y el impuesto interno', () => {
  assert.ok(/item_values_lc\.unit_cost_after_discount_lc/.test(sqlCapturado), 'debe usar unit_cost_after_discount_lc');
  assert.ok(/p\.internal_tax/.test(sqlCapturado), 'debe sumar p.internal_tax');
});
test('el SQL ya no toma el total sin descuento (amt_delivered_lc) como total recepcionado', () => {
  assert.ok(!/item_values_lc\.amt_delivered_lc/.test(sqlCapturado), 'no debe usar item_values_lc.amt_delivered_lc');
  assert.ok(!/IFNULL\(p\.item_values_lc\.unit_cost_lc, 0\) AS unit_cost_after_discount_lc_final/.test(sqlCapturado), 'unit_cost_lc es el costo SIN descuento');
});
test('el total recepcionado de la OC es la suma de (costo con descuento + impuesto) x recibido', () => {
  assert.strictEqual(po.total_recepcionado_neto, Math.round(78540 + 40122.9));
});
test('los items conservan el impuesto interno (antes quedaba en 0)', () => {
  const b = po.items.find(i => i.sku_id === 'ZVEN9F');
  assert.strictEqual(b.internal_tax_lc, 563.4468);
  assert.strictEqual(b.unit_cost_after_discount_lc_final, 3084);
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
