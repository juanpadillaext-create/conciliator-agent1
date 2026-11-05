const fs = require('fs');

// Let's inspect all endpoints using actual GAS code
const doc1 = fs.readFileSync('scratch/doc_10207759.xml', 'latin1');
const doc2 = fs.readFileSync('scratch/doc_10207760.xml', 'latin1');
const docNc = fs.readFileSync('scratch/doc_6363032.xml', 'latin1');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

// What if the user opened the WebApp, entered 524064, and saw:
// Look at the numbers:
// 1. In Codigo.gs:
// formattedInvoices:
// Invoice 1 (10207759): neto 477667
// Invoice 2 (10207760): neto 59830
// Invoice 3 (6363032): neto 2067 (NC)
// If the user clicked on ONE invoice in the table, what did the table show?
// Let's see: in the table of invoices (Paso 1):
// What is 'diferencia_ml' for each invoice in Paso 1?
const totalFacturasNeto = 477667 + 59830; // 537497
const totalOcRecepcionado = 495202;

// In Codigo.gs:
// For Factura 1 (10207759):
// recBodega = Math.round(totalOcRecepcionado * (477667 / 537497)) = 440079;
// dif_ml = 477667 - 440079 = 37588;
// For Factura 2 (10207760):
// recBodega = Math.round(totalOcRecepcionado * (59830 / 537497)) = 55123;
// dif_ml = 59830 - 55123 = 4707;
// For NC (6363032):
// dif_ml = -2067;

// What if the user clicked on Factura 10207760?
// Did it say "descalce de 59,987"?
// Where does 59987 come from?
// Could 59,987 be:
// 495,202 (Recepcionado) - 435,215?
// What if 526,094 - 466,107?
// What if 535,430 - 475,443?
// What if 537,497 - 477,510?
// Let's check:
// 537,497 - 477,667 = 59,830!
// 537,497 + 157 = 537,654!
// What if 59,987 is:
// 59,830 + 157?
// Where does 157 come from?
// Could 157 be:
// 157 CLP?
// Let's check all decimal roundings in BQ:
let bqDelSum = 0;
bqItems.forEach(b => {
  bqDelSum += parseFloat(b.amt_delivered);
});
console.log('bqDelSum exact:', bqDelSum); // 495201.56
let bqOrdSum = 0;
bqItems.forEach(b => {
  bqOrdSum += parseFloat(b.amt_ordered);
});
console.log('bqOrdSum exact:', bqOrdSum); // 526093.56

console.log('What about (526093.56 - 495201.56):', 526093.56 - 495201.56); // 30892
console.log('What about 30892 + 28608:', 30892 + 28608); // 59500!
console.log('What about 59500 + something?');
console.log('59987 - 59500 =', 59987 - 59500); // 487!

