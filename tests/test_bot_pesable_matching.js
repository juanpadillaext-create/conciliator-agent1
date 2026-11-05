const fs = require('fs');
const vm = require('vm');
const path = require('path');

// 1. Cargar CruceEngine.gs en entorno simulado de Google Apps Script
const cruceCode = fs.readFileSync(path.join(__dirname, '../apps-script-webapp/CruceEngine.gs'), 'utf8');
const sandbox = {
  Logger: console,
  console: console,
  Math: Math,
  Number: Number,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  Array: Array,
  Set: Set,
  Object: Object,
  String: String,
  Boolean: Boolean
};
vm.createContext(sandbox);
vm.runInContext(cruceCode, sandbox);

let errors = [];

// TEST 1: Producto PESABLE con datos normalizados por la query del bot (dentro de tolerancia)
const poDataPesableOk = {
  po_order_id: 'PO599001',
  store_name: 'CH_36_CD_Chile',
  warehouse_name: 'CH_36_CD_Chile',
  order_status: 'DELIVERED',
  po_found: true,
  items: [
    {
      po_number: 'PO599001',
      sku_id: 'SKU_CARNE_01',
      barcode: '780111222333',
      product_name: 'Lomo Vetado Granel',
      product_type: 'PESABLE',
      is_weightable: true,
      received_qty_final: 20.4, // 20.400 gr / 1000 = 20.4 kg
      unit_cost_after_discount_lc_final: 8500, // $8.5 * 1000 = $8500/kg
      internal_tax_lc: 0,
      total_amount_lc: 173400,
      quantity_ordered: 20.4,
      quantity_delivered: 20.4,
      cost_unit_lc: 8500,
      amt_ordered_lc: 173400,
      amt_delivered_lc: 173400,
      barcodes: ['780111222333']
    }
  ]
};

// Factura con 20.5 kg (diferencia de 100 gr = 0.48%, dentro de la tolerancia de pesables 2.5%)
const invoiceDataPesableOk = {
  folio: '99001',
  fecha_emision: '2026-05-10',
  emisor: { rut: '91004000-6', razon_social: 'Productos Fernández S.A. (PF)' },
  items: [
    {
      linea: 1,
      codigo: 'SKU_CARNE_01',
      ean: '780111222333',
      descripcion: 'Lomo Vetado Granel Kg',
      cantidad_facturada: 20.5,
      unidad_medida: 'KG',
      precio_facturado: 8500,
      monto_facturado: 174250
    }
  ]
};

sandbox.invDoc = invoiceDataPesableOk;
sandbox.poDoc = poDataPesableOk;
const res1 = vm.runInContext('ejecutarCruceSkuPorSku(invDoc, poDoc)', sandbox);

console.log('--- TEST 1: Pesable dentro de tolerancia ---');
console.log('Estado general:', res1.resumen.estado_general);
console.log('Líneas conformes:', res1.resumen.lineas_conformes);
console.log('Monto a reclamar:', res1.resumen.total_monto_a_reclamar);
console.log('Tipo descalce línea 1:', res1.lineas[0].tipo_descalce);

if (res1.lineas[0].tipo_descalce !== 'RECEPCION_CONFORME_PESABLE') {
  errors.push(`TEST 1 Falló: tipo_descalce esperado RECEPCION_CONFORME_PESABLE, obtenido ${res1.lineas[0].tipo_descalce}`);
}
if (res1.lineas[0].monto_a_reclamar !== 0) {
  errors.push(`TEST 1 Falló: monto_a_reclamar esperado 0, obtenido ${res1.lineas[0].monto_a_reclamar}`);
}

// TEST 2: Producto PESABLE con faltante real fuera de tolerancia (ej: facturó 30 kg, recepcionó 20.4 kg)
const invoiceDataPesableFaltante = {
  folio: '99002',
  fecha_emision: '2026-05-11',
  emisor: { rut: '91004000-6', razon_social: 'Productos Fernández S.A. (PF)' },
  items: [
    {
      linea: 1,
      codigo: 'SKU_CARNE_01',
      ean: '780111222333',
      descripcion: 'Lomo Vetado Granel Kg',
      cantidad_facturada: 30.0,
      unidad_medida: 'KG',
      precio_facturado: 8500,
      monto_facturado: 255000
    }
  ]
};

sandbox.invDoc = invoiceDataPesableFaltante;
sandbox.poDoc = poDataPesableOk;
const res2 = vm.runInContext('ejecutarCruceSkuPorSku(invDoc, poDoc)', sandbox);

console.log('\n--- TEST 2: Pesable con faltante fuera de tolerancia ---');
console.log('Estado general:', res2.resumen.estado_general);
console.log('Tipo descalce línea 1:', res2.lineas[0].tipo_descalce);
console.log('Monto a reclamar:', res2.resumen.total_monto_a_reclamar);

if (res2.lineas[0].tipo_descalce !== 'FALTANTE_RECEPCION_PESABLE') {
  errors.push(`TEST 2 Falló: tipo_descalce esperado FALTANTE_RECEPCION_PESABLE, obtenido ${res2.lineas[0].tipo_descalce}`);
}
if (res2.resumen.total_monto_a_reclamar <= 0) {
  errors.push(`TEST 2 Falló: monto_a_reclamar debió ser mayor a 0, obtenido ${res2.resumen.total_monto_a_reclamar}`);
}

// TEST 3: Producto UNITARIO estándar (UNIDAD) con calce exacto
const poDataUnidad = {
  po_order_id: 'PO599003',
  store_name: 'CH_36_CD_Chile',
  warehouse_name: 'CH_36_CD_Chile',
  order_status: 'DELIVERED',
  po_found: true,
  items: [
    {
      po_number: 'PO599003',
      sku_id: 'SKU_UNIT_01',
      barcode: '780444555666',
      product_name: 'Galletas Chocochips 100g',
      product_type: 'UNIDAD',
      is_weightable: false,
      received_qty_final: 50,
      unit_cost_after_discount_lc_final: 600,
      internal_tax_lc: 0,
      total_amount_lc: 30000,
      quantity_ordered: 50,
      quantity_delivered: 50,
      cost_unit_lc: 600,
      amt_ordered_lc: 30000,
      amt_delivered_lc: 30000,
      barcodes: ['780444555666']
    }
  ]
};

const invoiceDataUnidad = {
  folio: '99003',
  fecha_emision: '2026-05-12',
  emisor: { rut: '96591040-9', razon_social: 'Empresas Carozzi S.A.' },
  items: [
    {
      linea: 1,
      codigo: 'SKU_UNIT_01',
      ean: '780444555666',
      descripcion: 'Galletas Chocochips 100g',
      cantidad_facturada: 50,
      unidad_medida: 'UN',
      precio_facturado: 600,
      monto_facturado: 30000
    }
  ]
};

sandbox.invDoc = invoiceDataUnidad;
sandbox.poDoc = poDataUnidad;
const res3 = vm.runInContext('ejecutarCruceSkuPorSku(invDoc, poDoc)', sandbox);

console.log('\n--- TEST 3: Producto Unitario Calce 100% OK ---');
console.log('Estado general:', res3.resumen.estado_general);
console.log('Líneas conformes:', res3.resumen.lineas_conformes);
console.log('Monto a reclamar:', res3.resumen.total_monto_a_reclamar);
console.log('Tipo descalce:', res3.lineas[0].tipo_descalce);

if (res3.lineas[0].tipo_descalce !== 'CALCE_100_OK') {
  errors.push(`TEST 3 Falló: tipo_descalce esperado CALCE_100_OK, obtenido ${res3.lineas[0].tipo_descalce}`);
}
if (res3.resumen.total_monto_a_reclamar !== 0) {
  errors.push(`TEST 3 Falló: monto_a_reclamar esperado 0, obtenido ${res3.resumen.total_monto_a_reclamar}`);
}

if (errors.length > 0) {
  console.error('\n❌ ERRORES EN VALIDACIÓN:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log('\n✅ TODOS LOS TESTS DE VALIDACIÓN DE LA QUERY DEL BOT PASARON PERFECTAMENTE!');
}

