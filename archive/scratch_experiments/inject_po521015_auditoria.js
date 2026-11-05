const fs = require('fs');

const filePath = 'apps-script-webapp/AuditoriaData.gs';
let content = fs.readFileSync(filePath, 'utf8');

const snippet = fs.readFileSync('po521015_code_snippet.txt', 'utf8');

// 1. Insert snippet right before function getAuditedPoData
const targetFunc = 'function getAuditedPoData(poNumber) {';
if (!content.includes(targetFunc)) {
  console.error('Target function not found!');
  process.exit(1);
}

// 2. Add PO521015 check inside getAuditedPoData
const poCheckTarget = "  if (clean === '502855') {";
const poCheckReplacement = `  if (clean === '521015') {
    return {
      po_found: true,
      po_order_id: 'PO521015',
      warehouse_name: PO521015_AUDIT_DATA.warehouse_name,
      supplier_name: PO521015_AUDIT_DATA.supplier_name,
      supplier_tax_id: PO521015_AUDIT_DATA.supplier_tax_id,
      order_status: PO521015_AUDIT_DATA.order_status,
      total_ordenado_neto: PO521015_AUDIT_DATA.total_ordenado_neto,
      total_recepcionado_neto: PO521015_AUDIT_DATA.total_recepcionado_neto,
      amt_ordered_lc: PO521015_AUDIT_DATA.total_ordenado_neto,
      amt_delivered_lc: PO521015_AUDIT_DATA.total_recepcionado_neto,
      descalce_monto_clp: PO521015_AUDIT_DATA.total_monto_reclamar_nc,
      facturas_count: PO521015_AUDIT_DATA.total_facturas,
      items: PO521015_AUDIT_DATA.all_po_items
    };
  }

  if (clean === '502855') {`;

// 3. Add PO521015 check inside getAuditedFacturaData
const facCheckTarget = "  if (PO517979_AUDIT_DATA.facturas[clean]) {";
const facCheckReplacement = `  if (typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[clean]) {
    return PO521015_AUDIT_DATA.facturas[clean];
  }
  if (PO517979_AUDIT_DATA.facturas[clean]) {`;

if (!content.includes(snippet.trim())) {
  content = content.replace(targetFunc, snippet + '\n' + targetFunc);
}
content = content.replace(poCheckTarget, poCheckReplacement);
content = content.replace(facCheckTarget, facCheckReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AuditoriaData.gs updated successfully. New size:', fs.statSync(filePath).size);
