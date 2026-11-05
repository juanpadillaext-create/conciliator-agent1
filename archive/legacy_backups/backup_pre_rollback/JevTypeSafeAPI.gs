/**
 * JevTypeSafeAPI.gs
 * Integración con el motor de Inteligencia Artificial TypeSafe AI Jev (System-1 Decision Engine).
 * Proporciona decisiones estructuradas, tipadas y deterministas a alta velocidad (70-300 ms)
 * para:
 * 1. Homologación y desambiguación inteligente de SKUs (Fuzzy Matching con detección de UOM/packs).
 * 2. Triage y clasificación automática de causa raíz de discrepancias en la Tríada DTE-PO-Recepción.
 * 3. Asignación recomendada de cuentas contables para Journal Entry Vouchers (JEV).
 */

const JEV_TYPESAFE_CONFIG = {
  ENDPOINT_DEFAULT: 'https://api.typesafe.ai/v1/jev',
  MODEL_NAME: 'jev-system-1',
  TIMEOUT_MS: 4000
};

/**
 * Obtiene la API Key de TypeSafe AI Jev almacenada en el entorno o en ScriptProperties.
 */
function getJevApiKey() {
  const props = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();
  return props.getProperty('JEV_API_KEY') || scriptProps.getProperty('JEV_API_KEY') || '';
}

/**
 * Guarda la API Key de TypeSafe AI Jev en las propiedades de usuario.
 */
function guardarJevApiKey(apiKey) {
  const props = PropertiesService.getUserProperties();
  if (apiKey) {
    props.setProperty('JEV_API_KEY', apiKey.trim());
  } else {
    props.deleteProperty('JEV_API_KEY');
  }
  return { success: true };
}

/**
 * Ejecuta una consulta al motor Jev TypeSafe AI con fallback local transparente.
 * @param {string} task Tipo de tarea ('sku_matching' o 'discrepancy_triage')
 * @param {Object} payload Datos estructurados de entrada
 * @returns {Object} Decisión tipada con confianza y metadatos
 */
function consultarJevTypeSafe(task, payload) {
  const apiKey = getJevApiKey();

  if (apiKey) {
    try {
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Client-Source': 'Axteroid-Dmarts-Conciliator'
        },
        payload: JSON.stringify({
          model: JEV_TYPESAFE_CONFIG.MODEL_NAME,
          task: task,
          input: payload,
          temperature: 0.0,
          response_format: { type: 'json_object' }
        }),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(JEV_TYPESAFE_CONFIG.ENDPOINT_DEFAULT, options);
      const statusCode = response.getResponseCode();

      if (statusCode >= 200 && statusCode < 300) {
        const json = JSON.parse(response.getContentText());
        return {
          source: 'JEV_TYPESAFE_CLOUD',
          success: true,
          decision: json.decision || json
        };
      } else {
        Logger.log(`Aviso: TypeSafe AI Jev Cloud retornó código ${statusCode}. Usando motor local de respaldo.`);
      }
    } catch (e) {
      Logger.log(`Aviso comunicando con TypeSafe AI Jev API: ${e.message}. Activando inferencia local.`);
    }
  }

  // Motor de Inferencia Local Determinista System-1 (Zero Downtime Fallback)
  const decisionLocal = task === 'sku_matching' 
    ? jevInferenciaSkuMatchingLocal(payload)
    : jevInferenciaTriageLocal(payload);

  return {
    source: 'JEV_TYPESAFE_LOCAL_ENGINE',
    success: true,
    decision: decisionLocal
  };
}

/**
 * Evalúa el matching difuso de un ítem de factura contra candidatos de OC con TypeSafe AI Jev.
 * @param {Object} invItem Ítem de la factura ({ codigo, descripcion, precio, uom })
 * @param {Array} candidatePoItems Lista de ítems de la OC candidatos
 * @returns {Object} Decisión tipada { matched_sku_id, confidence, uom_multiplier, verdict, reasoning }
 */
function jevMatchSku(invItem, candidatePoItems) {
  if (!invItem || !candidatePoItems || candidatePoItems.length === 0) {
    return {
      matched_sku_id: null,
      confidence: 0,
      uom_multiplier: 1,
      verdict: 'NO_CANDIDATES',
      reasoning: 'No se suministraron ítems candidatos de la Orden de Compra.'
    };
  }

  const payload = {
    invoice_item: {
      codigo: invItem.codigo || '',
      descripcion: invItem.descripcion || '',
      precio_unitario: invItem.precio_facturado || invItem.precio || 0,
      unidad: invItem.unidad_medida || 'UN'
    },
    candidates: candidatePoItems.map(po => ({
      sku_id: po.sku_id || po.sku || '',
      supplier_sku: po.supplier_sku || '',
      product_name: po.product_name || po.descripcion || '',
      cost_unit: po.cost_unit_lc || po.costo || 0,
      barcodes: po.barcodes || []
    }))
  };

  const res = consultarJevTypeSafe('sku_matching', payload);
  return res.decision;
}

/**
 * Clasifica y diagnostica una discrepancia línea por línea usando TypeSafe AI Jev.
 * @param {Object} linea Línea de auditoría de CruceEngine
 * @param {Object} aforoInfo Información opcional de aforo del proveedor
 * @returns {Object} Triage tipado con causa raíz, severidad, acción y cuenta contable
 */
function jevTriageDiscrepancia(linea, aforoInfo) {
  if (!linea) return null;

  const payload = {
    sku: linea.sku_pedidosya || linea.sku || '-',
    descripcion: linea.descripcion_factura || linea.descripcion || '',
    cantidad_facturada: Number(linea.cantidad_facturada || 0),
    cantidad_recepcionada: Number(linea.cantidad_oc_recepcionada || linea.cantidad_recepcionada || 0),
    diferencia_unidades: Number(linea.diferencia_unidades || linea.dif_cantidad || 0),
    precio_facturado: Number(linea.precio_facturado || 0),
    costo_oc: Number(linea.costo_unitario_oc || linea.costo_oc || 0),
    diferencia_precio_unit: Number(linea.diferencia_precio_unit || linea.dif_precio || 0),
    monto_a_reclamar: Number(linea.monto_a_reclamar || linea.monto_reclamar || 0),
    es_en_oc: linea.sku_pedidosya !== 'NO EN OC' && linea.sku_pedidosya !== '-',
    es_lista_blanca_aforo: aforoInfo ? !!aforoInfo.es_lista_blanca : false
  };

  const res = consultarJevTypeSafe('discrepancy_triage', payload);
  return res.decision;
}

/**
 * Audita y enriquece un conjunto completo de líneas de conciliación con TypeSafe AI Jev.
 * @param {Object} reconResult Objeto completo de conciliación
 * @returns {Object} Objeto enriquecido con diagnósticos Jev
 */
function jevAuditarLoteCompleto(reconResult) {
  if (!reconResult || !reconResult.lineas) {
    throw new Error('Datos de conciliación inválidos para auditoría Jev.');
  }

  const aforo = reconResult.resumen ? reconResult.resumen.aforo_info : null;
  let totalAuditadas = 0;
  let totalDiscrepanciasJev = 0;
  const distribucionCausas = {};

  const lineasEnriquecidas = reconResult.lineas.map(linea => {
    totalAuditadas++;
    const triage = jevTriageDiscrepancia(linea, aforo);

    if (triage.root_cause !== 'CONFORME') {
      totalDiscrepanciasJev++;
      distribucionCausas[triage.root_cause] = (distribucionCausas[triage.root_cause] || 0) + 1;
    }

    return Object.assign({}, linea, {
      jev_root_cause: triage.root_cause,
      jev_severity: triage.severity,
      jev_confidence: Math.round(triage.confidence * 100),
      jev_recommended_action: triage.action,
      jev_gl_account: triage.recommended_jev_account,
      jev_reasoning: triage.reasoning
    });
  });

  return {
    success: true,
    total_lineas: totalAuditadas,
    total_discrepancias: totalDiscrepanciasJev,
    resumen_causas: distribucionCausas,
    lineas: lineasEnriquecidas
  };
}

// ============================================================================
// MOTOR DE INFERENCIA LOCAL DETERMINISTA (SYSTEM-1 FALLBACK)
// ============================================================================

/**
 * Motor local determinista para matching de SKUs.
 */
function jevInferenciaSkuMatchingLocal(payload) {
  const inv = payload.invoice_item || {};
  const candidates = payload.candidates || [];

  if (candidates.length === 0) {
    return {
      matched_sku_id: null,
      confidence: 0,
      uom_multiplier: 1,
      verdict: 'NO_MATCH',
      reasoning: 'Sin candidatos en la Orden de Compra.'
    };
  }

  const invDescNorm = normalizarTextoJev(inv.descripcion);
  const invCodeNorm = (inv.codigo || '').toLowerCase().trim();
  const invPrice = Number(inv.precio_unitario || 0);

  let bestMatch = null;
  let maxScore = 0;
  let detectedMultiplier = 1;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    let score = 0;

    // 1. Coincidencia por código de proveedor homologado (100% certeza)
    if (cand.supplier_sku && cand.supplier_sku.toLowerCase().trim() === invCodeNorm) {
      return {
        matched_sku_id: cand.sku_id,
        confidence: 0.99,
        uom_multiplier: 1,
        verdict: 'EXACT_SUPPLIER_CODE',
        reasoning: `Coincidencia exacta con código de proveedor homologado (${cand.supplier_sku}).`
      };
    }

    // 2. Coincidencia por Barcode / EAN
    if (cand.barcodes && cand.barcodes.some(b => b.trim() === invCodeNorm)) {
      return {
        matched_sku_id: cand.sku_id,
        confidence: 0.99,
        uom_multiplier: 1,
        verdict: 'EXACT_BARCODE',
        reasoning: `Coincidencia exacta con código de barra EAN (${invCodeNorm}).`
      };
    }

    // 3. Similitud léxica y n-gramas sobre la descripción
    const candDescNorm = normalizarTextoJev(cand.product_name);
    const scoreTexto = calcularSimilitudTokensJev(invDescNorm, candDescNorm);
    score += scoreTexto * 0.7;

    // 4. Corroboración de orden de magnitud de precio
    const candCost = Number(cand.cost_unit || 0);
    if (invPrice > 0 && candCost > 0) {
      const ratio = invPrice / candCost;
      if (ratio >= 0.85 && ratio <= 1.15) {
        score += 0.3; // Mismo nivel de precio unitario
      } else if (ratio >= 5.5 && ratio <= 6.5) {
        score += 0.25;
        detectedMultiplier = 6; // Pack de 6
      } else if (ratio >= 11.0 && ratio <= 13.0) {
        score += 0.25;
        detectedMultiplier = 12; // Caja de 12
      } else if (ratio >= 22.0 && ratio <= 26.0) {
        score += 0.25;
        detectedMultiplier = 24; // Caja de 24
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = cand;
    }
  }

  if (bestMatch && maxScore >= 0.45) {
    return {
      matched_sku_id: bestMatch.sku_id,
      confidence: Math.min(0.98, Number(maxScore.toFixed(2))),
      uom_multiplier: detectedMultiplier,
      verdict: maxScore >= 0.75 ? 'HIGH_CONFIDENCE_MATCH' : 'PROBABLE_MATCH',
      reasoning: `Similitud léxica y concordancia comercial con ${bestMatch.product_name} (${Math.round(maxScore * 100)}%).`
    };
  }

  return {
    matched_sku_id: null,
    confidence: Number(maxScore.toFixed(2)),
    uom_multiplier: 1,
    verdict: 'NO_MATCH',
    reasoning: 'Ningún candidato alcanzó el umbral mínimo de similitud.'
  };
}

/**
 * Motor local determinista para triage y clasificación de causa raíz de discrepancias.
 */
function jevInferenciaTriageLocal(p) {
  // Caso 1: Conforme
  if (p.monto_a_reclamar <= 0 && p.diferencia_unidades === 0 && p.diferencia_precio_unit === 0) {
    return {
      root_cause: 'CONFORME',
      severity: 'OK',
      confidence: 0.99,
      action: 'PAGO_APROBADO',
      recommended_jev_account: '11070000', // EM/RF
      reasoning: 'Línea conciliada sin descalce físico ni de precio.'
    };
  }

  // Caso 2: SKU no solicitado en la OC
  if (!p.es_en_oc) {
    return {
      root_cause: 'UNAUTHORIZED_SKU',
      severity: 'CRITICA',
      confidence: 0.98,
      action: 'SOLICITAR_NOTA_CREDITO_TOTAL',
      recommended_jev_account: '11090300', // Reclamo SKU no en OC
      reasoning: 'Artículo facturado por el proveedor sin orden de compra aprobada.'
    };
  }

  // Caso 3: Posible error de factor de empaque (Caja vs Unidad)
  if (p.diferencia_precio_unit > 0 && p.diferencia_unidades < 0) {
    const ratio = p.precio_facturado / (p.costo_oc || 1);
    if ([6, 10, 12, 20, 24, 30].some(factor => Math.abs(ratio - factor) < 0.25)) {
      return {
        root_cause: 'UOM_PACK_CONVERSION',
        severity: 'MODERADA',
        confidence: 0.94,
        action: 'AJUSTE_FACTOR_EMPAQUE_O_NC',
        recommended_jev_account: '51020100', // PPV
        reasoning: 'Discrepancia congruente con cobro en presentación de caja/pack en vez de unidades individuales.'
      };
    }
  }

  // Caso 4: Faltante físico en bodega predominante
  if (p.diferencia_unidades < 0 && Math.abs(p.diferencia_precio_unit) < 5) {
    return {
      root_cause: 'SHORT_DELIVERY',
      severity: 'ALTA',
      confidence: 0.96,
      action: 'SOLICITAR_NOTA_CREDITO_FALTANTE',
      recommended_jev_account: '11090200', // Reclamo Faltante Bodega
      reasoning: `Faltante físico comprobado de ${Math.abs(p.diferencia_unidades)} unidades no recepcionadas en bodega.`
    };
  }

  // Caso 5: Sobreprecio unitario
  if (p.diferencia_precio_unit > 0 && p.diferencia_unidades === 0) {
    return {
      root_cause: 'PRICE_VARIANCE',
      severity: 'MODERADA',
      confidence: 0.97,
      action: 'SOLICITAR_NOTA_CREDITO_PRECIO',
      recommended_jev_account: '51020100', // Desviación en Precio de Compra
      reasoning: `Sobreprecio de $${Math.round(p.diferencia_precio_unit)} por unidad respecto al costo acordado en OC.`
    };
  }

  // Caso 6: Discrepancia mixta (Faltante físico + Sobreprecio)
  if (p.diferencia_unidades < 0 && p.diferencia_precio_unit > 0) {
    return {
      root_cause: 'MIXED_VARIANCE',
      severity: 'CRITICA',
      confidence: 0.93,
      action: 'SOLICITAR_NOTA_CREDITO_MIXTA',
      recommended_jev_account: '11090200',
      reasoning: 'Línea presenta simultáneamente faltante físico en recepción y sobreprecio unitario.'
    };
  }

  // Fallback genérico
  return {
    root_cause: 'DESCALCE_OPERACIONAL',
    severity: 'MODERADA',
    confidence: 0.85,
    action: 'SOLICITAR_ACLARACION_CM',
    recommended_jev_account: '11090200',
    reasoning: 'Descalce financiero a regularizar con Category Manager y Proveedor.'
  };
}

/**
 * Normaliza cadenas de texto para matching determinista.
 */
function normalizarTextoJev(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d+)(g|gr|kg|ml|l|cc)\b/g, '$1 $2')
    .replace(/\b(gr|gramos)\b/g, 'g')
    .replace(/\b(choc|chocol)\b/g, 'chocolate')
    .replace(/\b(fideo|fids)\b/g, 'fideos')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Coeficiente de similitud de Jaccard sobre conjuntos de tokens.
 */
function calcularSimilitudTokensJev(strA, strB) {
  if (!strA || !strB) return 0;
  const tokensA = new Set(strA.split(' ').filter(t => t.length > 1));
  const tokensB = new Set(strB.split(' ').filter(t => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let inter = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) inter++;
  });

  const union = tokensA.size + tokensB.size - inter;
  return union > 0 ? (inter / union) : 0;
}
