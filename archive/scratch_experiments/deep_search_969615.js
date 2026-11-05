const fs = require('fs');

const invLines = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/all_invoice_lines_parsed.json', 'utf8'));

let raw = fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/po526132_items.json');
let text = '';
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
else text = raw.toString('utf8').replace(/^\uFEFF/, '');
text = text.replace(/^\uFEFF/, '').trim();
const bqItems = JSON.parse(text);

console.log('Searching for 969615 or 82307...');

// 1. Is 969615 the sum of some delivered items?
// Total delivered is 1827284.58.
// What if 969615 is delivered of some category or warehouse?

// 2. Is 82307 in BQ?
// Let's check single items or sums of items in BQ:
for (let i = 0; i < bqItems.length; i++) {
  const b1 = bqItems[i];
  const a1 = parseFloat(b1.amt_ordered) || 0;
  const d1 = parseFloat(b1.amt_delivered) || 0;
  const diff1 = a1 - d1;
  if (Math.abs(a1 - 82307) < 5 || Math.abs(d1 - 82307) < 5 || Math.abs(diff1 - 82307) < 5) {
    console.log('Single BQ item match 82307:', b1.product_name, a1, d1, diff1);
  }
  for (let j = i + 1; j < bqItems.length; j++) {
    const b2 = bqItems[j];
    const a2 = parseFloat(b2.amt_ordered) || 0;
    const d2 = parseFloat(b2.amt_delivered) || 0;
    const diff2 = a2 - d2;
    if (Math.abs((diff1 + diff2) - 82307) < 5) {
      console.log('2 BQ items diff match 82307:', b1.product_name, '+', b2.product_name, '=', diff1 + diff2);
    }
    if (Math.abs((d1 + d2) - 82307) < 5) {
      console.log('2 BQ items delivered match 82307:', b1.product_name, '+', b2.product_name, '=', d1 + d2);
    }
  }
}

// 3. What if 82307 is in Invoice Lines?
for (let i = 0; i < invLines.length; i++) {
  const l1 = invLines[i];
  if (Math.abs(l1.monto - 82307) < 5) {
    console.log('Single Inv line match 82307:', l1.name, l1.monto);
  }
  for (let j = i + 1; j < invLines.length; j++) {
    const l2 = invLines[j];
    if (Math.abs((l1.monto + l2.monto) - 82307) < 5) {
      console.log('2 Inv lines match 82307:', l1.name, '+', l2.name, '=', l1.monto + l2.monto);
    }
  }
}

// 4. What about 969615 in differences?
// Could 969615 be the difference of some invoices?
// Invoices are:
// 97913615: 36063
// 97913614: 196943
// 97913616: 599601
// 97913613: 2046600
// What if 969615 is:
// Factura 97913613 alone? 2046600 - delivered = 219315
// What if 97913613 + 97913616? 2646201 - delivered = 818916
// What if 97913613 + 97913614 + 97913615? 2279606 - delivered = 452321
