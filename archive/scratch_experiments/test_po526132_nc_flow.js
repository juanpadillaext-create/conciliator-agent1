// Simulación de la lógica de Codigo.gs para PO 526132
const facturas = [
  { folio: '97913615', tipo_dte: 'CL33', monto_neto: 36063, monto_total: 53689, es_nc: false },
  { folio: '97913614', tipo_dte: 'CL33', monto_neto: 196943, monto_total: 235402, es_nc: false },
  { folio: '97913616', tipo_dte: 'CL33', monto_neto: 599601, monto_total: 827299, es_nc: false },
  { folio: '97913613', tipo_dte: 'CL33', monto_neto: 2046600, monto_total: 2582282, es_nc: false },
  { folio: '25243761', tipo_dte: 'CL61', monto_neto: 50481, monto_total: 69668, es_nc: true },
  { folio: '25243763', tipo_dte: 'CL61', monto_neto: 60807, monto_total: 80314, es_nc: true },
  { folio: '25243760', tipo_dte: 'CL61', monto_neto: 21182, monto_total: 26247, es_nc: true }
];

const totalOcRecepcionado = 1827285;

let totalFacturasNeto = 0;
let totalNcsNeto = 0;
let totalFacturasTotal = 0;
let totalNcsTotal = 0;

facturas.forEach(f => {
  if (f.es_nc) {
    totalNcsNeto += Number(f.monto_neto || 0);
    totalNcsTotal += Number(f.monto_total || 0);
  } else {
    totalFacturasNeto += Number(f.monto_neto || 0);
    totalFacturasTotal += Number(f.monto_total || 0);
  }
});

const totalFacturadoNeto = Math.max(0, totalFacturasNeto - totalNcsNeto);
const totalFacturadoTotal = Math.max(0, totalFacturasTotal - totalNcsTotal);

// Asignar recepcionado y calcular Dif ML individual para cada factura y nota de crédito
facturas.forEach(f => {
  let recBodega = 0;
  if (f.es_nc) {
    f.recepcionado_bodega = 0;
    f.diferencia_ml = -Math.round(f.monto_neto);
    f.dif_ml = f.diferencia_ml;
  } else {
    if (totalFacturasNeto > 0) {
      recBodega = Math.round(totalOcRecepcionado * (f.monto_neto / totalFacturasNeto));
    }
    f.recepcionado_bodega = recBodega;
    f.diferencia_ml = Math.round(f.monto_neto - recBodega);
    f.dif_ml = f.diferencia_ml;
  }
});

const montoReferenciaOc = totalFacturadoNeto;
const diferenciaMlCalculada = Math.round(montoReferenciaOc - totalOcRecepcionado);
const sumDiferenciasIndividuales = facturas.reduce((s, f) => s + f.diferencia_ml, 0);

console.log('--- TEST PO 526132 CON DEDUCCIÓN AUTOMÁTICA DE NOTAS DE CRÉDITO ---');
console.log('Total Facturas Neto (4 DTE 33):', totalFacturasNeto);
console.log('Total NCs Neto Deducidas (3 DTE 61):', totalNcsNeto);
console.log('Total Facturado Neto Neteado:', totalFacturadoNeto);
console.log('Total Recepcionado Bodega Calama:', totalOcRecepcionado);
console.log('Monto Referencia OC:', montoReferenciaOc);
console.log('Dif ML Calculada (Monto Ref OC - Recepcionado):', diferenciaMlCalculada);
console.log('Suma de Dif ML de cada fila:', sumDiferenciasIndividuales);
console.log('¿Cuadra la suma de filas exactamente con la cabecera?:', sumDiferenciasIndividuales === diferenciaMlCalculada ? 'SÍ (Exacto)' : 'NO');

facturas.forEach(f => {
  console.log(`  Folio: ${f.folio} (${f.es_nc ? 'NC' : 'FAC'}) | Neto: ${f.monto_neto} | Rec: ${f.recepcionado_bodega} | Dif ML: ${f.diferencia_ml}`);
});
