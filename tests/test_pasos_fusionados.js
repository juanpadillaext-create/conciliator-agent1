/**
 * Los antiguos pasos 2 y 3 se fusionaron: el wizard tiene 2 pasos y las diferencias (panePaso3) se muestran
 * debajo de la orden de compra (Paso 2) solo cuando ya hay un cruce calculado.
 *
 * Ejecutar: node tests/test_pasos_fusionados.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const WEB = path.resolve(__dirname, '..', 'apps-script-webapp');
const js = fs.readFileSync(path.join(WEB, 'JavaScript.html'), 'utf8');
const index = fs.readFileSync(path.join(WEB, 'Index.html'), 'utf8');

function extraer(nombre) {
  const ini = js.indexOf('  function ' + nombre + '(');
  assert.ok(ini >= 0, 'No se encontró ' + nombre);
  let i = js.indexOf('{', ini), nivel = 0;
  for (; i < js.length; i++) {
    if (js[i] === '{') nivel++;
    else if (js[i] === '}') { nivel--; if (nivel === 0) break; }
  }
  return js.slice(ini, i + 1);
}

// DOM mínimo con classList
const elementos = {};
function el(id) {
  if (!elementos[id]) {
    const clases = new Set();
    elementos[id] = { id, classList: {
      add: (...c) => c.forEach(x => clases.add(x)), remove: (...c) => c.forEach(x => clases.delete(x)),
      toggle: (c, f) => { if (f) clases.add(c); else clases.delete(c); }, contains: c => clases.has(c) } };
  }
  return elementos[id];
}
const toasts = [];
const ctx = { console, document: { getElementById: el }, window: { scrollTo() {} }, showToast: (m) => toasts.push(m),
  wizardSelectedInvoice: null, wizardAssociatedPo: null, wizardCurrentStep: 1 };
vm.createContext(ctx);
vm.runInContext('let resultadosCruceVisibles = false;\n' + extraer('irAPasoWizard') +
  '\nfunction __setResultados(v) { resultadosCruceVisibles = v; }', ctx);
['wstep1', 'wstep2', 'panePaso1', 'panePaso2', 'panePaso3'].forEach(el);
const activo = id => el(id).classList.contains('active');

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}

test('el wizard tiene 2 pasos: ya no existe el paso 3 en la barra ni el texto "Paso 3"', () => {
  assert.ok(!/id="wstep3"/.test(index));
  assert.ok(/id="wstep2"/.test(index));
  assert.ok(/BARRA DE PROGRESO DE 2 PASOS/.test(index));
  assert.strictEqual((index.match(/Paso 3/g) || []).length, 0);
});
test('el encabezado del Paso 2 habla de orden de compra y diferencias', () => {
  assert.ok(/Paso 2 · Orden de compra y diferencias/.test(index));
});
test('sin factura seleccionada no se puede entrar al Paso 2 ni a las diferencias', () => {
  ctx.wizardSelectedInvoice = null;
  ctx.irAPasoWizard(2);
  ctx.irAPasoWizard(3);
  assert.strictEqual(toasts.length, 2);
  assert.strictEqual(ctx.wizardCurrentStep, 1);
});
test('Paso 2 sin cruce calculado: se ve la OC y NO las diferencias', () => {
  ctx.wizardSelectedInvoice = { folio: '1' }; ctx.wizardAssociatedPo = { po_order_id: 'PO1' };
  ctx.__setResultados(false);
  ctx.irAPasoWizard(2);
  assert.ok(activo('panePaso2') && !activo('panePaso3') && activo('wstep2') && !activo('wstep1'));
});
test('con cruce calculado, pedir el "paso 3" muestra las diferencias DENTRO del Paso 2', () => {
  ctx.__setResultados(true);
  ctx.irAPasoWizard(3);
  assert.strictEqual(ctx.wizardCurrentStep, 2);
  assert.ok(activo('panePaso2') && activo('panePaso3') && activo('wstep2'));
});
test('volver al Paso 1 oculta la OC y las diferencias', () => {
  ctx.irAPasoWizard(1);
  assert.ok(activo('panePaso1') && !activo('panePaso2') && !activo('panePaso3'));
});
test('al volver al Paso 2 con la misma factura, las diferencias siguen ahí', () => {
  ctx.irAPasoWizard(2);
  assert.ok(activo('panePaso2') && activo('panePaso3'));
});
test('al elegir una factura se calculan las diferencias solas (individual y consolidada)', () => {
  const sel = extraer('completarSeleccionFactura');
  assert.ok(/resultadosCruceVisibles = false;[\s\S]*irAPasoWizard\(2\);[\s\S]*ejecutarCruceWizard\(\);/.test(sel));
  const consol = js.slice(js.indexOf('function ejecutarCrucePoConsolidado'), js.indexOf('function mergeFacturasCatalogoYSincronizadas'));
  assert.ok(/resultadosCruceVisibles = false;\s*irAPasoWizard\(2\);\s*ejecutarCruceWizard\(\);/.test(consol));
});
test('al terminar el cruce las diferencias se muestran en el Paso 2', () => {
  const fin = extraer('renderizarPaso3Completo');
  assert.ok(/resultadosCruceVisibles = true;\s*irAPasoWizard\(2\);/.test(fin));
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
