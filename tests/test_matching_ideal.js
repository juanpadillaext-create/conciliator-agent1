const fs = require('fs');

// Test our improved logic on invoice 56458220 and PO519527
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

// Dictionary of Bimbo / Ideal
const BIMBO_DICT = {
  '965383': '4FM9KH',
  '4388': '15132888',
  '501107': '57800104',
  '501866': '15132657',
  '502988': '0OZS1W',
  '503410': '5DB8MI',
  '504104': 'G45RIF',
  '504103': '80AZ5R',
  '504186': '7WR04L',
  '504337': 'JQK9E0',
  '506369': 'KUPQHW',
  '506315': 'QJSXU0',
  '964621': 'D5WBYD',
  '964620': 'K6SYAN',
  '964614': 'AF9QGW',
  '964670': 'D0B1PL',
  '964506': '3LW16R',
  '23634': '15132899',
  '40279': 'UL1N30',
  '964588': '15132703',
  '965202': 'SDZUIN',
  '506558': 'POE65F',
  '503170': 'YCVU0B',
  '502686': 'OPOC5G',
  '502687': 'PZKG2J',
  '502682': '3GU09T',
  '502679': 'X426S2'
};

const matchedIndices = new Set();
const matches = [];

invItems.forEach((inv, idx) => {
  const cdg = inv.cdg;
  let match = null;
  let matchType = 'none';

  // Tier 1: Exact code or barcode
  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    if (po.sku_id === cdg || (po.supplier_sku && po.supplier_sku === cdg)) {
      match = po;
      matchType = 'exact_sku';
      matchedIndices.add(i);
      break;
    }
  }

  // Tier 2: Dictionary
  if (!match && BIMBO_DICT[cdg]) {
    const targetSku = BIMBO_DICT[cdg];
    for (let i = 0; i < poItems.length; i++) {
      if (matchedIndices.has(i)) continue;
      const po = poItems[i];
      if (po.sku_id === targetSku) {
        match = po;
        matchType = 'catalog_dictionary';
        matchedIndices.add(i);
        break;
      }
    }
  }

  matches.push({ inv, match, matchType });
});

console.log(`Matched: ${matches.filter(m => m.match).length} / ${invItems.length}`);
let totalFacturado = 0;
let totalRecepcionado = 0;
let totalDiferencia = 0;

matches.forEach((m, idx) => {
  totalFacturado += m.inv.mnt;
  const rec = m.match ? (parseFloat(m.match.amt_delivered_lc) || 0) : 0;
  totalRecepcionado += rec;
  const diff = m.inv.mnt - rec;
  totalDiferencia += diff;
  console.log(`[${idx+1}] Inv: "${m.inv.nmb.substring(0, 30)}" ($${m.inv.mnt}) -> PO: "${m.match?.product_name?.substring(0, 30)}" ($${rec}) | Diff: $${diff}`);
});

console.log('=============================');
console.log('TOTAL FACTURADO:   $', totalFacturado);
console.log('TOTAL RECEPCIONADO:$', totalRecepcionado);
console.log('TOTAL DESCALCE:    $', totalDiferencia);
console.log('=============================');
