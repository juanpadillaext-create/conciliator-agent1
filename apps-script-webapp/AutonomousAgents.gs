/**
 * AutonomousAgents.gs
 * Sistema de Agentes Autónomos de Software para Axteroid Dmarts Agente Conciliador.
 * Delivery Hero / PedidosYa Chile - Sociedad SAP 6202.
 * 
 * Contiene:
 * - DteIngestionAgent (Agente 1): Ingesta periódica, extracción de XML y detección de OC.
 * - ReconciliationAgent (Agente 2): Motor de Agente Conciliador autónomo en BigQuery con reglas de tolerancia.
 * - SapJevAgent (Agente 3): Generador y validador de asientos contables JEV balanceados (Debe == Haber) para Sociedad 6202.
 * - AgentOrchestrator: Planificador central, gestión de colas de estado y triggers horarios de Apps Script.
 */

const AGENTS_CONFIG = {
  // Configuración del Agente 1 (Ingesta DTE)
  INGESTION: {
    BATCH_SIZE: 500,
    WORKSPACE: 'acc_yZvUK1Aw6y5TAVLD3Y', // Sociedad 6202
    ALLOWED_TYPES: ['CL33', 'CL34', 'CL61', 'CL56']
  },
  // Configuración del Agente 2 (Reconciliación)
  RECONCILIATION: {
    AMOUNT_TOLERANCE_CLP: 1.0,        // Tolerancia de redondeo en pesos chilenos
    QTY_TOLERANCE_PCT: 0.0,           // 0% para productos unitarios estándar
    AUTO_APPROVE_PERFECT_MATCH: true  // Si calza perfecto, encola directo a SAP JEV
  },
  // Configuración del Agente 3 (SAP JEV Sociedad 6202)
  SAP_JEV: {
    COMPANY_CODE: '6202',
    COMPANY_NAME: 'Delivery Hero Dmarts Chile SpA',
    COST_CENTER: 'CD_36_CD_Chile',
    AUTO_POST_PERFECT_MATCH: true,
    MAX_UNBALANCED_TOLERANCE_CLP: 2.0 // Tolerancia máxima de redondeo para centavos
  },
  // Almacenamiento de estado de auditoría
  STATE_KEYS: {
    PROCESSED_INVOICES: 'AGENTS_PROCESSED_INVOICES',
    PENDING_RECONCILIATION: 'AGENTS_PENDING_QUEUE',
    PENDING_JEV_QUEUE: 'AGENTS_PENDING_JEV_QUEUE',
    GENERATED_JEVS_ARCHIVE: 'AGENTS_GENERATED_JEVS',
    LAST_SYNC_TIMESTAMP: 'AGENTS_LAST_SYNC_TS'
  }
};

// ============================================================================
// 🤖 AGENTE 1: DteIngestionAgent (Ingesta y Ciclo de Vida DTE)
// ============================================================================

const DteIngestionAgent = {
  
  /**
   * Ejecuta el ciclo autónomo de ingesta de nuevos DTEs desde Axteroid.
   * @param {Object} options Opciones de ejecución { limit, workspace, forceAll }
   * @returns {Object} Resumen del ciclo de ingesta
   */
  run(options = {}) {
    const startTime = new Date().getTime();
    Logger.log('🚀 [DteIngestionAgent] Iniciando ciclo de ingesta de DTEs...');

    const limit = options.limit || AGENTS_CONFIG.INGESTION.BATCH_SIZE;
    const workspace = options.workspace || AGENTS_CONFIG.INGESTION.WORKSPACE;
    const processedMap = this._getProcessedMap();

    // 1. Obtener documentos recientes desde la API de Axteroid
    let recentDocs = [];
    try {
      recentDocs = fetchRecentAxteroidInvoices(limit, workspace) || [];
      Logger.log(`📥 [DteIngestionAgent] Se recuperaron ${recentDocs.length} documentos de Axteroid.`);
    } catch (e) {
      Logger.log(`❌ [DteIngestionAgent] Error consultando Axteroid: ${e.message}`);
      return { success: false, error: e.message, ingested: 0 };
    }

    let newlyIngested = 0;
    let skippedAlreadyProcessed = 0;
    let missingPoCount = 0;
    const queuedForReconciliation = [];

    // 2. Procesar cada DTE para extraer XML, items y número de Orden de Compra
    for (const doc of recentDocs) {
      const docKey = `${doc.type || 'CL33'}_${doc.serial || doc.id}`;

      // Si ya fue procesado y no se fuerza relectura, saltar
      if (!options.forceAll && processedMap[docKey]) {
        skippedAlreadyProcessed++;
        continue;
      }

      try {
        const enrichedDoc = this.ingestSingleDoc(doc, workspace);

        if (enrichedDoc.hasPo) {
          queuedForReconciliation.push(enrichedDoc);
          newlyIngested++;
          processedMap[docKey] = {
            status: 'QUEUED_FOR_MATCHING',
            po: enrichedDoc.poNumber,
            date: new Date().toISOString()
          };
        } else {
          missingPoCount++;
          processedMap[docKey] = {
            status: 'NO_PO_REFERENCE',
            date: new Date().toISOString()
          };
          Logger.log(`⚠️ [DteIngestionAgent] Folio ${doc.serial} no tiene referencia a Orden de Compra.`);
        }
      } catch (docErr) {
        Logger.log(`⚠️ [DteIngestionAgent] Error procesando documento ${doc.serial || doc.id}: ${docErr.message}`);
      }
    }

    // 3. Persistir mapa de procesados y actualizar cola para Agente 2
    this._saveProcessedMap(processedMap);
    this._appendPendingQueue(queuedForReconciliation);

    const duration = ((new Date().getTime() - startTime) / 1000).toFixed(2);
    const summary = {
      success: true,
      duration_seconds: duration,
      retrieved_from_api: recentDocs.length,
      newly_ingested: newlyIngested,
      queued_for_matching: queuedForReconciliation.length,
      skipped_already_processed: skippedAlreadyProcessed,
      missing_po_reference: missingPoCount
    };

    Logger.log(`✅ [DteIngestionAgent] Ciclo completado en ${duration}s: ${JSON.stringify(summary)}`);
    return summary;
  },

  /**
   * Ingesta y enriquece un único documento DTE (extrae XML e ítems).
   * @param {Object} doc Objeto resumen de Axteroid
   * @param {string} workspace Tenant de Axteroid
   */
  ingestSingleDoc(doc, workspace) {
    const docId = doc.id;
    let xmlText = null;
    let parsedXml = null;

    // Intentar obtener y parsear el XML oficial del SII
    try {
      xmlText = fetchAxteroidXml(docId, workspace);
      if (xmlText && typeof parseDteXml === 'function') {
        parsedXml = parseDteXml(xmlText);
      }
    } catch (eXml) {
      Logger.log(`[DteIngestionAgent] Aviso obteniendo XML para doc ${docId}: ${eXml.message}`);
    }

    // Identificar la Orden de Compra
    let poNumber = doc.order_reference || null;
    if (!poNumber && parsedXml && parsedXml.referencias) {
      const refPo = parsedXml.referencias.find(r => r.is_po || r.tipo === '801');
      if (refPo) poNumber = refPo.folio;
    }

    const items = (parsedXml && parsedXml.items && parsedXml.items.length > 0)
      ? parsedXml.items
      : [];

    return {
      docId: docId,
      serial: doc.serial,
      type: doc.type || 'CL33',
      supplier_tax_id: doc.supplier_tax_id || (parsedXml && parsedXml.emisor ? parsedXml.emisor.rut : null),
      supplier_name: doc.supplier_name || (parsedXml && parsedXml.emisor ? parsedXml.emisor.razon_social : null),
      amount_net: doc.amount_net || (parsedXml && parsedXml.totales ? parsedXml.totales.neto : 0),
      amount_total: doc.amount_total || (parsedXml && parsedXml.totales ? parsedXml.totales.total : 0),
      date: doc.date || (parsedXml ? parsedXml.fecha_emision : null),
      poNumber: poNumber,
      hasPo: !!poNumber,
      parsedItems: items,
      rawXmlAvailable: !!xmlText
    };
  },

  // Helpers de persistencia en ScriptProperties
  _getProcessedMap() {
    try {
      const raw = PropertiesService.getScriptProperties().getProperty(AGENTS_CONFIG.STATE_KEYS.PROCESSED_INVOICES);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  _saveProcessedMap(map) {
    try {
      const keys = Object.keys(map);
      if (keys.length > 2000) {
        const pruned = {};
        keys.slice(-1500).forEach(k => { pruned[k] = map[k]; });
        PropertiesService.getScriptProperties().setProperty(AGENTS_CONFIG.STATE_KEYS.PROCESSED_INVOICES, JSON.stringify(pruned));
      } else {
        PropertiesService.getScriptProperties().setProperty(AGENTS_CONFIG.STATE_KEYS.PROCESSED_INVOICES, JSON.stringify(map));
      }
    } catch (e) {
      Logger.log('[DteIngestionAgent] Error guardando estado de procesados: ' + e.message);
    }
  },

  _appendPendingQueue(items) {
    if (!items || items.length === 0) return;
    try {
      const props = PropertiesService.getScriptProperties();
      const currentRaw = props.getProperty(AGENTS_CONFIG.STATE_KEYS.PENDING_RECONCILIATION);
      let queue = currentRaw ? JSON.parse(currentRaw) : [];
      items.forEach(newItem => {
        if (!queue.some(q => q.serial === newItem.serial)) {
          queue.push(newItem);
        }
      });
      props.setProperty(AGENTS_CONFIG.STATE_KEYS.PENDING_RECONCILIATION, JSON.stringify(queue));
    } catch (e) {
      Logger.log('[DteIngestionAgent] Error actualizando cola de conciliación: ' + e.message);
    }
  }
};

// ============================================================================
// 🤖 AGENTE 2: ReconciliationAgent (Motor Autónomo de Agente Conciliador)
// ============================================================================

const ReconciliationAgent = {

  /**
   * Ejecuta el ciclo autónomo del Agente Conciliador.
   * Procesa la cola de facturas pendientes, consulta BigQuery y ejecuta CruceEngine.
   * @param {Object} options { maxBatchSize, autoQueueSap }
   * @returns {Object} Resumen de resultados de conciliación
   */
  run(options = {}) {
    const startTime = new Date().getTime();
    Logger.log('⚡ [ReconciliationAgent] Iniciando ciclo del Agente Conciliador...');

    const queue = this._getPendingQueue();
    const maxBatch = options.maxBatchSize || Math.max(queue.length, 250);

    if (queue.length === 0) {
      Logger.log('ℹ️ [ReconciliationAgent] No hay facturas pendientes en cola.');
      return { success: true, processed: 0, message: 'Cola vacía.' };
    }

    const batch = queue.splice(0, maxBatch);
    const results = [];
    let perfectMatches = 0;
    let discrepanciesCount = 0;
    let poErrorsCount = 0;

    // PRE-CARGA MASIVA: Consulta unificada de todas las POs del lote en BigQuery
    const allPoNumbers = batch.map(d => d.poNumber).filter(Boolean);
    const massivePoMap = (typeof getMassivePurchaseOrders === 'function')
      ? getMassivePurchaseOrders(allPoNumbers)
      : {};

    for (const pendingDoc of batch) {
      try {
        const poDataPreloaded = massivePoMap[pendingDoc.poNumber] ||
          (typeof extraerPoBaseDigits === 'function' ? massivePoMap[extraerPoBaseDigits(pendingDoc.poNumber)] : null) ||
          null;
        const reconResult = this.reconcileInvoice(pendingDoc, poDataPreloaded);
        results.push(reconResult);

        if (reconResult.status === 'MATCHED_PERFECT') {
          perfectMatches++;
          // Si calza conforme, encolar automáticamente en SapJevAgent
          if (AGENTS_CONFIG.RECONCILIATION.AUTO_APPROVE_PERFECT_MATCH && typeof SapJevAgent !== 'undefined') {
            SapJevAgent.queueJev(reconResult);
          }
        } else if (reconResult.status === 'PO_NOT_FOUND') {
          poErrorsCount++;
        } else {
          discrepanciesCount++;
          // Facturas con discrepancia también se pueden encolar para que el usuario o el agente
          // construya el asiento provisional con la cuenta 11090200 (Reclamos a Proveedores)
          if (typeof SapJevAgent !== 'undefined') {
            SapJevAgent.queueJev(reconResult);
          }
        }
      } catch (err) {
        Logger.log(`❌ [ReconciliationAgent] Error en folio ${pendingDoc.serial}: ${err.message}`);
        results.push({
          serial: pendingDoc.serial,
          status: 'ERROR',
          error: err.message
        });
      }
    }

    // Guardar el remanente de la cola
    this._savePendingQueue(queue);

    const duration = ((new Date().getTime() - startTime) / 1000).toFixed(2);
    const summary = {
      success: true,
      duration_seconds: duration,
      processed: batch.length,
      perfect_matches: perfectMatches,
      discrepancies: discrepanciesCount,
      po_errors: poErrorsCount,
      remaining_in_queue: queue.length,
      results: results
    };

    Logger.log(`✅ [ReconciliationAgent] Ciclo completado en ${duration}s: ${JSON.stringify(summary)}`);
    return summary;
  },

  /**
   * Reconcilia exhaustivamente un DTE contra BigQuery usando CruceEngine.gs.
   * @param {Object} pendingDoc Objeto DTE encolado
   * @param {Object} [preloadedPoData] Datos de la PO precargados de la consulta masiva
   * @returns {Object} Diagnóstico y evaluación del Agente Conciliador
   */
  reconcileInvoice(pendingDoc, preloadedPoData) {
    const poNumber = pendingDoc.poNumber;
    if (!poNumber) {
      return {
        serial: pendingDoc.serial,
        poNumber: null,
        status: 'NO_PO_NUMBER',
        verdict: 'Documento sin Orden de Compra asociada.'
      };
    }

    // 1. Obtener ítems y recepciones desde BigQuery (priorizando la consulta masiva)
    let poData = preloadedPoData;
    if (!poData) {
      try {
        poData = getPurchaseOrderItems(poNumber);
      } catch (eBq) {
        Logger.log(`[ReconciliationAgent] Fallo consultando BQ para ${poNumber}: ${eBq.message}`);
      }
    }

    if (!poData || !poData.po_found) {
      return {
        serial: pendingDoc.serial,
        poNumber: poNumber,
        status: 'PO_NOT_FOUND',
        verdict: `La OC ${poNumber} no existe o no tiene recepciones en el almacén de destino.`,
        monto_a_reclamar: pendingDoc.amount_net || 0
      };
    }

    // 2. Preparar invoiceData para CruceEngine
    let invoiceData = {
      folio: String(pendingDoc.serial),
      tipo_dte: pendingDoc.type || '33',
      fecha_emision: pendingDoc.date,
      emisor: {
        rut: pendingDoc.supplier_tax_id || poData.supplier_tax_id || '-',
        razon_social: pendingDoc.supplier_name || poData.supplier_name || 'Proveedor'
      },
      totales: {
        neto: pendingDoc.amount_net,
        total: pendingDoc.amount_total
      },
      referencias: [{ tipo: '801', folio: poNumber, is_po: true }],
      items: pendingDoc.parsedItems || []
    };

    // Si el XML no tenía ítems desglosados, proyectar desde la OC
    if (!invoiceData.items || invoiceData.items.length === 0) {
      invoiceData.items = (poData.items || []).map((it, idx) => ({
        linea: idx + 1,
        codigo: it.supplier_sku || it.sku_id || ('ITEM-' + (idx + 1)),
        tipo_codigo: 'INT1',
        descripcion: it.product_name || 'Ítem Facturado',
        cantidad_facturada: it.quantity_ordered || it.quantity_delivered || 1,
        unidad_medida: 'UN',
        precio_facturado: it.cost_unit_lc || 0,
        monto_facturado: it.amt_ordered_lc || ((it.quantity_ordered || 1) * (it.cost_unit_lc || 0))
      }));
    }

    // 3. Ejecutar cruce con CruceEngine.gs
    const cruce = ejecutarCruceSkuPorSku(invoiceData, poData);
    const resumen = cruce.resumen || {};
    const montoReclamar = Number(resumen.total_monto_a_reclamar || resumen.total_monto_reclamar || 0);
    const faltanteFisico = Number(resumen.total_faltante_recepcion || 0);
    const descalcePrecio = Number(resumen.total_descalce_precio || 0);
    const noEnOc = Number(resumen.total_no_en_oc || 0);

    // 4. Determinar veredicto según umbrales de tolerancia
    let status = 'MATCHED_PERFECT';
    let verdict = 'Recepción y precios 100% conformes.';

    if (montoReclamar <= AGENTS_CONFIG.RECONCILIATION.AMOUNT_TOLERANCE_CLP) {
      status = 'MATCHED_PERFECT';
      verdict = 'Conforme (dentro de tolerancia de redondeo de $1 CLP).';
    } else {
      if (faltanteFisico > 0 && descalcePrecio > 0) {
        status = 'DISCREPANCY_MIXED';
        verdict = `Discrepancia mixta: Faltante físico ($${faltanteFisico.toLocaleString('es-CL')}) y Desvío de precio ($${descalcePrecio.toLocaleString('es-CL')}).`;
      } else if (faltanteFisico > 0) {
        status = 'DISCREPANCY_SHORTAGE';
        verdict = `Faltante físico en bodega por $${faltanteFisico.toLocaleString('es-CL')} (Requiere NC).`;
      } else if (descalcePrecio > 0) {
        status = 'DISCREPANCY_PRICE';
        verdict = `Sobreprecio respecto a la OC por $${descalcePrecio.toLocaleString('es-CL')} (PPV).`;
      } else if (noEnOc > 0) {
        status = 'DISCREPANCY_UNORDERED';
        verdict = `Ítems facturados no presentes en la OC por $${noEnOc.toLocaleString('es-CL')}.`;
      } else {
        status = 'DISCREPANCY_GENERAL';
        verdict = `Diferencia de liquidación neta por $${montoReclamar.toLocaleString('es-CL')}.`;
      }
    }

    return {
      serial: pendingDoc.serial,
      poNumber: poNumber,
      supplier_name: invoiceData.emisor.razon_social,
      supplier_rut: invoiceData.emisor.rut,
      status: status,
      verdict: verdict,
      total_facturado_neto: resumen.total_facturado_neto || pendingDoc.amount_net,
      total_recepcionado_neto: resumen.total_recepcionado_neto || 0,
      monto_a_reclamar: montoReclamar,
      desglose: {
        faltante_fisico: faltanteFisico,
        descalce_precio: descalcePrecio,
        no_en_oc: noEnOc
      },
      resumen: {
        total_facturado_neto: resumen.total_facturado_neto || pendingDoc.amount_net,
        total_recepcionado_neto: resumen.total_recepcionado_neto || 0,
        total_monto_a_reclamar: montoReclamar,
        total_faltante_recepcion: faltanteFisico,
        total_descalce_precio: descalcePrecio,
        total_no_en_oc: noEnOc,
        folio_factura: pendingDoc.serial,
        po_referencia: poNumber,
        proveedor_nombre: invoiceData.emisor.razon_social,
        proveedor_rut: invoiceData.emisor.rut,
        fecha_emision: pendingDoc.date
      },
      lineas: cruce.lineas || [],
      lineas_auditadas: (cruce.lineas || []).length
    };
  },

  // Helpers de cola pendiente
  _getPendingQueue() {
    try {
      const raw = PropertiesService.getScriptProperties().getProperty(AGENTS_CONFIG.STATE_KEYS.PENDING_RECONCILIATION);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  _savePendingQueue(queue) {
    try {
      PropertiesService.getScriptProperties().setProperty(
        AGENTS_CONFIG.STATE_KEYS.PENDING_RECONCILIATION,
        JSON.stringify(queue.slice(0, 500))
      );
    } catch (e) {
      Logger.log('[ReconciliationAgent] Error guardando cola: ' + e.message);
    }
  }
};

// ============================================================================
// 🤖 AGENTE 3: SapJevAgent (Contabilizador Automático Sociedad 6202)
// ============================================================================

const SapJevAgent = {

  /**
   * Encola un resultado de conciliación para generación de asiento contable JEV.
   * Invocado por ReconciliationAgent o manualmente desde la WebApp.
   * @param {Object} reconResult Objeto resultado de reconciliación
   */
  queueJev(reconResult) {
    if (!reconResult || !reconResult.serial) return;
    try {
      const queue = this._getJevQueue();
      // Evitar duplicados por serial
      if (!queue.some(q => q.serial === reconResult.serial)) {
        queue.push({
          queued_at: new Date().toISOString(),
          reconResult: reconResult,
          serial: reconResult.serial,
          poNumber: reconResult.poNumber,
          status: 'PENDING_GENERATION'
        });
        this._saveJevQueue(queue);
        Logger.log(`📥 [SapJevAgent] Folio ${reconResult.serial} encolado para generación de JEV.`);
      }
    } catch (e) {
      Logger.log(`❌ [SapJevAgent] Error encolando JEV para folio ${reconResult.serial}: ${e.message}`);
    }
  },

  /**
   * Ejecuta el ciclo de procesamiento y contabilización JEV.
   * Procesa la cola de asientos pendientes, valida la partida doble y genera el CSV/payload.
   * @param {Object} options { maxBatchSize, autoArchive }
   * @returns {Object} Resumen del lote de asientos generados
   */
  run(options = {}) {
    const startTime = new Date().getTime();
    Logger.log('🏛️ [SapJevAgent] Iniciando ciclo de generación contable SAP JEV (Sociedad 6202)...');

    const queue = this._getJevQueue();
    const maxBatch = options.maxBatchSize || Math.max(queue.length, 250);

    if (queue.length === 0) {
      Logger.log('ℹ️ [SapJevAgent] No hay asientos JEV pendientes en cola.');
      return { success: true, processed: 0, message: 'Cola de JEV vacía.' };
    }

    const batch = queue.splice(0, maxBatch);
    const generatedVouchers = [];
    const claimsGenerated = [];
    let balancedCount = 0;
    let failedCount = 0;

    for (const item of batch) {
      try {
        const jevOutput = this.buildAndValidateJev(item.reconResult);
        
        if (jevOutput.totals.is_balanced) {
          balancedCount++;
          generatedVouchers.push(jevOutput);

          // Si el asiento incluye cuentas de reclamo a proveedores (11090200 o 11090300)
          // se genera automáticamente el detalle del reclamo de Nota de Crédito (NC)
          if (jevOutput.claim_summary && jevOutput.claim_summary.has_claim) {
            claimsGenerated.push(jevOutput.claim_summary);
          }

          Logger.log(`✅ [SapJevAgent] JEV ${jevOutput.header.voucher_id} generado y BALANCEADO ($${jevOutput.totals.total_debits.toLocaleString('es-CL')}).`);
        } else {
          failedCount++;
          Logger.log(`⚠️ [SapJevAgent] Asiento DESBALANCEADO para folio ${item.serial}. Diferencia: $${jevOutput.totals.difference}`);
        }
      } catch (err) {
        failedCount++;
        Logger.log(`❌ [SapJevAgent] Error generando JEV para folio ${item.serial}: ${err.message}`);
      }
    }

    // Guardar el remanente de la cola
    this._saveJevQueue(queue);
    
    // Archivar vouchers exitosos
    if (generatedVouchers.length > 0) {
      this._archiveGeneratedJevs(generatedVouchers);
    }

    const duration = ((new Date().getTime() - startTime) / 1000).toFixed(2);
    const summary = {
      success: true,
      duration_seconds: duration,
      processed: batch.length,
      balanced_vouchers: balancedCount,
      failed_vouchers: failedCount,
      claims_generated: claimsGenerated.length,
      remaining_in_queue: queue.length,
      vouchers: generatedVouchers.map(v => ({
        voucher_id: v.header.voucher_id,
        folio: v.audit_summary.folio_factura,
        po: v.audit_summary.po_number,
        total_monto: v.totals.total_debits,
        has_claim: v.claim_summary.has_claim,
        monto_reclamo: v.claim_summary.total_claim_amount
      }))
    };

    Logger.log(`✅ [SapJevAgent] Ciclo JEV finalizado en ${duration}s: ${JSON.stringify(summary)}`);
    return summary;
  },

  /**
   * Construye, valida y estructura el Journal Entry Voucher a partir del cruce.
   * Utiliza la lógica contable maestra de JournalEntryVoucher.gs.
   * @param {Object} reconResult Resultado entregado por CruceEngine o ReconciliationAgent
   */
  buildAndValidateJev(reconResult) {
    if (!reconResult) throw new Error('Resultado de conciliación requerido.');

    // 1. Configurar parámetros de la póliza para Sociedad 6202
    const options = {
      companyCode: AGENTS_CONFIG.SAP_JEV.COMPANY_CODE,
      costCenter: AGENTS_CONFIG.SAP_JEV.COST_CENTER,
      includeTax: true,
      postingDate: formatearFechaIso(new Date()),
      voucherId: `JEV-6202-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${reconResult.serial || '0000'}`
    };

    // 2. Invocar generador de póliza balanceada (JournalEntryVoucher.gs)
    const jev = generarJournalEntryVoucher(reconResult, options);

    // 3. Evaluar y desglosar reclamos comerciales (Notas de Crédito a solicitar)
    let totalClaim = 0;
    const claimLines = jev.lines.filter(l => 
      l.account === JEV_CONFIG.CUENTAS.RECLAMO_FALTANTE_RECEPCION.codigo ||
      l.account === JEV_CONFIG.CUENTAS.RECLAMO_ITEM_NO_ORDENADO.codigo
    );

    claimLines.forEach(l => { totalClaim += (l.debit || 0); });

    jev.claim_summary = {
      has_claim: totalClaim > 0,
      total_claim_amount: totalClaim,
      claim_lines_count: claimLines.length,
      supplier_rut: jev.audit_summary.proveedor_rut,
      supplier_name: jev.audit_summary.proveedor_nombre,
      folio_factura: jev.audit_summary.folio_factura,
      po_number: jev.audit_summary.po_number,
      recommendation: totalClaim > 0
        ? `Emitir reclamo formal de Nota de Crédito por $${totalClaim.toLocaleString('es-CL')} antes del día 8 ante el SII.`
        : 'Sin reclamos pendientes. Factura lista para pago según vencimiento comercial.'
    };

    // 4. Pre-generar el payload CSV exportable para el importador de SAP
    jev.sap_csv_export = exportarJevCsv(jev);

    return jev;
  },

  // Helpers de persistencia en ScriptProperties
  _getJevQueue() {
    try {
      const raw = PropertiesService.getScriptProperties().getProperty(AGENTS_CONFIG.STATE_KEYS.PENDING_JEV_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  _saveJevQueue(queue) {
    try {
      PropertiesService.getScriptProperties().setProperty(
        AGENTS_CONFIG.STATE_KEYS.PENDING_JEV_QUEUE,
        JSON.stringify(queue.slice(0, 500))
      );
    } catch (e) {
      Logger.log('[SapJevAgent] Error guardando cola JEV: ' + e.message);
    }
  },

  _archiveGeneratedJevs(vouchers) {
    try {
      const props = PropertiesService.getScriptProperties();
      const raw = props.getProperty(AGENTS_CONFIG.STATE_KEYS.GENERATED_JEVS_ARCHIVE);
      let archive = raw ? JSON.parse(raw) : [];
      
      vouchers.forEach(v => {
        archive.push({
          voucher_id: v.header.voucher_id,
          folio: v.audit_summary.folio_factura,
          po: v.audit_summary.po_number,
          supplier: v.audit_summary.proveedor_nombre,
          total_bruto: v.totals.total_debits,
          has_claim: v.claim_summary.has_claim,
          claim_amount: v.claim_summary.total_claim_amount,
          generated_at: new Date().toISOString()
        });
      });

      // Mantener los últimos 100 archivados
      if (archive.length > 100) archive = archive.slice(-100);
      props.setProperty(AGENTS_CONFIG.STATE_KEYS.GENERATED_JEVS_ARCHIVE, JSON.stringify(archive));
    } catch (e) {
      Logger.log('[SapJevAgent] Error archivando JEVs: ' + e.message);
    }
  },

  getArchivedJevs() {
    try {
      const raw = PropertiesService.getScriptProperties().getProperty(AGENTS_CONFIG.STATE_KEYS.GENERATED_JEVS_ARCHIVE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
};

// ============================================================================
// 🎮 ORQUESTADOR Y CONTROLADORES DE DISPARO (Triggers)
// ============================================================================

const AgentOrchestrator = {

  /**
   * Ejecuta el ciclo completo integrado:
   * Agente 1 (Ingesta) -> Agente 2 (Matching) -> Agente 3 (Contabilización SAP JEV).
   */
  runFullCycle() {
    Logger.log('🏁 [AgentOrchestrator] Iniciando ciclo de automatización integral (Agentes 1, 2 y 3)...');
    
    // Paso 1: Ingestar todos los DTEs nuevos sin tope de 50
    const ingestionSummary = DteIngestionAgent.run({ limit: AGENTS_CONFIG.INGESTION.BATCH_SIZE });
    
    // Paso 2: Ejecutar conciliación sobre toda la cola pendiente
    const reconciliationSummary = ReconciliationAgent.run({ maxBatchSize: 250 });

    // Paso 3: Generar pólizas contables JEV balanceadas para toda la cola
    const jevSummary = SapJevAgent.run({ maxBatchSize: 250 });

    const totalSummary = {
      timestamp: new Date().toISOString(),
      ingestion: ingestionSummary,
      reconciliation: reconciliationSummary,
      sap_jev: jevSummary
    };

    Logger.log('🏁 [AgentOrchestrator] Ciclo integral finalizado: ' + JSON.stringify(totalSummary));
    return totalSummary;
  },

  /**
   * Instala los disparadores de tiempo periódicos en Google Apps Script.
   * Ejecuta la sincronización, conciliación y JEV cada 1 hora automáticamente.
   */
  installTriggers() {
    this.uninstallTriggers(); // Limpiar previos para evitar duplicidad

    ScriptApp.newTrigger('triggerEjecutarAgentesAutonomos')
      .timeBased()
      .everyHours(1)
      .create();

    Logger.log('⏰ [AgentOrchestrator] Disparador horario instalado exitosamente.');
    return { success: true, message: 'Disparador horario activo (cada 1 hora).' };
  },

  /**
   * Elimina los disparadores activos de los agentes.
   */
  uninstallTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;
    for (const t of triggers) {
      if (t.getHandlerFunction() === 'triggerEjecutarAgentesAutonomos') {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    }
    Logger.log(`🧹 [AgentOrchestrator] Se eliminaron ${removed} disparadores previos.`);
    return { success: true, removedTriggers: removed };
  },

  /**
   * Obtiene el estado actual de las colas y contadores de los agentes.
   */
  getStatus() {
    const pendingMatching = ReconciliationAgent._getPendingQueue();
    const pendingJev = SapJevAgent._getJevQueue();
    const processed = DteIngestionAgent._getProcessedMap();
    const archivedJevs = SapJevAgent.getArchivedJevs();

    let isTriggerActive = false;
    try {
      const triggers = ScriptApp.getProjectTriggers();
      isTriggerActive = triggers.some(t => t.getHandlerFunction() === 'triggerEjecutarAgentesAutonomos');
    } catch (eTrig) {}

    return {
      pendingMatchingCount: pendingMatching.length,
      pendingJevCount: pendingJev.length,
      processedHistoryCount: Object.keys(processed).length,
      archivedJevsCount: archivedJevs.length,
      isTriggerActive: isTriggerActive,
      pendingMatchingPreview: pendingMatching.slice(0, 5),
      pendingJevPreview: pendingJev.slice(0, 5),
      archivedJevs: archivedJevs
    };
  },

  /**
   * Consulta y concilia una Orden de Compra específica a petición del usuario.
   * Ejecuta la conciliación con el Agente Conciliador en BigQuery y Axteroid, genera el JEV SAP 6202 y lo archiva.
   * @param {string} poInput Número de OC (ej. 526150 o PO526150)
   * @returns {Object} Resultado estructurado con diagnóstico ejecutivo
   */
  reconcileSpecificPo(poInput) {
    if (!poInput) {
      return { success: false, error: 'Debe ingresar un número de Orden de Compra válido.' };
    }
    const cleanPo = poInput.toString().trim().toUpperCase().replace(/\s+/g, '');
    const formattedPo = cleanPo.startsWith('PO') ? cleanPo : ('PO' + cleanPo.replace(/^OC/i, ''));
    Logger.log(`🤖 [AgentOrchestrator] Solicitud de conciliación bajo demanda para ${formattedPo}...`);

    if (typeof apiConsolidateAndReconcilePo !== 'function') {
      return { success: false, error: 'Motor de conciliación consolidada no disponible en Codigo.gs.' };
    }

    const reconRes = apiConsolidateAndReconcilePo(formattedPo);
    if (!reconRes.success) {
      return { success: false, error: reconRes.error };
    }

    const recData = reconRes.data.reconciliacion || {};
    const poInfo = reconRes.data.po_info || {};
    const facturaConsolidada = reconRes.data.factura || {};
    const invoicesList = reconRes.data.invoices || [];

    // Generar y validar asiento SAP JEV
    let jev = null;
    let sapCsv = '';
    try {
      if (typeof SapJevAgent !== 'undefined') {
        jev = SapJevAgent.buildAndValidateJev(recData);
        sapCsv = jev.sap_csv_export || '';
        SapJevAgent._archiveGeneratedJevs([jev]);
      }
    } catch (eJev) {
      Logger.log(`[AgentOrchestrator] Aviso generando JEV para ${formattedPo}: ${eJev.message}`);
    }

    const resumen = recData.resumen || {};
    const totalFacturadoNeto = Number(resumen.total_facturado_neto || 0);
    const totalRecepcionadoNeto = Number(resumen.total_recepcionado_neto || 0);
    const montoReclamar = Number(resumen.total_monto_a_reclamar || resumen.total_monto_reclamar || 0);
    const difMl = totalFacturadoNeto - totalRecepcionadoNeto;

    return {
      success: true,
      po: formattedPo,
      supplier_name: (facturaConsolidada.emisor && facturaConsolidada.emisor.razon_social) || poInfo.supplier_name || 'Proveedor',
      supplier_rut: (facturaConsolidada.emisor && facturaConsolidada.emisor.rut) || poInfo.supplier_tax_id || '-',
      almacen: poInfo.warehouse_name || 'CH_36_CD_Chile (Sociedad 6202)',
      invoices_count: invoicesList.length,
      invoices: invoicesList.map(inv => ({
        folio: inv.folio,
        monto_neto: inv.monto_neto,
        monto_total: inv.monto_total,
        fecha: inv.fecha,
        es_nc: inv.es_nc
      })),
      total_facturado_neto: totalFacturadoNeto,
      total_recepcionado_neto: totalRecepcionadoNeto,
      dif_ml: difMl,
      monto_a_reclamar: montoReclamar,
      desglose: {
        faltante_fisico: Number(resumen.total_faltante_recepcion || 0),
        descalce_precio: Number(resumen.total_descalce_precio || 0),
        no_en_oc: Number(resumen.total_no_en_oc || 0)
      },
      lineas_count: (recData.lineas || []).length,
      lineas_con_descalce: Number(resumen.lineas_con_descalce || 0),
      lineas_conformes: Number(resumen.lineas_conformes || 0),
      jev: jev ? {
        voucher_id: jev.header.voucher_id,
        is_balanced: jev.totals.is_balanced,
        total_debits: jev.totals.total_debits,
        total_credits: jev.totals.total_credits,
        has_claim: jev.claim_summary ? jev.claim_summary.has_claim : false,
        claim_amount: jev.claim_summary ? jev.claim_summary.total_claim_amount : 0
      } : null,
      sap_csv: sapCsv,
      reconciliation_data: recData
    };
  }
};

/**
 * Función global de entrada para el Trigger de Google Apps Script.
 */
function triggerEjecutarAgentesAutonomos() {
  return AgentOrchestrator.runFullCycle();
}
