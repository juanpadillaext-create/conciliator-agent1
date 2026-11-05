const fs = require('fs');

const doc1 = fs.readFileSync('scratch/doc_10207759.xml', 'latin1');
const doc2 = fs.readFileSync('scratch/doc_10207760.xml', 'latin1');
const docNc = fs.readFileSync('scratch/doc_6363032.xml', 'latin1');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

function parseXmlDte(xmlStr) {
  const folio = (xmlStr.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const tipo = (xmlStr.match(/<TipoDTE>(\d+)<\/TipoDTE>/) || [])[1];
  const neto = parseFloat((xmlStr.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || 0);
  const total = parseFloat((xmlStr.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || 0);

  const matches = xmlStr.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  const items = matches.map((m, idx) => {
    const cod = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || 0);
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || 0);
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || 0);
    return {
      linea: idx + 1,
      codigo: cod,
      codigo_factura: cod,
      descripcion: name,
      descripcion_factura: name,
      cantidad_facturada: qty,
      precio_facturado: prc,
      monto_facturado: monto,
      total_facturado: monto,
      unidad_medida: 'UN'
    };
  });

  return {
    folio,
    tipo_dte: tipo === '33' ? 'CL33' : (tipo === '61' ? 'CL61' : tipo),
    monto_neto: neto,
    monto_total: total,
    totales: { total: neto },
    items
  };
}

const f1 = parseXmlDte(doc1);
const f2 = parseXmlDte(doc2);
const fnc = parseXmlDte(docNc);

// Now let's extract the exact calcularCruce1a1EnCliente from JavaScript.html
const jsFile = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');
const fnCode = jsFile.match(/function calcularCruce1a1EnCliente\(inv, po\) \{[\s\S]*?\n  \}/)[0];

const poData = {
  po_order_id: 'PO524064',
  warehouse_name: 'CH_6_La Serena (Sociedad 6202)',
  total_ordenado_neto: 526094,
  total_recepcionado_neto: 495202,
  items: bqItems
};

// Evaluate in context
const vm = require('vm');
const ctx = { console, Math, Number, Set, Array, Object, String, RegExp };
vm.createContext(ctx);
vm.runInContext(fnCode, ctx);

console.log('\n--- TEST CONSOLIDADO ---');
const consolInv = {
  folio: 'Consolidado (10207759, 10207760)',
  totales: { total: 535430 },
  items: [...f1.items, ...f2.items]
};
const resConsol = ctx.calcularCruce1a1EnCliente(consolInv, poData);
console.log('Consolidado:');
console.log('  total_facturado_neto:', resConsol.total_facturado_neto);
console.log('  total_recepcionado_neto:', resConsol.total_recepcionado_neto);
console.log('  dif_ml:', resConsol.dif_ml);
console.log('  total_monto_reclamar:', resConsol.total_monto_reclamar);
console.log('  diferencia_total_neta:', resConsol.diferencia_total_neta);

console.log('\n--- TEST FACTURA 10207759 ---');
const resF1 = ctx.calcularCruce1a1EnCliente(f1, poData);
console.log('Factura 10207759:');
console.log('  total_facturado_neto:', resF1.total_facturado_neto);
console.log('  total_recepcionado_neto:', resF1.total_recepcionado_neto);
console.log('  dif_ml:', resF1.dif_ml);
console.log('  total_monto_reclamar:', resF1.total_monto_reclamar);

console.log('\n--- TEST FACTURA 10207760 ---');
const resF2 = ctx.calcularCruce1a1EnCliente(f2, poData);
console.log('Factura 10207760:');
console.log('  total_facturado_neto:', resF2.total_facturado_neto);
console.log('  total_recepcionado_neto:', resF2.total_recepcionado_neto);
console.log('  dif_ml:', resF2.dif_ml);
console.log('  total_monto_reclamar:', resF2.total_monto_reclamar);
