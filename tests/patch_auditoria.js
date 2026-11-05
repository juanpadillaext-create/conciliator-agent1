const fs = require('fs');

const auditBlock = fs.readFileSync('tests/po519527_audit_block.js', 'utf8');
let code = fs.readFileSync('apps-script-webapp/AuditoriaData.gs', 'utf8');

// 1. Insert audit block before function getAuditedPoData
const marker = 'function getAuditedPoData(poNumber) {';
if (!code.includes('const PO519527_AUDIT_DATA =')) {
  code = code.replace(marker, auditBlock + '\n' + marker);
}

// 2. Add PO 519527 check in getAuditedPoData
const poCheckMarker = "  if (clean === '521015') {";
const poCheckReplacement = `  if (clean === '519527') {
    return {
      po_found: true,
      po_order_id: 'PO519527',
      warehouse_name: PO519527_AUDIT_DATA.warehouse_name,
      supplier_name: PO519527_AUDIT_DATA.supplier_name,
      supplier_tax_id: PO519527_AUDIT_DATA.supplier_tax_id,
      order_status: PO519527_AUDIT_DATA.order_status,
      total_ordenado_neto: PO519527_AUDIT_DATA.total_ordenado_neto,
      total_recepcionado_neto: PO519527_AUDIT_DATA.total_recepcionado_neto,
      amt_ordered_lc: PO519527_AUDIT_DATA.total_ordenado_neto,
      amt_delivered_lc: PO519527_AUDIT_DATA.total_recepcionado_neto,
      descalce_monto_clp: PO519527_AUDIT_DATA.total_monto_reclamar_nc,
      facturas_count: PO519527_AUDIT_DATA.total_facturas,
      items: PO519527_AUDIT_DATA.all_po_items
    };
  }

  if (clean === '521015') {`;

if (!code.includes("if (clean === '519527') {")) {
  code = code.replace(poCheckMarker, poCheckReplacement);
}

// 3. Add Factura 56458220 check in getAuditedFacturaData
const facCheckMarker = "  if (typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[clean]) {";
const facCheckReplacement = `  if (typeof PO519527_AUDIT_DATA !== 'undefined' && PO519527_AUDIT_DATA.facturas && PO519527_AUDIT_DATA.facturas[clean]) {
    return PO519527_AUDIT_DATA.facturas[clean];
  }
  if (typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[clean]) {`;

if (!code.includes("typeof PO519527_AUDIT_DATA !== 'undefined'")) {
  code = code.replace(facCheckMarker, facCheckReplacement);
}

fs.writeFileSync('apps-script-webapp/AuditoriaData.gs', code, 'utf8');
console.log('Successfully patched AuditoriaData.gs!');
