const fs = require('fs');

let raw = fs.readFileSync('scratch/po519695_items.json');
let text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
const bqItems = JSON.parse(text);

const xml = fs.readFileSync('scratch/factura_10198005.xml', 'latin1');
const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
const invItems = matches.map(m => ({
  nro: (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1],
  name: (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1],
  qty: parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1]),
  prc: parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1]),
  monto: parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1])
}));

console.log('--- COMPARACION BQ vs FACTURA ---');
bqItems.forEach(b => {
  console.log(`BQ: ${b.sku_id} | ${b.product_name} | Ord: ${b.quantity_ordered} | Del: ${b.quantity_delivered} | Cost: ${b.unit_cost}`);
});
console.log('\n--- FACTURA ITEMS ---');
invItems.forEach(i => {
  console.log(`INV: L${i.nro} | ${i.name} | Qty: ${i.qty} | Prc: ${i.prc} | Monto: ${i.monto}`);
});
