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

  const invoiceItems = invoiceData.items;
  const poItems = (poData && poData.items) ? poData.items : [];
  const poFound = poData && poData.po_found;

  const resultadoLineas = [];
  const matchedPoIndices = new Set();

  let totalFacturadoNeto = 0;
  let totalRecepcionadoNeto = 0;
  let totalMontoReclamar = 0;
  let itemsConDescalce = 0;
  let itemsConformes = 0;

  // Recorrer cada ítem de la factura
  invoiceItems.forEach((invItem) => {
    totalFacturadoNeto += invItem.monto_facturado;

    if (invItem.es_flete) {
      totalMontoReclamar += invItem.monto_facturado;
      itemsConDescalce++;
      resultadoLineas.push({
        linea_factura: invItem.linea,
        codigo_factura: invItem.codigo || 'FLETE',
        codigo_ean: '-',
        sku_pedidosya: 'FLETE',
        descripcion_factura: invItem.descripcion,
        cantidad_facturada: 1,
        unidad_factura: 'GL',
        precio_facturado: invItem.precio_facturado,
        monto_facturado: invItem.monto_facturado,
        
        sku_oc: '-',
        supplier_sku_oc: '-',
        descripcion_oc: 'No contemplado en OC',
        cantidad_oc_ordenada: 0,
        cantidad_oc_recepcionada: 0,
        costo_unitario_oc: 0,
        monto_recepcionado: 0,

        diferencia_unidades: 0,
        diferencia_precio_unit: invItem.precio_facturado,
        diferencia_monto_neta: invItem.monto_facturado,
        monto_a_reclamar: invItem.monto_facturado,

        tipo_descalce: 'FLETE_NO_PACTADO_OC',
        severidad: 'moderada',
        observacion: `Recargo global de flete (${formatMontoClp(invItem.monto_facturado)}) facturado en DTE pero no estipulado en la OC de mercadería.`,
        accion_correctiva: 'Verificar acuerdo comercial de flete con Category Manager o solicitar Nota de Crédito por cobro no convenido.'
      });
      return;
    }

    if (!poFound || poItems.length === 0) {
      // Caso: OC no encontrada en sistema
      const descalceMonto = invItem.monto_facturado;
      totalMontoReclamar += descalceMonto;
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
        costo_unitario_oc: 0,
        monto_recepcionado: 0,

        diferencia_unidades: -invItem.cantidad_facturada,
        diferencia_precio_unit: 0,
        diferencia_monto_neta: descalceMonto,
        monto_a_reclamar: descalceMonto,

        tipo_descalce: 'SKU_NO_EN_OC',
        severidad: 'critica',
        observacion: `El ítem ${invItem.codigo} (${invItem.descripcion}) no fue solicitado en la Orden de Compra ${poData.po_order_id}.`,
        accion_correctiva: `Solicitar Nota de Crédito por cobro no solicitado por $${formatearClp(descalceMonto)}.`,
        match_type: 'none',
        match_confidence: 0,
        data_source_invoice: `Axteroid API (Folio ${invoiceData.folio})`,
        data_source_po: `BigQuery cl_dmarts (OC ${poData.po_order_id})`
      });
      return;
    }

    // Análisis del ítem emparejado
    const analisis = analizarDiscrepanciaItem(invItem, poItem, poData);
    if (analisis.tiene_descalce) {
      itemsConDescalce++;
      totalMontoReclamar += analisis.monto_a_reclamar;
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
      cantidad_oc_ordenada: poItem.quantity_ordered,
      cantidad_oc_recepcionada: poItem.quantity_delivered,
      costo_unitario_oc: poItem.cost_unit_lc,
      monto_recepcionado: analisis.monto_recepcionado,

      diferencia_unidades: analisis.diferencia_unidades,
      diferencia_precio_unit: analisis.diferencia_precio_unit,
      diferencia_monto_neta: analisis.diferencia_monto_neta,
      monto_a_reclamar: analisis.monto_a_reclamar,

      tipo_descalce: analisis.tipo_descalce,
      severidad: analisis.severidad,
      observacion: analisis.observacion,
      accion_correctiva: analisis.accion_correctiva,
      factor_empaque: analisis.factor_empaque,
      match_type: matchResult.matchType || 'exact_sku',
      match_confidence: matchResult.confidence || 100,
      data_source_invoice: `Axteroid API (Folio ${invoiceData.folio})`,
      data_source_po: `BigQuery cl_dmarts (OC ${poData.po_order_id})`
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

  // Consultar condición en la Tabla de Aforos Chile (Spreadsheet en vivo)
  let aforoInfo = null;
  try {
    if (typeof obtenerCondicionAforoProveedor === 'function') {
      aforoInfo = obtenerCondicionAforoProveedor(invoiceData.emisor ? invoiceData.emisor.rut : null);
    }
  } catch (errAforo) {
    Logger.log(`Aviso consultando aforo en CruceEngine: ${errAforo.message}`);
  }

  let diagnostico = generarDiagnosticoGlobal(totalMontoReclamar, itemsConDescalce, invoiceItems.length);
  if (aforoInfo && aforoInfo.es_lista_blanca) {
    diagnostico += ` | ⚠️ PROVEEDOR EN LISTA BLANCA: "${aforoInfo.condicion_aforo}". Responsable Comercial: ${aforoInfo.category_manager || 'Comercial'}. No retener sin escalamiento.`;
  }

  const difMl = totalFacturadoNeto - totalRecepcionadoNeto;
  return {
    resumen: {
      folio_factura: invoiceData.folio,
      fecha_emision: invoiceData.fecha_emision,
      proveedor_rut: invoiceData.emisor.rut,
      proveedor_nombre: invoiceData.emisor.razon_social,
      po_referencia: poData ? poData.po_order_id : null,
      almacen: poData ? poData.warehouse_name : null,
      estado_po: poData ? poData.order_status : null,
      
      total_facturado_neto: totalFacturadoNeto,
      total_recepcionado_neto: totalRecepcionadoNeto,
      diferencia_total_neta: difMl,
      dif_ml: difMl,
      diferencia_moneda_local: difMl,
      total_monto_a_reclamar: totalMontoReclamar,
      corroboracion_calce_exacto: Math.abs(difMl - totalMontoReclamar) <= 5,
      
      total_lineas_factura: invoiceItems.length,
      lineas_conformes: itemsConformes,
      lineas_con_descalce: itemsConDescalce,
      estado_general: estadoGeneral,
      diagnostico_global: diagnostico,
      aforo_info: aforoInfo
    },
    lineas: resultadoLineas,
    items_oc_no_facturados: itemsOcNoFacturados
  };
}

/**
 * Diccionario de Homologación de Catálogos de Proveedores Clave en Chile
 * (Coca-Cola Embonor, Carozzi, CCU, Ideal, etc.)
 */
var DICCIONARIO_PROVEEDORES_CATALOGO = {
  // --- COCA-COLA EMBONOR S.A. ---
  '9507': '18425480', // Alto del Carmen Transparente 40° 750ml
  '9501': '18425481', // Alto del Carmen Especial 35° 1L
  '9517': '18425482', // Alto del Carmen Especial 35° 750ml
  '0154': '15132609', // Coca Cola Original 3L
  '154':  '15132609',
  '0379': '15132610', // Coca Cola Sin Azúcar 3L
  '379':  '15132610',
  '0354': '21111837', // Coca Cola Light 3L
  '354':  '21111837',
  '0579': '43485994', // Fanta Zero 3L
  '579':  '43485994',
  '0767': '21113082', // Sprite 3L
  '767':  '21113082',
  '0679': '21113080', // Sprite Zero 3L
  '679':  '21113080',
  '0161': '15132586', // Coca Cola 6x350cc Lata
  '161':  '15132586',
  '0381': '15132612', // Coca Cola Sin Azúcar 6x350cc Lata
  '381':  '15132612',
  '0929': 'S838LD',   // Fanta Naranja 3L
  '929':  'S838LD',
  '0933': 'KFAVH4',   // Fanta Pomelo 1.5L
  '933':  'KFAVH4',
  '0922': '15485806', // Fanta Naranja Lata 350cc Pack 6
  '922':  '15485806',
  '4272': '15485770', // Fanta Naranja Zero Lata 350cc Pack 6
  '0692': '15485788', // Sprite Zero Lata 350cc Pack 6
  '692':  '15485788',
  '0177': '40762457', // Coca Cola Regular 591ml
  '177':  '40762457',
  '0388': '40762459', // Coca Cola Sin Azúcar 591ml
  '388':  '40762459',
  '4269': '40762455', // Fanta Zero 591ml
  '0742': '40762452', // Sprite Regular 591ml
  '742':  '40762452',
  '0688': '40762453', // Sprite Zero 591ml
  '688':  '40762453',
  '0136': '15132574', // Coca Cola Regular 1.5L
  '136':  '15132574',
  '0336': '15132575', // Coca Cola Light 1.5L
  '336':  '15132575',
  '0377': '15132576', // Coca Cola Sin Azúcar 1.5L
  '377':  '15132576',
  '0757': '15133090', // Sprite 1.5L
  '757':  '15133090',
  '0694': '15133091', // Sprite Zero 1.5L
  '694':  '15133091',
  '4274': '15133078', // Fanta Zero 1.5L
  '2004': '15133082', // Inca Kola Zero 1.5L
  '2009': '8YC8DI',   // Inca Kola 3L
  '1993': 'EAGTT6',   // Monster Ultra Peachy Keen 473ml
  '1989': '9UGCBO',   // Monster Zero Sugar 473ml
  '1988': 'HWBKV4',   // Monster Ripper 473ml
  '1987': '2D320G',   // Monster Aussie Lemonade 473ml
  '1980': 'KKWKQ5',   // Monster Paradise 473ml
  '1978': '5I5POE',   // Monster Mango Loco 473ml
  '1966': '21113099', // Monster Ultra 473ml
  '1963': '15132548', // Monster Regular 473ml
  '2524': '15132530', // Benedictino Sin Gas 6.5L
  '2520': 'MNR7L2',   // Benedictino Sin Gas 3L
  '2521': 'GA25OI',   // Benedictino Con Gas 3L
  '2503': '15109273', // Benedictino Sin Gas 1.5L
  '2504': '15132540', // Benedictino Con Gas 1.5L
  '2508': '15109274', // Benedictino Sin Gas 500ml
  '2509': '15132541', // Benedictino Con Gas 500ml
  '2528': '61RK5M',   // Benedictino Manzana 500ml
  '2529': 'TG6A58',   // Benedictino Pera 500ml
  '2558': '15133266', // Benedictino Manzana 1.5L
  '2559': '15133267', // Benedictino Pera 1.5L
  '2557': '15133268', // Benedictino Limon Jengibre 1.5L
  '2560': 'J68J57',   // Benedictino Pomelo 1.5L
  '2624': '7WA5NP',   // Benedictino Frutos Rojos 1.5L
  '2625': '1G5SPD',   // Benedictino Frutos Rojos 500ml
  '2133': '15132538', // Vital Sin Gas 1.6L
  '2233': '15132536', // Vital Con Gas 1.6L
  '2244': 'HX6KOT',   // Vital Con Gas 2.5L
  '2583': '21111835', // Aquarius Limonada 1.6L
  '3000': 'FZ6VUA',   // Fastlyte Fresa 625ml
  '4649': '71AN5L',   // Powerade Frozen Blast 1.1L
  '4651': '0D120U',   // Powerade Rojo 1.1L
  '4652': 'C2700Z',   // Powerade Zero Frozen Blast 1.1L
  '4654': '62628O',   // Powerade Zero Uva 1.1L
  '1414': '15133299', // Andina Del Valle Piña Light 200cc Pack 6
  '1423': '15132616', // Andina Del Valle Piña 200cc Pack 6
  '1523': '15132615', // Andina Del Valle Naranja 200cc Pack 6
  '1123': '15132618', // Andina Del Valle Manzana 200cc Pack 6
  '1514': '15132833', // Andina Del Valle Naranja Light 200cc Pack 6
  '7223': '15132617', // Andina Del Valle Durazno 200cc Pack 6
  '1136': '15133096', // Andina Del Valle Manzana 1.5L
  '1362': '15133188', // Andina Del Valle Durazno Light 1.5L
  '1462': '15133100', // Andina Del Valle Piña Light 1.5L
  '1534': '15133099', // Andina Del Valle Naranja Light 1.5L
  '5575': '21111708', // Guallarauco Mango 1L
  '5624': 'W7X5BG',   // Guallarauco Orange Vitamin 1L
  '5625': '4NG46F',   // Guallarauco Red Vitamin 1L
  '9410': '0WVQ1V',   // Pack Quilmes 354cc 12 unids
  '9817': 'GOWK43',   // Cerveza Becker 473cc 6 unids
  '9840': 'TUSHY2',   // Cerveza Corona 330cc 12 unids
  '9841': 'QES1I6',   // Cerveza Corona 330cc 18 unids
  '9843': '43705987', // Cerveza Corona 330cc 6 unids
  '9898': '43705998', // Cerveza Stella Artois 330cc 6 unids
  '1700': '43706146', // Cerveza Baltica 473cc 6 unids
  '1718': 'ZVEN9F',   // Cerveza Quilmes 473cc 6 unids
  '1719': 'K13I7U',   // Cerveza Stella Artois 473cc 6 unids
  '0476': '919BY3',   // Schweppes Ginger Ale Sin Azúcar 1.5L

  // --- EMPRESAS CAROZZI S.A. ---
  '1033': 'CAR-FID-1033',
  '1034': 'CAR-FID-1034',
  '1035': 'CAR-SAL-1035',
  '1036': 'CAR-GAL-1036',
  '1037': 'CAR-ARR-1037',
  '1038': 'CAR-CHO-1038',
  'UHBPGV': 'UHBPGV',

  // --- GRUPO BIMBO / IDEAL S.A. (PO519527, PO521015) ---
  '965383': '4FM9KH',   // Tortillas de Maíz Takis Buckin Ranch 190 g
  '4388': '15132888',   // Pan Rallado Ideal Xl 250 g
  '501107': '57800104', // Pan Hamburguesa Ideal Artesano (720 g), 8 Unidades
  '501866': '15132657', // Pan Completo XL Ideal 6 Unidades 528 g
  '502988': '0OZS1W',   // Pan Molde Ideal Artesano Integral 600 g
  '503410': '5DB8MI',   // Pan Completo HotDog 8un 480 g Ideal
  '504104': 'G45RIF',   // Pan Blanco Ideal Cero Cero Bolsa 580 g
  '504103': '80AZ5R',   // Pan Molde Cero Integral Ideal 600 g
  '504186': '7WR04L',   // Pan De Molde Ideal Artesano Blanco 550 g
  '504337': 'JQK9E0',   // Pan Hamburguesa Artesano Brioche 4 Uni Ideal 352 G
  '506369': 'KUPQHW',   // Pita Ideal Cero & Cero Blanco 8 Piezas 344 g
  '506315': 'QJSXU0',   // Pan De Molde Ideal 580 g
  '964621': 'D5WBYD',   // Takis Original 190 g
  '964620': 'K6SYAN',   // Takis Fuego 190 g
  '964614': 'AF9QGW',   // Pan Hot Dog Brioche Artesano Ideal 6 Unidades
  '964670': 'D0B1PL',   // Pan De Molde Blanco Sin Bordes Ideal 400 g
  '964506': '3LW16R',   // Pan De Molde Ideal Proteína 430 g
  '23634': '15132899',  // Pre Pizza Redonda 500 g Ideal 2 Unidades
  '40279': 'UL1N30',    // Pastel Mil Hojas Manjar Agua de Piedra 6 Unidades
  '964588': '15132703', // Pan Ideal De Molde Blanco 750 g
  '965202': 'SDZUIN',   // Rayita (150 g) 5 Unidades
  '506558': 'POE65F',   // Pan Integral Calabaza Nuez Fuchs 600 g
  '503170': 'YCVU0B',   // Pack Brownie Nutra Bien! Braunichoc (140 g) 4 Unidades
  '502686': 'OPOC5G',   // Pack Brownie Chips 4 Unidades
  '502687': 'PZKG2J',   // Brownie Nutra Bien! Sin Azúcares 200 g
  '502682': '3GU09T',   // Galleton Chocolate Chip Nutrabien 40Gr
  '502679': 'X426S2'    // Galleton Almendras Nutrabien 40Gr
};

function limpiarCodigoItem(c) {
  if (!c) return '';
  return String(c).toLowerCase().replace(/^0+/, '').trim();
}

/**
 * Busca el mejor match en los ítems de la OC para una línea de factura.
 * Utiliza homologación jerárquica de 4 vías:
 * 1. Match Exacto por Código (SKU PedidosYa, Supplier SKU o Barcode EAN sin ceros a la izquierda)
 * 2. Homologación por Diccionario de Catálogo de Proveedor (ej: Embonor, Carozzi)
 * 3. Match Semántico Inteligente con Normalización de Volumen y Tokens de Marca
 */
function buscarMatchEnPo(invItem, poItems, matchedIndices) {
  const invCodeRaw = (invItem.codigo || '').toString().trim();
  const invCodeClean = limpiarCodigoItem(invCodeRaw);
  const invEanClean = limpiarCodigoItem(invItem.ean || '');
  const invDesc = invItem.descripcion || '';

  // ---------------------------------------------------------
  // TIER 1: Match Exacto por Código SKU o Supplier SKU
  // ---------------------------------------------------------
  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    const poSkuClean = limpiarCodigoItem(po.sku_id);
    const poSuppClean = limpiarCodigoItem(po.supplier_sku);

    if (poSkuClean && (poSkuClean === invCodeClean || poSkuClean === invCodeRaw.toLowerCase())) {
      return { poItem: po, index: i, matchType: 'exact_sku', confidence: 100 };
    }
    if (poSuppClean && (poSuppClean === invCodeClean || poSuppClean === invCodeRaw.toLowerCase())) {
      return { poItem: po, index: i, matchType: 'exact_supplier_code', confidence: 100 };
    }
  }

  // ---------------------------------------------------------
  // TIER 1.5: Match por Código de Barras EAN (Directo y Embebido)
  // ---------------------------------------------------------
  if (invEanClean.length >= 4 || invCodeClean.length >= 4) {
    for (let i = 0; i < poItems.length; i++) {
      if (matchedIndices.has(i)) continue;
      const po = poItems[i];
      if (po.barcodes && po.barcodes.length > 0) {
        for (let b of po.barcodes) {
          const bClean = limpiarCodigoItem(b);
          if (bClean && (bClean === invEanClean || (invCodeClean.length >= 8 && bClean === invCodeClean))) {
            return { poItem: po, index: i, matchType: 'exact_barcode', confidence: 100 };
          }
          if (bClean.length >= 8 && invEanClean.length >= 8 && (bClean.endsWith(invEanClean) || invEanClean.endsWith(bClean))) {
            return { poItem: po, index: i, matchType: 'exact_barcode', confidence: 98 };
          }
          // Código interno de fabricante embebido en el código de barra EAN (ej: Ideal 23634 dentro de 7803403236341)
          if (invCodeClean.length >= 4 && bClean.length >= 8 && bClean.includes(invCodeClean)) {
            return { poItem: po, index: i, matchType: 'exact_barcode', confidence: 95 };
          }
        }
      }
    }
  }

  // ---------------------------------------------------------
  // TIER 2: Homologación por Diccionario de Catálogo de Proveedores
  // ---------------------------------------------------------
  const targetSkuFromDict = DICCIONARIO_PROVEEDORES_CATALOGO[invCodeRaw] || DICCIONARIO_PROVEEDORES_CATALOGO[invCodeClean];
  if (targetSkuFromDict) {
    const targetClean = limpiarCodigoItem(targetSkuFromDict);
    for (let i = 0; i < poItems.length; i++) {
      if (matchedIndices.has(i)) continue;
      const po = poItems[i];
      if (limpiarCodigoItem(po.sku_id) === targetClean || limpiarCodigoItem(po.supplier_sku) === targetClean) {
        return { poItem: po, index: i, matchType: 'catalog_dictionary', confidence: 100 };
      }
    }
  }

  // ---------------------------------------------------------
  // TIER 3: Match Semántico Inteligente (Tokens de Marca + Volumen)
  // ---------------------------------------------------------
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < poItems.length; i++) {
    if (matchedIndices.has(i)) continue;
    const po = poItems[i];
    const score = calcularScoreSemanticoAvanzado(invDesc, po.product_name);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore >= 0.40 && bestIndex !== -1) {
    return { poItem: poItems[bestIndex], index: bestIndex, matchType: 'semantic_nlp', confidence: Math.round(bestScore * 100) };
  }

  return { poItem: null, index: -1, matchType: 'none', confidence: 0 };
}

/**
 * Analiza en profundidad las discrepancias de precio, cantidad y UOM.
 */
function analizarDiscrepanciaItem(invItem, poItem, poData) {
  const qtyFacturada = invItem.cantidad_facturada;
  const prcFacturado = invItem.precio_facturado;
  const montoFacturado = invItem.monto_facturado;

  const costOc = poItem.cost_unit_lc;
  const qtyDelivered = poItem.quantity_delivered;
  const qtyOrdered = poItem.quantity_ordered;

  // Detección de factor de empaque / UOM (ej: display x 30 unidades)
  let factorEmpaque = 1;
  let isUomMatch = false;

  const ratioDelivered = (qtyDelivered && qtyFacturada > 0) ? (qtyDelivered / qtyFacturada) : 1;
  const ratioOrdered = (qtyOrdered && qtyFacturada > 0) ? (qtyOrdered / qtyFacturada) : 1;
  const targetRatio = qtyDelivered ? ratioDelivered : ratioOrdered;

  const factoresComunes = [4, 6, 8, 10, 12, 16, 20, 24, 30, 36, 48];
  for (let f of factoresComunes) {
    if (Math.abs(targetRatio - f) < 0.1) {
      // Verificar si los montos netos coinciden o si el texto/precios indican factor de empaque
      const montoEsperado = qtyDelivered ? (poItem.amt_delivered_lc || (qtyDelivered * costOc)) : poItem.amt_ordered_lc;
      const descDicePack = new RegExp(`X0?${f}\\b|PACK\\s*0?${f}\\b`, 'i').test(invItem.descripcion);
      if (Math.abs(montoFacturado - montoEsperado) <= 500 || descDicePack || (costOc && Math.abs((prcFacturado / f) - costOc) <= costOc * 0.25)) {
        factorEmpaque = f;
        isUomMatch = true;
        break;
      }
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

  // 2. Caso Calce Exacto con o sin factor de empaque
  const montoRecepcionadoCalc = qtyDeliveredEffective * prcFacturado;
  const difQty = qtyDeliveredEffective - qtyFacturada;
  const difPrice = prcFacturado - costOcEffective;

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
      accion_correctiva: 'Conforme para pago. Sugerencia: Homologar UOM en maestro de artículos con Carozzi.'
    };
  }

  if (Math.abs(difQty) < 0.01 && Math.abs(difPrice) <= 2) {
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

  // 3. Faltante Físico (Shortage)
  let montoReclamar = 0;
  const observaciones = [];
  const acciones = [];
  let severidad = 'moderada';
  let tipoDescalce = 'DESCALCE';

  const hayFaltante = difQty < -0.01;
  const haySobreprecio = difPrice > 2;

  if (hayFaltante) {
    const unidadesFaltantes = Math.abs(difQty);
    const montoFaltante = Math.round(unidadesFaltantes * prcFacturado);
    montoReclamar += montoFaltante;
    observaciones.push(`Faltante en recepción: Se facturaron ${qtyFacturada} pero solo ingresaron ${qtyDeliveredEffective} (Faltan ${unidadesFaltantes.toFixed(1)} ${invItem.unidad_medida}).`);
    acciones.push(`Solicitar Nota de Crédito por Faltante Físico de $${formatearClp(montoFaltante)}`);
    tipoDescalce = 'FALTANTE_RECEPCION';
    severidad = 'critica';
  }

  if (haySobreprecio) {
    const montoSobreprecio = Math.round(difPrice * (qtyDeliveredEffective || qtyFacturada));
    montoReclamar += montoSobreprecio;
    observaciones.push(`Diferencia de costo: Facturado a $${formatearClp(prcFacturado)} vs Costo pactado OC $${formatearClp(costOcEffective)} (+ $${formatearClp(difPrice)}/u).`);
    acciones.push(`Solicitar Nota de Crédito por Diferencia de Precio de $${formatearClp(montoSobreprecio)}`);
    tipoDescalce = hayFaltante ? 'DESCALCE_MIXTO' : 'SOBREPRECIO';
    severidad = 'critica';
  }

  if (difQty > 0.01) {
    observaciones.push(`Sobrellegada física: Se recepcionaron ${qtyDeliveredEffective} unidades vs ${qtyFacturada} facturadas.`);
    acciones.push('Revisar si proveedor emitirá factura adicional por excedente recepcionado.');
    tipoDescalce = 'SOBRE_LLEGADA';
  }

  return {
    tiene_descalce: true,
    severidad: severidad,
    tipo_descalce: tipoDescalce,
    diferencia_unidades: difQty,
    diferencia_precio_unit: difPrice,
    diferencia_monto_neta: montoFacturado - (qtyDeliveredEffective * costOcEffective),
    monto_a_reclamar: montoReclamar,
    monto_recepcionado: Math.round(qtyDeliveredEffective * costOcEffective),
    factor_empaque: factorEmpaque,
    observacion: observaciones.join(' | '),
    accion_correctiva: acciones.join(' + ') + '.'
  };
}

/**
 * Extrae y normaliza el volumen o formato de empaque de un texto para evitar cruces erróneos.
 */
function extraerVolumenNormalizado(txt) {
  if (!txt) return null;
  const s = txt.toLowerCase()
    .replace(/(\d+)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d+)/g, '$1 $2');

  // Líquidos (cc, ml, l, lt)
  if (/(6[\.,]5\s*l|6500\s*(cc|ml)|6\.500\s*cc)/i.test(s)) return 'VOL_6500';
  if (/(3\s*l\b|3000\s*(cc|ml)|3\.000\s*cc)/i.test(s)) return 'VOL_3000';
  if (/(2[\.,]5\s*l|2500\s*(cc|ml)|2\.500\s*cc)/i.test(s)) return 'VOL_2500';
  if (/(1[\.,]6\s*l|1600\s*(cc|ml)|1\.600\s*cc)/i.test(s)) return 'VOL_1600';
  if (/(1[\.,]5\s*l|1500\s*(cc|ml)|1\.500\s*cc)/i.test(s)) return 'VOL_1500';
  if (/(1[\.,]1\s*l|1100\s*(cc|ml)|1\.1\s*l)/i.test(s)) return 'VOL_1100';
  if (/(1\s*l\b|1\s*lt\b|1000\s*(cc|ml)|1\.000\s*cc)/i.test(s)) return 'VOL_1000';
  if (/750\s*(cc|ml)/i.test(s)) return 'VOL_750';
  if (/591\s*(cc|ml)/i.test(s)) return 'VOL_591';
  if (/500\s*(cc|ml)/i.test(s)) return 'VOL_500';
  if (/(473|474)\s*(cc|ml)/i.test(s)) return 'VOL_473';
  if (/(350|354|355)\s*(cc|ml)/i.test(s)) return 'VOL_350';
  if (/330\s*(cc|ml)/i.test(s)) return 'VOL_330';
  if (/340\s*(cc|ml)/i.test(s)) return 'VOL_340';
  if (/200\s*(cc|ml)/i.test(s)) return 'VOL_200';

  // Gramajes / Sólidos (g, gr, kg)
  if (/(1[\.,]2\s*kg|1200\s*g)/i.test(s)) return 'PESO_1200';
  if (/(1\s*kg|1000\s*g)/i.test(s)) return 'PESO_1000';
  if (/770\s*g/i.test(s)) return 'PESO_770';
  if (/750\s*g/i.test(s)) return 'PESO_750';
  if (/720\s*g/i.test(s)) return 'PESO_720';
  if (/600\s*g/i.test(s)) return 'PESO_600';
  if (/580\s*g/i.test(s)) return 'PESO_580';
  if (/550\s*g/i.test(s)) return 'PESO_550';
  if (/528\s*g/i.test(s)) return 'PESO_528';
  if (/500\s*g/i.test(s)) return 'PESO_500';
  if (/480\s*g/i.test(s)) return 'PESO_480';
  if (/430\s*g/i.test(s)) return 'PESO_430';
  if (/400\s*g/i.test(s)) return 'PESO_400';
  if (/370\s*g/i.test(s)) return 'PESO_370';
  if (/352\s*g/i.test(s)) return 'PESO_352';
  if (/344\s*g/i.test(s)) return 'PESO_344';
  if (/315\s*g/i.test(s)) return 'PESO_315';
  if (/280\s*g/i.test(s)) return 'PESO_280';
  if (/250\s*g/i.test(s)) return 'PESO_250';
  if (/248\s*g/i.test(s)) return 'PESO_248';
  if (/200\s*g/i.test(s)) return 'PESO_200';
  if (/190\s*g/i.test(s)) return 'PESO_190';
  if (/150\s*g/i.test(s)) return 'PESO_150';
  if (/140\s*g/i.test(s)) return 'PESO_140';
  if (/108\s*g/i.test(s)) return 'PESO_108';
  if (/100\s*g/i.test(s)) return 'PESO_100';
  if (/90\s*g/i.test(s)) return 'PESO_90';
  if (/85\s*g/i.test(s)) return 'PESO_85';
  if (/40\s*g/i.test(s)) return 'PESO_40';

  const matchG = s.match(/(\d{2,4})\s*(?:g|gr|grs)\b/i);
  if (matchG) return 'PESO_' + matchG[1];

  return null;
}

/**
 * Tokeniza una descripción aplicando expansiones de abreviaturas del retail chileno.
 */
function tokenizarDescripcionAvanzada(txt) {
  if (!txt) return [];
  let s = txt.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d+)([a-zA-ZáéíóúÁÉÍÓÚñÑ])/g, '$1 $2')
    .replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ])(\d+)/g, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const reemplazos = [
    [/\btransp\b/g, 'transparente'],
    [/\bespec\b/g, 'especial'],
    [/\bcerv\b/g, 'cerveza'],
    [/\bnec\b/g, 'nectar'],
    [/\band\b/g, 'andina'],
    [/\bnar\b/g, 'naranja'],
    [/\bdur\b/g, 'durazno'],
    [/\bmanz\b/g, 'manzana'],
    [/\bpina\b/g, 'pina'],
    [/\bcoke\b/g, 'coca cola'],
    [/\blat\b/g, 'lata'],
    [/\bvid\b/g, 'vidrio'],
    [/\bligth\b/g, 'light'],
    [/\bfullsugar\b/g, 'original']
  ];
  reemplazos.forEach(([pat, rep]) => {
    s = s.replace(pat, rep);
  });

  const stopWords = ['de', 'la', 'el', 'en', 'x01', 'x02', 'x06', 'x12', 'x18', 'x24', 'pack', 'un', 'unid', 'vol', 'ow', 'tetra', 'tp', 'bolsa', 'bol', 'flow', 'bar', 'piezas', 'p', 'id', 'ch', 'adp', 'fuc', 'mla', 'nur', 'me', 'g', 'gr'];
  return s.split(' ').filter(w => w.length > 1 && !stopWords.includes(w));
}

/**
 * Calcula puntaje semántico con penalización por volúmenes incompatibles y bonus por marcas.
 */
function calcularScoreSemanticoAvanzado(invDesc, poDesc) {
  if (!invDesc || !poDesc) return 0;

  const volInv = extraerVolumenNormalizado(invDesc);
  const volPo = extraerVolumenNormalizado(poDesc);

  // Volúmenes o pesos incompatibles (ej: 3L vs 1.5L, o 400g vs 600g) no pueden emparejarse
  if (volInv && volPo && volInv !== volPo) {
    return 0;
  }

  const tokens1 = new Set(tokenizarDescripcionAvanzada(invDesc));
  const tokens2 = new Set(tokenizarDescripcionAvanzada(poDesc));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let interseccion = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) interseccion++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  let score = interseccion / union;

  // Bonus si coinciden volúmenes o gramajes
  if (volInv && volPo && volInv === volPo) {
    score += 0.25;
  }

  // Bonus si coinciden marcas reconocidas
  const marcas = [
    'alto del carmen', 'coca cola', 'monster', 'fanta', 'sprite',
    'benedictino', 'vital', 'corona', 'stella artois', 'quilmes',
    'becker', 'baltica', 'powerade', 'aquarius', 'andina del valle',
    'guallarauco', 'fastlyte', 'carozzi', 'costa', 'gretel',
    'ideal', 'bimbo', 'nutrabien', 'takis', 'marinela', 'fuchs', 'sanissimo', 'agua de piedra'
  ];
  const invNorm = invDesc.toLowerCase();
  const poNorm = poDesc.toLowerCase();
  for (let m of marcas) {
    if (invNorm.includes(m) && poNorm.includes(m)) {
      score += 0.25;
      break;
    }
  }

  return Math.min(1, score);
}

/**
 * Normaliza cadenas de texto para comparaciones resistentes a mayúsculas, tildes y símbolos.
 */
function normalizarTexto(txt) {
  if (!txt) return '';
  return txt.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula similitud de Jaccard basada en tokens entre dos descripciones.
 */
function calcularSimilitudTextos(str1, str2) {
  return calcularScoreSemanticoAvanzado(str1, str2);
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

