const fs = require('fs');
const vm = require('vm');

// Read CruceEngine.gs
const cruceCode = fs.readFileSync('apps-script-webapp/CruceEngine.gs', 'utf8');

// Also need helper functions: normalizarTexto, calcularSimilitudTextos, formatearClp, generarDiagnosticoGlobal, Logger
const helpers = `
const Logger = { log: console.log };
function normalizarTexto(t) {
  if (!t) return '';
  return t.toString().toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}
function calcularSimilitudTextos(s1, s2) {
  const w1 = new Set(s1.split(' ').filter(w => w.length > 2));
  const w2 = new Set(s2.split(' ').filter(w => w.length > 2));
  if (w1.size === 0 || w2.size === 0) return 0;
  let match = 0;
  w1.forEach(w => { if (w2.has(w)) match++; });
  return (2 * match) / (w1.size + w2.size);
}
function formatearClp(n) { return Math.round(n).toLocaleString('es-CL'); }
function generarDiagnosticoGlobal(monto, items, total) { return 'Diagnostico'; }
`;

const ctx = {
  console, Math, Number, Set, Array, Object, String, RegExp, parseInt, parseFloat, isNaN
};
vm.createContext(ctx);
vm.runInContext(helpers + '\n' + cruceCode, ctx);

// Parse invoice 10207759
const xmlParserCode = fs.readFileSync('apps-script-webapp/XmlParser.gs', 'utf8');
vm.runInContext(xmlParserCode, ctx);

const doc1 = fs.readFileSync('scratch/doc_10207759.xml', 'latin1');
const doc2 = fs.readFileSync('scratch/doc_10207760.xml', 'latin1');
const docNc = fs.readFileSync('scratch/doc_6363032.xml', 'latin1');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

// Format poData
const poData = {
  po_found: true,
  po_order_id: 'PO524064',
  warehouse_name: 'CH_6_La Serena (Sociedad 6202)',
  total_ordenado_neto: 526094,
  total_recepcionado_neto: 495202,
  supplier_tax_id: '88725800-4',
  items: bqItems.map(b => ({
    sku_id: b.sku_id,
    supplier_sku: b.supplier_sku || '',
    barcodes: b.barcodes || [],
    product_name: b.product_name,
    quantity_ordered: parseFloat(b.quantity_ordered),
    quantity_delivered: parseFloat(b.quantity_delivered),
    cost_unit_lc: parseFloat(b.unit_cost),
    amt_ordered_lc: parseFloat(b.amt_ordered),
    amt_delivered_lc: parseFloat(b.amt_delivered)
  }))
};

// Parse DTE XMLs
const inv1 = ctx.parseDteXml(doc1);
const inv2 = ctx.parseDteXml(doc2);
const invNc = ctx.parseDteXml(docNc);

console.log('--- CRUCE FACTURA 10207759 ---');
const r1 = ctx.ejecutarCruceSkuPorSku(inv1, poData);
console.log('R1 Resumen:', r1.resumen);

console.log('\n--- CRUCE FACTURA 10207760 ---');
const r2 = ctx.ejecutarCruceSkuPorSku(inv2, poData);
console.log('R2 Resumen:', r2.resumen);

console.log('\n--- CRUCE CONSOLIDADO ---');
const consolInv = {
  folio: 'Consolidado',
  fecha_emision: '2026-10-09',
  emisor: inv1.emisor,
  totales: { total: 535430 },
  items: [...inv1.items, ...inv2.items]
};
const rConsol = ctx.ejecutarCruceSkuPorSku(consolInv, poData);
console.log('RConsol Resumen:', rConsol.resumen);

