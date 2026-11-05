const fs = require('fs');

function consolidarLineasPorSku(lines) {
  if (!lines || lines.length === 0) return [];

  const mapSku = new Map();

  lines.forEach(l => {
    const skuCode = (l.sku || l.sku_pedidosya || l.sku_oc || '').trim();
    const prodCode = (l.codigo || l.codigo_factura || l.supplier_sku || '').trim();
    const eanCode = (l.ean || l.codigo_ean || '').trim();
    const descClean = (l.descripcion || l.descripcion_factura || l.product_name || '').trim().toLowerCase();

    let key = '';
    if (skuCode && skuCode !== 'NO EN OC' && skuCode !== '-') {
      key = 'SKU:' + skuCode.toUpperCase();
    } else if (prodCode && prodCode !== '-' && prodCode !== 'NO EN OC') {
      key = 'PROD:' + prodCode.toUpperCase();
    } else if (eanCode && eanCode !== '-') {
      key = 'EAN:' + eanCode;
    } else {
      key = 'DESC:' + descClean;
    }

    const qRec = Number(l.cantidad_recepcionada !== undefined ? l.cantidad_recepcionada : (l.cantidad_oc_recepcionada || 0));
    let cOc = Number(l.costo_oc !== undefined ? l.costo_oc : (l.costo_unitario_oc || 0));
    const qFac = Number(l.cantidad_facturada !== undefined ? l.cantidad_facturada : 0);
    const totFac = Number(l.total_facturado !== undefined ? l.total_facturado : (l.monto_facturado !== undefined ? l.monto_facturado : (qFac * (l.precio_facturado || cOc))));
    const prcFac = Number(l.precio_facturado !== undefined ? l.precio_facturado : (qFac > 0 ? totFac / qFac : cOc));

    let folioFound = '';
    const rawCom = String(l.comentario || l.factura || l.factura_origen || '').trim();
    const matchF = rawCom.match(/Factura\s*(\d+)/i) || rawCom.match(/\b(\d{7,9})\b/);
    if (matchF) {
      folioFound = matchF[1];
    }

    if (!mapSku.has(key)) {
      mapSku.set(key, {
        sku: l.sku || l.sku_pedidosya || l.codigo || '',
        ean: l.ean || l.codigo_ean || '',
        descripcion: l.descripcion || l.descripcion_factura || l.product_name || 'Producto',
        categoria: l.categoria || l.cat || '',
        cantidad_recepcionada: qRec,
        costo_oc: cOc,
        cantidad_facturada: qFac,
        total_facturado: totFac,
        precio_facturado: prcFac,
        factor_empaque: l.factor_empaque || 1,
        folios: folioFound ? [folioFound] : []
      });
    } else {
      const existing = mapSku.get(key);
      existing.cantidad_facturada += qFac;
      existing.total_facturado += totFac;
      if (existing.cantidad_facturada > 0) {
        existing.precio_facturado = existing.total_facturado / existing.cantidad_facturada;
      }
      if (existing.cantidad_recepcionada === 0 && qRec > 0) {
        existing.cantidad_recepcionada = qRec;
      }
      if (existing.costo_oc === 0 && cOc > 0) {
        existing.costo_oc = cOc;
      }
      if (l.categoria && (!existing.categoria || existing.categoria === 'General')) {
        existing.categoria = l.categoria;
      }
      if (folioFound && !existing.folios.includes(folioFound)) {
        existing.folios.push(folioFound);
      }
    }
  });

  const result = [];
  let idx = 0;
  for (const item of mapSku.values()) {
    idx++;
    let qRec = item.cantidad_recepcionada;
    let cOc = item.costo_oc;
    let qFac = item.cantidad_facturada;
    let totFac = item.total_facturado;
    let prcFac = qFac > 0 ? (totFac / qFac) : item.precio_facturado;

    // Regla 1: Homologación NO EN OC
    const isNoEnOc = (item.sku === 'NO EN OC' || item.sku === '-' || cOc === 0);
    if (isNoEnOc && prcFac > 0) {
      cOc = prcFac;
    }

    // Regla 2: Factor UOM
    let factor = Number(item.factor_empaque || 1);
    if (factor <= 1 && item.descripcion) {
      const m = String(item.descripcion).match(/\b(\d{1,3})\s*[xX*]\s*\d+/);
      if (m) {
        const fCand = parseInt(m[1], 10);
        if (fCand > 1 && fCand <= 240 && cOc > 0 && Math.abs((prcFac / fCand) - cOc) <= Math.max(5, cOc * 0.05)) {
          factor = fCand;
        }
      }
    }
    if (factor > 1 && cOc > 0 && Math.abs((prcFac / factor) - cOc) < Math.abs(prcFac - cOc)) {
      qFac = qFac * factor;
      prcFac = totFac / qFac;
    }

    // Regla 3: Redondeo estricto decimales SII
    if (Math.abs(prcFac - cOc) <= 0.05) {
      prcFac = cOc;
    }

    let difP = Math.round((prcFac - cOc) * 100) / 100;
    if (Math.abs(difP) <= 0.05) {
      difP = 0;
    }

    // Regla Refactorización 1: Tipo Producto
    let cat = item.categoria;
    if (qRec === 0 || !cat || cat === '0' || cat === 0 || String(cat).trim() === '') {
      cat = 'General';
    }

    // Regla Refactorización 2: Costo Total OC
    const cTotOc = (qRec === 0) ? 0.00 : Math.round(qRec * cOc * 100) / 100;

    // Regla Refactorización 3: Comentarios limpios
    let cleanCom = '';
    if (item.folios.length > 0) {
      cleanCom = `Factura ${item.folios.join(', ')}`;
    } else {
      cleanCom = 'Factura PO';
    }

    const difQ = qFac - qRec;
    let difFinal = '';
    if (difQ > 0 && difP > 0) {
      difFinal = 'Diferencia de Costo y Unidad';
    } else if (difQ > 0) {
      difFinal = 'Diferencia de Unidades';
    } else if (difP > 0) {
      difFinal = 'Diferencia de Costo';
    }

    result.push({
      linea: idx,
      sku: item.sku,
      ean: item.ean,
      descripcion: item.descripcion,
      categoria: cat,
      cantidad_recepcionada: qRec,
      costo_oc: cOc,
      costo_total_oc: cTotOc,
      cantidad_facturada: qFac,
      total_facturado: totFac,
      precio_facturado: prcFac,
      dif_cantidad: difQ,
      dif_precio: difP,
      diferencias_finales: difFinal,
      comentario: cleanCom
    });
  }

  return result;
}

// TEST 1: Verificar PO con múltiples facturas repetidas del mismo SKU
const testItemsMultiFactura = [
  { sku: 'SKU100', descripcion: 'LECHE ENTERA 1L', categoria: 'Lácteos', cantidad_facturada: 10, total_facturado: 10000, cantidad_recepcionada: 25, costo_oc: 1000, factura: 'Factura 101' },
  { sku: 'SKU100', descripcion: 'LECHE ENTERA 1L', categoria: 'Lácteos', cantidad_facturada: 15, total_facturado: 15000, cantidad_recepcionada: 25, costo_oc: 1000, factura: 'Factura 102' },
  { sku: 'NO EN OC', descripcion: 'PRODUCTO EXTRA NO SOLICITADO', categoria: '', cantidad_facturada: 5, total_facturado: 25000, cantidad_recepcionada: 0, costo_oc: 0, factura: 'Factura 103' },
  { sku: 'SKU200', descripcion: 'GALLETAS PACK 12X100G', categoria: 'Snacks', cantidad_facturada: 2, total_facturado: 24000, cantidad_recepcionada: 24, costo_oc: 1000, factor_empaque: 12, factura: 'Factura 104' }
];

const consolidados = consolidarLineasPorSku(testItemsMultiFactura);
console.log('=== TEST GENERALIZADO MULTI-PO MULTI-FACTURA ===');
console.log(`Líneas de entrada: ${testItemsMultiFactura.length} -> Líneas consolidadas SKU x SKU: ${consolidados.length}`);

// Validaciones:
console.log('\n1. Consolidación SKU100:');
const sku100 = consolidados.find(l => l.sku === 'SKU100');
console.log(`   Cantidad Facturada: ${sku100.cantidad_facturada} (Esperado: 25) -> ${sku100.cantidad_facturada === 25 ? 'OK' : 'FAIL'}`);
console.log(`   Cantidad Recepcionada: ${sku100.cantidad_recepcionada} (Esperado: 25) -> ${sku100.cantidad_recepcionada === 25 ? 'OK' : 'FAIL'}`);
console.log(`   Dif Unidades: ${sku100.dif_cantidad} (Esperado: 0) -> ${sku100.dif_cantidad === 0 ? 'OK' : 'FAIL'}`);
console.log(`   Comentario: ${sku100.comentario} (Esperado: Factura 101, 102) -> ${sku100.comentario === 'Factura 101, 102' ? 'OK' : 'FAIL'}`);

console.log('\n2. Homologación NO EN OC:');
const noOc = consolidados.find(l => l.sku === 'NO EN OC');
console.log(`   Costo OC heredado: $${noOc.costo_oc} (Esperado: $5000) -> ${noOc.costo_oc === 5000 ? 'OK' : 'FAIL'}`);
console.log(`   Dif Costo (PPV): $${noOc.dif_precio} (Esperado: $0) -> ${noOc.dif_precio === 0 ? 'OK' : 'FAIL'}`);
console.log(`   Tipo Producto: '${noOc.categoria}' (Esperado: 'General') -> ${noOc.categoria === 'General' ? 'OK' : 'FAIL'}`);
console.log(`   Costo Total OC: $${noOc.costo_total_oc} (Esperado: 0) -> ${noOc.costo_total_oc === 0 ? 'OK' : 'FAIL'}`);

console.log('\n3. Factor UOM:');
const uom = consolidados.find(l => l.sku === 'SKU200');
console.log(`   Unidades Facturadas post factor: ${uom.cantidad_facturada} (Esperado: 24) -> ${uom.cantidad_facturada === 24 ? 'OK' : 'FAIL'}`);
console.log(`   Dif Unidades: ${uom.dif_cantidad} (Esperado: 0) -> ${uom.dif_cantidad === 0 ? 'OK' : 'FAIL'}`);

console.log('\n✅ Test generalizado ejecutado con éxito.');
