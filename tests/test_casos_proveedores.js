/**
 * Casos reales de proveedores con reclamos absurdos (facturas de marzo-noviembre 2026), servidor y navegador:
 *  - Distribuidora Alma Brand 166209: factura en cajas y OC en unidades sin factor confirmado -> "sobrellegada" con $494.846 sobre una línea de $21.689.
 *  - Laboratorio Durandin 2134816: sobreprecio contado sobre unidades NO recibidas, además del faltante completo (doble conteo).
 *  - Cooperativa Agrícola 31172897: pesables (kg) con el mismo doble conteo.
 * Invariante: ninguna línea reclama más de lo que vale.
 *
 * Ejecutar: node tests/test_casos_proveedores.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const WEB = path.resolve(__dirname, '..', 'apps-script-webapp');
const html = fs.readFileSync(path.join(WEB, 'JavaScript.html'), 'utf8');

const ctxS = { console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map, Logger: { log() {} } };
vm.createContext(ctxS);
vm.runInContext(fs.readFileSync(path.join(WEB, 'CruceEngine.gs'), 'utf8'), ctxS, { filename: 'CruceEngine.gs' });

function extraer(nombre) {
  const ini = html.indexOf('  function ' + nombre + '(');
  assert.ok(ini >= 0, 'No se encontró ' + nombre);
  let i = html.indexOf('{', ini), nivel = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') nivel++;
    else if (html[i] === '}') { nivel--; if (nivel === 0) break; }
  }
  return html.slice(ini, i + 1);
}
const ctxC = { console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map };
vm.createContext(ctxC);
vm.runInContext(['esProductoPesable', 'obtenerToleranciaPesable', 'esRatioDeCaja', 'inferirFactorEmpaque', 'precioEfectivoFactura', 'buscarPorMontoEnPo', 'calcularCruce1a1EnCliente'].map(extraer).join('\n'), ctxC);

const itemOc = (sku, nombre, recibido, ordenado, costo) => ({
  sku_id: sku, product_name: nombre, barcodes: [], supplier_sku: null, product_type: 'UNIDAD', internal_tax_lc: 0,
  received_qty_final: recibido, quantity_delivered: recibido, quantity_ordered: ordenado,
  unit_cost_after_discount_lc_final: costo, cost_unit_lc: costo, ordered_qty_real: ordenado,
  ordered_amount_after_discount: Math.round(ordenado * costo * 100) / 100, amt_delivered_lc: recibido * costo
});
const lineaFac = (cod, desc, qty, precio, monto, uom) => ({ linea: 1, codigo: cod, tipo_codigo: '', descripcion: desc, descripcion_adicional: '',
  cantidad_facturada: qty, unidad_medida: uom || 'UN', precio_facturado: precio, monto_facturado: monto });

// Corre una línea contra una línea de OC en los dos motores y devuelve un resultado uniforme
function correr(linea, oc) {
  const f = { folio: 'F', emisor: { rut: '1-9', razon_social: 'X' }, totales: { neto: linea.monto_facturado }, referencias: [], items: [JSON.parse(JSON.stringify(linea))] };
  const po = { po_found: true, po_order_id: 'PO1', total_recepcionado_neto: 0, items: [JSON.parse(JSON.stringify(oc))] };
  const s = ctxS.ejecutarCruceSkuPorSku(f, po);
  const c = ctxC.calcularCruce1a1EnCliente(JSON.parse(JSON.stringify(f)), JSON.parse(JSON.stringify(po)));
  return {
    servidor: { tipo: s.lineas[0].tipo_descalce, reclamo: s.lineas[0].monto_a_reclamar, sobreprecio: s.resumen.total_descalce_precio, faltante: s.resumen.total_faltante_recepcion },
    navegador: { tipo: c.lineas[0].estado, reclamo: c.lineas[0].monto_reclamar, sobreprecio: c.total_descalce_precio, faltante: c.total_faltante_recepcion }
  };
}

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}
const ambos = (r, fn) => { fn('servidor', r.servidor); fn('navegador', r.navegador); };

console.log('Alma Brand (factura en cajas, OC en unidades, precio que no confirma el factor)');
test('1 caja a $21.689 vs OC 24 unidades a $1.070,42 (recibidas 24): sin reclamo, queda para revisar la unidad', () => {
  const r = correr(lineaFac('AB1', 'Producto Alma Brand', 1, 21689, 21689), itemOc('AB1', 'Producto Alma Brand', 24, 24, 1070.42));
  ambos(r, (m, x) => {
    assert.strictEqual(x.tipo, 'REVISAR_UOM', m + ' tipo ' + x.tipo);
    assert.strictEqual(x.reclamo, 0, m + ' reclama ' + x.reclamo);
    assert.strictEqual(x.sobreprecio, 0, m + ' sobreprecio ' + x.sobreprecio);
  });
});
test('2 cajas a $11.195 vs OC 24 unidades a $2.174,83: sin reclamo', () => {
  const r = correr(lineaFac('AB2', 'Otro producto', 2, 11195, 22390), itemOc('AB2', 'Otro producto', 24, 24, 2174.83));
  ambos(r, (m, x) => { assert.strictEqual(x.reclamo, 0, m + ' reclama ' + x.reclamo); assert.strictEqual(x.tipo, 'REVISAR_UOM'); });
});
test('una sobrellegada normal (no es caja: 13 recibidas vs 10 facturadas) sigue siendo sobrellegada y solo cobra precio sobre lo facturado', () => {
  const r = correr(lineaFac('SL1', 'Producto', 10, 1200, 12000), itemOc('SL1', 'Producto', 13, 13, 1000));
  ambos(r, (m, x) => {
    assert.notStrictEqual(x.tipo, 'REVISAR_UOM', m);
    assert.strictEqual(x.reclamo, 2000, m + ' reclama ' + x.reclamo); // 10 unidades x $200, no 13 x $200
  });
});

console.log('Durandin (doble conteo del sobreprecio sobre unidades no recibidas)');
test('72 unidades a $1.700 (monto $122.400) vs OC a $1.484 con 0 recibidas: se reclama la línea completa UNA vez', () => {
  const r = correr(lineaFac('LD1', 'Producto Durandin', 72, 1700, 122400), itemOc('LD1', 'Producto Durandin', 0, 72, 1484));
  ambos(r, (m, x) => {
    assert.strictEqual(x.reclamo, 122400, m + ' reclama ' + x.reclamo);
    assert.strictEqual(x.sobreprecio, 0, m + ' sobreprecio ' + x.sobreprecio);
    assert.strictEqual(x.tipo, 'FALTANTE_RECEPCION', m + ' tipo ' + x.tipo);
  });
});
test('recepción parcial con sobreprecio real: faltante a precio facturado + sobreprecio solo de lo recibido', () => {
  const r = correr(lineaFac('PP1', 'Producto', 10, 1200, 12000), itemOc('PP1', 'Producto', 6, 10, 1000));
  ambos(r, (m, x) => {
    assert.strictEqual(x.reclamo, 4 * 1200 + 6 * 200, m + ' reclama ' + x.reclamo); // 6.000
    assert.strictEqual(x.tipo, 'DESCALCE_MIXTO', m);
  });
});

console.log('Cooperativa (pesables en kg)');
test('3,84 kg a $7.907,03 (monto $30.363) vs OC a $1.265 con 0 recibidas: reclamo = valor de la línea, sin sobreprecio', () => {
  const r = correr(lineaFac('CA1', 'Producto pesable', 3.84, 7907.03, 30363, 'KGM'), itemOc('CA1', 'Producto pesable', 0, 24, 1265));
  ambos(r, (m, x) => {
    assert.ok(x.reclamo <= 30363 + 1, m + ' reclama ' + x.reclamo);
    assert.strictEqual(x.sobreprecio, 0, m + ' sobreprecio ' + x.sobreprecio);
  });
});

console.log('Invariante: nunca se reclama más que el valor de la línea');
test('400 combinaciones aleatorias de cantidades, precios y recepciones en los dos motores', () => {
  let semilla = 20261105;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
  const entre = (a, b) => Math.floor(a + azar() * (b - a + 1));
  const malos = [];
  for (let i = 0; i < 400; i++) {
    const qFac = entre(1, 60);
    const precio = entre(100, 30000);
    const costo = entre(50, 30000);
    const ordenado = entre(1, 240);
    const recibido = entre(0, ordenado);
    const monto = qFac * precio;
    const r = correr(lineaFac('Z' + i, 'Producto ' + i, qFac, precio, monto), itemOc('Z' + i, 'Producto ' + i, recibido, ordenado, costo));
    ['servidor', 'navegador'].forEach(m => {
      const rec = r[m].reclamo;
      if (!(rec >= 0 && rec <= monto + 1)) malos.push(m + ' q' + qFac + ' x' + precio + ' (monto ' + monto + ') costo ' + costo + ' ord ' + ordenado + ' rec ' + recibido + ' -> reclama ' + rec + ' [' + r[m].tipo + ']');
    });
  }
  assert.strictEqual(malos.length, 0, malos.length + ' casos exceden. Ejemplos: ' + malos.slice(0, 4).join(' || '));
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
