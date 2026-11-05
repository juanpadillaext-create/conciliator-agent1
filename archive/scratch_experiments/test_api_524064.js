const fs = require('fs');

// Let's check what apiSearchPoWithInvoices produces in Codigo.gs
// In Codigo.gs:
// rawDigits = '524064'
// BQ_KNOWN_POS['524064'] = {
//   total_ordenado: 526094,
//   total_recepcionado: 495202,
//   supplier: 'Distribución y Excelencia S.A. (Desa)',
//   warehouse: 'CH_6_La Serena (Sociedad 6202)',
//   tax_id: '96568970-2',
//   descalce: 40228,
//   total_facturado: 535430,
//   total_facturado_con_iva: 738426,
//   total_ncs: 2067,
//   total_facturas: 3
// }
// Wait! What if the user ran it BEFORE we added BQ_KNOWN_POS or without BQ_KNOWN_POS?
// What did BigQuery or Axteroid return for PO 524064 dynamically?

console.log('If dynamically querying Axteroid without BQ_KNOWN_POS:');
// Let's check what Axteroid API returns for searchAxteroidDocsByPo('524064')
