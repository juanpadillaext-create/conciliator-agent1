const fs = require('fs');

let raw = fs.readFileSync('scratch/po526132_items.json');
let text = '';
if (raw[0] === 0xff && raw[1] === 0xfe) {
  text = raw.toString('utf16le');
} else {
  text = raw.toString('utf8').replace(/^\uFEFF/, '');
}
text = text.replace(/^\uFEFF/, '').trim();
const data = JSON.parse(text);
console.log('Total items count:', data.length);
if (data.length > 0) {
  console.log('Supplier:', data[0].supplier_name);
  console.log('Warehouse:', data[0].warehouse_name);
  console.log('Date:', data[0].created_localtime_at);
  console.log('Invoices recorded in BQ:', data[0].inv_num_1, data[0].inv_num_2, data[0].inv_num_3);
}

let totOrdered = 0;
let totDelivered = 0;
let diffPhysical = 0;

data.forEach((item, idx) => {
  const qOrd = parseFloat(item.quantity_ordered) || 0;
  const qDel = parseFloat(item.quantity_delivered) || 0;
  const cost = parseFloat(item.unit_cost) || 0;
  const amtOrd = parseFloat(item.amt_ordered) || (qOrd * cost);
  const amtDel = parseFloat(item.amt_delivered) || (qDel * cost);
  totOrdered += amtOrd;
  totDelivered += amtDel;
  if (qOrd !== qDel) {
    const diffQ = qOrd - qDel;
    const diffAmt = diffQ * cost;
    diffPhysical += diffAmt;
    console.log(`[Diff] SKU: ${item.sku_id} | ${item.product_name} | Ord: ${qOrd} | Del: ${qDel} | Cost: ${cost} | DiffAmt: ${diffAmt.toFixed(2)}`);
  }
});

console.log('--- Totals from BQ ---');
console.log('Total Ordered:', totOrdered.toFixed(2));
console.log('Total Delivered:', totDelivered.toFixed(2));
console.log('Physical Shortage (Ordered - Delivered):', diffPhysical.toFixed(2));
console.log('Shortage with 19% IVA:', (diffPhysical * 1.19).toFixed(2));
