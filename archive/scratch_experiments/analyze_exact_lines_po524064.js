const fs = require('fs');

function parseXml(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'latin1');
  const folio = (xml.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const tipoDte = (xml.match(/<TipoDTE>(\d+)<\/TipoDTE>/) || [])[1];
  const neto = parseFloat((xml.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || 0);
  const total = parseFloat((xml.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || 0);

  const dscMatches = xml.match(/<DscRcgGlobal>[\s\S]*?<\/DscRcgGlobal>/g) || [];
  const recargos = dscMatches.map(d => ({
    tipo: (d.match(/<TpoMov>(\w+)<\/TpoMov>/) || [])[1],
    glosa: (d.match(/<Glosa>(.*?)<\/Glosa>/) || [])[1],
    pct: parseFloat((d.match(/<ValorDR>([\d.]+)<\/ValorDR>/) || [])[1] || 0)
  }));

  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  const lines = matches.map(m => {
    const nro = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
    const cod = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || 0);
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || 0);
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || 0);
    const dsc = (m.match(/<DescuentoMonto>([\d.]+)<\/DescuentoMonto>/) || [])[1];
    return { folio, tipoDte, nro, cod, name, qty, prc, monto, dsc: dsc ? parseFloat(dsc) : 0 };
  });

  return { folio, tipoDte, neto, total, recargos, lines };
}

const f1 = parseXml('scratch/doc_10207759.xml');
const f2 = parseXml('scratch/doc_10207760.xml');
const nc = parseXml('scratch/doc_6363032.xml');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

console.log('F1 Neto:', f1.neto, 'Total:', f1.total, 'Recargos:', f1.recargos);
console.log('F2 Neto:', f2.neto, 'Total:', f2.total, 'Recargos:', f2.recargos);
console.log('NC Neto:', nc.neto, 'Total:', nc.total, 'Recargos:', nc.recargos);

// Calculate sum of MontoItem
const f1_sum_monto = f1.lines.reduce((s, l) => s + l.monto, 0);
const f2_sum_monto = f2.lines.reduce((s, l) => s + l.monto, 0);
const nc_sum_monto = nc.lines.reduce((s, l) => s + l.monto, 0);
console.log('F1 sum lines:', f1_sum_monto, 'diff with neto:', f1.neto - f1_sum_monto);
console.log('F2 sum lines:', f2_sum_monto, 'diff with neto:', f2.neto - f2_sum_monto);
console.log('NC sum lines:', nc_sum_monto, 'diff with neto:', nc.neto - nc_sum_monto);

// BQ totals
const bq_ord = bqItems.reduce((s, b) => s + parseFloat(b.amt_ordered), 0);
const bq_del = bqItems.reduce((s, b) => s + parseFloat(b.amt_delivered), 0);
console.log('BQ ordered:', bq_ord, 'BQ delivered:', bq_del, 'BQ diff:', bq_ord - bq_del);
