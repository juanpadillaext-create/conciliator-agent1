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
      descripcion: nmbItem.trim(),
      cantidad_facturada: qty,
      unidad_medida: 'UN',
      precio_facturado: prcItem,
      monto_facturado: montoItem
    });
  }
  return items;
}

const items56500972 = parseDteXmlQuick(fs.readFileSync('doc_56500972.xml', 'utf8'));
const items56500937 = parseDteXmlQuick(fs.readFileSync('doc_56500937.xml', 'utf8'));
const rawPoItems = JSON.parse(fs.readFileSync('po521015_items_utf8.json', 'utf8').replace(/^\uFEFF/, ''));

console.log('Factura 56500972 count:', items56500972.length, 'sum:', items56500972.reduce((s,i)=>s+i.monto_facturado,0));
console.log('Factura 56500937 count:', items56500937.length, 'sum:', items56500937.reduce((s,i)=>s+i.monto_facturado,0));
console.log('PO items count:', rawPoItems.length);

const poItemsClean = rawPoItems.map(p => ({
  sku_id: p.sku_id,
  supplier_sku: p.sku_id,
  barcodes: [p.sku_id],
  product_name: p.product_name,
  quantity_ordered: Number(p.quantity_ordered),
  quantity_delivered: Number(p.quantity_delivered),
  cost_unit_lc: Number(p.cost_unit_lc),
  amt_ordered_lc: Number(p.amt_ordered_lc),
  amt_delivered_lc: Number(p.amt_delivered_lc),
  diff_qty: Number(p.diff_qty),
  diff_ordered_delivered: Number(p.diff_ordered_delivered)
}));

// Save intermediate json
fs.writeFileSync('po521015_audit_ready.json', JSON.stringify({
  po_order_id: 'PO521015',
  warehouse_name: 'CH_34_Manuel Montt',
  supplier_name: 'Ideal S.A. (Grupo Bimbo)',
  supplier_tax_id: '90297000-0',
  order_status: 'RECEPCION_CERRADA',
  total_ordenado_neto: 2029303,
  total_recepcionado_neto: 1789977,
  total_facturado_neto: 2009229,
  total_facturado_con_iva: 2390983,
  total_monto_reclamar_nc: 219252,
  total_facturas: 2,
  facturas: {
    '56500972': {
      items: items56500972,
      po_items: poItemsClean
    },
    '56500937': {
      items: items56500937,
      po_items: poItemsClean.filter(p => p.sku_id === '3GU09T' || p.sku_id === 'X426S2')
    }
  },
  all_po_items: poItemsClean
}, null, 2));

console.log('Created po521015_audit_ready.json successfully.');
