const fs = require('fs');

const invLines = JSON.parse(fs.readFileSync('scratch/all_invoice_lines_parsed.json', 'utf8'));

let raw = fs.readFileSync('scratch/po526132_items.json');
let text = '';
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
else text = raw.toString('utf8').replace(/^\uFEFF/, '');
text = text.replace(/^\uFEFF/, '').trim();
const bqItems = JSON.parse(text);

console.log('Invoice lines:', invLines.length);
console.log('BQ items:', bqItems.length);

// Let's print all 72 invoice lines with details
invLines.forEach((l, i) => {
  console.log(`[Inv ${i+1}] F:${l.folio} | Code:${l.code} | Name:${l.name} | Qty:${l.qty} ${l.uom} | Prc:${l.prc} | Monto:${l.monto} | Imp:${l.codImpAdic}`);
});
