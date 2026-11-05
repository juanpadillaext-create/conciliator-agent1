const fs = require('fs');
const vm = require('vm');
const path = require('path');

const cruceCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/CruceEngine.gs'), 'utf8');
const codigoCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/Codigo.gs'), 'utf8');

const sandbox = {
  Logger: { log: console.log },
  CATALOGO_AFOROS_MEMORIA_32: []
};
vm.createContext(sandbox);
vm.runInContext(cruceCode, sandbox);
vm.runInContext(codigoCode, sandbox);

console.log('=== TEST 1: Alias Resolution ===');
const resAndina = sandbox.resolverProveedorBackend('Andina- Guallarauco');
console.log('Andina- Guallarauco ->', resAndina);
const resCCU = sandbox.resolverProveedorBackend('Comercial CCU');
console.log('Comercial CCU ->', resCCU);
const resDesa = sandbox.resolverProveedorBackend('Dysa Licores');
console.log('Dysa Licores ->', resDesa);

console.log('\n=== TEST 2: Normalizacion y Similitud Bebidas ===');
const norm1 = sandbox.normalizarTexto('Cer Becker LT354cc 4,5g x 12');
const norm2 = sandbox.normalizarTexto('Cerveza Becker Lager En Lata 12 x 354 cm3');
console.log('Norm Factura:', norm1);
console.log('Norm BQ:     ', norm2);
const sim = sandbox.calcularSimilitudTextos(norm1, norm2);
console.log('Similitud calculada:', sim.toFixed(2));

console.log('\n=== TEST 3: Cruce Item Pack con UOM ===');
const invItem = {
  linea: 1,
  codigo: '120121',
  descripcion: 'Coca Cola PT1,5cc x 6',
  cantidad_facturada: 2,
  unidad_medida: 'CJ',
  precio_facturado: 8718,
  monto_facturado: 17436
};
const poItem = {
  sku_id: '120121',
  product_name: 'Bebida Coca Cola Original 1.5 L',
  quantity_ordered: 12,
  quantity_delivered: 12,
  cost_unit_lc: 1453,
  amt_ordered_lc: 17436,
  amt_delivered_lc: 17436
};
const analisis = sandbox.analizarDiscrepanciaItem(invItem, poItem, { po_order_id: 'PO526132', warehouse_name: 'CH_39_Calama' }, null);
console.log('Factor detectado:', analisis.factor_empaque);
console.log('Tiene descalce:', analisis.tiene_descalce);
console.log('Tipo descalce:', analisis.tipo_descalce);
console.log('Monto a reclamar:', analisis.monto_a_reclamar);

if (resAndina.rut === '91144000-8' && analisis.factor_empaque === 6 && !analisis.tiene_descalce) {
  console.log('\n✅ TODOS LOS TESTS DE REGLAS ANDINA Y PROVEEDORES PASARON CON ÉXITO!');
} else {
  console.error('\n❌ ERROR EN VALIDACIÓN');
  process.exit(1);
}

