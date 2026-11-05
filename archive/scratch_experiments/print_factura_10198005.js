const fs = require('fs');

const xml = fs.readFileSync('scratch/factura_10198005.xml', 'latin1');
const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
matches.forEach(m => {
  const nro = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
  const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
  const qty = (m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1];
  const prc = (m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1];
  const dsc = (m.match(/<DescuentoMonto>([\d.]+)<\/DescuentoMonto>/) || [])[1] || '0';
  const dscPct = (m.match(/<DescuentoPct>([\d.]+)<\/DescuentoPct>/) || [])[1] || '0';
  const monto = (m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1];
  console.log(`L${nro}: ${name} | Qty: ${qty} | Prc: ${prc} | Dsc: ${dsc} (${dscPct}%) | Monto: ${monto}`);
});
