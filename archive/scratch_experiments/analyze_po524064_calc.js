const fs = require('fs');

const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

// Exact 1-to-1 map
const MAP_FAC_TO_BQ = {
  'LI30300': '18425484', // Aperol
  'BE50055': '4UFLI4',   // Mr. Big 2.5L
  'CI25000': 'D16CDL',   // Bear Beer 500ml
  'CO30006': '18425486', // Secreto Peruano Sour
  'VI37003': '18629034', // Riccadonna Asti
  'VI37030': '18629032', // Riccadonna Moscato Rose
  'VN18345': 'C1GS91',   // Undurraga Zero Alcohol
  'VN18558': '4WUCZI',   // Undurraga Rosato RTD
  'LI40890': '2MKLXV',   // El Jimador Reposado
  'VN18084': '7Q0462',   // Aliwen Chardonnay
  'VN18306': '43706078', // Undurraga Baron Lacroix Brut
  'VN18251': '43705944', // Undurraga Brut 750ml
  'VN18555': 'T0DA5R',   // Undurraga Brut Lata 310ml
  'VN18089': '43706073', // Aliwen Carmenere
  'VN16231': '43705957'  // Oveja Negra Cab/Syr
};

// Totales de Facturas y NC:
// Factura 10207759: Neto $477.667 | Total $660.358
// Factura 10207760: Neto $59.830  | Total $80.659
// Total Facturas:   Neto $537.497 | Total $741.017
// NC 6363032:       Neto $2.067   | Total $2.591
// Total Neteado:    Neto $535.430 | Total $738.426

// Totales BigQuery:
let totOrdBQ = 0;
let totRecBQ = 0;
bqItems.forEach(b => {
  totOrdBQ += parseFloat(b.amt_ordered);
  totRecBQ += parseFloat(b.amt_delivered);
});

console.log('=== TOTALES GENERALES PO 524064 ===');
console.log('Total Facturado Bruto (F10207759 + F10207760) Neto: $537.497 CLP (Con IVA/ILA: $741.017 CLP)');
console.log('Total Nota de Crédito (NC 6363032) Neto:             -$2.067 CLP (Con IVA/ILA: -$2.591 CLP)');
console.log('Total Facturado Neteado (Facturas - NC) Neto:         $535.430 CLP (Con IVA/ILA: $738.426 CLP)');
console.log('Total Ordenado BigQuery (Nominal OC):                $' + totOrdBQ.toFixed(2) + ' CLP');
console.log('Total Recepcionado Físico Bodega La Serena:          $' + totRecBQ.toFixed(2) + ' CLP');
console.log('Descalce Físico BQ (Ordenado BQ - Recepcionado BQ):   $' + (totOrdBQ - totRecBQ).toFixed(2) + ' CLP');

console.log('\n=== DIFERENCIAS CLAVE ===');
console.log('1. Facturado Neteado ($535.430) - Recepcionado ($495.202) = $' + (535430 - Math.round(totRecBQ)) + ' CLP');
console.log('2. Facturado Bruto ($537.497) - Recepcionado ($495.202)   = $' + (537497 - Math.round(totRecBQ)) + ' CLP');
console.log('3. Descalce BQ (Ordenado $526.094 - Recepcionado $495.202)= $' + Math.round(totOrdBQ - totRecBQ) + ' CLP');

// Analicemos la mercadería faltante física:
console.log('\n=== ANÁLISIS DE MERCADERÍA FALTANTE FÍSICA ===');
console.log('a) Cerveza Peroni Lager 500ml (JQN63D): 6 packs ordenados en BQ ($28.608), 0 recibidos en bodega.');
console.log('   PERO Desa NUNCA la facturó (no viene en Factura 10207759 ni 10207760). No hay cobro indebido.');
console.log('b) Bebida Energizante Mr. Big 2.5L (4UFLI4): 6 ordenadas, 5 recibidas en bodega (Faltó 1 botella).');
console.log('   Desa facturó 6 botellas en F10207759.');
console.log('   Desa EMITIÓ Nota de Crédito NC 6363032 por la 1 botella faltante ($2.067 neto / $2.591 total).');
console.log('   => ¡EL FALTANTE FÍSICO DE MR. BIG YA ESTÁ 100% REGULARIZADO Y CUBIERTO POR LA NOTA DE CRÉDITO!');

