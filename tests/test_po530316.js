/**
 * Caso real PO530316 (Embotelladora Andina, CH_39_Calama). Simulador fiel a la API de Axteroid:
 *  - tax_id solo funciona CON guion (911440008 devuelve 0 resultados).
 *  - El listado trae las referencias SIN CodRef; el CodRef solo está en el XML.
 *  - La referencia a la OC (801) trae su propio CodRef, que no aplica a la NC.
 * Base: facturado y recepcionado se comparan con impuesto interno en ambos lados.
 *
 * Ejecutar: node tests/test_po530316.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const WEB = path.resolve(__dirname, '..', 'apps-script-webapp');
const RUT = '91144000-8';
const ctx = {
  console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map,
  Logger: { log() {} }, Utilities: { sleep() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }
};
vm.createContext(ctx);
['BigQueryAPI.gs', 'AxteroidAPI.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f }));

// Formato real del listado de Axteroid
const doc = (type, serial, neto, total, iva, taxes, ref, references, date) => ({ __endpoint: '/rec-docs', id: 'do_' + serial, type, serial, tax_id: RUT, supplier_name: 'Embotelladora Andina S.A.',
  amount_net: String(neto), amount_total: String(total), amount_tax: String(iva), amount_exempt: '0', taxes, order_reference: ref, references, date });
const tx = (code, amount) => ({ code, amount: String(amount), rate: null });
const r801 = { type: 'CL801', number: 'PO530316' };
const r33 = folio => ({ type: 'CL33', number: folio });
const iva = n => Math.round(n * 0.19);
const fac = (s, n, taxes) => doc('CL33', s, n, n + iva(n) + taxes.reduce((a, t) => a + Number(t.amount), 0), iva(n), taxes, 'PO530316', [r801], '2026-10-30');
const nc = (s, n, taxes, ref, refs, date) => doc('CL61', s, n, n + iva(n) + taxes.reduce((a, t) => a + Number(t.amount), 0), iva(n), taxes, ref, refs, date);

const DOCS = [
  fac('98111941', 2000748, [tx('271', 101351), tx('27', 63246)]),
  fac('98111946', 28523, [tx('25', 5438)]),
  fac('98111944', 59160, [tx('26', 11210)]),
  fac('98111943', 27463, [tx('24', 8065)]),
  fac('98111945', 6964, [tx('24', 1865)]),
  fac('98111942', 55234, [tx('271', 624), tx('27', 368)]),
  nc('25288795', 124401, [tx('271', 1320), tx('27', 2555)], 'PO530316', [r33('98111941'), r801], '2026-10-30'),
  nc('25288794', 6964, [tx('24', 1865)], 'PO530316', [r33('98111945'), r801], '2026-10-30'),
  nc('25298036', 3482, [tx('24', 932)], '', [r33('98111945')], '2026-11-03'), // no trae la OC: solo el folio de la factura
  nc('25299999', 5000, [], '', [r33('77777777')], '2026-11-03')               // otra factura: no pertenece a esta OC
];
// El XML sí trae CodRef; la referencia 801 trae su propio cod 1
const XML = {
  do_25288795: [{ tipo: '33', folio: '98111941', cod_ref: '3' }, { tipo: '801', folio: 'PO530316', cod_ref: '1' }],
  do_25288794: [{ tipo: '33', folio: '98111945', cod_ref: '3' }, { tipo: '801', folio: 'PO530316', cod_ref: '1' }],
  do_25298036: [{ tipo: '33', folio: '98111945', cod_ref: '3' }],
  do_25299999: [{ tipo: '33', folio: '77777777', cod_ref: '3' }]
};
ctx.callAxteroidApi = (endpoint, options) => {
  const p = options.params || {};
  const results = DOCS.filter(d => d.__endpoint === endpoint)
    .filter(d => !p.type || d.type === p.type)
    .filter(d => !p.order_reference || d.order_reference === p.order_reference)
    .filter(d => !p.tax_id || d.tax_id === p.tax_id) // igual que la API real: sin guion no devuelve nada
    .filter(d => !p.date__gte || d.date >= p.date__gte);
  const inicio = ((p.page || 1) - 1) * (p.page_size || 100);
  return { count: results.length, results: results.slice(inicio, inicio + (p.page_size || 100)).map(d => JSON.parse(JSON.stringify(d))) };
};
ctx.fetchAxteroidXml = (id) => id;
ctx.parseDteXml = (id) => ({ referencias: XML[id] || [] });

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}
const res = ctx.searchAxteroidDocsByPo('PO530316', 'acc_yZvUK1Aw6y5TAVLD3Y', { supplier_tax_id: RUT }).results;
const ncs = res.filter(d => d.is_nc);

console.log('RUT');
test('axRutConGuion arma el formato que acepta Axteroid', () => {
  assert.strictEqual(ctx.axRutConGuion('911440008'), RUT);
  assert.strictEqual(ctx.axRutConGuion(RUT), RUT);
  assert.strictEqual(ctx.axRutConGuion('77.125.361-K'), '77125361-K');
  assert.strictEqual(ctx.axRutConGuion('77125361k'), '77125361-K');
  assert.strictEqual(ctx.axRutConGuion(''), '');
});

console.log('Búsqueda de NC');
test('encuentra las 6 facturas', () => assert.strictEqual(res.filter(d => !d.is_nc).length, 6));
test('encuentra la NC que solo referencia el folio de la factura (25298036)', () => {
  const n = ncs.find(d => String(d.serial) === '25298036');
  assert.ok(n, 'NC encontradas: ' + ncs.map(d => d.serial).join(','));
  assert.strictEqual(n.nc_match, 'referencia_folio');
});
test('no trae una NC del mismo RUT que referencia otra factura', () => assert.ok(!ncs.some(d => String(d.serial) === '25299999')));
test('son exactamente 3 NC, sin duplicados', () => assert.strictEqual(ncs.length, 3));
test('el CodRef se lee del XML aunque el listado traiga referencias', () => {
  ncs.forEach(n => assert.strictEqual(n.nc_cod_ref, '3', 'NC ' + n.serial + ' CodRef ' + n.nc_cod_ref));
});
test('el CodRef 1 de la referencia a la OC no convierte la NC en anulación', () => {
  ncs.forEach(n => assert.notStrictEqual(n.nc_cod_ref, '1', 'NC ' + n.serial));
});
test('una NC que solo referencia la OC queda sin CodRef (se trata como descuento)', () => {
  const ev = ctx.axEvaluarNc({ tax_id: RUT, order_reference: 'PO530316', referencias: [{ tipo: '801', folio: 'PO530316', cod_ref: '1' }] }, '530316', [], true);
  assert.strictEqual(ev.cod_ref, '');
});

console.log('Base con impuesto interno');
test('axImpuestoInterno usa el detalle del listado, sin IVA', () => {
  assert.strictEqual(ctx.axImpuestoInterno({ taxes: [tx('271', 101351), tx('27', 63246)] }), 164597);
  assert.strictEqual(ctx.axImpuestoInterno({ taxes: [tx('14', 1900), tx('24', 100)] }), 100);
  assert.strictEqual(ctx.axImpuestoInterno({ amount_total: '1190', amount_net: '1000', amount_tax: '190' }), 0);
  assert.strictEqual(ctx.axImpuestoInterno({ amount_total: '1290', amount_net: '1000', amount_tax: '190' }), 100);
});
const REC = 1974372; // recepcionado BigQuery con impuesto interno
const paraTotales = (lista) => lista.map(d => ({ folio: String(d.serial), rut: RUT, es_nc: d.is_nc, monto_neto: d.amount_net, monto_total: d.amount_total, impuesto_interno: d.amount_internal_tax, nc_cod_ref: d.nc_cod_ref, nc_ref_folios: d.nc_ref_folios }));
test('Dif ML con las 3 NC y la misma base: $254.368', () => {
  const t = ctx.aplicarEfectoNc(paraTotales(res));
  assert.strictEqual(t.facturasNeto, 2178092);
  assert.strictEqual(t.ncsNeto, 134847);
  assert.strictEqual(t.facturasImpuesto, 192167);
  assert.strictEqual(t.ncsImpuesto, 6672);
  assert.strictEqual(t.totalFacturadoNeto, 2043245);
  assert.strictEqual(t.totalFacturadoComparable - REC, 254368);
});
test('el descalce bruto (sin NC) usa la misma base: $395.887', () => {
  const t = ctx.aplicarEfectoNc(paraTotales(res));
  assert.strictEqual(t.facturasComparable - REC, 395887);
});
test('una NC de CodRef 2 no descuenta ni el neto ni el impuesto', () => {
  const l = [{ folio: '1', rut: RUT, es_nc: false, monto_neto: 1000, monto_total: 1290, impuesto_interno: 100 }, { folio: '2', rut: RUT, es_nc: true, monto_neto: 500, monto_total: 645, impuesto_interno: 50, nc_cod_ref: '2', nc_ref_folios: ['1'] }];
  const t = ctx.aplicarEfectoNc(l);
  assert.strictEqual(t.totalFacturadoComparable, 1100);
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
