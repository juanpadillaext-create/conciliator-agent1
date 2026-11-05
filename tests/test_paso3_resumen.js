/**
 * Prueba de renderizarResumenPaso3 (Paso 3): cifras de facturas / NC / neto / bruto y tabla de documentos.
 * Usa un DOM mínimo simulado; carga las funciones reales desde JavaScript.html.
 *
 * Ejecutar: node tests/test_paso3_resumen.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'apps-script-webapp', 'JavaScript.html'), 'utf8');

function extraer(nombre) {
  const ini = html.indexOf('  function ' + nombre + '(');
  assert.ok(ini >= 0, 'No se encontró ' + nombre);
  // Cuerpo completo por conteo de llaves (las llaves de este código están balanceadas)
  let i = html.indexOf('{', ini);
  let nivel = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') nivel++;
    else if (html[i] === '}') { nivel--; if (nivel === 0) break; }
  }
  return html.slice(ini, i + 1);
}

// DOM mínimo
const nodos = {};
function el(id) {
  if (!nodos[id]) nodos[id] = { id, textContent: '', style: {}, children: [], className: '',
    appendChild(c) { this.children.push(c); return c; },
    get firstChild() { return this.children[0]; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); } };
  return nodos[id];
}
const ctx = {
  console, Math, Number, String, Array, Object, JSON,
  document: { getElementById: el, createElement: () => ({ children: [], className: '', textContent: '', appendChild(c) { this.children.push(c); return c; } }) }
};
vm.createContext(ctx);
vm.runInContext(['safeNum', 'documentoSinEfecto', 'renderizarResumenPaso3'].map(extraer).join('\n'), ctx);

const txt = id => nodos[id].textContent;
let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}
const fac = (folio, neto, extra) => Object.assign({ folio, monto_neto: neto, es_nc: false }, extra || {});
const nc = (folio, neto, extra) => Object.assign({ folio, monto_neto: neto, es_nc: true, efecto_nc: 'DESCUENTA' }, extra || {});
const norm = n => String(n).replace(/ /g, ' ');

test('CodRef 3: neto = facturas − NC y bruto = facturas − recepcionado', () => {
  ctx.renderizarResumenPaso3({ total_recepcionado_neto: 350000, invoices_source: [fac('1', 300000), fac('2', 200000), nc('9', 30000)] });
  assert.strictEqual(norm(txt('p3StatFacturas')).replace(/\D/g, ''), '500000');
  assert.strictEqual(norm(txt('p3StatFacturado')).replace(/\D/g, ''), '470000');
  assert.strictEqual(norm(txt('p3DescalceNeto')).replace(/\D/g, ''), '120000');
  assert.strictEqual(norm(txt('p3DescalceBruto')).replace(/\D/g, ''), '150000');
  assert.ok(txt('p3StatNcs').startsWith('−'));
  assert.strictEqual(nodos.boxDocumentosPaso3.style.display, 'block');
  assert.strictEqual(nodos.tbodyDocumentosPaso3.children.length, 3);
});

test('CodRef 2: la NC aparece en la tabla pero no cambia los montos', () => {
  ctx.renderizarResumenPaso3({ total_recepcionado_neto: 350000, invoices_source: [fac('1', 500000), nc('9', 30000, { efecto_nc: 'SIN_EFECTO_MONTOS', nc_cod_ref: '2' })] });
  assert.strictEqual(norm(txt('p3StatFacturado')).replace(/\D/g, ''), '500000');
  assert.strictEqual(norm(txt('p3DescalceNeto')), norm(txt('p3DescalceBruto')));
  assert.strictEqual(nodos.tbodyDocumentosPaso3.children.length, 2);
});

test('CodRef 1: la factura anulada no suma', () => {
  ctx.renderizarResumenPaso3({ total_recepcionado_neto: 0, invoices_source: [fac('1', 100000, { anulada: true, anulada_por_nc: '9' }), fac('2', 50000), nc('9', 100000, { efecto_nc: 'ANULA', nc_cod_ref: '1' })] });
  assert.strictEqual(norm(txt('p3StatFacturas')).replace(/\D/g, ''), '50000');
  assert.strictEqual(norm(txt('p3StatFacturado')).replace(/\D/g, ''), '50000');
});

test('una sola factura sin NC: no se muestra la tabla de documentos', () => {
  ctx.renderizarResumenPaso3({ total_recepcionado_neto: 90, invoices_source: [fac('1', 100)] });
  assert.strictEqual(nodos.boxDocumentosPaso3.style.display, 'none');
});

test('sin documentos: usa total_facturado_neto del cruce', () => {
  ctx.renderizarResumenPaso3({ total_recepcionado_neto: 40000, total_facturado_neto: 100000, invoices_source: [] });
  assert.strictEqual(norm(txt('p3StatFacturado')).replace(/\D/g, ''), '100000');
  assert.strictEqual(norm(txt('p3DescalceNeto')).replace(/\D/g, ''), '60000');
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
