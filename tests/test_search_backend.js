const fs = require('fs');
const vm = require('vm');

const context = {
  console: console,
  Logger: { log: console.log },
  Math: Math,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  RegExp: RegExp,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  Date: Date,
  JSON: JSON
};

vm.createContext(context);

// Load all .gs files in order
const files = [
  'AxteroidAPI.gs',
  'AuditoriaData.gs',
  'BigQueryAPI.gs',
  'XmlParser.gs',
  'SheetsAPI.gs',
  'JevTypeSafeAPI.gs',
  'JournalEntryVoucher.gs',
  'CruceEngine.gs',
  'IndicePoFacturas.gs',
  'Codigo.gs'
];

files.forEach(f => {
  const code = fs.readFileSync('apps-script-webapp/' + f, 'utf8');
  vm.runInContext(code, context);
});

console.log('--- Probando apiSearchPoWithInvoices("PO502855") ---');
const poRes = vm.runInContext('apiSearchPoWithInvoices("PO502855", null, { skip_xml: true })', context);
console.log('poRes success:', poRes.success);
console.log('poRes po_found:', poRes.po_found);
console.log('poRes invoices count:', (poRes.invoices || []).length);
console.log('poRes data:', JSON.stringify({
  po_number: poRes.po_number,
  supplier_name: poRes.supplier_name,
  total_ordenado: poRes.total_oc_ordenado,
  total_recepcionado: poRes.total_oc_recepcionado,
  diferencia_ml: poRes.diferencia_ml,
  diferencia_preliminar_clp: poRes.diferencia_preliminar_clp
}, null, 2));

console.log('--- Probando apiUniversalSearch("PO502855") ---');
const uniRes = vm.runInContext('apiUniversalSearch("PO502855")', context);
console.log('uniRes success:', uniRes.success);
console.log('uniRes po_found:', uniRes.po_found);
console.log('uniRes invoices count:', (uniRes.invoices || []).length);
console.log('uniRes data:', JSON.stringify({
  po_number: uniRes.po_number,
  supplier_name: uniRes.supplier_name,
  total_ordenado: uniRes.total_oc_ordenado,
  total_recepcionado: uniRes.total_oc_recepcionado,
  diferencia_ml: uniRes.diferencia_ml,
  diferencia_preliminar_clp: uniRes.diferencia_preliminar_clp
}, null, 2));
