const fs = require('fs');

// 1. Parse XML lines
const xml = fs.readFileSync('tests/factura_56458220.xml', 'utf8');
const invLines = [];
const detRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
let m;
while ((m = detRegex.exec(xml)) !== null) {
  const b = m[1];
  const cdg = (b.match(/<VlrCodigo>([\s\S]*?)<\/VlrCodigo>/) || [])[1] || '';
  const nmb = (b.match(/<NmbItem>([\s\S]*?)<\/NmbItem>/) || [])[1] || '';
  const qty = parseFloat((b.match(/<QtyItem>([\s\S]*?)<\/QtyItem>/) || [])[1] || '0');
  const prc = parseFloat((b.match(/<PrcItem>([\s\S]*?)<\/PrcItem>/) || [])[1] || '0');
  const mnt = parseFloat((b.match(/<(?:MontoItem|MntItem)>([\s\S]*?)<\/(?:MontoItem|MntItem)>/) || [])[1] || '0');
  invLines.push({ cdg: cdg.trim(), nmb: nmb.trim(), qty, prc, mnt });
}

console.log(`Invoice lines: ${invLines.length}`);
const invTotalNet = invLines.reduce((acc, l) => acc + l.mnt, 0);
console.log(`Invoice Total Net: ${invTotalNet}`);

// Let's get BigQuery PO items for PO519527
const { execSync } = require('child_process');
const bqOut = execSync('Get-Content tests/query.sql -Raw | bq query --use_legacy_sql=false --label datacloud:antigravity --format=prettyjson', { shell: 'powershell.exe' });
const poItems = JSON.parse(bqOut.toString());
console.log(`BigQuery PO lines: ${poItems.length}`);

// Load CruceEngine logic from CruceEngine.gs
const cruceGs = fs.readFileSync('apps-script-webapp/CruceEngine.gs', 'utf8');

// Let's print out all invoice items and see what each one is
console.log('\n--- INVOICE ITEMS ---');
invLines.forEach((l, idx) => {
  console.log(`[${idx+1}] Code: ${l.cdg} | Qty: ${l.qty} | Prc: ${l.prc} | Mnt: ${l.mnt} | Name: ${l.nmb}`);
});

console.log('\n--- PO ITEMS ---');
poItems.forEach((p, idx) => {
  console.log(`[${idx+1}] SKU: ${p.sku_id} | QtyOrd: ${p.quantity_ordered} | QtyDeliv: ${p.quantity_delivered} | Cost: ${p.cost_unit_lc} | AmtDeliv: ${p.amt_delivered_lc} | Name: ${p.product_name}`);
});
