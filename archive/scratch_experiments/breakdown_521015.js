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
const allInvoiced = [...items1, ...items2];

const poItems = JSON.parse(fs.readFileSync('po521015_items_utf8.json', 'utf8').replace(/^\uFEFF/, ''));

console.log('Total invoiced line items:', allInvoiced.length);
console.log('Total PO line items:', poItems.length);

// Let's match by description or code
const results = [];
let totalFisica = 0;
let totalPrecio = 0;

poItems.forEach(poi => {
  // Try to find matching invoiced item
  // Ideal product codes in XML often appear in the name or code
  const pName = poi.product_name.toLowerCase();
  const matchInv = allInvoiced.find(inv => {
    const invName = inv.nombre.toLowerCase();
    return inv.codigo === poi.sku_id || 
           invName.includes(poi.sku_id.toLowerCase()) || 
           (poi.supplier_sku && inv.codigo === poi.supplier_sku) ||
           // Match key words
           (pName.includes('pan molde') && invName.includes('pan') && invName.includes('molde')) ||
           (pName.includes('nutrabien') && invName.includes('nutrabien'));
  });
});

console.log('\n--- Resumen General ---');
console.log('Factura 56500972:', items1.reduce((s, i) => s + i.monto, 0));
console.log('Factura 56500937:', items2.reduce((s, i) => s + i.monto, 0));
console.log('Total Facturado Consolidado (59 + 2 = 61 líneas):', allInvoiced.reduce((s, i) => s + i.monto, 0));
console.log('Total Recepcionado Bodega (62 líneas):', poItems.reduce((s, i) => s + Number(i.amt_delivered_lc), 0));
console.log('DIFERENCIA A RECLAMAR (Facturado - Recepcionado):', allInvoiced.reduce((s, i) => s + i.monto, 0) - poItems.reduce((s, i) => s + Number(i.amt_delivered_lc), 0));
