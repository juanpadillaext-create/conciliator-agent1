const fs = require('fs');

let raw = fs.readFileSync('scratch/po519695_items.json');
let text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
const bqItems = JSON.parse(text);

const TARGET = 233384;
console.log('Searching for target:', TARGET);

// 1. Check subset sums of line differences:
const diffs = bqItems.map(b => ({
  name: b.product_name,
  sku: b.sku_id,
  diff: parseFloat(b.amt_ordered) - parseFloat(b.amt_delivered),
  ord: parseFloat(b.amt_ordered),
  del: parseFloat(b.amt_delivered),
  cost: parseFloat(b.unit_cost)
}));

// Check all subsets of diffs
const n = diffs.length;
for (let mask = 0; mask < (1 << n); mask++) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (mask & (1 << i)) s += diffs[i].diff;
  }
  if (Math.abs(s - TARGET) < 1) {
    console.log(`Subset of diffs equals TARGET! mask=${mask}`);
  }
  if (Math.abs(s - (TARGET - 235631)) < 1) {
    console.log(`Subset equals difference!`);
  }
}

// 2. What about 235631.40 - 233384 = 2247.40?
// Check if 2247.40 is a difference of something:
// Let's check difference between BQ unit costs and something:
diffs.forEach(d1 => {
  diffs.forEach(d2 => {
    if (Math.abs(d1.diff - d2.diff - 2247.40) < 1) {
      console.log(`d1 - d2 = 2247.40: ${d1.name} vs ${d2.name}`);
    }
  });
});

// Check if 2247.40 is unit cost or tax or discount:
// What is 2247.40?
// Look at 176147.40 (Jack Daniels)
// 176147.40 - 173900 = 2247.40?
// What about (qOrd - qDel) * cost?
// Let's check if user used different unit costs:
// E.g. what if Jack Daniels unit cost was:
// 176147.40 - 2247.40 = 173900? 173900 / 12 = 14491.666
// What if Peroni or Bear Beer?
// 4124 - 2247.40 = 1876.60
// 9280 - 2247.40 = 7032.60
// 8172 - 2247.40 = 5924.60
// 28608 - 2247.40 = 26360.60
// 9300 - 2247.40 = 7052.60
