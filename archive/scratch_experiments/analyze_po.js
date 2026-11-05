const fs = require('fs');
const raw = fs.readFileSync('po521015_items_utf8.json', 'utf8').replace(/^\uFEFF/, '');
const items = JSON.parse(raw);
console.log('Total items in PO521015:', items.length);

let totalOrdered = 0;
let totalDelivered = 0;
let totalDiff = 0;

const diffItems = [];

items.forEach(it => {
  const ord = Number(it.amt_ordered_lc) || 0;
  const del = Number(it.amt_delivered_lc) || 0;
  const diff = Number(it.diff_ordered_delivered) || 0;
  totalOrdered += ord;
  totalDelivered += del;
  totalDiff += diff;
  if (Math.abs(diff) > 0.01 || Number(it.quantity_ordered) !== Number(it.quantity_delivered)) {
    diffItems.push(it);
  }
});

console.log('Total ordered:', totalOrdered);
console.log('Total delivered:', totalDelivered);
console.log('Total diff ordered - delivered:', totalDiff);
console.log('\n--- SKUs with differences (' + diffItems.length + ') ---');
diffItems.forEach(d => {
  console.log(`SKU: ${d.sku_id} | ${d.product_name} | QtyOrd: ${d.quantity_ordered} | QtyDel: ${d.quantity_delivered} | Cost: ${d.cost_unit_lc} | DiffAmt: ${d.diff_ordered_delivered}`);
});
