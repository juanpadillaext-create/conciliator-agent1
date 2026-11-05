const fs = require('fs');

// Load XMLs
const doc1 = fs.readFileSync('scratch/doc_10207759.xml', 'latin1');
const doc2 = fs.readFileSync('scratch/doc_10207760.xml', 'latin1');
const docNc = fs.readFileSync('scratch/doc_6363032.xml', 'latin1');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

// Emulate XmlParser
function parseXmlDte(xmlStr) {
  const folio = (xmlStr.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const tipo = (xmlStr.match(/<TipoDTE>(\d+)<\/TipoDTE>/) || [])[1];
  const neto = parseFloat((xmlStr.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || 0);
  const total = parseFloat((xmlStr.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || 0);
  const date = (xmlStr.match(/<FchEmis>(.*?)<\/FchEmis>/) || [])[1];

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

const parsed1 = parseXmlDte(doc1);
const parsed2 = parseXmlDte(doc2);
const parsedNc = parseXmlDte(docNc);

console.log('Factura 1 items:', parsed1.items.length);
console.log('Factura 2 items:', parsed2.items.length);
console.log('NC items:', parsedNc.items.length);

// Emulate CruceEngine logic
// Let's check how CruceEngine matches
// We want to see what 'monto_reclamar' or 'diferencia' CruceEngine produces
