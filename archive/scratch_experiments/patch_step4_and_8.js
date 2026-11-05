const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'apps-script-webapp', 'JavaScript.html');
let content = fs.readFileSync(targetFile, 'utf8');

const catalogoInicial = JSON.parse(fs.readFileSync(path.join(__dirname, 'po521534_catalogo_inicial.json'), 'utf8'));

// Inject 10 invoices in FACTURAS_CATALOGO_INICIAL
if (!content.includes('"folio": "105275609"')) {
  const targetCat = '  const FACTURAS_CATALOGO_INICIAL = [\n';
  const catEntriesJson = JSON.stringify(catalogoInicial, null, 2);
  const innerEntries = catEntriesJson.slice(catEntriesJson.indexOf('[') + 1, catEntriesJson.lastIndexOf(']')).trim();
  const replacementCat = `  const FACTURAS_CATALOGO_INICIAL = [\n${innerEntries},\n`;
  if (content.includes(targetCat)) {
    content = content.replace(targetCat, replacementCat);
    console.log('4. 10 Facturas de Embonor agregadas a FACTURAS_CATALOGO_INICIAL.');
  } else {
    // Try with \r\n
    const targetCatCRLF = '  const FACTURAS_CATALOGO_INICIAL = [\r\n';
    if (content.includes(targetCatCRLF)) {
      content = content.replace(targetCatCRLF, `  const FACTURAS_CATALOGO_INICIAL = [\r\n${innerEntries},\r\n`);
      console.log('4. 10 Facturas de Embonor agregadas a FACTURAS_CATALOGO_INICIAL (CRLF).');
    } else {
      console.error('ERROR: No se encontró targetCat');
    }
  }
} else {
  console.log('4. FACTURAS_CATALOGO_INICIAL ya tiene folio 105275609.');
}

// Fix ejecutarBusquedaAxteroidPaso1 number discrimination
if (!content.includes('filters.order_reference = rawNum.padStart(10, \'0\');')) {
  const oldBlock = `    const filters = {};
    const rawNum = term.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');
    if (/^[0-9]+$/.test(term)) {
      filters.serial = term;
    } else if (/^[0-9]+$/.test(rawNum)) {
      filters.order_reference = rawNum;
      filters.raw_number = rawNum;
    } else {
      filters.supplier_name_query = term;
    }`;

  const newBlock = `    const filters = {};
    const rawNum = term.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');
    if (/^\\d{5,7}$/.test(rawNum)) {
      // Formato típico de Orden de Compra SAP Dmarts (5 a 7 dígitos)
      filters.order_reference = rawNum.padStart(10, '0');
      filters.raw_number = rawNum;
    } else if (/^[0-9]+$/.test(term)) {
      filters.serial = term;
    } else if (/^[0-9]+$/.test(rawNum)) {
      filters.order_reference = rawNum;
      filters.raw_number = rawNum;
    } else {
      filters.supplier_name_query = term;
    }`;

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    console.log('8. Discriminación de número en ejecutarBusquedaAxteroidPaso1 corregida.');
  } else {
    // Try CRLF
    const oldBlockCRLF = oldBlock.replace(/\n/g, '\r\n');
    const newBlockCRLF = newBlock.replace(/\n/g, '\r\n');
    if (content.includes(oldBlockCRLF)) {
      content = content.replace(oldBlockCRLF, newBlockCRLF);
      console.log('8. Discriminación de número en ejecutarBusquedaAxteroidPaso1 corregida (CRLF).');
    } else {
      console.error('ERROR: No se encontró oldBlock');
    }
  }
} else {
  console.log('8. ejecutarBusquedaAxteroidPaso1 ya corregido.');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('JavaScript.html guardado exitosamente.');
