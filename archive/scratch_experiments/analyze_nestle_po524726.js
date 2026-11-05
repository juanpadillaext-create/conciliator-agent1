const fs = require('fs');

// 1. Cargar PO Items Enriquecidos
const poSkus = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/po524726_enriched.json', 'utf8').trim());

// 2. Cargar Facturas
const invoices = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/invoices_nestle.json', 'utf8'));

// Parse simple de XML para extraer items de cada factura
function parseXmlSimple(xmlStr, folio) {
  const items = [];
  const detalleRegex = /<Detalle>([\s\S]*?)<\/Detalle>/gi;
  let match;
  let linea = 1;

  while ((match = detalleRegex.exec(xmlStr)) !== null) {
    const block = match[1];
    const getTag = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const cdgItemMatch = block.match(/<CdgItem>([\s\S]*?)<\/CdgItem>/i);
    let vlrCodigo = '';
    let tpoCodigo = '';
    if (cdgItemMatch) {
      const vM = cdgItemMatch[1].match(/<VlrCodigo>([\s\S]*?)<\/VlrCodigo>/i);
      vlrCodigo = vM ? vM[1].trim() : '';
      const tM = cdgItemMatch[1].match(/<TpoCodigo>([\s\S]*?)<\/TpoCodigo>/i);
      tpoCodigo = tM ? tM[1].trim() : '';
    }
    if (!vlrCodigo) {
      vlrCodigo = getTag('VlrCodigo');
    }

    const nmbItem = getTag('NmbItem');
    const dscItem = getTag('DscItem');
    const qty = parseFloat(getTag('QtyItem') || '0');
    const unmd = getTag('UnmdItem') || 'UN';
    const prc = parseFloat(getTag('PrcItem') || '0');
    const monto = parseFloat(getTag('MontoItem') || '0');

    items.push({
      folio: folio,
      linea: linea++,
      codigo: vlrCodigo.trim(),
      tipo_codigo: tpoCodigo,
      descripcion: nmbItem.trim(),
      descripcion_adicional: dscItem ? dscItem.trim() : '',
      cantidad_facturada: qty,
      unidad_medida: unmd,
      precio_facturado: prc,
      monto_facturado: monto
    });
  }
  return items;
}

const allInvoiceLines = [];
let totalFacturasNeto = 0;
let totalFacturasBruto = 0;

for (const inv of invoices) {
  totalFacturasNeto += Number(inv.amount_net || 0);
  totalFacturasBruto += Number(inv.amount_total || 0);
  const parsedItems = parseXmlSimple(inv.xml, inv.serial);
  allInvoiceLines.push(...parsedItems);
  console.log(`Factura ${inv.serial}: ${parsedItems.length} líneas, Neto: $${inv.amount_net.toLocaleString('es-CL')}, Total: $${inv.amount_total.toLocaleString('es-CL')}`);
}

console.log(`\nTotal Líneas Facturadas: ${allInvoiceLines.length}`);
console.log(`Total Neto Facturado: $${totalFacturasNeto.toLocaleString('es-CL')}`);
console.log(`Total Bruto Facturado: $${totalFacturasBruto.toLocaleString('es-CL')}`);

// 3. Preparar catálogo PO
function norm(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const poList = poSkus.map(p => ({
  sku_id: p.sku_id,
  supplier_sku: (p.supplier_sku || '').trim(),
  product_name: p.product_name,
  quantity_ordered: Number(p.quantity_ordered || 0),
  quantity_delivered: Number(p.quantity_delivered || 0),
  unit_cost_lc: Number(p.cost_unit_lc || 0),
  amt_ordered_lc: Number(p.amt_ordered_lc || 0),
  amt_delivered_lc: Number(p.amt_delivered_lc || 0),
  barcodes: (p.barcodes_str || '').split(',').map(b => b.trim()).filter(Boolean)
}));

// Consolidar líneas facturadas por código para cruce agregado
const facturaByCode = new Map();
allInvoiceLines.forEach(l => {
  const c = l.codigo;
  if (!facturaByCode.has(c)) {
    facturaByCode.set(c, {
      codigo: c,
      descripcion: l.descripcion,
      unidad_medida: l.unidad_medida,
      folios: [l.folio],
      cantidad_facturada: 0,
      monto_facturado: 0
    });
  }
  const item = facturaByCode.get(c);
  if (!item.folios.includes(l.folio)) item.folios.push(l.folio);
  item.cantidad_facturada += l.cantidad_facturada;
  item.monto_facturado += l.monto_facturado;
});

console.log(`Total Códigos de Producto únicos en facturas: ${facturaByCode.size}`);

// Cruce SKU x SKU
const matchedResults = [];
let sumDifMlQ = 0;
let sumDifMlP = 0;
let sumTotalDifMl = 0;

let countConformes = 0;
let countDescalceCantidad = 0;
let countDescalcePrecio = 0;
let countDescalceAmbos = 0;
let countNoEnOc = 0;

const matchedPoSkus = new Set();

facturaByCode.forEach((fItem, cod) => {
  // Buscar match en PO:
  // 1. Por supplier_sku (código del proveedor)
  let poMatch = poList.find(p => p.supplier_sku && p.supplier_sku === cod);
  
  // 2. Por sku_id directo
  if (!poMatch) {
    poMatch = poList.find(p => p.sku_id && p.sku_id.toLowerCase() === cod.toLowerCase());
  }

  // 3. Por barcodes
  if (!poMatch) {
    poMatch = poList.find(p => p.barcodes.some(b => b === cod || b.endsWith(cod) || cod.endsWith(b)));
  }

  // 4. Por similitud de nombre
  if (!poMatch) {
    const fNorm = norm(fItem.descripcion);
    poMatch = poList.find(p => {
      const pNorm = norm(p.product_name);
      return pNorm.includes(fNorm) || fNorm.includes(pNorm);
    });
  }

  const qFac = fItem.cantidad_facturada;
  const totFac = fItem.monto_facturado;
  const prcFacUnit = qFac > 0 ? (totFac / qFac) : 0;

  if (!poMatch) {
    countNoEnOc++;
    const totalDif = totFac;
    sumTotalDifMl += totalDif;
    matchedResults.push({
      codigo_factura: cod,
      sku: 'NO EN OC',
      descripcion: fItem.descripcion,
      folios: fItem.folios.join(', '),
      qRec: 0,
      cOc: 0,
      qFac: qFac,
      prcFac: prcFacUnit,
      totFac: totFac,
      difQ: qFac,
      difP: 0,
      difMlQ: 0,
      difMlP: 0,
      totalDifMl: totalDif,
      tipo: 'NO_EN_OC'
    });
    return;
  }

  matchedPoSkus.add(poMatch.sku_id);

  const qRec = poMatch.quantity_delivered;
  const cOc = poMatch.unit_cost_lc;
  const totRecValido = qRec * cOc;

  // Notar que en DTE de Nestlé el precio facturado y cantidad pueden venir por caja (bulto) o unidad
  // Veamos si hay factor de conversión UOM o si es directo
  const difQ = qFac - qRec;
  const difP = prcFacUnit - cOc;

  const difMlQ = Math.round(difQ * cOc);
  const difMlP = Math.round(difP * qFac);
  const totalDif = difMlQ + difMlP;

  sumDifMlQ += difMlQ;
  sumDifMlP += difMlP;
  sumTotalDifMl += totalDif;

  let tipo = 'CALCE_OK';
  if (difQ > 0.001 && difP > 0.5) {
    tipo = 'DESCALCE_AMBOS';
    countDescalceAmbos++;
  } else if (difQ > 0.001) {
    tipo = 'DESCALCE_CANTIDAD';
    countDescalceCantidad++;
  } else if (difP > 0.5) {
    tipo = 'DESCALCE_PRECIO';
    countDescalcePrecio++;
  } else {
    countConformes++;
  }

  matchedResults.push({
    codigo_factura: cod,
    sku: poMatch.sku_id,
    descripcion: poMatch.product_name,
    folios: fItem.folios.join(', '),
    qRec: qRec,
    cOc: cOc,
    qFac: qFac,
    prcFac: prcFacUnit,
    totFac: totFac,
    difQ: difQ,
    difP: difP,
    difMlQ: difMlQ,
    difMlP: difMlP,
    totalDifMl: totalDif,
    tipo: tipo
  });
});

console.log('\n======================================================');
console.log('RESUMEN DE CRUCE SKU x SKU - PO524726 NESTLÉ');
console.log('======================================================');
console.log(`Líneas Conformes:               ${countConformes}`);
console.log(`Descalces Solo Cantidad:        ${countDescalceCantidad}`);
console.log(`Descalces Solo Precio:          ${countDescalcePrecio}`);
console.log(`Descalces Precio y Cantidad:    ${countDescalceAmbos}`);
console.log(`Ítems No en OC:                 ${countNoEnOc}`);
console.log('------------------------------------------------------');
console.log(`Dif. ML Cantidad (Faltante):   $${sumDifMlQ.toLocaleString('es-CL')} CLP`);
console.log(`Dif. ML Precio (Sobreprecio):  $${sumDifMlP.toLocaleString('es-CL')} CLP`);
console.log(`TOTAL DIF. ML (RECLAMO NC):    $${sumTotalDifMl.toLocaleString('es-CL')} CLP`);
console.log('======================================================\n');

// Top 15 SKUs con mayor diferencia
matchedResults.sort((a, b) => b.totalDifMl - a.totalDifMl);
console.log('TOP 15 SKUs CON MAYOR DESCALCE:');
matchedResults.slice(0, 15).forEach((r, idx) => {
  console.log(`${idx + 1}. SKU: ${r.sku} [Cod: ${r.codigo_factura}] - ${r.descripcion.substring(0, 40)}`);
  console.log(`   Rec: ${r.qRec} | Fac: ${r.qFac} | ΔQ: ${r.difQ} (Dif ML Cant: $${r.difMlQ.toLocaleString('es-CL')})`);
  console.log(`   Costo OC: $${r.cOc} | Prc Fac: $${Math.round(r.prcFac)} | ΔP: $${Math.round(r.difP)} (Dif ML Prc: $${r.difMlP.toLocaleString('es-CL')})`);
  console.log(`   👉 Total a Reclamar: $${r.totalDifMl.toLocaleString('es-CL')} CLP [${r.tipo}] (Facturas: ${r.folios})\n`);
});

fs.writeFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/nestle_cruce_resumen.json', JSON.stringify({
  po: 'PO524726',
  proveedor: 'Nestle Chile Alimentacion',
  facturas: invoices.map(i => ({ folio: i.serial, neto: i.amount_net, total: i.amount_total })),
  kpis: {
    sumDifMlQ,
    sumDifMlP,
    sumTotalDifMl,
    countConformes,
    countDescalceCantidad,
    countDescalcePrecio,
    countDescalceAmbos,
    countNoEnOc
  },
  matchedResults
}, null, 2), 'utf8');
