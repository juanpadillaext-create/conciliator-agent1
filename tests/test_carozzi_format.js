const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.utils.book_new();

// Sheet 1: Carozzi (o nombre del Proveedor)
const ws1 = {};
const lastRow = 140;

// 1. Tarjeta KPI superior (Filas 1 a 3)
ws1['A1'] = { t: 's', v: 'Orden de Compra:' };
ws1['B1'] = { t: 's', v: 'PO517979' };
ws1['D1'] = { t: 's', v: 'Monto por diferencia de unidades:' };
ws1['E1'] = { t: 'n', f: 'SUMPRODUCT(($H$6:$H$' + lastRow + ')*($N$6:$N$' + lastRow + '))', v: 9752441, z: '#,##0.00' };

ws1['A2'] = { t: 's', v: 'Monto Aforado:' };
ws1['B2'] = { t: 'n', v: -9680087, z: '#,##0.00' };
ws1['D2'] = { t: 's', v: 'Monto por diferencia de costo:' };
ws1['E2'] = { t: 'n', f: 'SUMPRODUCT(($M$6:$M$' + lastRow + ')*($K$6:$K$' + lastRow + '))-SUMPRODUCT(($H$6:$H$' + lastRow + ')*($K$6:$K$' + lastRow + '))', v: -72354, z: '#,##0.00' };

ws1['A3'] = { t: 's', v: 'Diferencia sin identificar:' };
ws1['B3'] = { t: 'n', f: '$B$2+$E$3', v: 0, z: '#,##0.00' };
ws1['D3'] = { t: 's', v: 'Monto total diferencias:' };
ws1['E3'] = { t: 'n', f: '$E$1+$E$2', v: 9680087, z: '#,##0.00' };

// Textos de Ayuda / Instrucción
ws1['K1'] = { t: 's', v: 'EN CASO DE HABER FACTURADO POR CAJA, FAVOR DE COLOCAR LAS UNIDADES TOTALES Y EL COSTO TOTAL FACTURADO' };
ws1['K4'] = { t: 's', v: 'COMPLETAR CON LOS PRODUCTOS FACTURADOS' };
ws1['N4'] = { t: 's', v: 'REVISAR LAS DIFERENCIAS' };

// Celdas combinadas (Merges) idénticas al archivo adjunto
ws1['!merges'] = [
  { s: { r: 0, c: 10 }, e: { r: 2, c: 12 } }, // K1:M3
  { s: { r: 3, c: 10 }, e: { r: 3, c: 12 } }, // K4:M4
  { s: { r: 3, c: 13 }, e: { r: 3, c: 15 } }  // N4:P4
];

// Fila 5: Encabezados Oficiales (17 Columnas)
const headers = [
  'Órdenes de Compra', 'Tienda', 'SKU', 'EAN', 'Nombre de Producto', 'Tipo Producto',
  'Unidades Recepcionadas', 'Costo Unitario OC', 'Impuesto Interno', 'Costo Total OC',
  'Unidades Facturadas', 'Costo Total Facturado (SIN IVA)', 'Costo Unitario Facturado (SIN IVA)',
  'Diferencia de Unidades', 'Diferencia de Costo', 'Diferencias Finales', 'Comentarios'
];

headers.forEach((h, idx) => {
  const cellRef = XLSX.utils.encode_cell({ r: 4, c: idx });
  ws1[cellRef] = { t: 's', v: h };
});

// Fila 6 (Muestra con fórmulas idénticas al archivo adjunto)
const r = 6;
ws1['A' + r] = { t: 's', v: 'PO517979' };
ws1['B' + r] = { t: 's', v: 'CH_36_CD_Chile' };
ws1['C' + r] = { t: 's', v: 'UHBPGV' };
ws1['D' + r] = { t: 's', v: '' };
ws1['E' + r] = { t: 's', v: 'Galleta Sabor Pie de Limón Gretel 85 g' };
ws1['F' + r] = { t: 's', v: 'Snacks' };
ws1['G' + r] = { t: 'n', v: 120, z: '#,##0' };
ws1['H' + r] = { t: 'n', v: 938, z: '#,##0.00' };
ws1['I' + r] = { t: 'n', v: 0, z: '#,##0.00' };
ws1['J' + r] = { t: 'n', f: 'G' + r + '*H' + r, v: 112560, z: '#,##0.00' };
ws1['K' + r] = { t: 'n', v: 120, z: '#,##0' };
ws1['L' + r] = { t: 'n', v: 112560, z: '#,##0.00' };
ws1['M' + r] = { t: 'n', f: 'IF(OR(K' + r + '="",K' + r + '=0,L' + r + '=""),0,IFERROR(L' + r + '/K' + r + ',""))', v: 938, z: '#,##0.00' };
ws1['N' + r] = { t: 'n', f: 'IF(OR(K' + r + '="",K' + r + '=0,L' + r + '=""),0,K' + r + '-G' + r + ')', v: 0, z: '#,##0.00' };
ws1['O' + r] = { t: 'n', f: 'ROUND(IF(OR(K' + r + '="",K' + r + '=0,L' + r + '=""),0,M' + r + '-H' + r + '),2)', v: 0, z: '#,##0.00' };
ws1['P' + r] = { t: 's', f: 'IF(AND(N' + r + '>0,O' + r + '>0),"Diferencia de Costo y Unidad",IF(N' + r + '>0,"Diferencia de Unidades",IF(O' + r + '>0,"Diferencia de Costo","")))', v: '' };
ws1['Q' + r] = { t: 's', v: 'Factura 22586659' };

ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 5, c: 16 } });

ws1['!cols'] = [
  { wch: 23.1 }, { wch: 19.2 }, { wch: 12.0 }, { wch: 22.0 }, { wch: 53.5 },
  { wch: 17.8 }, { wch: 19.2 }, { wch: 18.3 }, { wch: 14.1 }, { wch: 18.8 },
  { wch: 15.7 }, { wch: 18.8 }, { wch: 20.0 }, { wch: 17.4 }, { wch: 17.0 },
  { wch: 22.5 }, { wch: 20.0 }
];

XLSX.utils.book_append_sheet(wb, ws1, 'Carozzi');

// Sheet 2: Detalle Facturas
const detHeaders = ['Nº Factura', 'Código Producto', 'Descripción', 'Unid. Vta', 'Cantidad', 'Precio Unitario', 'Valor Neto'];
const ws2 = XLSX.utils.aoa_to_sheet([
  detHeaders,
  ['22586652', '516923', 'VIVO LINE BERRIES 10 X 320 GR.', 'CAJ', 9, 19250, 173250]
]);
ws2['!cols'] = [{ wch: 14.3 }, { wch: 19.5 }, { wch: 41.8 }, { wch: 13.3 }, { wch: 13.0 }, { wch: 17.9 }, { wch: 14.4 }];
XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Facturas');

XLSX.writeFile(wb, 'test_output_carozzi.xlsx');
console.log('✅ test_output_carozzi.xlsx escrito exitosamente con formato idéntico');
