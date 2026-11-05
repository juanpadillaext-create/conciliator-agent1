const fs = require('fs');

const invLines = JSON.parse(fs.readFileSync('scratch/all_invoice_lines_parsed.json', 'utf8'));

let raw = fs.readFileSync('scratch/po526132_items.json');
let text = '';
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
else text = raw.toString('utf8').replace(/^\uFEFF/, '');
text = text.replace(/^\uFEFF/, '').trim();
const bqItems = JSON.parse(text);

console.log('Invoice lines count:', invLines.length);
console.log('BQ items count:', bqItems.length);

// Group invoice lines by code / name
// In DTE: code is like 120775 (Andina internal product code)
// Let's see what codes exist in invoice lines vs BQ items (supplier_sku, barcodes, sku_id)
console.log('Sample invoice lines:');
invLines.slice(0, 5).forEach(l => console.log(l));

console.log('Sample BQ items:');
bqItems.slice(0, 5).forEach(b => console.log(`SKU: ${b.sku_id} | Name: ${b.product_name} | Ord: ${b.quantity_ordered} | Del: ${b.quantity_delivered} | Cost: ${b.unit_cost}`));

// Let's find matches between invLines and bqItems
// How do they match?
// By name or code?
let matches = 0;
let totalInvMatchedNet = 0;
let totalBqDeliveredNet = 0;

invLines.forEach(l => {
  const normInv = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const found = bqItems.find(b => {
    const normBq = b.product_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normBq.includes(normInv.slice(0, 8)) || normInv.includes(normBq.slice(0, 8));
  });
  if (found) {
    matches++;
  }
});

console.log(`Matched ${matches} / ${invLines.length} invoice lines by name substring.`);
