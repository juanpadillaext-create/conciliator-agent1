const fs = require('fs');

const data = JSON.parse(fs.readFileSync('po521015_audit_ready.json', 'utf8'));
const items72 = data.facturas['56500972'].items;
const items37 = data.facturas['56500937'].items;
const poItems = data.all_po_items;

function clean(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('Factura 56500937 mapping:');
items37.forEach(inv => {
  // 502682 is Galleton Chocolate Chip (3GU09T)
  // 502679 is Galleton Almendra (X426S2)
  const match = poItems.find(p => p.sku_id === (inv.codigo === '502682' ? '3GU09T' : 'X426S2'));
  console.log(`   ${inv.codigo} -> ${match.sku_id} (${match.product_name})`);
});

// For Factura 56500972:
console.log('\nMapping Factura 56500972 items:');
const mapping = [];
const usedPo = new Set();

items72.forEach(inv => {
  const normInv = clean(inv.descripcion);
  let best = null;
  let bestScore = -1;

  poItems.forEach((poi, pIdx) => {
    if (usedPo.has(pIdx)) return;
    const normPo = clean(poi.product_name);

    // Exact price match gives strong hint
    const priceDiff = Math.abs(inv.precio_facturado - poi.cost_unit_lc);
    
    // Words match
    const invWords = normInv.split(' ').filter(w => w.length > 2);
    const poWords = normPo.split(' ').filter(w => w.length > 2);
    let common = 0;
    invWords.forEach(w => { if (poWords.includes(w)) common++; });
    let score = common / Math.max(invWords.length, poWords.length);

    if (priceDiff < 5) score += 0.5;
    if (Math.abs(inv.cantidad_facturada - poi.quantity_ordered) < 0.1) score += 0.2;

    if (score > bestScore) {
      bestScore = score;
      best = { poi, pIdx, score, priceDiff };
    }
  });

  if (best && bestScore > 0.4) {
    usedPo.add(best.pIdx);
    mapping.push({ inv, poi: best.poi, score: best.score });
  } else {
    mapping.push({ inv, poi: null, score: 0 });
  }
});

console.log('Mapped count:', mapping.filter(m => m.poi !== null).length, 'of', items72.length);
const unmapped = mapping.filter(m => m.poi === null);
if (unmapped.length > 0) {
  console.log('Unmapped:');
  unmapped.forEach(u => console.log('   ', u.inv.codigo, u.inv.descripcion, u.inv.monto_facturado));
}
