const fs = require('fs');

function parseXmlManual(xmlText) {
  const folio = (xmlText.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const mntNeto = parseFloat((xmlText.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || '0');
  const mntTotal = parseFloat((xmlText.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || '0');
  const rutEmisor = (xmlText.match(/<RUTEmisor>(.*?)<\/RUTEmisor>/) || [])[1] || '';
  const rznSoc = (xmlText.match(/<RznSoc>(.*?)<\/RznSoc>/) || [])[1] || '';

  const detalles = [];
  const detMatches = xmlText.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  detMatches.forEach((det, idx) => {
    const vlrCodigo = (det.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1] || '';
    const nmbItem = (det.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1] || '';
    const qty = parseFloat((det.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || '0');
    const prc = parseFloat((det.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || '0');
    const monto = parseFloat((det.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || '0');
    const rec = parseFloat((det.match(/<RecargoMonto>([\d.]+)<\/RecargoMonto>/) || [])[1] || '0');
    detalles.push({
      linea: idx + 1,
      codigo: vlrCodigo.trim(),
      descripcion: nmbItem.trim(),
      cantidad_facturada: qty,
      unidad_medida: 'UN',
      precio_facturado: prc,
      monto_facturado: monto,
      recargo_monto: rec
    });
  });

  return {
    folio,
    tipo_dte: '33',
    fecha_emision: '2026-10-09',
    emisor: { rut: rutEmisor, razon_social: rznSoc },
    totales: { neto: mntNeto, total: mntTotal },
    items: detalles
  };
}

const doc1 = fs.readFileSync('scratch/doc_10207759.xml', 'latin1');
const doc2 = fs.readFileSync('scratch/doc_10207760.xml', 'latin1');
const inv1 = parseXmlManual(doc1);
const inv2 = parseXmlManual(doc2);
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

// Now evaluate with CruceEngine logic
const vm = require('vm');
const cruceCode = fs.readFileSync('apps-script-webapp/CruceEngine.gs', 'utf8');
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
const ctx = { console, Math, Number, Set, Array, Object, String, RegExp, parseInt, parseFloat, isNaN };
vm.createContext(ctx);
vm.runInContext(helpers + '\n' + cruceCode, ctx);

const poData = {
  po_found: true,
  po_order_id: 'PO524064',
  warehouse_name: 'CH_6_La Serena (Sociedad 6202)',
  total_ordenado_neto: 526094,
  total_recepcionado_neto: 495202,
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

const r1 = ctx.ejecutarCruceSkuPorSku(inv1, poData);
console.log('\n--- F1 Cruce ---');
console.log('F1 total_facturado_neto:', r1.resumen.total_facturado_neto);
console.log('F1 total_recepcionado_neto:', r1.resumen.total_recepcionado_neto);
console.log('F1 dif_ml:', r1.resumen.dif_ml);
console.log('F1 total_monto_a_reclamar:', r1.resumen.total_monto_a_reclamar);

const r2 = ctx.ejecutarCruceSkuPorSku(inv2, poData);
console.log('\n--- F2 Cruce ---');
console.log('F2 total_facturado_neto:', r2.resumen.total_facturado_neto);
console.log('F2 total_recepcionado_neto:', r2.resumen.total_recepcionado_neto);
console.log('F2 dif_ml:', r2.resumen.dif_ml);
console.log('F2 total_monto_a_reclamar:', r2.resumen.total_monto_a_reclamar);

