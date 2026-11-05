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

console.log('Factura Monto Neto Total:', invItems.reduce((s, i) => s + i.monto, 0));
console.log('Factura amount_net header:', 362423);

// Let's check how the user could get 233,384:
// 235,631.40 - 233,384 = 2,247.40
// What if user calculated:
// Total Facturado de alguna forma?
// Or what if 233,384 is:
// Let's test combinations of sums:
const bqDiffs = [176147.4, 9300, 28608, 4124, 9280, 8172];
console.log('Sum of bqDiffs:', bqDiffs.reduce((a,b)=>a+b,0)); // 235631.4

// Look at Bear Beer: amt_ord: 12372, amt_del: 8248, diff: 4124
// Peroni Sin Alcohol: amt_ord: 27840, amt_del: 18560, diff: 9280
// Peroni Lager 330: amt_ord: 24516, amt_del: 16344, diff: 8172
// Mr Big: 9300
// Peroni 500: 28608
// Jack Daniels: 176147.4

// What if the user subtracted something from 235,631.40?
// What equals 2,247.40?
// 26709.96 / 12 = 2225.83
// 25580.04 / 12 = 2131.67
// 12790.02 / 6 = 2131.67
// Look at: 2,247.40!
// Could 2,247.40 be:
// 235,631.40 - 2,247.40 = 233,384!
// Where is 2,247.40 in Viña del Mar or in the PO?
