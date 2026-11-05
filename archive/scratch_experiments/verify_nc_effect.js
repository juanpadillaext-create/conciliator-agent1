const fs = require('fs');

const invLines = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/all_invoice_lines_parsed.json', 'utf8'));

// The 3 NCs lines:
const ncLines = [
  // NC 25243761 (Folio 25243761 ref Factura 97913616)
  { folio: 25243761, name: 'Stella Arts VD330cc 5g x6', qty: 9, uom: 'PAC', monto: 50481 },
  // NC 25243763 (Folio 25243763 ref Factura 97913613)
  { folio: 25243763, name: 'Inca Kola PT3,0cc x 6', qty: 3, uom: 'PAC', monto: 38312 },
  { folio: 25243763, name: 'Benedictino Manzana PT1.5cc x 6', qty: 4, uom: 'PAC', monto: 22495 },
  // NC 25243760 (Folio 25243760 ref Factura 97913614)
  { folio: 25243760, name: 'FASTLYTE SANDIA PT 625ml x 6', qty: 1, uom: 'PAC', monto: 9964 },
  { folio: 25243760, name: 'Cer Bud Zero S/Alc VD330cc 0g x6', qty: 2, uom: 'PAC', monto: 11218 }
];

console.log('--- Resumen con Deducción Automática de NCs ---');
const totFact = invLines.reduce((s, l) => s + l.monto, 0);
const totNc = ncLines.reduce((s, l) => s + l.monto, 0);
console.log('Total Facturado Bruto:', totFact);
console.log('Total Notas de Crédito Deducidas:', totNc);
console.log('Total Neto Efectivo Facturado:', totFact - totNc);
console.log('Total Recepcionado en Bodega Calama:', 1827284.58);
console.log('Diferencia Neta Real a Reclamar:', (totFact - totNc - 1827284.58).toFixed(2));
