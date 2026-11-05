const fs = require('fs');

// We want to test CruceEngine logic with PO 521015
const audit = JSON.parse(fs.readFileSync('po521015_audit_ready.json', 'utf8'));

// Build barcode mapping so each invoice item code maps to the corresponding PO item
const manualMap = {
  '502682': '3GU09T',
  '502679': 'X426S2',
  '503413': 'YN667H',
  '504186': '7WR04L',
  '964670': 'D0B1PL',
  '504571': '15133050',
  '503170': 'YCVU0B',
  '502686': 'OPOC5G',
  '502702': '21653362',
  '502701': '21653364',
  '502700': 'L7S6M7'
};

// Add invoice codes to barcodes of PO items
audit.all_po_items.forEach(poi => {
  if (!poi.barcodes) poi.barcodes = [poi.sku_id];
  // check manualMap reverse
  for (const [invCode, pSku] of Object.entries(manualMap)) {
    if (pSku === poi.sku_id) {
      if (!poi.barcodes.includes(invCode)) poi.barcodes.push(invCode);
    }
  }
});

// Also map other items:
const items72 = audit.facturas['56500972'].items;
const items37 = audit.facturas['56500937'].items;
const allInv = [...items72, ...items37];

function clean(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

allInv.forEach(inv => {
  const normInv = clean(inv.descripcion);
  let best = null;
  let bestScore = -1;
  audit.all_po_items.forEach(poi => {
    const normPo = clean(poi.product_name);
    const invWords = normInv.split(' ').filter(w => w.length > 2);
    const poWords = normPo.split(' ').filter(w => w.length > 2);
    let common = 0;
    invWords.forEach(w => { if (poWords.includes(w)) common++; });
    let score = common / Math.max(invWords.length, poWords.length);
    if (Math.abs(inv.precio_facturado - poi.cost_unit_lc) < 5) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = poi;
    }
  });
  if (best && bestScore > 0.35) {
    if (!best.barcodes.includes(inv.codigo)) best.barcodes.push(inv.codigo);
    if (inv.codigo.length >= 4) {
      // Also add numeric prefix if present in description
      const prefix = inv.descripcion.match(/^(\d+)/)?.[1];
      if (prefix && !best.barcodes.includes(prefix)) best.barcodes.push(prefix);
    }
  }
});

console.log('PO Items barcode mapping populated.');
const mappedCount = audit.all_po_items.filter(p => p.barcodes.length > 1).length;
console.log('PO items with mapped invoice codes:', mappedCount, 'of', audit.all_po_items.length);

// Calculate total diff between invoiced and delivered
const totalFac = allInv.reduce((s, i) => s + i.monto_facturado, 0);
const totalRec = audit.all_po_items.reduce((s, p) => s + p.amt_delivered_lc, 0);
console.log('Total Facturado:', totalFac);
console.log('Total Recepcionado:', totalRec);
console.log('Diferencia neta esperada:', totalFac - totalRec);

fs.writeFileSync('po521015_audit_complete.json', JSON.stringify(audit, null, 2));
