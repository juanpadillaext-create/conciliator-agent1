const fs = require('fs');

const base12 = [
  { serial: "22599557", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 118224, amount_total: 140687, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8IEMB9W8", sap_id: "7000014989", nro_doc_sap: "3200108276" },
  { serial: "22599552", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3370547, amount_total: 4010951, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR84WExtWR", sap_id: "7000014989", nro_doc_sap: "3200108277" },
  { serial: "22599553", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3084034, amount_total: 3670000, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8dfyioj-", sap_id: "7000014989", nro_doc_sap: "3200108278" },
  { serial: "22599554", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 328068, amount_total: 390401, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8NxWKiZ1", sap_id: "7000014989", nro_doc_sap: "3200108279" },
  { serial: "22599555", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3496366, amount_total: 4160676, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8nb_TxIE", sap_id: "7000014989", nro_doc_sap: "3200108280" },
  { serial: "22599556", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 4313351, amount_total: 5132888, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeR8ziMSLFN", sap_id: "7000014989", nro_doc_sap: "3200108281" },
  { serial: "22599563", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 3184566, amount_total: 3789634, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruu2y0FII", sap_id: "7000014989", nro_doc_sap: "3200108282" },
  { serial: "22599564", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2249089, amount_total: 2676416, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruYdqEmQu", sap_id: "7000014989", nro_doc_sap: "3200108283" },
  { serial: "22599565", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1530194, amount_total: 1820931, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruJjXD6R7", sap_id: "7000014989", nro_doc_sap: "3200108284" },
  { serial: "22599566", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 2337694, amount_total: 2781856, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTerupORZGzi", sap_id: "7000014989", nro_doc_sap: "3200108285" },
  { serial: "22599567", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 1384986, amount_total: 1648133, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruvwW478J", sap_id: "7000014989", nro_doc_sap: "3200108286" },
  { serial: "22599568", date: "2026-10-14", supplier_name: "EMPRESAS CAROZZI S.A.", supplier_tax_id: "96591040-9", amount_net: 157520, amount_total: 187449, order_reference: "0000524332", batch_po: "0000524332", status: "APR", rec_status: "ROK", id: "do_AAABoTeruouwNv-t", sap_id: "7000014989", nro_doc_sap: "3200108287" }
];

const totalNeto = base12.reduce((s, f) => s + f.amount_net, 0);
const recepcionadoBodega = 10800335;
const descalce = totalNeto - recepcionadoBodega;

console.log('=== CUADRATURA OFICIAL PO 524332 (12 FACTURAS CAROZZI) ===');
console.log('Total Facturas:', base12.length);
console.log('Total Facturado Neto:', `$${totalNeto.toLocaleString('es-CL')} CLP`);
console.log('Recepcionado Bodega:', `$${recepcionadoBodega.toLocaleString('es-CL')} CLP`);
console.log('Diferencia a Reclamar (Dif ML):', `$${descalce.toLocaleString('es-CL')} CLP`);

if (totalNeto === 25554639 && descalce === 14754304) {
  console.log('\n✅ CUADRATURA EXACTA DE $14.754.304 CONFIRMADA AL 100%');
} else {
  console.error('\n❌ ERROR EN LA CUADRATURA');
  process.exit(1);
}
