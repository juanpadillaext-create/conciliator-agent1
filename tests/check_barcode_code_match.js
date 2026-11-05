const fs = require('fs');

const xml = fs.readFileSync('tests/factura_56458220.xml', 'utf8');
const invItems = [];
const detRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
let m;
while ((m = detRegex.exec(xml)) !== null) {
  const b = m[1];
  const cdg = (b.match(/<VlrCodigo>([\s\S]*?)<\/VlrCodigo>/) || [])[1] || '';
  const nmb = (b.match(/<NmbItem>([\s\S]*?)<\/NmbItem>/) || [])[1] || '';
  const qty = parseFloat((b.match(/<QtyItem>([\s\S]*?)<\/QtyItem>/) || [])[1] || '0');
  const prc = parseFloat((b.match(/<PrcItem>([\s\S]*?)<\/PrcItem>/) || [])[1] || '0');
  const mnt = parseFloat((b.match(/<(?:MontoItem|MntItem)>([\s\S]*?)<\/(?:MontoItem|MntItem)>/) || [])[1] || '0');
  invItems.push({ cdg: cdg.trim(), nmb: nmb.trim(), qty, prc, mnt });
}

let bqRaw = fs.readFileSync('tests/po_barcodes.json');
let bqStr = bqRaw.toString('utf8');
if (bqStr.charCodeAt(0) === 0xFEFF || bqStr.startsWith('\u0000') || bqRaw[0] === 0xFF && bqRaw[1] === 0xFE) {
  bqStr = bqRaw.toString('utf16le').replace(/^\uFEFF/, '');
}
const poItems = JSON.parse(bqStr.trim());

console.log(`Checking ${invItems.length} invoice items against ${poItems.length} PO items:\n`);

invItems.forEach((inv, idx) => {
  const cdg = inv.cdg;
  let matched = null;
  let matchReason = '';

  // 1. Direct barcode substring (barcode contains cdg or cdg contains barcode)
  for (const po of poItems) {
    const barcodes = (po.barcodes_str || '').split(',').map(b => b.trim().replace(/^0+/, ''));
    for (const b of barcodes) {
      if (b.includes(cdg) || cdg.includes(b)) {
        matched = po;
        matchReason = `Barcode Match (${b} contains ${cdg})`;
        break;
      }
    }
    if (matched) break;
  }

  // 2. Token match
  if (!matched) {
    // Simple word overlap
    const invWords = inv.nmb.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    let bestPo = null;
    let maxOverlap = 0;
    for (const po of poItems) {
      const poWords = po.product_name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      const overlap = invWords.filter(w => poWords.includes(w)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestPo = po;
      }
    }
    if (bestPo && maxOverlap >= 2) {
      matched = bestPo;
      matchReason = `Overlap Match (${maxOverlap} words)`;
    }
  }

  console.log(`[${idx+1}] Inv Code: ${cdg.padEnd(8)} | Desc: "${inv.nmb.substring(0, 35).padEnd(35)}" -> ${matched ? `MATCH [${matchReason}]: SKU ${matched.sku_id} - "${matched.product_name}"` : 'NO MATCH'}`);
});
