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

const items1 = parseDteXmlQuick(fs.readFileSync('doc_56500972.xml', 'utf8')).map(i => ({ ...i, factura: '56500972' }));
const items2 = parseDteXmlQuick(fs.readFileSync('doc_56500937.xml', 'utf8')).map(i => ({ ...i, factura: '56500937' }));
const allInvoiced = [...items1, ...items2];
const poItems = JSON.parse(fs.readFileSync('po521015_items_utf8.json', 'utf8').replace(/^\uFEFF/, ''));

console.log('Total facturado items:', allInvoiced.length);
console.log('Total PO items:', poItems.length);

const shortages = poItems.filter(p => Number(p.diff_ordered_delivered) > 0);
console.log('\n--- PO Shortages en BigQuery (' + shortages.length + ' items) ---');
shortages.forEach(s => {
  console.log('SKU:', s.sku_id, '|', s.product_name, '| Ord:', s.quantity_ordered, '| Rec:', s.quantity_delivered, '| DiffQty:', s.diff_qty, '| DiffAmt: $' + s.diff_ordered_delivered, '| CostUnit: $' + s.cost_unit_lc);
});
const totalPoShortageAmt = shortages.reduce((sum, s) => sum + Number(s.diff_ordered_delivered), 0);
console.log('\nTotal Faltante Ordenado vs Recepcionado en PO: $' + totalPoShortageAmt);

console.log('\n--- Comparativa Global ---');
const totalFac1 = items1.reduce((s, i) => s + i.monto, 0);
const totalFac2 = items2.reduce((s, i) => s + i.monto, 0);
const totalFacturado = totalFac1 + totalFac2;
const totalRecepcionado = poItems.reduce((s, i) => s + Number(i.amt_delivered_lc), 0);
const totalOrdenado = poItems.reduce((s, i) => s + Number(i.amt_ordered_lc), 0);

console.log('Factura 56500972:', totalFac1);
console.log('Factura 56500937:', totalFac2);
console.log('Total Facturado (59 + 2 = 61 líneas):', totalFacturado);
console.log('Total Ordenado (62 líneas):', totalOrdenado);
console.log('Total Recepcionado Bodega CH_34 (62 líneas):', totalRecepcionado);
console.log('Facturado vs Recepcionado (DIFERENCIA REAL A RECLAMAR):', totalFacturado - totalRecepcionado);
