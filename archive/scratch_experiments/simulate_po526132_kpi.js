const fs = require('fs');

const invLines = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/all_invoice_lines_parsed.json', 'utf8'));

let raw = fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/po526132_items.json');
let text = '';
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
else text = raw.toString('utf8').replace(/^\uFEFF/, '');
text = text.replace(/^\uFEFF/, '').trim();
const bqItems = JSON.parse(text);

console.log('BQ Items count:', bqItems.length);

function detectFactor(desc, uom) {
  if (uom === 'BOT' || uom === 'UN') return 1;
  const m = desc.match(/[xX*]\s*(\d+)/);
  if (m) {
    const f = parseInt(m[1], 10);
    if (f > 1 && f <= 36) return f;
  }
  const m2 = desc.match(/pack\s*x?\s*(\d+)/i);
  if (m2) return parseInt(m2[1], 10);
  return 1;
}

let matchedLines = [];
let unmatchedInv = [];

invLines.forEach(inv => {
  const factor = detectFactor(inv.name, inv.uom);
  const unitsInvoiced = inv.qty * factor;
  const unitPriceFacturado = unitsInvoiced > 0 ? (inv.monto / unitsInvoiced) : 0;

  let bestMatch = null;
  let bestScore = 0;

  bqItems.forEach(b => {
    let score = 0;
    const invWords = inv.name.toLowerCase().split(/[\s,.*xX]+/);
    invWords.forEach(w => {
      if (w.length >= 3 && b.product_name.toLowerCase().includes(w)) {
        score += w.length;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      bestMatch = b;
    }
  });

  if (bestMatch && bestScore >= 6) {
    matchedLines.push({
      inv,
      bq: bestMatch,
      factor,
      unitsInvoiced,
      unitPriceFacturado,
      unitCostOc: parseFloat(bestMatch.unit_cost) || 0,
      unitsReceived: parseFloat(bestMatch.quantity_delivered) || 0,
      unitsOrdered: parseFloat(bestMatch.quantity_ordered) || 0
    });
  } else {
    unmatchedInv.push(inv);
  }
});

console.log(`Matched: ${matchedLines.length}, Unmatched: ${unmatchedInv.length}`);

const consolidated = new Map();

matchedLines.forEach(m => {
  const sku = m.bq.sku_id;
  if (!consolidated.has(sku)) {
    consolidated.set(sku, {
      sku: sku,
      name: m.bq.product_name,
      unitsReceived: m.unitsReceived,
      unitCostOc: m.unitCostOc,
      unitsInvoiced: 0,
      totalInvoiced: 0,
      invoices: []
    });
  }
  const item = consolidated.get(sku);
  item.unitsInvoiced += m.unitsInvoiced;
  item.totalInvoiced += m.inv.monto;
  item.invoices.push(m.inv.folio);
});

bqItems.forEach(b => {
  if (!consolidated.has(b.sku_id)) {
    consolidated.set(b.sku_id, {
      sku: b.sku_id,
      name: b.product_name,
      unitsReceived: parseFloat(b.quantity_delivered) || 0,
      unitCostOc: parseFloat(b.unit_cost) || 0,
      unitsInvoiced: 0,
      totalInvoiced: 0,
      invoices: []
    });
  }
});

let sumE1 = 0;
let sumE2 = 0;
let sumTotalFacturado = 0;
let sumTotalRecepcionado = 0;

for (const it of consolidated.values()) {
  const H = it.unitCostOc;
  const G = it.unitsReceived;
  const K = it.unitsInvoiced;
  const L = it.totalInvoiced;
  const M = K > 0 ? (L / K) : 0;
  const N = K - G;
  const difCosto = K > 0 ? (M - H) : 0;

  sumE1 += (H * N);
  sumE2 += (difCosto * K);
  sumTotalFacturado += L;
  sumTotalRecepcionado += (G * H);
}

console.log('\n--- Tarjeta KPI Oficial Simulada ---');
console.log('Monto por diferencia de unidades (E1):', sumE1.toFixed(2));
console.log('Monto por diferencia de costo (E2):', sumE2.toFixed(2));
console.log('Monto total diferencias (E3 = E1 + E2):', (sumE1 + sumE2).toFixed(2));
console.log('Total Facturado sumado:', sumTotalFacturado.toFixed(2));
console.log('Total Recepcionado sumado:', sumTotalRecepcionado.toFixed(2));
console.log('Facturado - Recepcionado:', (sumTotalFacturado - sumTotalRecepcionado).toFixed(2));
