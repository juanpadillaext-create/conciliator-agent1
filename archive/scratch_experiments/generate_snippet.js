const fs = require('fs');

const audit = JSON.parse(fs.readFileSync('po521015_audit_complete.json', 'utf8'));

// Format clean JS object literal
const jsCode = `
/**
 * Auditoría Oficial PO521015 - Ideal S.A. (Sociedad 6202 / Almacén CH_34 Manuel Montt)
 * Total Facturado: $2.009.229 (2 facturas: 56500972 por $1.968.789 + 56500937 por $40.440)
 * Total Recepcionado Bodega: $1.789.976,8 (BigQuery cl_dmarts)
 * Total Diferencia a Reclamar: $219.252 CLP
 */
const PO521015_AUDIT_DATA = ` + JSON.stringify(audit) + `;
`;

fs.writeFileSync('po521015_code_snippet.txt', jsCode);
console.log('Snippet length:', jsCode.length);
