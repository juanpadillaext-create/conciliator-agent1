const fs = require('fs');

// Load CruceEngine code
const cruceCode = fs.readFileSync('apps-script-webapp/CruceEngine.gs', 'utf8');

// Mock Apps Script environment
const sandbox = {
  Logger: console,
  console: console
};
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(cruceCode, sandbox);

// Read invoice items
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
    descripcion: nmb.trim(),
    cantidad_facturada: qty,
    precio_facturado: prc,
    monto_facturado: mnt
  });
}

// Read PO items from BigQuery result
let bqRaw = fs.readFileSync('tests/query_po_bq.json');
let bqStr = bqRaw.toString('utf8');
if (bqStr.charCodeAt(0) === 0xFEFF || bqStr.startsWith('\u0000') || bqRaw[0] === 0xFF && bqRaw[1] === 0xFE) {
  bqStr = bqRaw.toString('utf16le').replace(/^\uFEFF/, '');
}
const bqRows = JSON.parse(bqStr.trim());
const poItems = bqRows.map(r => ({
  sku_id: r.sku_id,
  product_name: r.product_name,
  quantity_ordered: parseInt(r.quantity_ordered || '0', 10),
  quantity_delivered: r.quantity_delivered !== null ? parseInt(r.quantity_delivered, 10) : 0,
  cost_unit_lc: parseFloat(r.cost_unit_lc || '0'),
  amt_ordered_lc: parseFloat(r.amt_ordered_lc || '0'),
  amt_delivered_lc: parseFloat(r.amt_delivered_lc || '0'),
  barcodes: []
}));

const invDoc = {
  folio: '56458220',
  emisor: { rut: '82623500-4', razon_social: 'Ideal S.A' },
  totales: { neto: 1033571 },
  items: invItems
};

const poDoc = {
  po_number: 'PO519527',
  supplier_name: 'Bimbo',
  items: poItems
};

sandbox.invDoc = invDoc;
sandbox.poDoc = poDoc;

poDoc.po_found = true;
const result = vm.runInContext('ejecutarCruceSkuPorSku(invDoc, poDoc)', sandbox);

console.log('=== RESULTADO RESUMEN ===');
console.log('Total Facturado:', result.resumen.total_facturado);
console.log('Total Recepcionado:', result.resumen.total_recepcionado);
console.log('Total a Reclamar (NC):', result.resumen.total_reclamar);
console.log('Total Líneas:', result.resumen.total_lineas);
console.log('Conformes:', result.resumen.lineas_conformes);
console.log('Diferencias:', result.resumen.lineas_con_diferencia);
console.log('No en OC:', result.resumen.lineas_no_en_oc);

console.log('\n=== DETALLE LÍNEAS ===');
result.lineas.forEach(l => {
  console.log(`[${l.estado}] Invoice: "${l.descripcion_factura}" (${l.codigo_factura}) -> PO SKU: ${l.sku_po} ("${l.descripcion_po}") | Match: ${l.match_type} | Fact: Qty ${l.cantidad_facturada} @ $${l.precio_facturado} = $${l.monto_facturado} | Recep: Qty ${l.cantidad_recepcionada} @ $${l.precio_oc} = $${l.monto_recepcionado} | Reclamo: $${l.monto_a_reclamar}`);
});
