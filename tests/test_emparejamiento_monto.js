/**
 * Emparejamiento por MONTO entre líneas de factura y líneas de la OC (códigos propios del proveedor, sin EAN).
 * Caso real: PO 529067 + factura 2345904 (AVÍCOLA Y COMERCIAL EL TOCO). Las dos copias del cruce deben dar el mismo
 * resultado: el servidor (CruceEngine.gs) y el navegador (JavaScript.html). Sin red.
 *
 * Ejecutar: node tests/test_emparejamiento_monto.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const WEB = path.resolve(__dirname, '..', 'apps-script-webapp');
const html = fs.readFileSync(path.join(WEB, 'JavaScript.html'), 'utf8');

// ───────── Datos reales: OC 529067 (BigQuery) y factura 2345904 (XML del SII en Axteroid) ─────────
const itemOc = (sku, nombre, recibido, ordenado, costo) => ({
  sku_id: sku, product_name: nombre, barcodes: [], supplier_sku: null, product_type: 'UNIDAD', internal_tax_lc: 0,
  received_qty_final: recibido, quantity_delivered: recibido, quantity_ordered: recibido,
  unit_cost_after_discount_lc_final: costo, cost_unit_lc: costo,
  ordered_qty_real: ordenado, ordered_amount_after_discount: Math.round(ordenado * costo * 100) / 100,
  amt_delivered_lc: recibido * costo
});
const poItems = () => [
  itemOc('18630892', 'Huevos Gallinas Libres Grandes Color 12 Unidades', 15, 30, 3154),
  itemOc('15133220', 'Huevos Cintazul Grandes Blancos 6 Unidades', 0, 30, 1246.31),
  itemOc('6J7X40', 'Huevos Cintazul Extra Blanco Grande 20 Unidades', 20, 30, 3927),
  itemOc('15133032', 'Huevos Blancos Grandes Cintazul 12 Unidades', 60, 90, 2119.9),
  itemOc('86ND0N', 'Huevos Cinta Azul Color Grande 12 Unidades', 0, 15, 2566),
  itemOc('F04Z87', 'Huevo Grande Color 30 Un Cintazul', 10, 10, 6380)
];
const lineaFac = (n, cod, desc, qty, prc, monto) => ({ linea: n, codigo: cod, tipo_codigo: '', descripcion: desc, descripcion_adicional: '',
  cantidad_facturada: qty, unidad_medida: 'UN', precio_facturado: prc, monto_facturado: monto });
const itemsFactura = () => [
  lineaFac(1, '010306', 'GRANDE BLANCO DOCENA', 6, 31800, 190800),
  lineaFac(2, '011306FTP', 'GRANDE COLOR DOC.FREE TP', 2, 47310, 94620),
  lineaFac(3, '010307', 'GRANDE BLANCO 1/2 DOCENA', 1, 37380, 37380),
  lineaFac(4, '011306', 'GRANDE COLOR DOCENA', 1, 38490, 38490),
  lineaFac(5, '010209', 'EXTRA BLANCO PACK 20', 6, 19635, 117810),
  lineaFac(6, '011312', 'GRANDE COLOR PACK 30', 2, 31900, 63800)
];
// Cada código de la factura debe terminar en este SKU de la OC (deducido por monto: cantidad ordenada x costo)
const ESPERADO = { '010306': '15133032', '011306FTP': '18630892', '010307': '15133220', '011306': '86ND0N', '010209': '6J7X40', '011312': 'F04Z87' };
const DIF_ML_OC = 226056; // Facturado 542.900 - Recepcionado 316.844 (nivel OC, como el Paso 1)

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); } catch (e) { console.error('  FAIL ' + nombre + '\n       ' + e.message); process.exitCode = 1; }
}

// ───────── Servidor: CruceEngine.gs ─────────
const ctxS = { console, Math, Number, String, Array, Object, RegExp, parseInt, parseFloat, isNaN, Date, JSON, Set, Map, Logger: { log() {} } };
vm.createContext(ctxS);
vm.runInContext(fs.readFileSync(path.join(WEB, 'CruceEngine.gs'), 'utf8'), ctxS, { filename: 'CruceEngine.gs' });

console.log('Servidor (CruceEngine.gs)');
const factura = () => ({ folio: '2345904', tipo_dte: '33', emisor: { rut: '78383730-7', razon_social: 'AVICOLA Y COMERCIAL EL TOCO LTDA' },
  totales: { neto: 542900 }, referencias: [{ tipo: '801', folio: '00005290671', is_po: true }], items: itemsFactura() });
const poData = () => ({ po_found: true, po_order_id: 'PO529067', warehouse_name: 'CH_16_Departamental', total_recepcionado_neto: 316844, items: poItems() });
const rS = ctxS.ejecutarCruceSkuPorSku(factura(), poData());

test('las 6 líneas se enlazan con su SKU correcto aunque el código del proveedor no esté homologado', () => {
  rS.lineas.forEach(l => assert.strictEqual(l.sku_oc, ESPERADO[l.codigo_factura], 'línea ' + l.codigo_factura + ' -> ' + l.sku_oc));
});
test('ninguna línea queda como "no en OC" ni como sobrellegada', () => {
  assert.strictEqual(rS.lineas.filter(l => l.tipo_descalce === 'SKU_NO_EN_OC' || l.tipo_descalce === 'SOBRE_LLEGADA').length, 0);
});
test('las líneas emparejadas por monto quedan marcadas y avisadas', () => {
  const l = rS.lineas.find(x => x.codigo_factura === '010306');
  assert.strictEqual(l.emparejado_por, 'monto');
  assert.ok(/Emparejada por monto/.test(l.observacion));
});
test('la suma de reclamos de las líneas coincide con el Dif ML de la OC (±$100 por redondeo de costos)', () => {
  const suma = rS.lineas.reduce((s, l) => s + (Number(l.monto_a_reclamar) || 0), 0);
  assert.ok(Math.abs(suma - DIF_ML_OC) <= 100, 'suma líneas ' + suma + ' vs OC ' + DIF_ML_OC);
  assert.strictEqual(rS.resumen.dif_ml, DIF_ML_OC);
});
test('con el código exacto de SKU no cambia el comportamiento (el código gana al monto)', () => {
  const f = factura();
  f.items[0].codigo = '15133032';
  const r = ctxS.ejecutarCruceSkuPorSku(f, poData());
  const l = r.lineas.find(x => x.codigo_factura === '15133032');
  assert.strictEqual(l.sku_oc, '15133032');
  assert.notStrictEqual(l.emparejado_por, 'monto');
});
test('si dos líneas de la OC valen lo mismo, NO adivina por monto', () => {
  const dup = [itemOc('AAA111', 'Producto uno', 6, 6, 1283), itemOc('BBB222', 'Producto dos', 6, 6, 1283)];
  const r = ctxS.buscarMatchPorMonto({ monto_facturado: 7698 }, dup, new Set());
  assert.strictEqual(r.index, -1);
});
test('una línea de la OC ya emparejada no se vuelve a usar', () => {
  const r = ctxS.buscarMatchPorMonto({ monto_facturado: 63800 }, poItems(), new Set([5]));
  assert.strictEqual(r.index, -1);
});
test('un monto que no coincide con ninguna línea no se empareja', () => {
  assert.strictEqual(ctxS.buscarMatchPorMonto({ monto_facturado: 99999 }, poItems(), new Set()).index, -1);
});

// ───────── Navegador: JavaScript.html (misma lógica, copia del cliente) ─────────
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

console.log('Navegador (JavaScript.html)');
const rC = ctxC.calcularCruce1a1EnCliente({ folio: '2345904', emisor: { rut: '78383730-7', razon_social: 'EL TOCO' }, fecha_emision: '2026-10-24', items: itemsFactura() },
  { po_order_id: 'PO529067', warehouse_name: 'CH_16_Departamental', items: poItems() });

test('las 6 líneas se enlazan con su SKU correcto', () => {
  rC.lineas.forEach(l => assert.strictEqual(l.sku_oc, ESPERADO[l.codigo_factura], 'línea ' + l.codigo_factura + ' -> ' + l.sku_oc));
});
test('ninguna línea queda como "no en OC"', () => {
  assert.strictEqual(rC.lineas.filter(l => l.estado === 'NO_EN_OC').length, 0);
});
test('las líneas emparejadas por monto quedan marcadas', () => {
  const l = rC.lineas.find(x => x.codigo === '010306');
  assert.strictEqual(l.emparejado_por, 'monto');
  assert.ok(/Emparejada por monto/.test(l.diagnostico));
});
test('el total de la tabla coincide con el Dif ML de la OC (±$100)', () => {
  const suma = rC.lineas.reduce((s, l) => s + (Number(l.monto_reclamar) || 0), 0);
  assert.ok(Math.abs(suma - DIF_ML_OC) <= 100, 'suma líneas ' + suma + ' vs OC ' + DIF_ML_OC);
  assert.ok(Math.abs(rC.dif_ml - DIF_ML_OC) <= 100, 'dif_ml del cruce ' + rC.dif_ml);
});

// ───────── Descuento por línea: el precio efectivo es monto / cantidad (caso real: LUCCHETTI, factura 3685184) ─────────
// La factura dice 1 x 15.000 pero el monto neto de la línea es 12.894 (descuento de línea). La OC: 24 unidades a 537,29 = 12.894,96.
const itemOcDesc = () => [itemOc('18425402', 'Sal. Lucchetti Doy Pack Natural', 0, 24, 537.29)];
const lineaDesc = () => ({ linea: 1, codigo: '1061492', tipo_codigo: '', descripcion: 'Sal. LUCCHETTI Doy Natural', descripcion_adicional: '',
  cantidad_facturada: 1, unidad_medida: 'UN', precio_facturado: 15000, monto_facturado: 12894 });
const facDesc = () => ({ folio: 'T1', emisor: { rut: '1-9', razon_social: 'X' }, totales: { neto: 12894 }, referencias: [], items: [lineaDesc()] });

console.log('Descuento por línea (servidor)');
test('precioEfectivoFactura: usa monto/cantidad con descuento y respeta el precio si solo hay redondeo', () => {
  assert.strictEqual(ctxS.precioEfectivoFactura(1, 15000, 12894), 12894);
  assert.strictEqual(ctxS.precioEfectivoFactura(6, 31800, 190800), 31800);
  assert.strictEqual(ctxS.precioEfectivoFactura(2.5, 1000, 2499), 1000); // redondeo de pesables
  assert.strictEqual(ctxS.precioEfectivoFactura(0, 500, 1000), 500);      // sin cantidad: no se toca
  assert.strictEqual(ctxS.precioEfectivoFactura(3, 500, 0), 500);         // sin monto: no se toca
});
test('línea con descuento: NO hay sobreprecio falso y el reclamo no supera el valor de la línea', () => {
  const r = ctxS.ejecutarCruceSkuPorSku(facDesc(), { po_found: true, po_order_id: 'PO1', total_recepcionado_neto: 0, items: itemOcDesc() });
  const l = r.lineas[0];
  assert.strictEqual(l.sku_oc, '18425402');
  assert.strictEqual(r.resumen.total_descalce_precio, 0, 'sobreprecio ' + r.resumen.total_descalce_precio);
  assert.ok(l.monto_a_reclamar <= l.monto_facturado + 1, 'reclama ' + l.monto_a_reclamar + ' de ' + l.monto_facturado);
  assert.ok(Math.abs(l.monto_a_reclamar - 12894) <= 100, 'faltante completo esperado, reclama ' + l.monto_a_reclamar);
});
test('el motor no modifica las líneas de la factura que recibe', () => {
  const f = facDesc();
  ctxS.ejecutarCruceSkuPorSku(f, { po_found: true, po_order_id: 'PO1', total_recepcionado_neto: 0, items: itemOcDesc() });
  assert.strictEqual(f.items[0].precio_facturado, 15000);
});
test('un sobreprecio REAL (precio y monto coherentes, más caro que la OC) sí se sigue reclamando', () => {
  const caro = { linea: 1, codigo: 'ZZ', tipo_codigo: '', descripcion: 'Producto', descripcion_adicional: '', cantidad_facturada: 10, unidad_medida: 'UN', precio_facturado: 1200, monto_facturado: 12000 };
  const f = { folio: 'T2', emisor: { rut: '1-9', razon_social: 'X' }, totales: { neto: 12000 }, referencias: [], items: [caro] };
  const po = { po_found: true, po_order_id: 'PO2', total_recepcionado_neto: 10000, items: [itemOc('ZZ', 'Producto', 10, 10, 1000)] };
  const r = ctxS.ejecutarCruceSkuPorSku(f, po);
  assert.ok(r.resumen.total_descalce_precio >= 1900, 'sobreprecio detectado ' + r.resumen.total_descalce_precio);
});

console.log('Descuento por línea (navegador)');
test('precioEfectivoFactura del navegador es igual al del servidor', () => {
  [[1, 15000, 12894], [6, 31800, 190800], [2.5, 1000, 2499], [0, 500, 1000], [3, 500, 0], [24, 800, 17000]].forEach(a => {
    assert.strictEqual(ctxC.precioEfectivoFactura.apply(null, a), ctxS.precioEfectivoFactura.apply(null, a), JSON.stringify(a));
  });
});
test('línea con descuento en el navegador: sin sobreprecio falso y reclamo acotado al valor de la línea', () => {
  const r = ctxC.calcularCruce1a1EnCliente(facDesc(), { po_order_id: 'PO1', items: itemOcDesc() });
  const l = r.lineas[0];
  assert.strictEqual(l.sku_oc, '18425402');
  assert.strictEqual(r.total_descalce_precio, 0, 'sobreprecio ' + r.total_descalce_precio);
  assert.ok(l.monto_reclamar <= l.monto_facturado + 1, 'reclama ' + l.monto_reclamar + ' de ' + l.monto_facturado);
});

// ───────── Factor de empaque fuera de la lista fija (casos reales: TRESMONTES, factura 7188476) ─────────
const lineaCaja = (cod, desc, qty, precio, monto) => ({ linea: 1, codigo: cod, tipo_codigo: '', descripcion: desc, descripcion_adicional: '',
  cantidad_facturada: qty, unidad_medida: 'UN', precio_facturado: precio, monto_facturado: monto });
const facUna = (l) => ({ folio: 'F', emisor: { rut: '1-9', razon_social: 'X' }, totales: { neto: l.monto_facturado }, referencias: [], items: [l] });
const poUna = (it) => ({ po_found: true, po_order_id: 'PO9', total_recepcionado_neto: 0, items: [it] });

console.log('Factor de empaque inferido');
test('inferirFactorEmpaque: caja de 7 y de 160 confirmadas por la cantidad ordenada', () => {
  assert.strictEqual(ctxS.inferirFactorEmpaque(10956.83, 1565.2, 6, 42, 0), 7);
  assert.strictEqual(ctxS.inferirFactorEmpaque(29440, 184, 1, 160, 0), 160);
});
test('inferirFactorEmpaque: sin confirmación por cantidades NO inventa un factor (sobreprecio real con costo bajo)', () => {
  assert.strictEqual(ctxS.inferirFactorEmpaque(30000, 184, 1, 100, 0), 0);   // 30.000/184 = 163, pero se ordenaron 100
  assert.strictEqual(ctxS.inferirFactorEmpaque(1200, 1000, 10, 10, 10), 0);  // factor 1: no es caja
  assert.strictEqual(ctxS.inferirFactorEmpaque(1000, 0, 1, 10, 0), 0);       // sin costo
});
test('servidor: caja de 7 unidades (6 cajas a $10.956,83 = $65.741; OC ordenó 42 a $1.565,20): sin sobreprecio falso', () => {
  const r = ctxS.ejecutarCruceSkuPorSku(facUna(lineaCaja('1070567', 'Frt. Cons. LIVEAN Nac Pou', 6, 10956.83, 65741)), poUna(itemOc('VZ508P', 'Frt. Cons. LIVEAN Nac Pouch', 0, 42, 1565.2)));
  const l = r.lineas[0];
  assert.strictEqual(l.sku_oc, 'VZ508P');
  assert.strictEqual(l.factor_empaque, 7);
  assert.strictEqual(r.resumen.total_descalce_precio, 0);
  assert.ok(l.monto_a_reclamar <= 65741 + 20, 'reclama ' + l.monto_a_reclamar);
});
test('servidor: caja de 160 unidades (1 caja a $29.440; OC ordenó 160 a $184)', () => {
  const r = ctxS.ejecutarCruceSkuPorSku(facUna(lineaCaja('1100741', 'Hamb SB 100g', 1, 29440, 29440)), poUna(itemOc('XII32G', 'Hamburguesa SB 100g', 0, 160, 184)));
  const l = r.lineas[0];
  assert.strictEqual(l.factor_empaque, 160);
  assert.strictEqual(r.resumen.total_descalce_precio, 0);
  assert.ok(l.monto_a_reclamar <= 29440 + 20, 'reclama ' + l.monto_a_reclamar);
});
test('servidor: un sobreprecio real con costo bajo sigue reclamándose (no se esconde tras un factor inventado)', () => {
  const r = ctxS.ejecutarCruceSkuPorSku(facUna(lineaCaja('9999', 'Producto', 1, 30000, 30000)), poUna(itemOc('P1', 'Producto', 100, 100, 184)));
  assert.ok(r.lineas[0].factor_empaque !== 163, 'no debe inventar factor 163');
});
test('navegador: caja de 7 y de 160 igual que el servidor', () => {
  const r7 = ctxC.calcularCruce1a1EnCliente(facUna(lineaCaja('1070567', 'Frt. Cons. LIVEAN Nac Pou', 6, 10956.83, 65741)), { po_order_id: 'PO9', items: [itemOc('VZ508P', 'Frt. Cons. LIVEAN Nac Pouch', 0, 42, 1565.2)] });
  assert.strictEqual(r7.lineas[0].factor_empaque, 7);
  assert.strictEqual(r7.total_descalce_precio, 0);
  assert.ok(r7.lineas[0].monto_reclamar <= 65741 + 20);
  const r160 = ctxC.calcularCruce1a1EnCliente(facUna(lineaCaja('1100741', 'Hamb SB 100g', 1, 29440, 29440)), { po_order_id: 'PO9', items: [itemOc('XII32G', 'Hamburguesa SB 100g', 0, 160, 184)] });
  assert.strictEqual(r160.lineas[0].factor_empaque, 160);
  assert.ok(r160.lineas[0].monto_reclamar <= 29440 + 20);
});

console.log('\n' + ok + ' pruebas OK' + (process.exitCode ? ' (hay fallas)' : ''));
