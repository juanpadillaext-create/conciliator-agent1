/**
 * Pruebas de detección de Notas de Crédito (CL61) asociadas a una PO, para cualquier proveedor.
 * Caso base: PO 529067 - AVÍCOLA Y COMERCIAL EL TOCO LTDA (RUT 78383730-7).
 * Sin red: callAxteroidApi / fetchAxteroidXml / parseDteXml se simulan.
 *
 * Ejecutar: node tests/test_nc_detection.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', 'apps-script-webapp');
const context = {
  console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map,
  Logger: { log: () => {} },
  Utilities: { sleep: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }
};
vm.createContext(context);
['BigQueryAPI.gs', 'AxteroidAPI.gs', 'XmlParser.gs'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f });
});

// ───────────── Fixtures ─────────────
const RUT = '78383730-7';
const OTHER_RUT = '96591040-9';
let DOCS = [];
let CALLS = [];
let XML_REFS = {}; // doc.id -> referencias parseadas del XML

const norm = s => String(s || '').replace(/[^0-9kK]/g, '').toUpperCase();
context.callAxteroidApi = (endpoint, options) => {
  const p = (options && options.params) || {};
  CALLS.push({ endpoint, params: p });
  const results = DOCS.filter(d => d.__endpoint === endpoint)
    .filter(d => !p.type || d.type === p.type)
    .filter(d => !p.order_reference || d.order_reference === p.order_reference)
    .filter(d => !p.tax_id || d.tax_id === p.tax_id) // igual que la API real: sin guion no devuelve nada
    .filter(d => !p.date__gte || String(d.date) >= p.date__gte)
    .map(d => { const c = Object.assign({}, d); delete c.__endpoint; return c; });
  return { count: results.length, results };
};
context.fetchAxteroidXml = (id) => 'XML:' + id;
context.parseDteXml = (xml) => ({ referencias: XML_REFS[String(xml).replace('XML:', '')] || [] });

function doc(o) {
  return Object.assign({
    __endpoint: '/rec-docs', id: 'do_' + o.serial, type: 'CL33', tax_id: RUT, supplier_name: 'AVICOLA Y COMERCIAL EL TOCO LTDA',
    date: '2026-10-20', amount_net: 100000, amount_total: 119000, order_reference: '', references: []
  }, o);
}
const factura = (serial, ref, extra) => doc(Object.assign({ serial, order_reference: ref }, extra || {}));
const nc = (serial, extra) => doc(Object.assign({ serial, type: 'CL61', amount_net: 10000, amount_total: 11900, date: '2026-10-25' }, extra || {}));

function buscar() {
  CALLS = [];
  const r = context.searchAxteroidDocsByPo('PO529067', 'acc_yZvUK1Aw6y5TAVLD3Y', { supplier_tax_id: RUT });
  return r.results;
}
const ncs = rs => rs.filter(r => r.is_nc);
const facs = rs => rs.filter(r => !r.is_nc);

// Los arrays creados dentro de vm son de otro realm: se comparan por JSON
const same = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  OK   ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

// ───────────── normalizePo ─────────────
console.log('normalizePo');
test('quita PO/OC, prefijo 002 y ceros en ese orden', () => {
  const n = context.normalizePo;
  assert.strictEqual(n('PO529067'), '529067');
  assert.strictEqual(n('oc529067'), '529067');
  assert.strictEqual(n('002529067'), '529067');
  assert.strictEqual(n('PO002529067'), '529067');
  assert.strictEqual(n('0000529067'), '529067');
  assert.strictEqual(n(' po 0000529067 '), '529067');
  assert.strictEqual(n(''), '');
  assert.strictEqual(n(null), '');
});
test('no confunde una PO que solo empieza con 00 con prefijo de proveedor', () => {
  assert.strictEqual(context.normalizePo('0021'), '21');
});
test('extraerPoBaseDigits mantiene formatos con sufijo de tienda', () => {
  assert.strictEqual(context.extraerPoBaseDigits('002529067'), '529067');
  assert.strictEqual(context.extraerPoBaseDigits('000052348939'), '523489');
});
test('normalizePoSql replica la misma lógica en BigQuery', () => {
  const sql = context.normalizePoSql('po.po_order_id');
  assert.ok(sql.includes("r'^(PO|OC)'") && sql.includes("r'^002([1-9][0-9]{4,})$'") && sql.includes("r'^0+'"));
  assert.ok(sql.indexOf('(PO|OC)') < sql.indexOf('002(') && sql.indexOf('002(') < sql.indexOf('^0+'));
});

// ───────────── Facturas: se recopilan TODAS ─────────────
console.log('Facturas CL33');
test('recopila facturas de varios formatos de order_reference (sin cortar en la primera)', () => {
  DOCS = [factura('1001', 'PO529067'), factura('1002', '002529067'), factura('1003', '0000529067')];
  same(facs(buscar()).map(r => r.serial).sort(), ['1001', '1002', '1003']);
});

// ───────────── NC ─────────────
console.log('Notas de crédito CL61');
test('NC con la PO en order_reference', () => {
  DOCS = [factura('1001', 'PO529067'), nc('501', { order_reference: 'PO529067' })];
  const r = buscar();
  assert.strictEqual(ncs(r).length, 1);
  assert.strictEqual(ncs(r)[0].serial, '501');
  assert.strictEqual(ncs(r)[0].type, 'CL61');
  assert.strictEqual(ncs(r)[0].nc_match, 'order_reference');
});

test('NC que solo referencia el folio de la factura (mismo RUT)', () => {
  DOCS = [
    factura('1001', 'PO529067'),
    nc('502', { references: [{ type: 'CL33', number: '1001', cod_ref: '3' }] }),
    nc('503', { tax_id: OTHER_RUT, references: [{ type: 'CL33', number: '1001', cod_ref: '3' }] }) // otro RUT: NO
  ];
  const r = ncs(buscar());
  same(r.map(x => x.serial), ['502']);
  assert.strictEqual(r[0].nc_match, 'referencia_folio');
  assert.strictEqual(r[0].nc_cod_ref, '3');
  same(Array.from(r[0].nc_ref_folios), ['1001']);
});

test('NC sin referencias en el listado: se lee Referencia/CodRef del XML', () => {
  DOCS = [factura('1002', 'PO529067'), nc('504')];
  XML_REFS = { do_504: [{ tipo: '33', folio: '1002', cod_ref: '1' }] };
  const r = ncs(buscar());
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].nc_cod_ref, '1');
  XML_REFS = {};
});

test('NC con prefijo 002 en order_reference', () => {
  DOCS = [factura('1001', 'PO529067'), nc('505', { order_reference: '002529067' })];
  const r = ncs(buscar());
  same(r.map(x => x.serial), ['505']);
});

test('NC duplicada en /rec-docs y /rec-docs/woemail se cuenta una sola vez', () => {
  DOCS = [
    factura('1001', 'PO529067'),
    nc('506', { order_reference: 'PO529067' }),
    nc('506', { order_reference: 'PO529067', __endpoint: '/rec-docs/woemail', id: 'wo_506' }),
    nc('0506', { order_reference: 'PO529067', __endpoint: '/rec-docs/woemail', id: 'wo_0506' }) // folio con ceros = mismo documento
  ];
  const r = ncs(buscar());
  assert.strictEqual(r.length, 1);
  assert.ok(CALLS.some(c => c.endpoint === '/rec-docs/woemail'), 'debe consultar woemail');
  assert.ok(CALLS.filter(c => c.params.type === 'CL61').length > 0, 'debe pedir type=CL61 explícito');
});

test('NC solo en woemail también se detecta', () => {
  DOCS = [factura('1001', 'PO529067'), nc('507', { order_reference: 'PO529067', __endpoint: '/rec-docs/woemail' })];
  same(ncs(buscar()).map(x => x.serial), ['507']);
});

test('misma factura+NC no se duplican entre workspaces', () => {
  DOCS = [factura('1001', 'PO529067'), nc('508', { order_reference: 'PO529067' })];
  const r = buscar();
  assert.strictEqual(facs(r).length, 1);
  assert.strictEqual(ncs(r).length, 1);
});

// ───────────── CodRef / totales ─────────────
console.log('CodRef y totales');
const inv = (folio, neto, extra) => Object.assign({ folio, rut: RUT, es_nc: false, monto_neto: neto, monto_total: Math.round(neto * 1.19) }, extra || {});
const ncInv = (folio, neto, cod, refs) => inv(folio, neto, { es_nc: true, nc_cod_ref: cod, nc_ref_folios: refs || ['1001'] });

test('CodRef 3 descuenta: TotalFacturadoNeto = FacturasNeto - NcsNeto', () => {
  const t = context.aplicarEfectoNc([inv('1001', 100000), inv('1002', 50000), ncInv('501', 10000, '3')]);
  assert.strictEqual(t.facturasNeto, 150000);
  assert.strictEqual(t.ncsNeto, 10000);
  assert.strictEqual(t.totalFacturadoNeto, 140000);
});
test('sin CodRef se trata como descuento (compatibilidad)', () => {
  const t = context.aplicarEfectoNc([inv('1001', 100000), ncInv('501', 10000, '')]);
  assert.strictEqual(t.totalFacturadoNeto, 90000);
});
test('CodRef 2 no afecta montos', () => {
  const list = [inv('1001', 100000), ncInv('501', 10000, '2')];
  const t = context.aplicarEfectoNc(list);
  assert.strictEqual(t.totalFacturadoNeto, 100000);
  assert.strictEqual(t.ncsNeto, 0);
  assert.strictEqual(list[1].efecto_nc, 'SIN_EFECTO_MONTOS');
});
test('CodRef 1 anula la factura referenciada y la NC no descuenta aparte', () => {
  const list = [inv('1001', 100000), inv('1002', 50000), ncInv('501', 100000, '1', ['1001'])];
  const t = context.aplicarEfectoNc(list);
  assert.strictEqual(list[0].anulada, true);
  assert.strictEqual(list[1].anulada, false);
  assert.strictEqual(t.facturasNeto, 50000);
  assert.strictEqual(t.ncsNeto, 0);
  assert.strictEqual(t.totalFacturadoNeto, 50000);
});
test('CodRef 1 no anula facturas de otro RUT con el mismo folio', () => {
  const list = [inv('1001', 100000, { rut: OTHER_RUT }), ncInv('501', 100000, '1', ['1001'])];
  context.aplicarEfectoNc(list);
  assert.strictEqual(list[0].anulada, false);
});
test('el total puede quedar negativo (no se oculta con Math.max)', () => {
  const t = context.aplicarEfectoNc([inv('1001', 1000), ncInv('501', 5000, '3')]);
  assert.strictEqual(t.totalFacturadoNeto, -4000);
});

test('XmlParser: lee CodRef y no toma una referencia a factura 33 como OC', () => {
  const src = fs.readFileSync(path.join(ROOT, 'XmlParser.gs'), 'utf8');
  assert.ok(src.includes("getElementText(ref, 'CodRef')"));
  assert.ok(/isDteRef/.test(src) && /!isDteRef &&/.test(src));
});

console.log('\n' + passed + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
