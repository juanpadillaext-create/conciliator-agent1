const fs = require('fs');

const poSkus = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/po524726_enriched.json', 'utf8').trim());
const invoices = JSON.parse(fs.readFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/invoices_nestle.json', 'utf8'));

// Parse simple de XML
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

// 1. Facturas consolidación
const allInvoiceLines = [];
const invoicesSummary = [];

for (const inv of invoices) {
  const items = parseXmlSimple(inv.xml, inv.serial);
  allInvoiceLines.push(...items);
  invoicesSummary.push({
    serial: inv.serial,
    date: inv.date,
    neto: inv.amount_net,
    total: inv.amount_total,
    itemsCount: items.length
  });
}

// 2. Mapear PO
const poMapBySupplierSku = new Map();
const poMapBySkuId = new Map();
const poMapByName = new Map();

poSkus.forEach(p => {
  const item = {
    sku_id: p.sku_id,
    supplier_sku: (p.supplier_sku || '').trim(),
    product_name: p.product_name,
    quantity_ordered: Number(p.quantity_ordered || 0),
    quantity_delivered: Number(p.quantity_delivered || 0),
    unit_cost_lc: Number(p.cost_unit_lc || 0),
    amt_ordered_lc: Number(p.amt_ordered_lc || 0),
    amt_delivered_lc: Number(p.amt_delivered_lc || 0),
    barcodes: (p.barcodes_str || '').split(',').map(b => b.trim()).filter(Boolean)
  };
  if (item.supplier_sku) poMapBySupplierSku.set(item.supplier_sku, item);
  if (item.sku_id) poMapBySkuId.set(item.sku_id.toLowerCase(), item);
});

// Detectar factor UOM
// En las descripciones de Nestlé suele venir: "NESC FSEL Jar 6x200g" -> factor 6
// "SAHNE NUSS Chocolate Barra 15x250g" -> factor 15
// "TRITON Regular Chocolate 30x116g" -> factor 30
// "TRENCITO Chocolate Barra 21x80g" -> factor 21
function extractPackFactor(desc) {
  const m = desc.match(/\b(\d{1,3})\s*[xX*]\s*\d+/);
  if (m) {
    const f = parseInt(m[1], 10);
    if (f > 1 && f <= 100) return f;
  }
  return 1;
}

// Agrupar facturación por código
const facturasGrouped = new Map();
allInvoiceLines.forEach(l => {
  if (!facturasGrouped.has(l.codigo)) {
    facturasGrouped.set(l.codigo, {
      codigo: l.codigo,
      descripcion: l.descripcion,
      folios: [l.folio],
      cantidad_cajas: 0,
      monto_total_facturado: 0
    });
  }
  const g = facturasGrouped.get(l.codigo);
  if (!g.folios.includes(l.folio)) g.folios.push(l.folio);
  g.cantidad_cajas += l.cantidad_facturada;
  g.monto_total_facturado += l.monto_facturado;
});

// Cruce SKU a SKU
const skusEvaluados = [];

facturasGrouped.forEach((fGroup, cod) => {
  // Buscar en PO
  let po = poMapBySupplierSku.get(cod) || poMapBySkuId.get(cod.toLowerCase());
  
  if (!po) {
    // Buscar por nombre
    const codNorm = fGroup.descripcion.toLowerCase().replace(/[^a-z0-9]/g, '');
    po = poSkus.find(p => {
      const pNorm = (p.product_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pNorm.includes(codNorm) || codNorm.includes(pNorm);
    });
  }

  const factor = extractPackFactor(fGroup.descripcion);
  const qCajasFac = fGroup.cantidad_cajas;
  const totFacNeto = fGroup.monto_total_facturado;

  if (!po) {
    skusEvaluados.push({
      codigo_proveedor: cod,
      sku_pedidosya: 'NO EN OC',
      descripcion: fGroup.descripcion,
      factor_empaque: factor,
      folios: fGroup.folios.join(', '),
      q_cajas_facturada: qCajasFac,
      q_unidades_facturada: qCajasFac * factor,
      q_unidades_recepcionada: 0,
      costo_unit_oc: 0,
      monto_facturado: totFacNeto,
      monto_recepcionado: 0,
      dif_cantidad_pesos: 0,
      dif_precio_pesos: 0,
      total_a_reclamar: totFacNeto,
      tipo_descalce: 'NO_EN_OC',
      observacion: 'Facturado por Nestlé pero no figura en la Orden de Compra PO524726'
    });
    return;
  }

  const qRecUnidades = Number(po.quantity_delivered || 0);
  const costOcUnidad = Number(po.cost_unit_lc || 0);
  const totRecValido = qRecUnidades * costOcUnidad;

  // Unidades efectivas facturadas (Cajas x Factor o Unidades directas)
  // Si precio facturado / factor aproxima al costo OC, entonces la cantidad en factura son cajas
  let qFacUnidades = qCajasFac;
  let prcUnitFacEfectivo = totFacNeto / qCajasFac;
  let factorAplicado = 1;

  if (factor > 1) {
    const prcPorUnidadSiEsCaja = prcUnitFacEfectivo / factor;
    if (Math.abs(prcPorUnidadSiEsCaja - costOcUnidad) < Math.abs(prcUnitFacEfectivo - costOcUnidad)) {
      factorAplicado = factor;
      qFacUnidades = qCajasFac * factor;
      prcUnitFacEfectivo = prcPorUnidadSiEsCaja;
    }
  }

  // Faltante en unidades
  const faltanteUnidades = Math.max(0, qFacUnidades - qRecUnidades);
  const sobreprecioUnitario = Math.max(0, prcUnitFacEfectivo - costOcUnidad);

  const difMlCantidad = Math.round(faltanteUnidades * costOcUnidad);
  const difMlPrecio = Math.round(sobreprecioUnitario * qFacUnidades);
  const totalReclamoSku = difMlCantidad + difMlPrecio;

  let tipo = 'CONFORME';
  if (difMlCantidad > 500 && difMlPrecio > 500) tipo = 'DESCALCE_AMBOS';
  else if (difMlCantidad > 500) tipo = 'FALTANTE_RECEPCION';
  else if (difMlPrecio > 500) tipo = 'SOBREPRECIO_UNITARIO';

  skusEvaluados.push({
    codigo_proveedor: cod,
    sku_pedidosya: po.sku_id,
    descripcion: po.product_name,
    factor_empaque: factorAplicado,
    folios: fGroup.folios.join(', '),
    q_cajas_facturada: qCajasFac,
    q_unidades_facturada: qFacUnidades,
    q_unidades_recepcionada: qRecUnidades,
    costo_unit_oc: costOcUnidad,
    prc_unit_fac: Math.round(prcUnitFacEfectivo),
    monto_facturado: totFacNeto,
    monto_recepcionado: totRecValido,
    dif_cantidad_pesos: difMlCantidad,
    dif_precio_pesos: difMlPrecio,
    total_a_reclamar: totalReclamoSku,
    tipo_descalce: tipo,
    observacion: tipo === 'CONFORME' ? 'Calce conforme para pago' : `Faltante: ${faltanteUnidades} unids ($${difMlCantidad.toLocaleString('es-CL')}), Sobreprecio: $${sobreprecioUnitario} ($${difMlPrecio.toLocaleString('es-CL')})`
  });
});

// Ordenar por monto a reclamar descendente
skusEvaluados.sort((a, b) => b.total_a_reclamar - a.total_a_reclamar);

const totales = {
  facturadoNeto: skusEvaluados.reduce((acc, s) => acc + s.monto_facturado, 0),
  recepcionadoValido: skusEvaluados.reduce((acc, s) => acc + s.monto_recepcionado, 0),
  difCantidad: skusEvaluados.reduce((acc, s) => acc + s.dif_cantidad_pesos, 0),
  difPrecio: skusEvaluados.reduce((acc, s) => acc + s.dif_precio_pesos, 0),
  totalReclamar: skusEvaluados.reduce((acc, s) => acc + s.total_a_reclamar, 0),
  conformesCount: skusEvaluados.filter(s => s.tipo_descalce === 'CONFORME').length,
  descalcesCount: skusEvaluados.filter(s => s.tipo_descalce !== 'CONFORME').length
};

console.log('=== TOTALES FINANCIEROS AUDITORÍA NESTLÉ PO524726 ===');
console.log('Facturado Neto (5 DTEs):        $' + totales.facturadoNeto.toLocaleString('es-CL'));
console.log('Recepcionado Válido (Bodega):   $' + totales.recepcionadoValido.toLocaleString('es-CL'));
console.log('Faltante Físico (Δ Cantidad):   $' + totales.difCantidad.toLocaleString('es-CL'));
console.log('Sobreprecio (Δ Precio):         $' + totales.difPrecio.toLocaleString('es-CL'));
console.log('TOTAL A RECLAMAR (NC):          $' + totales.totalReclamar.toLocaleString('es-CL'));
console.log('Líneas Conformes:               ' + totales.conformesCount);
console.log('Líneas con Descalce:            ' + totales.descalcesCount);

console.log('\n=== TOP 10 SKUs CON MAYOR DESCALCE ===');
skusEvaluados.slice(0, 10).forEach((s, idx) => {
  console.log(`${idx + 1}. [SKU: ${s.sku_pedidosya}] [Cod Nestlé: ${s.codigo_proveedor}] ${s.descripcion}`);
  console.log(`   Fac: ${s.q_unidades_facturada} unids ($${s.monto_facturado.toLocaleString('es-CL')}) | Rec: ${s.q_unidades_recepcionada} unids ($${s.monto_recepcionado.toLocaleString('es-CL')})`);
  console.log(`   Costo OC: $${s.costo_unit_oc} | Prc Fac: $${s.prc_unit_fac}`);
  console.log(`   👉 Reclamo: $${s.total_a_reclamar.toLocaleString('es-CL')} CLP (${s.tipo_descalce}) | Facturas: ${s.folios}\n`);
});

fs.writeFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/nestle_final_audit.json', JSON.stringify({
  invoicesSummary,
  totales,
  skusEvaluados
}, null, 2), 'utf8');
