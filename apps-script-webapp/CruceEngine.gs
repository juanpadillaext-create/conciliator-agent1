/**
 * CruceEngine.gs
 * Motor de conciliación exhaustiva 1 a 1 SKU x SKU entre Facturas (DTE) y Órdenes de Compra (BigQuery).
 * Identifica descalces de precio, cantidad y UOM, generando observaciones y acciones correctivas.
 */

/**
 * Ejecuta el cruce SKU x SKU completo entre una factura parseada y los datos de la OC.
 * @param {Object} invoiceData Objeto retornado por parseDteXml()
 * @param {Object} poData Objeto retornado por getPurchaseOrderItems()
 */
function ejecutarCruceSkuPorSku(invoiceData, poData) {
  if (!invoiceData || !invoiceData.items) {
    throw new Error('Datos de factura no disponibles para el cruce.');
  }

  // Precio EFECTIVO: si la línea trae descuento (monto distinto de cantidad x precio de lista), el precio realmente cobrado
  // es monto / cantidad. Comparar el precio de lista con el costo de la OC generaba "sobreprecios" falsos.
  const invoiceItems = invoiceData.items.map(normalizarPrecioItemFactura);
  const poItems = (poData && poData.items) ? poData.items : [];
  const poFound = poData && poData.po_found;

  // Consultar condición en la Tabla de Aforos Chile (Spreadsheet en vivo) y consolidar con SAP 3WM (`peya-datamarts-pro.dm_fintech.sap_report_3wm`)
  let aforoInfo = (poData && poData.aforo_info) ? Object.assign({}, poData.aforo_info) : null;
  try {
    if (typeof obtenerCondicionAforoProveedor === 'function') {
      const rutToCheck = (poData && poData.supplier_tax_id) || (invoiceData.emisor ? invoiceData.emisor.rut : null);
      const sheetAforo = obtenerCondicionAforoProveedor(rutToCheck);
      if (sheetAforo) {
        aforoInfo = Object.assign({}, sheetAforo, aforoInfo || {});
      }
    }
  } catch (errAforo) {
    Logger.log(`Aviso consultando aforo en CruceEngine: ${errAforo.message}`);
  }

  // Enriquecer y alinear aforoInfo con los datos del bot SAP 3WM (`sap_report_3wm`) si existen
  const sap3wm = (poData && poData.sap_3wm && poData.sap_3wm.found) ? poData.sap_3wm : null;
  if (sap3wm || aforoInfo) {
    const baseAforo = aforoInfo || {};
    const montoAforoUnificado = Math.round(
      Number(sap3wm && sap3wm.monto_aforo) ||
      Number(baseAforo.monto_retenido_aforo) ||
      Number(baseAforo.monto_aforo) ||
      Number(baseAforo.monto_aforado) ||
      Number(poData && poData.monto_aforo) ||
      0
    );
    const docAforoUnificado = (sap3wm && sap3wm.documento_aforo) || baseAforo.documento_aforo || (poData && poData.documento_aforo) || null;
    const statusAforoUnificado = (sap3wm && sap3wm.status_aforo) || baseAforo.status_aforo || (poData && poData.status_aforo) || (montoAforoUnificado > 0 ? 'APLICADO_SAP_3WM' : 'NO_APLICA');
    aforoInfo = Object.assign({}, baseAforo, {
      aplica_aforo: Boolean(baseAforo.aplica_aforo || montoAforoUnificado > 0 || docAforoUnificado),
      condicion_aforo: baseAforo.condicion_aforo || statusAforoUnificado || 'ESTÁNDAR (AFORO ACTIVO)',
      monto_aforo: montoAforoUnificado,
      monto_aforado: montoAforoUnificado,
      monto_retenido_aforo: montoAforoUnificado,
      documento_aforo: docAforoUnificado,
      status_aforo: statusAforoUnificado,
      total_difference_sap: sap3wm ? sap3wm.total_difference : (baseAforo.total_difference_sap !== undefined ? baseAforo.total_difference_sap : null)
    });
  }

  const resultadoLineas = [];
  const matchedPoIndices = new Set();

  let totalFacturadoNeto = 0;
  let totalRecepcionadoNeto = 0;
  let totalMontoReclamar = 0;
  let totalFaltanteRecepcion = 0;
  let totalDescalcePrecio = 0;
  let totalNoEnOc = 0;
  let itemsConDescalce = 0;
  let itemsConformes = 0;

  // Recorrer cada ítem de la factura
  invoiceItems.forEach((invItem) => {
    totalFacturadoNeto += invItem.monto_facturado;

    if (!poFound || poItems.length === 0) {
      // Caso: OC no encontrada en sistema
      const descalceMonto = invItem.monto_facturado;
      totalMontoReclamar += descalceMonto;
      totalNoEnOc += descalceMonto;
      itemsConDescalce++;

      resultadoLineas.push({
        linea_factura: invItem.linea,
        codigo_factura: invItem.codigo,
        codigo_ean: invItem.ean || '-',
        sku_pedidosya: '-',
        descripcion_factura: invItem.descripcion,
        cantidad_facturada: invItem.cantidad_facturada,
        unidad_factura: invItem.unidad_medida,
        precio_facturado: invItem.precio_facturado,
        monto_facturado: invItem.monto_facturado,
        
        sku_oc: '-',
        supplier_sku_oc: '-',
        descripcion_oc: 'OC No Encontrada',
        cantidad_oc_ordenada: 0,
        cantidad_oc_recepcionada: 0,
        costo_unitario_oc: 0,
        monto_recepcionado: 0,

        diferencia_unidades: -invItem.cantidad_facturada,
        diferencia_precio_unit: 0,
        diferencia_monto_neta: descalceMonto,
        monto_a_reclamar: descalceMonto,

        tipo_descalce: 'OC_NO_ENCONTRADA',
        severidad: 'critica', // critica, moderada, info, ok
        observacion: 'La Orden de Compra asociada no existe o no tiene registros en el almacén de destino.',
        accion_correctiva: 'Solicitar aclaración a Category Manager o congelar pago hasta identificar OC válida.'
      });
      return;
    }

    // Buscar match en la OC
    const matchResult = buscarMatchEnPo(invItem, poItems, matchedPoIndices);
    const poItem = matchResult.poItem;
    if (matchResult.index !== -1) {
      matchedPoIndices.add(matchResult.index);
    }

    if (!poItem) {
      // Caso 1: Ítem facturado no existe en la OC
      const descalceMonto = invItem.monto_facturado;
      totalMontoReclamar += descalceMonto;
      totalNoEnOc += descalceMonto;
      itemsConDescalce++;

      resultadoLineas.push({
        linea_factura: invItem.linea,
        codigo_factura: invItem.codigo,
        codigo_ean: invItem.ean || '-',
        sku_pedidosya: 'NO EN OC',
        descripcion_factura: invItem.descripcion,
        cantidad_facturada: invItem.cantidad_facturada,
        unidad_factura: invItem.unidad_medida,
        precio_facturado: invItem.precio_facturado,
        monto_facturado: invItem.monto_facturado,
        
        sku_oc: 'NO EN OC',
        supplier_sku_oc: '-',
        descripcion_oc: '-',
        cantidad_oc_ordenada: 0,
        cantidad_oc_recepcionada: 0,
        costo_unitario_oc: invItem.precio_facturado, // Hereda costo unitario facturado para mantener dif_costo en $0
        monto_recepcionado: 0,

        diferencia_unidades: -invItem.cantidad_facturada,
        diferencia_precio_unit: 0,
        diferencia_monto_neta: descalceMonto,
        monto_a_reclamar: descalceMonto,

        tipo_descalce: 'SKU_NO_EN_OC',
        severidad: 'critica',
        observacion: `El ítem ${invItem.codigo} (${invItem.descripcion}) no fue solicitado en la Orden de Compra ${poData.po_order_id}.`,
        accion_correctiva: `Solicitar Nota de Crédito por cobro no solicitado por $${formatearClp(descalceMonto)}.`
      });
      return;
    }

    // Análisis del ítem emparejado considerando pesables y tolerancias dinámicas
    const analisis = analizarDiscrepanciaItem(invItem, poItem, poData, aforoInfo);
    if (analisis.tiene_descalce) {
      itemsConDescalce++;
      totalMontoReclamar += analisis.monto_a_reclamar;
      totalFaltanteRecepcion += (analisis.monto_faltante || 0);
      totalDescalcePrecio += (analisis.monto_sobreprecio || 0);
    } else {
      itemsConformes++;
    }

    totalRecepcionadoNeto += analisis.monto_recepcionado;

    const eanBarcode = (poItem.barcodes && poItem.barcodes.length > 0) ? poItem.barcodes[0] : (invItem.ean || '-');

    resultadoLineas.push({
      linea_factura: invItem.linea,
      codigo_factura: invItem.codigo,
      codigo_ean: eanBarcode,
      barcodes_list: poItem.barcodes || [],
      sku_pedidosya: poItem.sku_id,
      descripcion_factura: invItem.descripcion,
      cantidad_facturada: invItem.cantidad_facturada,
      unidad_factura: invItem.unidad_medida,
      precio_facturado: invItem.precio_facturado,
      monto_facturado: invItem.monto_facturado,
      
      sku_oc: poItem.sku_id,
      supplier_sku_oc: poItem.supplier_sku || invItem.codigo,
      descripcion_oc: poItem.product_name,
      product_type: poItem.product_type || (esProductoPesable(invItem, poItem, aforoInfo) ? 'PESABLE' : 'UNIDAD'),
      cantidad_oc_ordenada: poItem.quantity_ordered,
      cantidad_oc_recepcionada: poItem.received_qty_final !== undefined ? poItem.received_qty_final : poItem.quantity_delivered,
      costo_unitario_oc: poItem.unit_cost_after_discount_lc_final !== undefined ? poItem.unit_cost_after_discount_lc_final : poItem.cost_unit_lc,
      internal_tax_lc: poItem.internal_tax_lc || 0,
      monto_recepcionado: analisis.monto_recepcionado,

      diferencia_unidades: analisis.diferencia_unidades,
      diferencia_precio_unit: analisis.diferencia_precio_unit,
      diferencia_monto_neta: analisis.diferencia_monto_neta,
      monto_a_reclamar: analisis.monto_a_reclamar,

      tipo_descalce: analisis.tipo_descalce,
      severidad: analisis.severidad,
      emparejado_por: matchResult.matchType,
      observacion: (matchResult.matchType === 'monto' ? 'Emparejada por monto con la OC (código del proveedor sin homologar). ' : '') + analisis.observacion,
      accion_correctiva: analisis.accion_correctiva,
      factor_empaque: analisis.factor_empaque
    });
  });

  // Identificar ítems de la OC no facturados (remanentes o pendientes)
  const itemsOcNoFacturados = [];
  poItems.forEach((poItem, idx) => {
    if (!matchedPoIndices.has(idx)) {
      itemsOcNoFacturados.push({
        sku_oc: poItem.sku_id,
        descripcion_oc: poItem.product_name,
        cantidad_ordenada: poItem.quantity_ordered,
        cantidad_recepcionada: poItem.quantity_delivered,
        costo_unitario_oc: poItem.cost_unit_lc,
        monto_ordenado: poItem.amt_ordered_lc,
        monto_recepcionado: poItem.amt_delivered_lc,
        observacion: 'Ítem ordenado en la OC pero no incluido en esta factura.'
      });
    }
  });

  const estadoGeneral = totalMontoReclamar > 0 ? 'CON_DESCALCE' : 'CALCE_CONFORME';

  let diagnostico = generarDiagnosticoGlobal(totalMontoReclamar, itemsConDescalce, invoiceItems.length);
  if (aforoInfo && aforoInfo.es_lista_blanca) {
    diagnostico += ` | ⚠️ PROVEEDOR EN LISTA BLANCA: "${aforoInfo.condicion_aforo}". Responsable Comercial: ${aforoInfo.category_manager || 'Comercial'}. No retener sin escalamiento.`;
  }

  // Cuadratura oficial de la Orden de Compra y Recepción Física en Bodega (Sociedad 6202)
  const warehouseTotalRecepcionado = (poData && Number(poData.total_recepcionado_neto) > 0)
    ? Number(poData.total_recepcionado_neto)
    : (totalRecepcionadoNeto > 0 ? totalRecepcionadoNeto : 0);

  // El recepcionado de la OC incluye impuesto interno: el facturado también, para comparar la misma base.
  // Las líneas por producto y sus reclamos siguen sin impuesto.
  const impuestoInternoFactura = Number(invoiceData.totales && invoiceData.totales.impuesto_interno) || 0;
  const totalFacturadoComparable = totalFacturadoNeto + impuestoInternoFactura;
  const difMlOficial = Math.round(totalFacturadoComparable - warehouseTotalRecepcionado);
  const montoAforoResumen = (aforoInfo && (aforoInfo.monto_retenido_aforo || aforoInfo.monto_aforo || aforoInfo.monto_aforado)) || 0;

  return {
    resumen: {
      folio_factura: invoiceData.folio,
      fecha_emision: invoiceData.fecha_emision,
      proveedor_rut: invoiceData.emisor ? invoiceData.emisor.rut : null,
      proveedor_nombre: invoiceData.emisor ? invoiceData.emisor.razon_social : null,
      po_referencia: poData ? poData.po_order_id : null,
      almacen: poData ? poData.warehouse_name : null,
      estado_po: poData ? poData.order_status : null,
      
      total_facturado_neto: totalFacturadoNeto,
      total_facturado_comparable: totalFacturadoComparable,
      total_recepcionado_neto: warehouseTotalRecepcionado,
      monto_referencia_oc: totalFacturadoNeto,
      total_oc_ordenado: totalFacturadoNeto,
      total_oc_ordenado_nominal: (poData && poData.total_ordenado_neto) ? poData.total_ordenado_neto : totalFacturadoNeto,
      diferencia_total_neta: difMlOficial,
      dif_ml: difMlOficial,
      diferencia_ml: difMlOficial,
      total_monto_a_reclamar: Math.max(0, difMlOficial),
      total_faltante_recepcion: Math.round(totalFaltanteRecepcion),
      total_descalce_precio: Math.round(totalDescalcePrecio),
      total_no_en_oc: Math.round(totalNoEnOc),
      monto_aforo: montoAforoResumen,
      monto_aforado: montoAforoResumen,
      monto_retenido_aforo: montoAforoResumen,
      documento_aforo: (aforoInfo && aforoInfo.documento_aforo) || (sap3wm && sap3wm.documento_aforo) || null,
      status_aforo: (aforoInfo && aforoInfo.status_aforo) || (sap3wm && sap3wm.status_aforo) || null,
      
      total_lineas_factura: invoiceItems.length,
      lineas_conformes: itemsConformes,
      lineas_con_descalce: itemsConDescalce,
      estado_general: difMlOficial > 0 ? 'CON_DESCALCE' : 'CALCE_CONFORME',
      diagnostico_global: diagnostico,
      aforo_info: aforoInfo,
      sap_3wm: sap3wm
    },
    lineas: resultadoLineas,
    items_oc_no_facturados: itemsOcNoFacturados
  };
}

// Catálogo oficial de homologación de códigos cruzados proveedor -> PedidosYa
const CATALOGO_HOMOLOGACION_SKU = {
  // Carozzi & Embonor
  '965383': '4FM9KH', '4388': '15132888', '501107': '57800104', '501866': '15132657',
  '502988': '0OZS1W', '503410': '5DB8MI', '504104': 'G45RIF', '504103': '80AZ5R',
  '504186': '7WR04L', '504337': 'JQK9E0', '506369': 'KUPQHW', '506315': 'QJSXU0',
  '964621': 'D5WBYD', '964620': 'K6SYAN', '964614': 'AF9QGW', '964670': 'D0B1PL',
  '964506': '3LW16R', '23634': '15132899', '40279': 'UL1N30', '964588': '15132703',
  '965202': 'SDZUIN', '506558': 'POE65F', '503170': 'YCVU0B', '502686': 'OPOC5G',
  '502687': 'PZKG2J', '502682': '3GU09T', '502679': 'X426S2',

  // Nestlé Chile Alimentos (Códigos de material SAP -> SKU PedidosYa)
  '12519782': 'R6BWKG', '12617672': 'KXIH5L', '12617671': 'XTZ4TE', '12617670': 'HZGO4L',
  '12613576': '21071590', '12618094': '22868493', '11262096': '21071510', '11262149': 'TSDD0N',
  '12613173': 'W6ZLVA', '13370997': 'VR9Q8M', '12627975': '15132913', '12613038': 'ZXXA6M',
  '12208772': '15132985', '12307708': 'Y8LRK7', '14508884': '15485731', '12629061': '22868495',
  '12246934': '15132906', '12094273': '21071566', '12094276': '15132798', '12445777': '15132996',
  '8502763': '6SL6B1', '12045818': '22868492', '12276444': '22868468', '12395414': '22868514',
  '12111270': '16245894', '12549158': 'K0RP7N', '12345805': '13WTQG', '12494998': 'FXYOWO',
  '12220991': '22868502', '12230562': '22868498', '12457281': 'Y043FI', '12581079': 'A0SKYE',
  '12408400': 'AJFB0F', '12605220': '2GPB4A', '12584688': 'UFQBRG', '12482819': 'N7JH84',
  '12473567': 'Z18ML2', '12562296': 'T7H033', '12445778': '22868458', '12630815': '22868494',

  // Embotelladora Andina S.A. (Códigos internos Coca-Cola / Andina -> SKU PedidosYa)
  '126948': '126948', '126925': '126925', '123437': '123437', '124214': '124214',
  '120367': '120367', '121200': '121200', '121201': '121201', '121204': '121204',
  '123444': '123444', '127203': '127203', '127271': '127271', '127354': '127354',
  '127404': '127404', '127347': '127347', '127341': '127341', '127281': '127281',
  '127470': '127470', '127472': '127472', '127478': '127478', '120775': '15132610',
  '121378': '121378', '122915': '122915', '122977': '122977', '122627': '122627',
  '120121': '120121', '120477': '15132610', '120480': '120480', '120475': '120475',
  '122200': '122200', '122202': '122202', '1414': '15133299', '15132614': '15132614',
  '15132833': '15132833', '15133299': '15133299', '15132618': '15132618', 'YOIV9T': 'YOIV9T'
};

/**
 * Busca el mejor match en los ítems de la OC para una línea de factura.
 * Utiliza homologación de 4 vías: Código Factura Proveedor -> Catálogo -> Barcode EAN -> Similitud de Texto.
 */
function buscarMatchEnPo(invItem, poItems, matchedIndices) {
  const invCode = (invItem.codigo || '').toLowerCase().trim();
  const invEan = (invItem.ean || invItem.codigo_ean || '').toLowerCase().trim();
  const invDesc = normalizarTexto(invItem.descripcion);
  const mappedSku = (CATALOGO_HOMOLOGACION_SKU[invItem.codigo] || CATALOGO_HOMOLOGACION_SKU[invCode] || '').toLowerCase().trim();

  // Intento 1: Match exacto por código interno de proveedor (supplier_sku homologado)
  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    const poSupp = (po.supplier_sku || '').toLowerCase().trim();
    if (poSupp && (poSupp === invCode || poSupp === invEan)) {
      return { poItem: po, index: i, matchType: 'exact_supplier_code' };
    }
  }

  // Intento 2: Match por Catálogo de Homologación Previo
  if (mappedSku) {
    for (let i = 0; i < poItems.length; i++) {
      if (matchedIndices.has(i)) continue;
      const po = poItems[i];
      const poSku = (po.sku_id || '').toLowerCase().trim();
      if (poSku === mappedSku) {
        return { poItem: po, index: i, matchType: 'homologacion_catalogo' };
      }
    }
  }

  // Intento 3: Match exacto por SKU de PedidosYa o Barcode EAN
  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    const poSku = (po.sku_id || '').toLowerCase().trim();
    if (poSku && (poSku === invCode || poSku === invEan)) {
      return { poItem: po, index: i, matchType: 'exact_sku' };
    }
    if (po.barcodes && po.barcodes.some(b => {
      const cleanB = (b || '').toLowerCase().trim();
      return cleanB && (cleanB === invCode || cleanB === invEan || cleanB.endsWith(invCode) || invCode.endsWith(cleanB));
    })) {
      return { poItem: po, index: i, matchType: 'exact_barcode' };
    }
  }

  // Intento 3.5: Match por MONTO. Las facturas de muchos proveedores traen sus propios códigos (sin EAN) y cantidades en
  // cajas: la línea facturada vale lo mismo que cantidad ordenada x costo con descuento de UNA línea de la OC.
  const porMonto = buscarMatchPorMonto(invItem, poItems, matchedIndices);
  if (porMonto.index !== -1) {
    return { poItem: poItems[porMonto.index], index: porMonto.index, matchType: 'monto', diferencia_monto: porMonto.diferencia };
  }

  // Intento 4: Match por similitud de nombre
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    const poDesc = normalizarTexto(po.product_name);
    const score = calcularSimilitudTextos(invDesc, poDesc);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore >= 0.38 && bestIndex !== -1) {
    return { poItem: poItems[bestIndex], index: bestIndex, matchType: 'fuzzy_text', score: bestScore };
  }

  return { poItem: null, index: -1, matchType: 'none' };
}

/**
 * ¿La relación recibido/facturado parece un factor de caja (entero >= 2)? Si la factura viene en cajas y la OC en unidades,
 * pero el precio no confirma el factor, comparar precio por unidad contra costo no es confiable: hay que revisar a mano.
 */
function esRatioDeCaja(ratio) {
  ratio = Number(ratio) || 0;
  return ratio >= 2 && Math.abs(ratio - Math.round(ratio)) < 0.1;
}

/**
 * Factor de empaque deducido del PRECIO (precio facturado / costo de la OC) para los que no están en la lista fija
 * (ej: cajas de 7 o de 160 unidades). Solo vale si la cantidad ordenada o recibida dividida por la facturada lo confirma;
 * sin esa confirmación, con costos bajos casi cualquier precio "calzaría" y se escondería un sobreprecio real.
 * @return {number} el factor (>= 2) o 0 si no hay un factor claro
 */
function inferirFactorEmpaque(precio, costo, qtyFacturada, qtyOrdenada, qtyRecibida) {
  precio = Number(precio) || 0;
  costo = Number(costo) || 0;
  qtyFacturada = Number(qtyFacturada) || 0;
  if (precio <= 0 || costo <= 0 || qtyFacturada <= 0) return 0;
  const f = Math.round(precio / costo);
  if (f < 2 || f > 500) return 0;
  if (Math.abs(precio / f - costo) > Math.max(5, costo * 0.005)) return 0;
  const confirmaOrdenada = (Number(qtyOrdenada) || 0) > 0 && Math.abs((Number(qtyOrdenada) / qtyFacturada) - f) < 0.1;
  const confirmaRecibida = (Number(qtyRecibida) || 0) > 0 && Math.abs((Number(qtyRecibida) / qtyFacturada) - f) < 0.1;
  return (confirmaOrdenada || confirmaRecibida) ? f : 0;
}

/**
 * Precio unitario realmente cobrado en una línea de factura. El DTE trae PrcItem (precio de lista) y MontoItem (monto neto,
 * ya con descuentos/recargos de línea). Si no cuadran (más allá de redondeos), el precio efectivo es monto / cantidad.
 */
function precioEfectivoFactura(cantidad, precio, monto) {
  cantidad = Number(cantidad) || 0;
  precio = Number(precio) || 0;
  monto = Number(monto) || 0;
  if (cantidad <= 0 || monto <= 0) return precio;
  const tolerancia = Math.max(50, monto * 0.005); // $50 o 0,5%: absorbe redondeos de pesables y decimales
  if (Math.abs(cantidad * precio - monto) <= tolerancia) return precio;
  return monto / cantidad;
}

/** Copia de la línea de factura con el precio efectivo (conserva el de lista y el descuento para trazabilidad). */
function normalizarPrecioItemFactura(it) {
  const efectivo = precioEfectivoFactura(it.cantidad_facturada, it.precio_facturado, it.monto_facturado);
  if (efectivo === Number(it.precio_facturado)) return it;
  return Object.assign({}, it, {
    precio_lista_facturado: it.precio_facturado,
    precio_facturado: efectivo,
    descuento_linea: Math.round((Number(it.cantidad_facturada) * Number(it.precio_facturado) - Number(it.monto_facturado)) * 100) / 100
  });
}

/**
 * Empareja una línea de factura con la línea de la OC cuyo monto coincide (ordenado o recibido, con descuento).
 * Solo devuelve un resultado cuando hay UN candidato claro: si dos líneas de la OC valen lo mismo, no adivina.
 * @return {{index:number, diferencia:number}} index = -1 si no hay emparejamiento único
 */
function buscarMatchPorMonto(invItem, poItems, matchedIndices) {
  const monto = Number(invItem.monto_facturado) || 0;
  if (monto <= 0) return { index: -1, diferencia: 0 };
  const tolerancia = Math.max(50, monto * 0.002); // $50 o 0,2%: absorbe decimales del costo unitario

  const candidatos = [];
  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    const costo = Number(po.unit_cost_after_discount_lc_final !== undefined ? po.unit_cost_after_discount_lc_final : po.cost_unit_lc) || 0;
    const recibido = Number(po.received_qty_final !== undefined ? po.received_qty_final : po.quantity_delivered) || 0;
    const referencias = [Number(po.ordered_amount_after_discount) || 0, costo * recibido].filter(v => v > 0);
    if (referencias.length === 0) continue;
    const diferencia = Math.min.apply(null, referencias.map(v => Math.abs(v - monto)));
    if (diferencia <= tolerancia) candidatos.push({ index: i, diferencia: diferencia });
  }
  if (candidatos.length === 1) return candidatos[0];
  return { index: -1, diferencia: 0 }; // ninguno o ambiguo
}

/**
 * Detecta si un ítem corresponde a un producto pesable (carnes, cecinas, quesos, frutas/verduras)
 * en base a su UOM, descripción, decimales en cantidades o condición de aforo del proveedor.
 */
function esProductoPesable(invItem, poItem, aforoInfo) {
  if (poItem && (poItem.product_type === 'PESABLE' || poItem.is_weightable === true)) return true;

  const uom = (invItem.unidad_medida || invItem.unidad_factura || (poItem && poItem.unit) || '').toString().toUpperCase().trim();
  const PESABLE_UOMS = ['KG', 'KGM', 'KILO', 'KILOS', 'KILOGRAMO', 'KILOGRAMOS', 'GR', 'GRM', 'GRAMO', 'GRAMOS', 'LT', 'LTR', 'LITRO', 'LITROS'];
  if (PESABLE_UOMS.includes(uom)) return true;

  const desc = ((invItem.descripcion || '') + ' ' + (poItem ? (poItem.product_name || '') : '')).toLowerCase();
  if (/\b(kg|kilo|kilos|granel|pesable|pechuga|trutro|lomo|posta|carne|molida|queso|jamon|cecina|fruta|verdura|palta|tomate|platano|manzana)\b/i.test(desc)) {
    const qFac = Number(invItem.cantidad_facturada || 0);
    const qRec = Number(poItem ? (poItem.received_qty_final !== undefined ? poItem.received_qty_final : (poItem.quantity_delivered || poItem.quantity_ordered || 0)) : 0);
    if (!Number.isInteger(qFac) || !Number.isInteger(qRec)) return true;
  }

  if (aforoInfo && aforoInfo.condicion_aforo && aforoInfo.condicion_aforo.toUpperCase().includes('PESABLE')) {
    return true;
  }

  return false;
}

/**
 * Obtiene el umbral oficial de tolerancia para productos pesables desde el catálogo de aforos.
 */
function obtenerToleranciaPesable(aforoInfo) {
  let tolPct = 0.025; // 2.5% por defecto para pesables en Dmarts Chile
  if (aforoInfo && aforoInfo.tolerancia) {
    const rawNum = parseFloat(aforoInfo.tolerancia.toString().replace(/%/g, '').replace(/,/g, '.').trim());
    if (!isNaN(rawNum) && Math.abs(rawNum) > 0) {
      tolPct = Math.max(0.005, Math.abs(rawNum) / 100);
    }
  }
  return tolPct;
}

/**
 * Analiza en profundidad las discrepancias de precio, cantidad y UOM, incorporando tolerancias de pesables.
 */
function analizarDiscrepanciaItem(invItem, poItem, poData, aforoInfo) {
  const qtyFacturada = invItem.cantidad_facturada;
  const prcFacturado = invItem.precio_facturado;
  const montoFacturado = invItem.monto_facturado;

  const costOc = poItem.unit_cost_after_discount_lc_final !== undefined ? poItem.unit_cost_after_discount_lc_final : poItem.cost_unit_lc;
  const qtyDelivered = poItem.received_qty_final !== undefined ? poItem.received_qty_final : poItem.quantity_delivered;
  const qtyOrdered = poItem.quantity_ordered !== undefined ? poItem.quantity_ordered : qtyDelivered;

  // Detección de factor de empaque / UOM (ej: display x 30 unidades)
  let factorEmpaque = 1;
  let isUomMatch = false;

  const ratioDelivered = (qtyDelivered && qtyFacturada > 0) ? (qtyDelivered / qtyFacturada) : 1;
  const ratioOrdered = (qtyOrdered && qtyFacturada > 0) ? (qtyOrdered / qtyFacturada) : 1;
  const targetRatio = qtyDelivered ? ratioDelivered : ratioOrdered;

  const factoresComunes = [2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 30, 36, 40, 42, 48, 50, 60, 100, 240];
  
  // Intento 1: Extraer factor directo desde la descripción (ej: 15x250g, PT1,5 x 6, pack x 12, 6x4)
  const descCandidates = ((invItem.descripcion || '') + ' ' + (invItem.descripcion_adicional || '')).toLowerCase();
  
  // A. Multi-pack (ej: 6x4 -> 24, 6*4 -> 24)
  const matchMulti = descCandidates.match(/(\d{1,2})\s*[xX*]\s*(\d{1,2})\b/);
  if (matchMulti) {
    const fMult = parseInt(matchMulti[1], 10) * parseInt(matchMulti[2], 10);
    if (fMult > 1 && fMult <= 240) {
      if (!factoresComunes.includes(fMult)) factoresComunes.unshift(fMult);
      else { factoresComunes.splice(factoresComunes.indexOf(fMult), 1); factoresComunes.unshift(fMult); }
    }
  }

  // B. Sufijo estándar multiplicador (ej: x 6, x 12, x12, x24, x 18, * 6)
  const matchSuffix = descCandidates.match(/[xX*]\s*(\d{1,3})\b/);
  if (matchSuffix) {
    const fSuffix = parseInt(matchSuffix[1], 10);
    if (fSuffix > 1 && fSuffix <= 240) {
      if (!factoresComunes.includes(fSuffix)) factoresComunes.unshift(fSuffix);
      else { factoresComunes.splice(factoresComunes.indexOf(fSuffix), 1); factoresComunes.unshift(fSuffix); }
    }
  }

  // C. Formato Pack o Unidades (ej: pack x 6, pack 6, 6 unidades, 12 botellas)
  const matchPack = descCandidates.match(/(?:pack\s*x?\s*|(\d{1,3})\s*(?:unidades|unids?|botellas|latas)\b)(\d{1,3})?/i);
  if (matchPack) {
    const fPack = parseInt(matchPack[1] || matchPack[2], 10);
    if (fPack > 1 && fPack <= 240) {
      if (!factoresComunes.includes(fPack)) factoresComunes.unshift(fPack);
      else { factoresComunes.splice(factoresComunes.indexOf(fPack), 1); factoresComunes.unshift(fPack); }
    }
  }

  // D. Formato clásico de empaque inicial (ej: 15x250g, 21x80g)
  const matchDescFactor = descCandidates.match(/\b(\d{1,3})\s*[xX*]\s*\d+/);
  if (matchDescFactor) {
    const fDesc = parseInt(matchDescFactor[1], 10);
    if (fDesc > 1 && fDesc <= 240 && !factoresComunes.includes(fDesc)) {
      factoresComunes.unshift(fDesc);
    }
  }

  for (let f of factoresComunes) {
    // Caso A: El ratio de cantidades entregadas/ordenadas coincide con el factor de empaque
    if (Math.abs(targetRatio - f) < 0.1) {
      const montoEsperado = qtyDelivered ? (poItem.amt_delivered_lc || (qtyDelivered * costOc)) : poItem.amt_ordered_lc;
      if (Math.abs(montoFacturado - montoEsperado) <= 500 || (costOc > 0 && Math.abs((prcFacturado / f) - costOc) <= 5)) {
        factorEmpaque = f;
        isUomMatch = true;
        break;
      }
    }
    // Caso B: El precio unitario facturado dividido por el factor coincide exactamente con el costo OC
    if (costOc > 0 && Math.abs((prcFacturado / f) - costOc) <= 5) {
      factorEmpaque = f;
      isUomMatch = true;
      break;
    }
    // Caso C: En bebidas con ILA (impuesto interno), comparar (costOc + internalTax) contra (prcFacturado / f)
    const costWithTax = costOc + (Number(poItem.internal_tax_lc) || 0);
    if (costWithTax > 0 && Math.abs((prcFacturado / f) - costWithTax) <= 5) {
      factorEmpaque = f;
      isUomMatch = true;
      break;
    }
  }

  // Factor fuera de la lista fija (ej: 7 o 160 unidades por caja), confirmado por la cantidad ordenada o recibida
  if (!isUomMatch) {
    const fInferido = inferirFactorEmpaque(prcFacturado, costOc, qtyFacturada, poItem.ordered_qty_real !== undefined ? poItem.ordered_qty_real : poItem.quantity_ordered, qtyDelivered);
    if (fInferido > 0) {
      factorEmpaque = fInferido;
      isUomMatch = true;
    }
  }

  // Cantidad recepcionada efectiva en la misma unidad que la factura
  const qtyDeliveredEffective = qtyDelivered !== null ? (isUomMatch ? (qtyDelivered / factorEmpaque) : qtyDelivered) : null;
  const costOcEffective = isUomMatch ? (costOc * factorEmpaque) : costOc;

  // 1. Caso Recepción Aún No Registrada
  if (qtyDelivered === null) {
    return {
      tiene_descalce: true,
      severidad: 'moderada',
      tipo_descalce: 'RECEPCION_PENDIENTE',
      diferencia_unidades: -qtyFacturada,
      diferencia_precio_unit: Math.round(costOcEffective - prcFacturado),
      diferencia_monto_neta: montoFacturado,
      monto_a_reclamar: 0, // Pendiente de validar ingreso físico
      monto_recepcionado: 0,
      factor_empaque: factorEmpaque,
      observacion: `Recepción no cerrada en ${poData.warehouse_name} (estado OC: '${poData.order_status}'). Aún no hay registro de ingreso en sistema.`,
      accion_correctiva: `Contactar a bodega/operaciones para confirmar recepción física de ${qtyFacturada} ${invItem.unidad_medida} antes de autorizar el pago.`
    };
  }

  const difQty = qtyDeliveredEffective - qtyFacturada;
  const difPrice = prcFacturado - costOcEffective;

  // 2. Caso Calce Exacto por Factor de Empaque (UOM)
  if (isUomMatch && Math.abs(difQty) < 0.01 && Math.abs(difPrice) <= 5) {
    return {
      tiene_descalce: false,
      severidad: 'ok',
      tipo_descalce: 'CALCE_UOM_OK',
      diferencia_unidades: 0,
      diferencia_precio_unit: 0,
      diferencia_monto_neta: 0,
      monto_a_reclamar: 0,
      monto_recepcionado: montoFacturado,
      factor_empaque: factorEmpaque,
      observacion: `Calce exacto por factor de empaque (${factorEmpaque} unids/caja). Facturado en bultos (${qtyFacturada}), recepcionado en unidades (${qtyDelivered}). Monto neto exacto.`,
      accion_correctiva: 'Conforme para pago. Sugerencia: Homologar UOM en maestro de artículos con proveedor.'
    };
  }

  // 3. Caso Productos Pesables con Tolerancia Dinámica (Carnes, Cecinas, Pesables)
  const esPesable = esProductoPesable(invItem, poItem, aforoInfo);
  const tolPesablePct = esPesable ? obtenerToleranciaPesable(aforoInfo) : 0;
  const pctVarPesable = (esPesable && qtyFacturada > 0) ? (Math.abs(difQty) / qtyFacturada) : 0;

  if (esPesable && Math.abs(difPrice) <= 2) {
    if (pctVarPesable <= tolPesablePct || Math.abs(difQty * prcFacturado) <= 1500) {
      // Variación dentro de la merma comercial aceptada: NO genera discrepancia artificial
      return {
        tiene_descalce: false,
        severidad: 'ok',
        tipo_descalce: 'RECEPCION_CONFORME_PESABLE',
        diferencia_unidades: difQty,
        diferencia_precio_unit: 0,
        diferencia_monto_neta: 0,
        monto_a_reclamar: 0,
        monto_recepcionado: montoFacturado,
        factor_empaque: 1,
        observacion: `Calce conforme con tolerancia dinámica de pesables (Var: ${(pctVarPesable * 100).toFixed(2)}%, dentro del umbral de merma comercial ${(tolPesablePct * 100).toFixed(2)}%). Sin reclamo NC.`,
        accion_correctiva: 'Conforme para pago. Variación de peso aceptada por política comercial.'
      };
    }
  }

  // 4. Caso Calce Perfecto 100% o Redondeo Mínimo por Centavos (<= $5 CLP)
  if (Math.abs(difQty) < 0.01 && (Math.abs(difPrice) <= 2 || Math.abs(montoFacturado - (qtyDeliveredEffective * costOcEffective)) <= 5)) {
    return {
      tiene_descalce: false,
      severidad: 'ok',
      tipo_descalce: 'CALCE_100_OK',
      diferencia_unidades: 0,
      diferencia_precio_unit: 0,
      diferencia_monto_neta: 0,
      monto_a_reclamar: 0,
      monto_recepcionado: montoFacturado,
      factor_empaque: 1,
      observacion: 'Calce perfecto 100%: Cantidades y costo unitario coinciden exactamente con la recepción.',
      accion_correctiva: 'Conforme para pago.'
    };
  }

  // 5. Descalces Reales (Faltante Físico, Sobreprecio o Descalce Mixto)
  let montoReclamar = 0;
  let montoFaltanteItem = 0;
  let montoSobreprecioItem = 0;
  const observaciones = [];
  const acciones = [];
  let severidad = 'moderada';
  let tipoDescalce = 'DESCALCE';

  const hayFaltante = difQty < -0.01;
  // Factura en cajas y OC en unidades sin factor confirmado por precio: el precio por unidad no es comparable
  const posibleUnidadDistinta = difQty > 0.01 && !isUomMatch && esRatioDeCaja(qtyFacturada > 0 ? qtyDeliveredEffective / qtyFacturada : 0);
  // El sobreprecio solo aplica a las unidades recibidas y facturadas; las no recibidas ya se reclaman completas como faltante
  const unidadesConPrecio = Math.min(Number(qtyDeliveredEffective) || 0, qtyFacturada);
  const haySobreprecio = difPrice > 2 && !posibleUnidadDistinta && unidadesConPrecio > 0;

  if (hayFaltante) {
    let unidadesFaltantes = Math.abs(difQty);
    // Si es pesable y excedió la tolerancia, reclamar el exceso no cubierto
    if (esPesable && pctVarPesable > tolPesablePct) {
      unidadesFaltantes = Math.max(0, unidadesFaltantes - (qtyFacturada * tolPesablePct));
    }
    const montoFaltante = Math.round(unidadesFaltantes * prcFacturado);
    montoFaltanteItem = montoFaltante;
    montoReclamar += montoFaltante;
    observaciones.push(`Faltante en recepción: Se facturaron ${qtyFacturada} pero solo ingresaron ${qtyDeliveredEffective} (Faltan ${unidadesFaltantes.toFixed(2)} ${invItem.unidad_medida || 'UN'}).`);
    acciones.push(`Solicitar Nota de Crédito por Faltante Físico de $${formatearClp(montoFaltante)}`);
    tipoDescalce = esPesable ? 'FALTANTE_RECEPCION_PESABLE' : 'FALTANTE_RECEPCION';
    severidad = 'critica';
  }

  if (haySobreprecio) {
    const montoSobreprecio = Math.round(difPrice * unidadesConPrecio);
    montoSobreprecioItem = montoSobreprecio;
    montoReclamar += montoSobreprecio;
    observaciones.push(`Diferencia de costo: Facturado a $${formatearClp(prcFacturado)} vs Costo pactado OC $${formatearClp(costOcEffective)} (+ $${formatearClp(difPrice)}/u).`);
    acciones.push(`Solicitar Nota de Crédito por Diferencia de Precio de $${formatearClp(montoSobreprecio)}`);
    tipoDescalce = hayFaltante ? 'DESCALCE_MIXTO' : 'SOBREPRECIO';
    severidad = 'critica';
  }

  if (difQty > 0.01) {
    if (posibleUnidadDistinta) {
      observaciones.push(`Unidad de medida distinta entre factura y OC: se facturaron ${qtyFacturada} y se recepcionaron ${qtyDeliveredEffective} (${(qtyDeliveredEffective / qtyFacturada).toFixed(2)} por cada una facturada), pero el precio no confirma el factor de empaque. No se genera reclamo automático.`);
      acciones.push('Revisar la unidad de medida (caja vs unidad) de este producto con el proveedor y homologarla.');
      tipoDescalce = 'REVISAR_UOM';
      severidad = 'moderada';
    } else {
      observaciones.push(`Sobrellegada física: Se recepcionaron ${qtyDeliveredEffective} unidades vs ${qtyFacturada} facturadas.`);
      acciones.push('Revisar si proveedor emitirá factura adicional por excedente recepcionado.');
      tipoDescalce = 'SOBRE_LLEGADA';
    }
  }

  // Nunca se reclama más que el valor de la línea: si pasara, se recorta el sobreprecio (lo primero que se pudo contar de más)
  if (montoReclamar > montoFacturado + 1) {
    montoSobreprecioItem = Math.max(0, montoFacturado - montoFaltanteItem);
    montoReclamar = Math.min(montoFacturado, montoFaltanteItem + montoSobreprecioItem);
    observaciones.push('Reclamo limitado al valor de la línea facturada.');
  }

  const montoRecepcionadoFinal = Math.max(0, montoFacturado - montoReclamar);

  return {
    tiene_descalce: true,
    severidad: severidad,
    tipo_descalce: tipoDescalce,
    diferencia_unidades: difQty,
    diferencia_precio_unit: difPrice,
    diferencia_monto_neta: montoFacturado - montoRecepcionadoFinal,
    monto_a_reclamar: montoReclamar,
    monto_faltante: montoFaltanteItem,
    monto_sobreprecio: montoSobreprecioItem,
    monto_recepcionado: montoRecepcionadoFinal,
    factor_empaque: factorEmpaque,
    observacion: observaciones.join(' | '),
    accion_correctiva: acciones.join(' + ') + '.'
  };
}

// Abreviaturas comerciales frecuentes en DTEs de bebestibles y abarrotes en Chile
const ABREVIATURAS_CHILE = {
  cer: 'cerveza',
  lt: 'lata',
  vd: 'botella vidrio',
  pt: 'pet botella',
  andi: 'andina',
  andif: 'andina frut',
  arts: 'artois',
  cusque: 'cusquena',
  buchan: 'buchanans',
  og: 'original',
  orig: 'original',
  s_alc: 'sin alcohol',
  s_g: 'sin gas',
  c_g: 'con gas'
};

/**
 * Normaliza cadenas de texto para comparaciones resistentes a mayúsculas, tildes, unidades y símbolos.
 */
function normalizarTexto(txt) {
  if (!txt) return '';
  let s = txt.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/s\/alc\b/g, 's_alc')
    .replace(/s\/g\b/g, 's_g')
    .replace(/c\/g\b/g, 'c_g')
    .replace(/(\d+)\s*(cc|ml|cm3|lt|l|gr|g|kilos?|kg)\b/g, '$1 ')
    .replace(/[^a-z0-9_\s]/g, ' ');

  Object.keys(ABREVIATURAS_CHILE).forEach(k => {
    s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), ABREVIATURAS_CHILE[k]);
  });

  return s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calcula similitud de texto considerando tokens exactos, prefijos y marcas clave.
 */
function calcularSimilitudTextos(str1, str2) {
  if (!str1 || !str2) return 0;
  const arr1 = str1.split(' ').filter(w => w.length >= 2);
  const arr2 = str2.split(' ').filter(w => w.length >= 2);
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  let interseccion = 0;
  let bonusBrand = 0;

  set1.forEach(w1 => {
    if (set2.has(w1)) {
      interseccion++;
      if (w1.length >= 4) bonusBrand += 0.08;
    } else {
      for (const w2 of set2) {
        if ((w1.length >= 4 && w2.length >= 4) && (w1.startsWith(w2) || w2.startsWith(w1))) {
          interseccion += 0.8;
          bonusBrand += 0.05;
          break;
        }
      }
    }
  });

  const union = new Set([...set1, ...set2]).size;
  const jaccard = union > 0 ? (interseccion / union) : 0;
  return Math.min(1.0, jaccard + bonusBrand);
}

function formatearClp(monto) {
  return Math.round(monto || 0).toLocaleString('es-CL');
}

function generarDiagnosticoGlobal(montoReclamar, lineasDescalce, totalLineas) {
  if (montoReclamar <= 0 && lineasDescalce === 0) {
    return 'Factura conforme al 100%. Aprobada para pago sin observaciones.';
  }
  return `Atención: Se detectaron ${lineasDescalce} de ${totalLineas} líneas con discrepancias. Monto total sugerido a reclamar en Notas de Crédito: $${formatearClp(montoReclamar)} CLP.`;
}
