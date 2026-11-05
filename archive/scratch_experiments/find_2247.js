const fs = require('fs');

let raw = fs.readFileSync('scratch/po519695_items.json');
let text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
const bqItems = JSON.parse(text);

console.log('--- FIND 2247.40 ---');
bqItems.forEach((b, i) => {
  const diff = parseFloat(b.amt_ordered) - parseFloat(b.amt_delivered);
  console.log(`Item ${i}: ${b.product_name} | amt_ord: ${b.amt_ordered} | amt_del: ${b.amt_delivered} | diff: ${diff}`);
  if (Math.abs(diff - 2247.4) < 10) console.log('--> MATCH DIFF!');
  if (Math.abs(parseFloat(b.amt_ordered) - 2247.4) < 10) console.log('--> MATCH ORDERED!');
  if (Math.abs(parseFloat(b.amt_delivered) - 2247.4) < 10) console.log('--> MATCH DELIVERED!');
});

// Check differences between unit costs
bqItems.forEach(b => {
  const cost = parseFloat(b.unit_cost);
  if (Math.abs(cost - 2247.4) < 100) {
    console.log(`Cost close to 2247: ${b.product_name} (Cost: ${cost})`);
  }
});
