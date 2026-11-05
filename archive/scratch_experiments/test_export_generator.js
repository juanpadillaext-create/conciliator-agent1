const XLSX = require('xlsx');
const fs = require('fs');

const jsContent = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');

// Extract CAROZZI_517979_SKU_TUPLES and CAROZZI_517979_DETALLE_TUPLES
const skuMatch = jsContent.match(/const CAROZZI_517979_SKU_TUPLES = (\[[\s\S]*?\]);/);
const detMatch = jsContent.match(/const CAROZZI_517979_DETALLE_TUPLES = (\[[\s\S]*?\]);/);

if (!skuMatch || !detMatch) {
  console.error('Could not extract tuples from JavaScript.html');
  process.exit(1);
}

const CAROZZI_517979_SKU_TUPLES = JSON.parse(skuMatch[1]);
const CAROZZI_517979_DETALLE_TUPLES = JSON.parse(detMatch[1]);

console.log('Tuples extracted successfully:');
console.log('SKUs:', CAROZZI_517979_SKU_TUPLES.length);
console.log('Detalle:', CAROZZI_517979_DETALLE_TUPLES.length);

// Test building the workbook with the 17 columns
function testBuildWorkbook(soloDescalces) {
  const wb = XLSX.utils.book_new();
  const rawLines = CAROZZI_517979_SKU_TUPLES.map((t, idx) => ({
    linea: idx + 1,
    sku: t[0],
    ean: t[1],
    descripcion: t[2],
    categoria: t[3] || 'Snacks',
    cantidad_recepcionada: t[4],
    costo_oc: t[5],
    cantidad_facturada: t[6],
    total_facturado: t[7],
    precio_facturado: t[8],
    dif_cantidad: t[9],
    dif_precio: t[10],
    diferencias_finales: t[11],
    comentario: t[12],
    monto_reclamar: (t[9] !== 0 || t[10] !== 0 || t[11]) ? Math.max(0, t[7] - (t[4] * t[5])) : 0,
    estado: t[11] ? 'DESCALCE' : 'CALCE_100_OK'
  }));

  let linesToExport = rawLines;
  if (soloDescalces) {
    linesToExport = rawLines.filter(l => (l.diferencias_finales && l.diferencias_finales !== 'Calce Conforme') || l.dif_cantidad !== 0 || Math.abs(l.dif_precio) > 0.05);
  }

  const lastRow = linesToExport.length + 5;
  const ws1 = {};

  let sumProdUnids = 0;
  let sumProdCosto = 0;
  linesToExport.forEach(l => {
    sumProdUnids += (l.costo_oc * (l.cantidad_facturada - l.cantidad_recepcionada));
    sumProdCosto += ((l.precio_facturado * l.cantidad_facturada) - (l.costo_oc * l.cantidad_facturada));
  });

  const sumProdTotal = Math.round((sumProdUnids + sumProdCosto) * 100) / 100;

  ws1['A1'] = { t: 's', v: 'Orden de Compra:' };
  ws1['B1'] = { t: 's', v: 'PO517979' };
  ws1['D1'] = { t: 's', v: 'Monto por diferencia de unidades:' };
  ws1['E1'] = { t: 'n', f: `SUMPRODUCT(($H$6:$H$${lastRow})*($N$6:$N$${lastRow}))`, v: Math.round(sumProdUnids), z: '#,##0.00' };

  ws1['A2'] = { t: 's', v: 'Monto Aforado:' };
  ws1['B2'] = { t: 'n', v: -sumProdTotal, z: '#,##0.00' };
  ws1['D2'] = { t: 's', v: 'Monto por diferencia de costo:' };
  ws1['E2'] = { t: 'n', f: `SUMPRODUCT(($M$6:$M$${lastRow})*($K$6:$K$${lastRow}))-SUMPRODUCT(($H$6:$H$${lastRow})*($K$6:$K$${lastRow}))`, v: Math.round(sumProdCosto), z: '#,##0.00' };

  ws1['A3'] = { t: 's', v: 'Diferencia sin identificar:' };
  ws1['B3'] = { t: 'n', f: '$B$2+$E$3', v: 0, z: '#,##0.00' };
  ws1['D3'] = { t: 's', v: 'Monto total diferencias:' };
  ws1['E3'] = { t: 'n', f: '$E$1+$E$2', v: sumProdTotal, z: '#,##0.00' };

  ws1['K1'] = { t: 's', v: 'EN CASO DE HABER FACTURADO POR CAJA, FAVOR DE COLOCAR LAS UNIDADES TOTALES Y EL COSTO TOTAL FACTURADO' };
  ws1['K4'] = { t: 's', v: 'COMPLETAR CON LOS PRODUCTOS FACTURADOS' };
  ws1['N4'] = { t: 's', v: 'REVISAR LAS DIFERENCIAS' };

  ws1['!merges'] = [
    { s: { r: 0, c: 10 }, e: { r: 2, c: 12 } },
    { s: { r: 3, c: 10 }, e: { r: 3, c: 12 } },
    { s: { r: 3, c: 13 }, e: { r: 3, c: 15 } }
  ];

  const headers17 = [
    'Órdenes de Compra', 'Tienda', 'SKU', 'EAN', 'Nombre de Producto', 'Tipo Producto',
    'Unidades Recepcionadas', 'Costo Unitario OC', 'Impuesto Interno', 'Costo Total OC',
    'Unidades Facturadas', 'Costo Total Facturado (SIN IVA)', 'Costo Unitario Facturado (SIN IVA)',
    'Diferencia de Unidades', 'Diferencia de Costo', 'Diferencias Finales', 'Comentarios'
  ];

  headers17.forEach((h, idx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 4, c: idx });
    ws1[cellRef] = { t: 's', v: h };
  });

  linesToExport.forEach((l, idx) => {
    const r = idx + 6;
    ws1['A' + r] = { t: 's', v: 'PO517979' };
    ws1['B' + r] = { t: 's', v: 'CH_36_CD_Chile' };
    ws1['C' + r] = { t: 's', v: l.sku };
    ws1['D' + r] = { t: 's', v: l.ean };
    ws1['E' + r] = { t: 's', v: l.descripcion };
    ws1['F' + r] = { t: 's', v: l.categoria };
    ws1['G' + r] = { t: 'n', v: l.cantidad_recepcionada, z: '#,##0' };
    ws1['H' + r] = { t: 'n', v: l.costo_oc, z: '#,##0.00' };
    ws1['I' + r] = { t: 'n', v: 0, z: '#,##0.00' };
    ws1['J' + r] = { t: 'n', f: `G${r}*H${r}`, v: l.cantidad_recepcionada * l.costo_oc, z: '#,##0.00' };
    ws1['K' + r] = { t: 'n', v: l.cantidad_facturada, z: '#,##0' };
    ws1['L' + r] = { t: 'n', v: l.total_facturado, z: '#,##0.00' };
    ws1['M' + r] = { t: 'n', f: `IF(OR(K${r}="",K${r}=0,L${r}=""),0,IFERROR(L${r}/K${r},""))`, v: l.precio_facturado, z: '#,##0.00' };
    ws1['N' + r] = { t: 'n', f: `IF(OR(K${r}="",K${r}=0,L${r}=""),0,K${r}-G${r})`, v: l.dif_cantidad, z: '#,##0.00' };
    ws1['O' + r] = { t: 'n', f: `ROUND(IF(OR(K${r}="",K${r}=0,L${r}=""),0,M${r}-H${r}),2)`, v: l.dif_precio, z: '#,##0.00' };
    ws1['P' + r] = { t: 's', f: `IF(AND(N${r}>0,O${r}>0),"Diferencia de Costo y Unidad",IF(N${r}>0,"Diferencia de Unidades",IF(O${r}>0,"Diferencia de Costo",IF(AND(N${r}=0,O${r}=0),"Calce Conforme",""))))`, v: l.diferencias_finales || 'Calce Conforme' };
    ws1['Q' + r] = { t: 's', v: l.comentario };
  });

  ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 16 } });
  XLSX.utils.book_append_sheet(wb, ws1, 'Carozzi');

  // Detalle Facturas
  const detHeaders = ['Nº Factura', 'Código Producto', 'Descripción', 'Unid. Vta', 'Cantidad', 'Precio Unitario', 'Valor Neto'];
  const dataSheet2 = [detHeaders];
  CAROZZI_517979_DETALLE_TUPLES.forEach(d => {
    dataSheet2.push([d[0], d[1], d[2], d[3], d[4], d[5], d[6]]);
  });

  const lastDetItemRow = CAROZZI_517979_DETALLE_TUPLES.length + 1;
  const subtotalNetoFac = CAROZZI_517979_DETALLE_TUPLES.reduce((a, b) => a + b[6], 0);

  dataSheet2.push([null, null, null, null, null, 'Total Facturado Neto:', { t: 'n', f: `SUBTOTAL(9,G2:G${lastDetItemRow})`, v: Math.round(subtotalNetoFac), z: '#,##0' }]);
  dataSheet2.push([null, null, null, null, null, 'Total OC Conforme Recepcionado:', { t: 'n', v: 12388682, z: '#,##0' }]);
  dataSheet2.push([null, null, null, null, null, 'Saldo a Regularizar (Nota de Crédito):', { t: 'n', f: `G${lastDetItemRow + 2}-G${lastDetItemRow + 1}`, v: 12388682 - Math.round(subtotalNetoFac), z: '#,##0' }]);

  const ws2 = XLSX.utils.aoa_to_sheet(dataSheet2);
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Facturas');

  const outName = soloDescalces ? 'scratch/test_export_solo_descalces.xlsx' : 'scratch/test_export_po_completa.xlsx';
  XLSX.writeFile(wb, outName);
  console.log(`Generated: ${outName} (${linesToExport.length} lines)`);
}

testBuildWorkbook(false);
testBuildWorkbook(true);
