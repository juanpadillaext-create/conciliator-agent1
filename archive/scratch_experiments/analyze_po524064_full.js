const fs = require('fs');

function parseXmlLines(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'latin1');
  const folio = (xml.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const tipoDte = (xml.match(/<TipoDTE>(\d+)<\/TipoDTE>/) || [])[1];
  const mntNeto = parseFloat((xml.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || 0);
  const mntTotal = parseFloat((xml.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || 0);
  const date = (xml.match(/<FchEmis>(.*?)<\/FchEmis>/) || [])[1];

  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  const lines = matches.map(m => {
    const nro = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
    const cod = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || 0);
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || 0);
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || 0);
    return { folio, tipoDte, nro, cod, name, qty, prc, monto };
  });

  const dscMatches = xml.match(/<DscRcgGlobal>[\s\S]*?<\/DscRcgGlobal>/g) || [];
  const dscRcgs = dscMatches.map(d => ({
    tipo: (d.match(/<TpoMov>(.*?)<\/TpoMov>/) || [])[1],
    valor: parseFloat((d.match(/<ValorDR>([\d.]+)<\/ValorDR>/) || [])[1] || 0)
  }));

  return { folio, tipoDte, mntNeto, mntTotal, date, lines, dscRcgs };
}

const f1 = parseXmlLines('scratch/doc_10207759.xml');
const f2 = parseXmlLines('scratch/doc_10207760.xml');
const nc = parseXmlLines('scratch/doc_6363032.xml');

console.log('=== RESUMEN DE DOCUMENTOS DTE ===');
console.log(`Factura 1: Folio ${f1.folio} | Neto: ${f1.mntNeto} | Total: ${f1.mntTotal} | Lineas: ${f1.lines.length}`);
if (f1.dscRcgs.length) console.log('  Recargos/Descuentos F1:', f1.dscRcgs);

console.log(`Factura 2: Folio ${f2.folio} | Neto: ${f2.mntNeto} | Total: ${f2.mntTotal} | Lineas: ${f2.lines.length}`);
if (f2.dscRcgs.length) console.log('  Recargos/Descuentos F2:', f2.dscRcgs);

console.log(`Nota Crédito: Folio ${nc.folio} | Neto: ${nc.mntNeto} | Total: ${nc.mntTotal} | Lineas: ${nc.lines.length}`);
if (nc.dscRcgs.length) console.log('  Recargos/Descuentos NC:', nc.dscRcgs);

console.log('\n=== LÍNEAS DE FACTURA 10207759 ===');
console.table(f1.lines.map(l => ({ cod: l.cod, name: l.name.substring(0, 35), qty: l.qty, prc: l.prc, monto: l.monto })));

console.log('\n=== LÍNEAS DE FACTURA 10207760 ===');
console.table(f2.lines.map(l => ({ cod: l.cod, name: l.name.substring(0, 35), qty: l.qty, prc: l.prc, monto: l.monto })));

console.log('\n=== LÍNEAS DE NOTA DE CRÉDITO 6363032 ===');
console.table(nc.lines.map(l => ({ cod: l.cod, name: l.name.substring(0, 35), qty: l.qty, prc: l.prc, monto: l.monto })));

// BigQuery items
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));
console.log('\n=== CRUCE SKU A SKU (FACTURAS VS BIGQUERY) ===');
