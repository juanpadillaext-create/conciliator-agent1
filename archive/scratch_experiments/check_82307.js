const fs = require('fs');

const invLines = JSON.parse(fs.readFileSync('scratch/all_invoice_lines_parsed.json', 'utf8'));

let raw = fs.readFileSync('scratch/po526132_items.json');
let text = '';
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
else text = raw.toString('utf8').replace(/^\uFEFF/, '');
text = text.replace(/^\uFEFF/, '').trim();
const bqItems = JSON.parse(text);

console.log('=== Checking lines in Invoices around 82.307 ===');
invLines.forEach(l => {
  if (Math.abs(l.monto - 82307) < 500) {
    console.log(`Invoice line close to 82307: Folio ${l.folio} | Code: ${l.code} | ${l.name} | Monto: ${l.monto} | Qty: ${l.qty} | Prc: ${l.prc}`);
  }
});

console.log('=== Checking lines in BQ items around 82.307 ===');
bqItems.forEach(b => {
  const amtOrd = parseFloat(b.amt_ordered) || 0;
  const amtDel = parseFloat(b.amt_delivered) || 0;
  const diffAmt = amtOrd - amtDel;
  if (Math.abs(amtOrd - 82307) < 500 || Math.abs(amtDel - 82307) < 500 || Math.abs(diffAmt - 82307) < 500) {
    console.log(`BQ line close to 82307: SKU ${b.sku_id} | ${b.product_name} | amtOrd: ${amtOrd} | amtDel: ${amtDel} | diff: ${diffAmt}`);
  }
});

// Check combinations of 2 or 3 items
console.log('\n=== Checking if 969.615 is a sum of subset of invoice lines or differences ===');
// Total facturado = 2.879.207
// Recepcionado = 1.827.284.58
// Diff = 1.051.922.42
// If someone calculated 969,615:
// What if 969,615 is:
// 1) 1.051.922.42 - 82.307.42
// Look at NCs!
// Folio 25243763: Total is 80314, Neto is 60807, IVA is 11553, ILA is 7954.
// Folio 25243761: Total is 69668, Neto is 50481, IVA is 9591, ILA is 9596.
// Folio 25243760: Total is 26247, Neto is 21182, IVA is 4025, ILA is 1040.
// What if NC 25243763 + something?
// What about:
// 2879207 - (something)?
console.log('2879207 - 969615 =', 2879207 - 969615); // 1.909.592 (recepcionado según el usuario?)
console.log('1827284.58 + 82307 =', 1827284.58 + 82307); // 1.909.592!
