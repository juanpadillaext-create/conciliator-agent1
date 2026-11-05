// test_backend_runner.js
const fs = require('fs');
const vm = require('vm');

// Mock GAS globals
global.Logger = { log: console.log };
global.Utilities = { sleep: () => {} };
global.ScriptApp = { getOAuthToken: () => 'mock_token' };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
global.UrlFetchApp = {
  fetch: () => ({
    getContentText: () => JSON.stringify({ results: [] }),
    getResponseCode: () => 200
  })
};

const gsFiles = [
  'AuditoriaData.gs',
  'AxteroidAPI.gs',
  'BigQueryAPI.gs',
  'CruceEngine.gs',
  'IndicePoFacturas.gs',
  'JevTypeSafeAPI.gs',
  'JournalEntryVoucher.gs',
  'SheetsAPI.gs',
  'XmlParser.gs',
  'Codigo.gs'
];

gsFiles.forEach(f => {
  const code = fs.readFileSync('apps-script-webapp/' + f, 'utf8');
  vm.runInThisContext(code);
});

console.log('Testing queries in apiUniversalSearch:');

const queries = ['523428', 'PO521534', '105275609', '284719', 'Carozzi', 'CCU', 'Colun', 'Trendy', '93281000-K', 'Choclo'];

queries.forEach(q => {
  try {
    const res = apiUniversalSearch(q);
    console.log(`Query "${q}": success=${res.success}, po_found=${res.po_found}, invoices=${(res.invoices || []).length}, po_number=${res.po_number}`);
  } catch (err) {
    console.error(`Query "${q}": ERROR ${err.message}`);
  }
});
