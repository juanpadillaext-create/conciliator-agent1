const fs = require('fs');

// 1. Read invoice lines
const xml = fs.readFileSync('tests/factura_56458220.xml', 'utf8');
const invItems = [];
const detRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
let m;
let lineNum = 1;
while ((m = detRegex.exec(xml)) !== null) {
  const b = m[1];
  const cdg = (b.match(/<VlrCodigo>([\s\S]*?)<\/VlrCodigo>/) || [])[1] || '';
  const nmb = (b.match(/<NmbItem>([\s\S]*?)<\/NmbItem>/) || [])[1] || '';
  const qty = parseFloat((b.match(/<QtyItem>([\s\S]*?)<\/QtyItem>/) || [])[1] || '0');
  const prc = parseFloat((b.match(/<PrcItem>([\s\S]*?)<\/PrcItem>/) || [])[1] || '0');
  const mnt = parseFloat((b.match(/<(?:MontoItem|MntItem)>([\s\S]*?)<\/(?:MontoItem|MntItem)>/) || [])[1] || '0');
  invItems.push({
    linea: lineNum++,
    codigo: cdg.trim(),
    ean: cdg.trim(),
    descripcion: nmb.trim(),
    cantidad_facturada: qty,
    unidad_medida: 'UN',
    precio_facturado: prc,
    monto_facturado: mnt
  });
}

// 2. Read BQ PO lines
let bqRaw = fs.readFileSync('tests/query_po_bq.json');
let bqStr = bqRaw.toString('utf8');
if (bqStr.charCodeAt(0) === 0xFEFF || bqStr.startsWith('\u0000') || bqRaw[0] === 0xFF && bqRaw[1] === 0xFE) {
  bqStr = bqRaw.toString('utf16le').replace(/^\uFEFF/, '');
}
const bqRows = JSON.parse(bqStr.trim());

const poItems = bqRows.map(r => ({
  sku_id: r.sku_id,
  supplier_sku: r.sku_id,
  barcodes: (r.barcodes_str || '').split(',').map(b => b.trim()).filter(Boolean),
  product_name: r.product_name,
  quantity_ordered: parseInt(r.quantity_ordered || '0', 10),
  quantity_delivered: r.quantity_delivered !== null ? parseInt(r.quantity_delivered, 10) : 0,
  cost_unit_lc: parseFloat(r.cost_unit_lc || '0'),
  amt_ordered_lc: parseFloat(r.amt_ordered_lc || '0'),
  amt_delivered_lc: parseFloat(r.amt_delivered_lc || '0'),
  diff_qty: parseInt(r.quantity_ordered || '0', 10) - (r.quantity_delivered !== null ? parseInt(r.quantity_delivered, 10) : 0),
  diff_ordered_delivered: parseFloat(r.amt_ordered_lc || '0') - parseFloat(r.amt_delivered_lc || '0')
}));

const auditData = {
  po_order_id: 'PO519527',
  warehouse_name: 'CH_24_El Belloto',
  supplier_name: 'Ideal S.A. (Grupo Bimbo)',
  supplier_tax_id: '82623500-4',
  order_status: 'RECEPCION_CERRADA',
  total_ordenado_neto: 1181837,
  total_recepcionado_neto: 996268,
  total_facturado_neto: 1033571,
  total_facturado_con_iva: 1229948,
  total_monto_reclamar_nc: 37303,
  total_facturas: 1,
  category_manager: 'Constanza Urra',
  condicion_aforo: 'NO AFORADO POR SOLICITUD DE COMERCIAL',
  facturas: {
    '56458220': {
      folio: '56458220',
      proveedor: 'Ideal S.A. (Grupo Bimbo)',
      rut: '82623500-4',
      fecha: '2026-09-25',
      monto_neto: 1033571,
      monto_total: 1229948,
      items: invItems,
      po_items: poItems
    }
  },
  all_po_items: poItems
};

const jsContent = `const PO519527_AUDIT_DATA = ${JSON.stringify(auditData, null, 2)};\n`;
fs.writeFileSync('tests/po519527_audit_block.js', jsContent, 'utf8');
console.log('Generated tests/po519527_audit_block.js with size:', jsContent.length);
