const fs = require('fs');
const vm = require('vm');

const sandbox = {
  Logger: { log: () => {} },
  console: console,
  ScriptApp: { getOAuthToken: () => 'mock-token' },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 500, getContentText: () => '{}' }) },
  AXTEROID_CONFIG: { DEFAULT_WORKSPACE: 'ws-demo' },
  BQ_CONFIG: { DATASET_PO: 'peya-data-origins-pro.cl_dmarts.purchase_orders' },
  INDICE_MAESTRO_POS_FACTURAS: [],
  CATALOGO_AFOROS_MEMORIA_32: []
};
vm.createContext(sandbox);

const files = ['AuditoriaData.gs', 'AxteroidAPI.gs', 'BigQueryAPI.gs', 'IndicePoFacturas.gs', 'Codigo.gs', 'CruceEngine.gs', 'SheetsAPI.gs', 'XmlParser.gs'];
files.forEach(f => {
  const code = fs.readFileSync('apps-script-webapp/' + f, 'utf8');
  vm.runInContext(code, sandbox);
});

console.log('INDICE_MAESTRO_POS_FACTURAS count:', sandbox.INDICE_MAESTRO_POS_FACTURAS.length);

const testQueries = ['PO517979', '517979', 'Carozzi', 'PO521534', '521534', 'Coca-Cola', '105275609', '284719', 'Nestle', 'Colun', 'CCU', '521015', '519527'];
testQueries.forEach(q => {
  try {
    const res = sandbox.apiUniversalSearch(q);
    console.log(`Query: "${q}" => success: ${res.success}, invoices: ${res.invoices ? res.invoices.length : null}, po_found: ${res.po_found}, po_number: ${res.po_number}, supplier: ${res.supplier_name}, error: ${res.error}`);
  } catch(e) {
    console.error(`Query: "${q}" => EXCEPTION: ${e.message}`);
  }
});
