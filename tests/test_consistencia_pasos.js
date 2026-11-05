/**
 * Consistencia del monto recepcionado de la OC entre los pasos de la webapp:
 *   Paso 1 (lista de facturas)  -> queryMultiplePurchaseOrdersSummary
 *   Pasos 1 (tarjeta), 2 y 3    -> getPurchaseOrderItems
 * Casos: OC solo en el datamart, OC solo en el origen (creada hoy) y OC con descuento e impuesto interno.
 * Sin red: executeBigQuerySql se simula según la tabla consultada.
 *
 * Ejecutar: node tests/test_consistencia_pasos.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'apps-script-webapp', 'BigQueryAPI.gs'), 'utf8');

function nuevoContexto() {
  const mem = {};
  const ctx = {
    console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map,
    Logger: { log() {} }, Utilities: { sleep() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => mem[k] || null, setProperty: (k, v) => { mem[k] = v; } }) }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'BigQueryAPI.gs' });
  ctx.llamadas = [];
  ctx.executeBigQuerySql = (sql) => {
    ctx.llamadas.push(sql);
    const pide = (d) => sql.indexOf(d) !== -1;
    const fila = (po, qty, costo, imp) => ({
      po_number: po, store_name: 'CH_16_Departamental', sku_id: 'SKU' + po, barcode: '', product_name: 'Producto ' + po, product_type: 'UNIDAD',
      received_qty_final: String(qty), unit_cost_after_discount_lc_final: String(costo), internal_tax_lc: String(imp),
      total_amount_lc: String((costo + imp) * qty), quantity_ordered: String(qty), supplier_name: 'Proveedor', unit_cost_after_discount_lc: String(costo)
    });
    if (pide('sap_report_3wm')) return [];
    // Datos de prueba. 111111 y 333333 están en el datamart; 222222 solo en el origen; 333333 también en el origen.
    const datamart = [fila('PO111111', 10, 1000, 0), fila('PO333333', 20, 3927, 0)];
    const origen = [fila('PO222222', 5, 3927, 100), fila('PO333333', 20, 3927, 0)];
    if (pide('cl_dmarts.purchase_orders')) {
      return origen.filter(r => pide(r.po_number.replace('PO', '')));
    }
    const delDatamart = datamart.filter(r => pide(r.po_number.replace('PO', '')));
    if (pide('ROUND(SUM(')) { // resumen agregado del Paso 1
      return delDatamart.map(r => ({ po_number: r.po_number, store_name: r.store_name, total_recepcionado_neto: String((Number(r.unit_cost_after_discount_lc_final) + Number(r.internal_tax_lc)) * Number(r.received_qty_final)) }));
    }
    return delDatamart; // consulta masiva por SKU (Pasos 2 y 3)
  };
  return ctx;
}

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}

const esperado = { PO111111: 10000, PO222222: 20135, PO333333: 78540 };

test('Paso 1 (lista) devuelve las tres OC aunque una solo exista en el origen (lote mezclado)', () => {
  const ctx = nuevoContexto();
  const lista = ctx.queryMultiplePurchaseOrdersSummary(['111111', '222222', '333333']);
  const ids = lista.map(r => r.po_order_id).sort();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ids)), ['PO111111', 'PO222222', 'PO333333']);
});

test('el monto recepcionado del Paso 1 coincide con Pasos 2-3 en cada OC', () => {
  const lista = nuevoContexto().queryMultiplePurchaseOrdersSummary(['111111', '222222', '333333']);
  Object.keys(esperado).forEach(po => {
    const paso1 = lista.find(r => r.po_order_id === po).total_recepcionado_neto;
    const paso23 = nuevoContexto().getPurchaseOrderItems(po).total_recepcionado_neto; // contexto nuevo: sin caché compartida
    assert.strictEqual(paso1, paso23, po + ': Paso 1=' + paso1 + ' vs Pasos 2-3=' + paso23);
    assert.strictEqual(paso1, esperado[po], po + ' esperado ' + esperado[po]);
  });
});

test('la OC con descuento e impuesto interno vale (costo con descuento + impuesto) x recibido', () => {
  const po = nuevoContexto().getPurchaseOrderItems('PO222222');
  assert.strictEqual(po.total_recepcionado_neto, (3927 + 100) * 5);
  assert.strictEqual(po.items[0].internal_tax_lc, 100);
});

test('la clave de caché incluye la versión de esquema (invalida valores antiguos al desplegar)', () => {
  assert.ok(/BQ_CACHE_SCHEMA\s*=\s*'[^']+'/.test(SRC));
  assert.ok(/BQ_\$\{epoch\}_\$\{BQ_CACHE_SCHEMA\}_\$\{prefix\}_\$\{digits\}/.test(SRC));
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
