const fs = require('fs');

const auditBlock = fs.readFileSync('po521534_audit_block.json', 'utf8');
let auditoriaFile = fs.readFileSync('apps-script-webapp/AuditoriaData.gs', 'utf8');

// 1. Insert const PO521534_AUDIT_DATA right before function getAuditedPoData
const marker = 'function getAuditedPoData(poNumber) {';
if (!auditoriaFile.includes('const PO521534_AUDIT_DATA')) {
  const auditDeclaration = `\nconst PO521534_AUDIT_DATA = ${auditBlock};\n\n`;
  auditoriaFile = auditoriaFile.replace(marker, auditDeclaration + marker);
}

// 2. Insert if (clean === '521534') in getAuditedPoData
const poCheckMarker = "if (clean === '521015') {";
const po521534Check = `if (clean === '521534') {
    return {
      po_found: true,
      po_order_id: 'PO521534',
      warehouse_name: PO521534_AUDIT_DATA.warehouse_name,
      supplier_name: PO521534_AUDIT_DATA.supplier_name,
      supplier_tax_id: PO521534_AUDIT_DATA.supplier_tax_id,
      order_status: PO521534_AUDIT_DATA.order_status,
      total_ordenado_neto: PO521534_AUDIT_DATA.total_ordenado_neto,
      total_recepcionado_neto: PO521534_AUDIT_DATA.total_recepcionado_neto,
      amt_ordered_lc: PO521534_AUDIT_DATA.total_ordenado_neto,
      amt_delivered_lc: PO521534_AUDIT_DATA.total_recepcionado_neto,
      descalce_monto_clp: PO521534_AUDIT_DATA.total_monto_reclamar_nc,
      facturas_count: PO521534_AUDIT_DATA.total_facturas,
      category_manager: 'Javiera Rogers',
      condicion_aforo: PO521534_AUDIT_DATA.condicion_aforo,
      items: PO521534_AUDIT_DATA.all_po_items
    };
  }

  `;

if (!auditoriaFile.includes("clean === '521534'")) {
  auditoriaFile = auditoriaFile.replace(poCheckMarker, po521534Check + poCheckMarker);
}

// 3. Insert in getAuditedFacturaData
const facCheckMarker = "if (typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[clean]) {";
const fac521534Check = `if (typeof PO521534_AUDIT_DATA !== 'undefined' && PO521534_AUDIT_DATA.facturas && PO521534_AUDIT_DATA.facturas[clean]) {
    return PO521534_AUDIT_DATA.facturas[clean];
  }
  `;

if (!auditoriaFile.includes("PO521534_AUDIT_DATA.facturas[clean]")) {
  auditoriaFile = auditoriaFile.replace(facCheckMarker, fac521534Check + facCheckMarker);
}

fs.writeFileSync('apps-script-webapp/AuditoriaData.gs', auditoriaFile, 'utf8');
console.log('Successfully injected PO521534 into AuditoriaData.gs!');
