const fs = require('fs');

function parseDteXmlQuick(xmlText) {
  const items = [];
  const detalleRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
  let match;
  while ((match = detalleRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const nroLinea = block.match(/<NroLinDet>(\d+)<\/NroLinDet>/)?.[1] || '';
    const cdgItem = block.match(/<VlrCodigo>([^<]+)<\/VlrCodigo>/)?.[1] || '';
    const nmbItem = block.match(/<NmbItem>([^<]+)<\/NmbItem>/)?.[1] || '';
    const qty = parseFloat(block.match(/<QtyItem>([^<]+)<\/QtyItem>/)?.[1] || '0');
    const prcItem = parseFloat(block.match(/<PrcItem>([^<]+)<\/PrcItem>/)?.[1] || '0');
    const montoItem = parseFloat(block.match(/<MontoItem>([^<]+)<\/MontoItem>/)?.[1] || '0');

    items.push({
      linea: parseInt(nroLinea),
      codigo: cdgItem.trim(),
      nombre: nmbItem.trim(),
      cantidad: qty,
      precio: prcItem,
      monto: montoItem
    });
  }
  return items;
}

const items1 = parseDteXmlQuick(fs.readFileSync('doc_56500972.xml', 'utf8')).map(i => ({ ...i, factura: '56500972' }));
const items2 = parseDteXmlQuick(fs.readFileSync('doc_56500937.xml', 'utf8')).map(i => ({ ...i, factura: '56500937' }));
const allInvoiced = [...items1, ...items2];
const poItems = JSON.parse(fs.readFileSync('po521015_items_utf8.json', 'utf8').replace(/^\uFEFF/, ''));

function normalize(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('--- Matching analysis ---');
let totalDiff = 0;
const matchedInv = new Set();

poItems.forEach(poi => {
  const normPo = normalize(poi.product_name);
  // Find best match in allInvoiced
  let best = null;
  let bestScore = 0;

  allInvoiced.forEach((inv, idx) => {
    if (matchedInv.has(idx)) return;
    const normInv = normalize(inv.nombre);
    
    // Check token overlap
    const poTokens = normPo.split(' ').filter(t => t.length > 2);
    const invTokens = normInv.split(' ').filter(t => t.length > 2);
    let common = 0;
    poTokens.forEach(t => { if (invTokens.includes(t)) common++; });
    const score = common / Math.max(poTokens.length, invTokens.length);

    // Also match exact price
    const priceDiff = Math.abs(inv.precio - Number(poi.cost_unit_lc));

    if (score > 0.4 && priceDiff < 5 && score > bestScore) {
      best = { inv, idx, score };
      bestScore = score;
    }
  });

  if (best) {
    matchedInv.add(best.idx);
    const inv = best.inv;
    const qtyInv = inv.cantidad;
    const qtyRec = Number(poi.quantity_delivered);
    const prc = inv.precio;
    const montoInv = inv.monto;
    const montoRec = Number(poi.amt_delivered_lc);
    const diff = montoInv - montoRec;
    totalDiff += diff;
    if (diff !== 0) {
      console.log(`[DESCALCE] SKU: ${poi.sku_id} | ${poi.product_name}`);
      console.log(`   Factura ${inv.factura} (${inv.nombre}): QtyFac=${qtyInv}, Prc=${prc}, MontoFac=$${montoInv}`);
      console.log(`   Bodega BigQuery: QtyRec=${qtyRec}, Cost=${poi.cost_unit_lc}, MontoRec=$${montoRec}`);
      console.log(`   DIFERENCIA A RECLAMAR: $${diff}`);
    }
  } else {
    console.log(`[NO MATCH EN FACTURA] SKU: ${poi.sku_id} | ${poi.product_name} | MontoOrd=$${poi.amt_ordered_lc} | MontoRec=$${poi.amt_delivered_lc}`);
  }
});

console.log('\nFacturas no emparejadas:');
allInvoiced.forEach((inv, idx) => {
  if (!matchedInv.has(idx)) {
    console.log(`   Factura ${inv.factura}: ${inv.nombre} | Qty=${inv.cantidad} | Monto=$${inv.monto}`);
  }
});

console.log('\nTotal Diferencia calculada en emparejados: $' + totalDiff);
