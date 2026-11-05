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

let bqRaw = fs.readFileSync('tests/query_po_bq.json');
let bqStr = bqRaw.toString('utf8');
if (bqStr.charCodeAt(0) === 0xFEFF || bqStr.startsWith('\u0000') || bqRaw[0] === 0xFF && bqRaw[1] === 0xFE) {
  bqStr = bqRaw.toString('utf16le').replace(/^\uFEFF/, '');
}
const poItems = JSON.parse(bqStr.trim());
const poDelivered = poItems.filter(p => parseInt(p.quantity_delivered || '0', 10) > 0);

console.log(`Invoice items: ${invItems.length}`);
console.log(`PO Delivered items: ${poDelivered.length}`);

// Let's pair them up by matching quantity first, then description similarity
const pairings = [];
const usedPo = new Set();

invItems.forEach((inv, invIdx) => {
  // Candidate POs with exact same quantity delivered
  let candidates = poDelivered.filter((p, pIdx) => !usedPo.has(pIdx) && parseInt(p.quantity_delivered, 10) === inv.qty);
  
  if (candidates.length === 0) {
    // Look among all unused
    candidates = poDelivered.filter((p, pIdx) => !usedPo.has(pIdx));
  }

  // Score candidate by word overlap and price similarity
  let bestCandidate = null;
  let bestPoIdx = -1;
  let bestScore = -999;

  candidates.forEach(cand => {
    const origPoIdx = poDelivered.indexOf(cand);
    const invWords = inv.nmb.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const poWords = cand.product_name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    let overlap = invWords.filter(w => poWords.includes(w)).length;
    
    // Weight match
    const invG = (inv.nmb.match(/(\d+)\s*g/i) || [])[1];
    const poG = (cand.product_name.match(/(\d+)\s*g/i) || [])[1];
    if (invG && poG && invG === poG) overlap += 3;

    // Price similarity bonus
    const prcDiff = Math.abs(inv.prc - parseFloat(cand.cost_unit_lc));
    const prcBonus = prcDiff < 10 ? 5 : (prcDiff < 100 ? 2 : 0);

    const totalScore = overlap * 2 + prcBonus;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCandidate = cand;
      bestPoIdx = origPoIdx;
    }
  });

  if (bestCandidate) {
    usedPo.add(bestPoIdx);
    pairings.push({
      invCode: inv.cdg,
      invName: inv.nmb,
      invQty: inv.qty,
      invPrc: inv.prc,
      invMnt: inv.mnt,
      poSku: bestCandidate.sku_id,
      poName: bestCandidate.product_name,
      poQty: parseInt(bestCandidate.quantity_delivered, 10),
      poCost: parseFloat(bestCandidate.cost_unit_lc),
      poAmt: parseFloat(bestCandidate.amt_delivered_lc),
      diffMnt: inv.mnt - parseFloat(bestCandidate.amt_delivered_lc)
    });
  }
});

console.log('\n--- 1-to-1 PAIRINGS FOUND ---');
let totalInv = 0;
let totalPo = 0;
let totalDiff = 0;

pairings.forEach((p, i) => {
  totalInv += p.invMnt;
  totalPo += p.poAmt;
  totalDiff += p.diffMnt;
  console.log(`[${i+1}] Inv: "${p.invName}" (${p.invCode}) Qty:${p.invQty} Prc:$${p.invPrc} -> PO: "${p.poName}" (${p.poSku}) Qty:${p.poQty} Cost:$${p.poCost} | Diff: $${p.diffMnt}`);
});

console.log('\n================================');
console.log(`Total Facturado:   $${totalInv}`);
console.log(`Total Recepcionado:$${totalPo}`);
console.log(`DESCALCE TOTAL:    $${totalDiff} CLP`);
console.log('================================');
