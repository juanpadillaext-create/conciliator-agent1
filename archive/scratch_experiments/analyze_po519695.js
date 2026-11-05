const fs = require('fs');

let raw = fs.readFileSync('scratch/po519695_items.json');
let text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
const data = JSON.parse(text);

console.log('--- ITEMS DE PO 519695 ---');
data.forEach(d => {
  const qO = parseFloat(d.quantity_ordered);
  const qD = parseFloat(d.quantity_delivered);
  const cost = parseFloat(d.unit_cost);
  const aO = parseFloat(d.amt_ordered);
  const aD = parseFloat(d.amt_delivered);
  const diff = aO - aD;
  console.log(`${d.sku_id} | ${d.product_name} | Ord: ${qO} | Del: ${qD} | Cost: ${cost} | aO: ${aO.toFixed(2)} | aD: ${aD.toFixed(2)} | Diff: ${diff.toFixed(2)}`);
});
