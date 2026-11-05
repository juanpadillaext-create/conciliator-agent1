const fs = require('fs');

// Let's inspect what apiSearchPurchaseOrder does
// In Codigo.gs:
// 1. buscarFacturasPorPo('524064')
// 2. BigQuery lookup:
// Let's simulate apiSearchPurchaseOrder for '524064'

const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

// Axteroid mock or live docs:
// Factura 10207759 (neto 477667)
// Factura 10207760 (neto 59830)
// NC 6363032 (neto 2067)

const invoicesList = [
  { serial: "10207759", date: "2026-10-09", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "88725800-4", amount_net: 477667, amount_total: 660358, order_reference: "0000524064", status: "APR", rec_status: "ROK", id: "do_AAABoR8NHdtRW8H1" },
  { serial: "10207760", date: "2026-10-09", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "88725800-4", amount_net: 59830, amount_total: 80659, order_reference: "0000524064", status: "APR", rec_status: "ROK", id: "do_AAABoR8M8nu064Rv" },
  { serial: "6363032", date: "2026-10-13", supplier_name: "DISTRIBUCION Y EXCELENCIA S.A.", supplier_tax_id: "88725800-4", amount_net: 2067, amount_total: 2591, order_reference: "0000524064", doc_type: "CL61", type: "CL61", status: "APR", rec_status: "ROK", id: "do_AAABoTgESzwpdwmM" }
];

let totalFacturasNeto = 477667 + 59830;
let totalNcsNeto = 2067;
let totalFacturadoNeto = totalFacturasNeto - totalNcsNeto; // 535430
let totalOcRecepcionado = 495202;
let totalOcOrdenado = 526094;

console.log('totalFacturasNeto:', totalFacturasNeto);
console.log('totalNcsNeto:', totalNcsNeto);
console.log('totalFacturadoNeto:', totalFacturadoNeto);
console.log('totalOcRecepcionado:', totalOcRecepcionado);
console.log('totalOcOrdenado:', totalOcOrdenado);

// Now in Codigo.gs:
// formattedInvoices:
invoicesList.forEach(f => {
  const isNc = (f.doc_type === 'CL61' || f.type === 'CL61');
  let recBodega = 0;
  let dif = 0;
  if (isNc) {
    dif = -f.amount_net;
  } else {
    recBodega = Math.round(totalOcRecepcionado * (f.amount_net / totalFacturasNeto));
    dif = f.amount_net - recBodega;
  }
  console.log(`Invoice ${f.serial}: Neto: ${f.amount_net} | RecBodega: ${recBodega} | Dif: ${dif}`);
});

console.log('Diferencia ML consolidada (Facturado Neteado - Recepcionado):', totalFacturadoNeto - totalOcRecepcionado);
console.log('Descalce BQ (Ordenado - Recepcionado):', totalOcOrdenado - totalOcRecepcionado);
