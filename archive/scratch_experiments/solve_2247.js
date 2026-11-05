const fs = require('fs');

let raw = fs.readFileSync('scratch/po519695_items.json');
let text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
const bqItems = JSON.parse(text);

const TARGET = 233384;
const WEBAPP = 235631.40;
const DIFF = WEBAPP - TARGET; // 2247.40

console.log('TARGET:', TARGET);
console.log('WEBAPP:', WEBAPP);
console.log('DIFF:', DIFF);

// 1. Is DIFF exactly the cost of 1 unit or combination of units?
bqItems.forEach(b => {
  const c = parseFloat(b.unit_cost);
  const qO = parseFloat(b.quantity_ordered);
  const qD = parseFloat(b.quantity_delivered);
  // Check if cost equals 2247.4
  console.log(`${b.product_name}: cost=${c}, diff_q=${qO - qD}, line_diff=${(qO-qD)*c}`);
});

// 2. What if 1 unit of some item was delivered?
// If delivered +1 unit of something:
bqItems.forEach(b => {
  const c = parseFloat(b.unit_cost);
  for (let q = 1; q <= 6; q++) {
    if (Math.abs(q * c - DIFF) < 5) {
      console.log(`MATCH 1: Del +${q} units of ${b.product_name} reduces diff by ${q*c} (target diff: ${DIFF})`);
    }
    if (Math.abs(WEBAPP - q * c - TARGET) < 5) {
      console.log(`MATCH 1b: ${b.product_name} * ${q} = ${q*c}`);
    }
  }
});

// 3. What if there is a price difference?
// What if cost in OC was higher than SAP/invoice or vice versa?
// 4. Look at the invoice items in XML:
const xml = fs.readFileSync('scratch/factura_10198005.xml', 'latin1');
const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
const invItems = matches.map(m => ({
  name: (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1],
  qty: parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1]),
  prc: parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1]),
  monto: parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1])
}));

console.log('\n--- MATCHING INVOICE AND BQ DELIVERED ---');
// Let's match each BQ item with Invoice item
// BQ items delivered:
let totalDelivered = 168952.02;
// In Factura 10198005:
// Line 1: Peroni Lager 330: Qty 24 (which is 4 packs of 6) | Monto: 13978
// Line 2: Mr Big: Qty 6 | Monto: 5049 (Note: NC credited this entire 5049!)
// Line 3: Bear Beer: Qty 24 (4 packs of 6) | Monto: 6089
// Line 4: Peroni Sin Alcohol: Qty 24 (4 packs of 6) | Monto: 15327
// Line 5: Secreto Peruano: Qty 12 | Monto: 23507
// Line 6: Undurraga Moscato: Qty 12 | Monto: 26217
// Line 7: Oveja Negra: Qty 12 | Monto: 21915
// Line 8: Aliwen Cab/Syr: Qty 6 | Monto: 9457
// Line 9: Aliwen Carmenere: Qty 12 | Monto: 18914
// Line 10: Jack Daniels: Qty 12 | Monto: 171810
let totalFacturado = invItems.reduce((s, i) => s + i.monto, 0);
console.log('Total Facturado Detalle:', totalFacturado);

// What if the user matched Factura items against BQ?
// Notice in Factura:
// Delivered in Bodega Viña:
// Jack Daniels: Del = 0! In Factura: billed 171,810!
// Mr Big: Del = 0! In Factura: billed 5,049 (and NC credited 5,049 neto + taxes = 9,609 with ILA/IVA)
// Peroni Lager 500 (JQN63D): Del = 0! In Factura: NOT BILLED (0)!
// Bear Beer: Del = 4 packs (24 cans). In Factura: billed 24 cans = 6,089!
// Peroni Sin Alcohol: Del = 4 packs (24 bot). In Factura: billed 24 bot = 15,327!
// Peroni Lager 330: Del = 4 packs (24 bot). In Factura: billed 24 bot = 13,978!
// Oveja Negra: Del = 12. In Factura: billed 12 = 21,915!
// Aliwen Cab/Syr: Del = 6. In Factura: billed 6 = 9,457!
// Undurraga Moscato: Del = 12. In Factura: billed 12 = 26,217!
// Aliwen Carmenere: Del = 12. In Factura: billed 12 = 18,914!
// Secreto Peruano: Del = 12. In Factura: billed 12 = 23,507!

console.log('Notice: BQ ordered Jack Daniels = 176,147.40, but Factura Jack Daniels = 171,810!');
console.log('Difference on Jack Daniels:', 176147.40 - 171810); // 4337.40
