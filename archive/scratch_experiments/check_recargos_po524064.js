const fs = require('fs');

const f1 = parseXmlLines('scratch/doc_10207759.xml');
const f2 = parseXmlLines('scratch/doc_10207760.xml');
const nc = parseXmlLines('scratch/doc_6363032.xml');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

function parseXmlLines(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'latin1');
  const folio = (xml.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const mntNeto = parseFloat((xml.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || 0);
  const mntTotal = parseFloat((xml.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || 0);

  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  const lines = matches.map(m => {
    const cod = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || 0);
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || 0);
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || 0);
    return { folio, cod, name, qty, prc, monto };
  });

  const dscMatches = xml.match(/<DscRcgGlobal>[\s\S]*?<\/DscRcgGlobal>/g) || [];
  const dscRcgs = dscMatches.map(d => ({
    tipo: (d.match(/<TpoMov>(.*?)<\/TpoMov>/) || [])[1],
    valor: parseFloat((d.match(/<ValorDR>([\d.]+)<\/ValorDR>/) || [])[1] || 0)
  }));

  return { folio, mntNeto, mntTotal, lines, dscRcgs };
}

const sumLinesF1 = f1.lines.reduce((s, l) => s + l.monto, 0);
const sumLinesF2 = f2.lines.reduce((s, l) => s + l.monto, 0);
console.log('Suma lineas F1 (10207759):', sumLinesF1, '| Header MntNeto:', f1.mntNeto, '| Dif (Recargo):', f1.mntNeto - sumLinesF1);
console.log('Suma lineas F2 (10207760):', sumLinesF2, '| Header MntNeto:', f2.mntNeto, '| Dif (Recargo):', f2.mntNeto - sumLinesF2);

const sumLinesNetoTotal = sumLinesF1 + sumLinesF2;
console.log('Suma líneas ambas facturas (sin recargo global):', sumLinesNetoTotal);

// Compare with BigQuery received amount:
let bqDeliveredWithoutPeroni = 0;
bqItems.forEach(b => {
  bqDeliveredWithoutPeroni += parseFloat(b.amt_delivered);
});
console.log('BigQuery Total Recepcionado Bodega:', bqDeliveredWithoutPeroni);
console.log('Diferencia (Suma líneas facturas - BigQuery recepcionado):', sumLinesNetoTotal - bqDeliveredWithoutPeroni);

// Look at line by line comparison:
const MAP_FAC_TO_BQ = {
  'LI30300': '18425484', // Aperol
  'BE50055': '4UFLI4',   // Mr. Big 2.5L
  'CI25000': 'D16CDL',   // Bear Beer 500ml
  'CO30006': '18425486', // Secreto Peruano Sour
  'VI37003': '18629034', // Riccadonna Asti
  'VI37030': '18629032', // Riccadonna Moscato Rose
  'VN18345': 'C1GS91',   // Undurraga Zero Alcohol
  'VN18558': '4WUCZI',   // Undurraga Rosato RTD
  'LI40890': '2MKLXV',   // El Jimador Reposado
  'VN18084': '7Q0462',   // Aliwen Chardonnay
  'VN18306': '43706078', // Undurraga Baron Lacroix Brut
  'VN18251': '43705944', // Undurraga Brut 750ml
  'VN18555': 'T0DA5R',   // Undurraga Brut Lata 310ml
  'VN18089': '43706073', // Aliwen Carmenere
  'VN16231': '43705957'  // Oveja Negra Cab/Syr
};

const allLines = [...f1.lines, ...f2.lines];
let totalLineDiff = 0;
console.log('\n--- COMPARATIVA LÍNEA A LÍNEA (VALOR LÍNEA FACTURA VS VALOR BQ RECEPCIONADO) ---');
allLines.forEach(l => {
  const bqSku = MAP_FAC_TO_BQ[l.cod];
  const bq = bqItems.find(b => b.sku_id === bqSku);
  const bqDelAmt = bq ? parseFloat(bq.amt_delivered) : 0;
  const bqOrdAmt = bq ? parseFloat(bq.amt_ordered) : 0;
  const dif = l.monto - bqDelAmt;
  totalLineDiff += dif;
  console.log(`${l.folio} | Cod: ${l.cod} | ${l.name.substring(0, 25)} | Fac Monto: ${l.monto} | BQ Del: ${bqDelAmt} | BQ Ord: ${bqOrdAmt} | Dif: ${dif}`);
});
console.log('Total Line Diff:', totalLineDiff);
