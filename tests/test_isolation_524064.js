const fs = require('fs');

const bqContent = fs.readFileSync('apps-script-webapp/BigQueryAPI.gs', 'utf8');
const axContent = fs.readFileSync('apps-script-webapp/AxteroidAPI.gs', 'utf8');
const codContent = fs.readFileSync('apps-script-webapp/Codigo.gs', 'utf8');
const jsContent = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');

let errors = [];

// 1. Check SQL WHERE in BigQueryAPI.gs (no loose LIKE %baseDigits)
if (bqContent.includes('po.po_order_id LIKE')) {
  errors.push('BigQueryAPI.gs still contains po.po_order_id LIKE');
}

// 2. Check getFacturasLocalesPorPo
const fnMatch = axContent.match(/function getFacturasLocalesPorPo\([\s\S]*?\n\}/);
if (!fnMatch) {
  errors.push('Could not find getFacturasLocalesPorPo in AxteroidAPI.gs');
} else {
  eval(fnMatch[0]);
  const res524064 = getFacturasLocalesPorPo('524064');
  if (!res524064 || res524064.length !== 3) {
    errors.push('getFacturasLocalesPorPo("524064") should return exactly 3 items, got: ' + (res524064 ? res524064.length : 0));
  } else {
    if (!res524064.some(f => f.serial === '6363032' && f.type === 'CL61' && f.is_nc === true)) {
      errors.push('Doc 6363032 must have type CL61 and is_nc true');
    }
    if (!res524064.every(f => f.supplier_tax_id === '96568970-2')) {
      errors.push('All 3 docs must have tax_id 96568970-2');
    }
  }

  // 3. Partial digits check (no partial 3-digit false positives)
  const res524 = getFacturasLocalesPorPo('524');
  if (res524 && res524.length > 0) {
    errors.push('getFacturasLocalesPorPo("524") should return empty array, got: ' + res524.length);
  }
}

// 4. extraerPoBaseDigits check
const extMatch = bqContent.match(/function extraerPoBaseDigits\([\s\S]*?\n\}/);
if (!extMatch) {
  errors.push('Could not find extraerPoBaseDigits in BigQueryAPI.gs');
} else {
  eval(extMatch[0]);
  if (extraerPoBaseDigits('524064') !== '524064') errors.push('extraerPoBaseDigits 524064 failed: ' + extraerPoBaseDigits('524064'));
  if (extraerPoBaseDigits('po 524064') !== '524064') errors.push('extraerPoBaseDigits po 524064 failed: ' + extraerPoBaseDigits('po 524064'));
  if (extraerPoBaseDigits('PO524064') !== '524064') errors.push('extraerPoBaseDigits PO524064 failed: ' + extraerPoBaseDigits('PO524064'));
}

// 5. Check tax_id in Codigo.gs and JavaScript.html
if (!codContent.includes("'524064': { total_ordenado: 526094, total_recepcionado: 495202, supplier: 'Distribución y Excelencia S.A. (Desa)', warehouse: 'CH_6_La Serena (Sociedad 6202)', tax_id: '96568970-2'")) {
  errors.push('BQ_KNOWN_POS in Codigo.gs does not have tax_id 96568970-2 for 524064');
}
if (!jsContent.includes("'524064': {") || !jsContent.includes("supplier_tax_id: '96568970-2'")) {
  errors.push('PO_METRICS_REGISTRY in JavaScript.html does not have tax_id 96568970-2 for 524064');
}

// 6. Check banner leakage in JavaScript.html
if (jsContent.includes('((wizardFacturasFiltradas && wizardFacturasFiltradas.length > 0) ? [...wizardFacturasFiltradas] : [])')) {
  errors.push('JavaScript.html still contains banner invoice leakage fallback');
}

if (errors.length > 0) {
  console.error('❌ Tests failed with errors:\n', errors.join('\n'));
  process.exit(1);
} else {
  console.log('✅ All backend and frontend isolation tests PASSED perfectly!');
}
