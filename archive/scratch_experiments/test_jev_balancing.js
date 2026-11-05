const fs = require('fs');
let code = fs.readFileSync('apps-script-webapp/JournalEntryVoucher.gs', 'utf8');

// Update code logic for PPV favorable
code = code.replace(
`  // 2. Débito a Desviación de Precio de Compra (PPV - Sobreprecio)
  if (descalcePrecio > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.codigo,
      account_name: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.nombre,
      dc_indicator: 'D',
      debit: descalcePrecio,
      credit: 0,
      cost_center: costCenter,
      assignment: \`PO:\${res.po_referencia || res.po_number || '-'}\`,
      item_text: \`Sobreprecio Unitario Factura vs OC \${res.po_referencia || res.po_number || ''}\`
    });
  }`,
`  // 2. Desviación en Precio de Compra (PPV - Sobreprecio o Favorable)
  if (descalcePrecio > 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.codigo,
      account_name: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.nombre,
      dc_indicator: 'D',
      debit: descalcePrecio,
      credit: 0,
      cost_center: costCenter,
      assignment: \`PO:\${res.po_referencia || res.po_number || '-'}\`,
      item_text: \`Sobreprecio Unitario Factura vs OC \${res.po_referencia || res.po_number || ''}\`
    });
  } else if (descalcePrecio < 0) {
    lines.push({
      item: itemCounter++,
      account: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.codigo,
      account_name: JEV_CONFIG.CUENTAS.DESVIACION_PRECIO_COMPRA.nombre + ' (Favorable)',
      dc_indicator: 'C',
      debit: 0,
      credit: Math.abs(descalcePrecio),
      cost_center: costCenter,
      assignment: \`PO:\${res.po_referencia || res.po_number || '-'}\`,
      item_text: \`Variación Favorable Costo Factura vs OC \${res.po_referencia || res.po_number || ''}\`
    });
  }`
);

global.Session = { getActiveUser: () => ({ getEmail: () => 'juan.padilla@pedidosya.com' }) };
global.formatearFechaIso = (d) => d.toISOString().slice(0, 10);

eval(code);

const reconCarozzi = {
  folio_factura: '22586652-59',
  po_number: 'PO517979',
  po_referencia: 'PO517979',
  proveedor_nombre: 'Empresas Carozzi S.A.',
  proveedor_rut: '96.591.040-9',
  almacen: 'CH_36_CD_Chile',
  total_facturado_neto: 22068769,
  total_recepcionado_neto: 12388682,
  total_faltante_recepcion: 9752441,
  total_descalce_precio: -72354,
  total_monto_reclamar: 9680087
};

console.log('Testing updated PPV favorable behavior:');
const jev = generarJournalEntryVoucher(reconCarozzi);
console.log('Is balanced:', jev.totals.is_balanced);
console.log('Total Debits:', jev.totals.total_debits);
console.log('Total Credits:', jev.totals.total_credits);
console.log('Difference:', jev.totals.difference);
console.log('Lines count:', jev.lines.length);
jev.lines.forEach(l => console.log('  Item ' + l.item + ': ' + l.account + ' (' + l.account_name + ') | D=' + l.debit + ' | C=' + l.credit + ' | ' + l.item_text));
