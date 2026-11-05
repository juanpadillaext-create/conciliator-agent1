const fs = require('fs');

function parseDteXmlQuick(xmlText) {
  const items = [];
  const detalleRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
  let match;
  while ((match = detalleRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const nroLinea = block.match(/<NroLinDet>(\d+)<\/NroLinDet>/)?.[1] || '';
    const cdgItem = block.match(/<VlrCodigo>([^<]+)<\/VlrCodigo>/)?.[1] || '';
    const nmbItem = block.match(/<NmbItem>([^<]+)<\/NmbItem>/)?.[1] || '';
    const qty = parseFloat(block.match(/<QtyItem>([^<]+)<\/QtyItem>/)?.[1] || '0');
    const prcItem = parseFloat(block.match(/<PrcItem>([^<]+)<\/PrcItem>/)?.[1] || '0');
    const montoItem = parseFloat(block.match(/<MontoItem>([^<]+)<\/MontoItem>/)?.[1] || '0');

    items.push({
      linea: parseInt(nroLinea),
      codigo: cdgItem.trim(),
      nombre: nmbItem.trim(),
      cantidad: qty,
      precio: prcItem,
      monto: montoItem
    });
  }
  return items;
}

const items1 = parseDteXmlQuick(fs.readFileSync('doc_56500972.xml', 'utf8'));
const items2 = parseDteXmlQuick(fs.readFileSync('doc_56500937.xml', 'utf8'));

console.log('Factura 56500972 (items: ' + items1.length + '):');
const sum1 = items1.reduce((s, i) => s + i.monto, 0);
console.log('Sum 1:', sum1);

console.log('\nFactura 56500937 (items: ' + items2.length + '):');
const sum2 = items2.reduce((s, i) => s + i.monto, 0);
console.log('Sum 2:', sum2);
items2.forEach(i => console.log('  Item 2:', i));

console.log('\nTotal Facturado ambos DTEs:', sum1 + sum2);

// Now load PO items
const poItems = JSON.parse(fs.readFileSync('po521015_items_utf8.json', 'utf8').replace(/^\uFEFF/, ''));
console.log('\nPO items count:', poItems.length);
const totalDelivered = poItems.reduce((s, i) => s + Number(i.amt_delivered_lc), 0);
const totalOrdered = poItems.reduce((s, i) => s + Number(i.amt_ordered_lc), 0);
console.log('PO Total Ordered:', totalOrdered);
console.log('PO Total Delivered:', totalDelivered);
console.log('DIFERENCIA TOTAL (Facturado - Recepcionado):', (sum1 + sum2) - totalDelivered);
