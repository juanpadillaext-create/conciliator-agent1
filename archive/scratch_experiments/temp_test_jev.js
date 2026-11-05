
const fs = require('fs');
let code = fs.readFileSync('apps-script-webapp/JournalEntryVoucher.gs', 'utf8');
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

const jev = generarJournalEntryVoucher(reconCarozzi);
console.log('JEV Generated:');
console.log('Is balanced:', jev.totals.is_balanced);
console.log('Total Debits:', jev.totals.total_debits);
console.log('Total Credits:', jev.totals.total_credits);
console.log('Difference:', jev.totals.difference);
console.log('Lines count:', jev.lines.length);
jev.lines.forEach(l => console.log('  Item ' + l.item + ': ' + l.account + ' (' + l.account_name + ') | D=' + l.debit + ' | C=' + l.credit + ' | ' + l.item_text));
