const fs = require('fs');

let raw = fs.readFileSync('scratch/po519695_items.json');
let text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
const bqItems = JSON.parse(text);

const xml = fs.readFileSync('scratch/factura_10198005.xml', 'latin1');
const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
const invItems = matches.map(m => ({
  name: (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1],
  qty: parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1]),
  prc: parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1]),
  dsc: parseFloat((m.match(/<DescuentoMonto>([\d.]+)<\/DescuentoMonto>/) || [])[1] || '0'),
  monto: parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1])
}));

console.log('--- RECONCILIACION ITEM POR ITEM ---');
// Let's pair each BQ item with Invoice item
const pairings = [
  { bqName: 'Whisky Jack Daniel\'s Tennessee Honey 750 ml', invName: 'JACK DANIELS HONEY', factor: 1 },
  { bqName: 'Bebida Energizante Mr. Big Zero Botella 1.5 L', invName: 'BEBIDA ENERGETICA MR. BIG ZERO', factor: 1 },
  { bqName: '4 Pack Cerveza Peroni Lager 500 ml', invName: null, factor: 1 }, // NOT in invoice!
  { bqName: 'Cerveza Bear Beer Lager 6 x 500 ml', invName: 'BEAR BEER LAGER', factor: 6 }, // 4 packs = 24 cans
  { bqName: 'Cerveza Peroni Nastro Azzurro Sin Alcohol 6 x 330 ml', invName: 'PERONI SIN ALCOHOL', factor: 6 }, // 4 packs = 24 bot
  { bqName: '6 Pack Cerveza Botella Peroni Lager 330 ml', invName: 'PERONI LAGER 330CC', factor: 6 }, // 4 packs = 24 bot
  { bqName: 'Vino Carmenere-Merlot Oveja Negra Reserva 750 ml', invName: 'OVEJA NEGRA CARM/MERLOT', factor: 1 },
  { bqName: 'Vino Tinto Aliwen Cabernet Sauvignon Syrah 750 ml', invName: 'UNDURRAGA ALIWEN CAB/SYR', factor: 1 },
  { bqName: 'Espumante Undurraga Sweet Moscato 750 ml', invName: 'UNDURRAGA MOSCATO', factor: 1 },
  { bqName: 'Vino Tinto Aliwen Reserva Carmenere 750 ml', invName: 'UNDURRAGA ALIWEN CARMENER', factor: 1 },
  { bqName: 'Coctel Sour Limon 15° Secreto Peruano 1 L', invName: 'SECRETO PERUANO SOUR LIMON', factor: 1 }
];

let totalDifUnidades = 0;
let totalDifCosto = 0;
let totalDifFinal = 0;

pairings.forEach(p => {
  const bq = bqItems.find(b => b.product_name.includes(p.bqName) || p.bqName.includes(b.product_name));
  const inv = p.invName ? invItems.find(i => i.name.includes(p.invName)) : null;

  const qRec = bq ? parseFloat(bq.quantity_delivered) : 0;
  const costOc = bq ? parseFloat(bq.unit_cost) : 0;
  const qFac = inv ? (inv.qty / p.factor) : 0; // en unidades de OC (packs / botellas)
  const montoFac = inv ? inv.monto : 0;
  const costFac = qFac > 0 ? (montoFac / qFac) : 0;

  const difQ = qFac - qRec;
  const montoDifUnidades = difQ * costOc;
  const montoDifCosto = qFac * (costFac - costOc);
  const difTotalItem = montoDifUnidades + montoDifCosto;

  totalDifUnidades += montoDifUnidades;
  totalDifCosto += montoDifCosto;
  totalDifFinal += difTotalItem;

  console.log(`\nItem: ${p.bqName}`);
  console.log(`  OC: Q_Ord=${bq?bq.quantity_ordered:0}, Q_Rec=${qRec}, CostOC=${costOc}`);
  console.log(`  Fac: Q_Fac=${qFac}, MontoFac=${montoFac}, CostFac=${costFac.toFixed(2)}`);
  console.log(`  Dif_Q: ${difQ} -> MontoDifUnidades: ${montoDifUnidades.toFixed(2)}`);
  console.log(`  Dif_Cost: ${(costFac - costOc).toFixed(2)} -> MontoDifCosto: ${montoDifCosto.toFixed(2)}`);
  console.log(`  Total Item: ${difTotalItem.toFixed(2)}`);
});

console.log('\n=======================================');
console.log('Total Dif Unidades:', totalDifUnidades.toFixed(2));
console.log('Total Dif Costo:', totalDifCosto.toFixed(2));
console.log('Total Diferencia SKU x SKU:', totalDifFinal.toFixed(2));
