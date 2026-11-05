const facturas = [
  { folio: 97913615, net: 36063, tax: 6852, ila: 10774, tot: 53689 },
  { folio: 97913614, net: 196943, tax: 37419, ila: 1040, tot: 235402 },
  { folio: 97913616, net: 599601, tax: 113924, ila: 113774, tot: 827299 },
  { folio: 97913613, net: 2046600, tax: 388854, ila: 146828, tot: 2582282 }
];

const ncs = [
  { folio: 25243761, net: 50481, tax: 9591, ila: 9596, tot: 69668, ref: 97913616 },
  { folio: 25243763, net: 60807, tax: 11553, ila: 7954, tot: 80314, ref: 97913613 },
  { folio: 25243760, net: 21182, tax: 4025, ila: 1040, tot: 26247, ref: 97913614 }
];

const totFactNet = 2879207;
const recNet = 1827284.58;
const ordNet = 2553590.93;

console.log('Facturado Neto Total:', totFactNet);
console.log('Recepcionado Neto BQ:', recNet);
console.log('DIFERENCIA EXACTA (Facturado Neto - Recepcionado Neto):', totFactNet - recNet);

const totNcNet = 50481 + 60807 + 21182; // 132470
console.log('Total NCs Neto:', totNcNet);
console.log('Facturado Neto menos NCs Neto:', totFactNet - totNcNet);
console.log('(Facturado Neto - NCs Neto) - Recepcionado Neto:', (totFactNet - totNcNet) - recNet);

// Now what about 969,615?
// 1051922 - 969615 = 82307
console.log('\nDiferencia entre 1.051.922 y 969.615:', 1051922 - 969615);

// Could 82307 be related to one NC?
// NC 25243763 Total is 80314! (close to 82307)
// What about NCs?
console.log('NC 25243763 Total:', 80314);
console.log('NC 25243761 Total:', 69668);

// What if 969,615 is calculated without one invoice?
// 1051922 - 969615 = 82307.
// What about Factura 97913616 or others?
// What about 1051922 / 1.084887?
// What about ILA? Total ILA on facturas is 272416.
// What about ILA on NCs? 9596 + 7954 + 1040 = 18590.
// Let's check combinations:
for (let i = 0; i < facturas.length; i++) {
  console.log(`Without Factura ${facturas[i].folio} (Net ${facturas[i].net}): diff = ${totFactNet - facturas[i].net - recNet}`);
}

// What if 969615 is:
// 1051922.42 - something?
// Let's check every combination of items or sub-sums
