const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');

// Cargar fixtures disponibles
let po521534Catalog = [];
let po521534Audit = null;
let po521015Audit = null;

try {
  let catPath = path.join(ROOT_DIR, 'data/fixtures/po521534_catalogo_inicial.json');
  if (!fs.existsSync(catPath)) catPath = path.join(ROOT_DIR, 'po521534_catalogo_inicial.json');
  if (fs.existsSync(catPath)) {
    po521534Catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  }
} catch (e) {
  console.warn('Advertencia cargando po521534_catalogo_inicial.json:', e.message);
}

try {
  let auditPath = path.join(ROOT_DIR, 'data/fixtures/po521534_audit_block.json');
  if (!fs.existsSync(auditPath)) auditPath = path.join(ROOT_DIR, 'po521534_audit_block.json');
  if (fs.existsSync(auditPath)) {
    po521534Audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  }
} catch (e) {
  console.warn('Advertencia cargando po521534_audit_block.json:', e.message);
}

try {
  let audit1015Path = path.join(ROOT_DIR, 'data/fixtures/po521015_audit_ready.json');
  if (!fs.existsSync(audit1015Path)) audit1015Path = path.join(ROOT_DIR, 'po521015_audit_ready.json');
  if (fs.existsSync(audit1015Path)) {
    po521015Audit = JSON.parse(fs.readFileSync(audit1015Path, 'utf8'));
  }
} catch (e) {
  console.warn('Advertencia cargando po521015_audit_ready.json:', e.message);
}

let indiceCompletoPos = [];
try {
  const indPath = path.join(ROOT_DIR, 'tests/indice_completo_pos_facturas.json');
  if (fs.existsSync(indPath)) {
    indiceCompletoPos = JSON.parse(fs.readFileSync(indPath, 'utf8'));
  }
} catch (e) {
  console.warn('Advertencia cargando indice_completo_pos_facturas.json:', e.message);
}

// Manejador central de llamadas RPC simuladas de Google Apps Script
function handleGasRpc(method, args) {
  console.log(`[GAS RPC Mock] Executing: ${method}`, JSON.stringify(args));

  switch (method) {
    case 'apiCargarFacturasAxteroidEnVivo': {
      return {
        success: true,
        sociedad: '6202',
        sociedad_nombre: 'Delivery Hero Stores Chile SpA (Sociedad 6202)',
        count: po521534Catalog.length,
        total_available: po521534Catalog.length,
        page: 1,
        has_more: false,
        next_page: null,
        bq_telemetry: {
          queries_executed: 1,
          queries_saved_by_cache: 4,
          pos_served_from_cache: 48,
          pos_queried_live: 12,
          origin_fallback_hits: 0,
          cache_hit_rate_pct: 80
        },
        invoices: po521534Catalog
      };
    }
    case 'apiGetDataRefreshAndConsumptionStatus': {
      return {
        success: true,
        axteroid_cadence: 'Tiempo Real (API /rec-docs + SII XML)',
        bigquery: {
          checked_at: new Date().toISOString(),
          cache_epoch: 'v1',
          tables: [
            { id: 'purchase_orders_sku_level', last_modified_iso: new Date().toISOString(), row_count: 142580, status: 'ACTIVA_CACHE_INTELIGENTE' },
            { id: 'dim_vendor_product', last_modified_iso: new Date().toISOString(), row_count: 85420, status: 'ACTIVA_CACHE_INTELIGENTE' },
            { id: 'sap_report_3wm', last_modified_iso: new Date().toISOString(), row_count: 20543, status: 'ACTIVA_CACHE_INTELIGENTE' },
            { id: 'cl_dmarts_purchase_orders', last_modified_iso: new Date().toISOString(), row_count: 21200, status: 'RESPALDO_TIEMPO_REAL' }
          ],
          telemetry: {
            queries_executed: 1,
            queries_saved_by_cache: 4,
            pos_served_from_cache: 48,
            pos_queried_live: 12,
            origin_fallback_hits: 0,
            cache_hit_rate_pct: 80
          }
        }
      };
    }
    case 'apiPurgeBigQuerySmartCache': {
      return {
        success: true,
        purge: { success: true, new_epoch: 'v2' },
        bigquery: {
          checked_at: new Date().toISOString(),
          tables: [],
          telemetry: {
            queries_executed: 0,
            queries_saved_by_cache: 0,
            pos_served_from_cache: 0,
            pos_queried_live: 0,
            origin_fallback_hits: 0,
            cache_hit_rate_pct: 100
          }
        }
      };
    }
    case 'apiGetIndexedPoList': {
      const filtros = (args && args[0]) || {};
      let lista = [...indiceCompletoPos];
      if (filtros.busqueda) {
        const q = String(filtros.busqueda).toUpperCase().trim();
        const rawDigits = q.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
        lista = lista.filter(po => {
          const matchPo = (po.po_number || '').toUpperCase().includes(q) || (rawDigits && (po.base_digits || '').includes(rawDigits));
          const matchProv = (po.supplier_name || '').toUpperCase().includes(q);
          const matchRut = (po.supplier_tax_id || '').toUpperCase().includes(q);
          const matchWh = (po.warehouse_name || '').toUpperCase().includes(q);
          const matchFac = (po.facturas || []).some(f => (f.folio || '').includes(q) || (rawDigits && (f.folio || '').includes(rawDigits)));
          return matchPo || matchProv || matchRut || matchWh || matchFac;
        });
      }
      if (filtros.solo_con_facturas) {
        lista = lista.filter(po => po.total_facturas > 0);
      }
      if (filtros.solo_diferencias) {
        lista = lista.filter(po => {
          const d = Number(po.diferencia_ml !== undefined ? po.diferencia_ml : po.diferencia_preliminar) || 0;
          return Math.abs(d) > 100;
        });
      }
      const page = parseInt(filtros.page) || 1;
      const limit = parseInt(filtros.limit) || 25;
      const totalCount = lista.length;
      const startIndex = (page - 1) * limit;
      const paginated = lista.slice(startIndex, startIndex + limit).map(po => {
        const d = Number(po.diferencia_ml !== undefined ? po.diferencia_ml : po.diferencia_preliminar) || 0;
        return {
          ...po,
          diferencia_ml: d,
          diferencia_preliminar: d
        };
      });
      return {
        success: true,
        total_pos: totalCount,
        page: page,
        limit: limit,
        total_pages: Math.ceil(totalCount / limit),
        pos: paginated
      };
    }

    case 'apiGetIndexedPoDetail': {
      const poNum = ((args && args[0]) || '').toString().toUpperCase().trim();
      const rawDigits = poNum.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
      const found = indiceCompletoPos.find(p =>
        (p.po_number || '').toUpperCase() === poNum ||
        p.base_digits === rawDigits ||
        (p.facturas || []).some(f => f.folio === poNum || f.folio === rawDigits)
      );
      if (found) {
        return { success: true, po: found };
      }
      return { success: false, error: 'Orden de Compra no encontrada en el índice.' };
    }
    case 'apiUniversalSearch': {
      const query = (args[0] || '').toString().trim();
      const rawDigits = query.toUpperCase().replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');

      // Caso 1: PO 521534 (Embonor)
      if (rawDigits === '521534' || query.toUpperCase().includes('521534')) {
        const invoices = po521534Catalog.map(inv => ({
          ...inv,
          monto_neto: inv.monto_neto,
          monto_total: inv.monto_total || Math.round(inv.monto_neto * 1.19),
          oc_asociada: 'PO521534',
          order_reference: '0000521534',
          aforo_tipo: 'Bebestibles - Ambiente (Coca-Cola Embonor)',
          almacen: 'CH_8_Vina del Mar (Sociedad 6202)'
        }));

        const totalNeto = invoices.reduce((acc, f) => acc + (f.monto_neto || 0), 0);

        return {
          success: true,
          po_number: 'PO521534',
          po_found: true,
          supplier_name: 'Coca-Cola Embonor S.A. (Bebestibles)',
          supplier_tax_id: '93281000-K',
          warehouse_name: 'CH_8_Vina del Mar (Sociedad 6202)',
          total_oc_ordenado: po521534Audit ? po521534Audit.total_ordenado_neto : 2433481,
          total_oc_recepcionado: po521534Audit ? po521534Audit.total_recepcionado_neto : 1827308,
          total_facturado_neto: totalNeto,
          total_facturas_monto_neto: totalNeto,
          total_facturas: invoices.length,
          diferencia_preliminar: (po521534Audit ? po521534Audit.total_ordenado_neto : 2433481) - (po521534Audit ? po521534Audit.total_recepcionado_neto : 1827308),
          invoices: invoices,
          po_data: {
            po_order_id: 'PO521534',
            items: po521534Audit ? po521534Audit.all_po_items : []
          }
        };
      }

      // Caso 2: PO 517979 (Carozzi)
      if (rawDigits === '517979' || query.toUpperCase().includes('517979')) {
        return {
          success: true,
          po_number: 'PO517979',
          po_found: true,
          supplier_name: 'Empresas Carozzi S.A.',
          supplier_tax_id: '96591040-9',
          warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
          total_oc_ordenado: 28619421,
          total_oc_recepcionado: 12388682,
          total_facturado_neto: 22068769,
          total_facturas_monto_neto: 22068769,
          total_facturas: 8,
          diferencia_preliminar: 9680118,
          invoices: [
            {
              folio: '22586659',
              proveedor: 'Empresas Carozzi S.A.',
              rut: '96591040-9',
              fecha: '2026-09-15',
              monto_neto: 1450200,
              monto_total: 1725738,
              oc_asociada: 'PO517979',
              aforo_tipo: 'CONFITERÍA Y GALLETAS (Aforado)',
              almacen: 'CH_36_CD_Chile',
              items: [
                { linea: 1, codigo: 'UHBPGV', ean: 'UHBPGV', descripcion: 'Galleta Sabor Pie de Limón Gretel 85 g', cantidad_facturada: 120, precio_facturado: 938, monto_facturado: 112560 }
              ]
            }
          ],
          po_data: {
            po_order_id: 'PO517979',
            items: []
          }
        };
      }

      // Caso 2.5: PO 518183 (Lo Valledor / Iquique) o búsqueda por "518183", "valledor", "choclo", "90I591"
      if (rawDigits === '518183' || query.toUpperCase().includes('518183') || query.toLowerCase().includes('valledor') || query.toLowerCase().includes('choclo') || query.toUpperCase().includes('90I591')) {
        let po518183Items = [];
        try {
          const pPath = path.join(ROOT_DIR, 'po518183_items.json');
          if (fs.existsSync(pPath)) {
            po518183Items = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          }
        } catch (e) { }

        return {
          success: true,
          po_number: 'PO518183',
          po_found: true,
          supplier_name: 'Mercado Lo Valledor (Regiones)',
          supplier_tax_id: '78185379-8',
          warehouse_name: 'CH_38_Iquique',
          total_oc_ordenado: 558807,
          total_oc_recepcionado: 465280,
          total_facturado_neto: 0,
          total_facturas_monto_neto: 0,
          total_facturas: 0,
          diferencia_preliminar: 93527,
          invoices: [],
          po_data: {
            po_order_id: 'PO518183',
            supplier_name: 'Mercado Lo Valledor (Regiones)',
            supplier_tax_id: '78185379-8',
            warehouse_name: 'CH_38_Iquique',
            items: po518183Items
          }
        };
      }

      // Caso 2.8: PO 519527 (Ideal S.A. / Grupo Bimbo - CH_24 El Belloto)
      if (rawDigits === '519527' || query.toUpperCase().includes('519527') || query.toLowerCase().includes('ideal') || query.toLowerCase().includes('bimbo') || query.toLowerCase().includes('nutrabien')) {
        let po519527Audit = null;
        try {
          const pPath = path.join(ROOT_DIR, 'tests/po519527_audit_block.js');
          if (fs.existsSync(pPath)) {
            const raw = fs.readFileSync(pPath, 'utf8');
            po519527Audit = JSON.parse(raw.replace(/^const PO519527_AUDIT_DATA =\s*/, '').replace(/;\s*$/, ''));
          }
        } catch (e) { }

        const inv56458220 = po519527Audit ? po519527Audit.facturas['56458220'] : null;
        const invoices = inv56458220 ? [{
          folio: '56458220',
          proveedor: 'Ideal S.A. (Grupo Bimbo)',
          rut: '82623500-4',
          fecha: '2026-09-25',
          monto_neto: 1033571,
          monto_total: 1229948,
          oc_asociada: 'PO519527',
          order_reference: '519527',
          aforo_tipo: 'Panadería y Snacks (Ideal S.A.)',
          almacen: 'CH_24_El Belloto (Sociedad 6202)',
          ax_doc_id: 'do_AAABoNmiZ3502o7z',
          items: inv56458220.items,
          po_items: po519527Audit ? po519527Audit.all_po_items : []
        }] : [];

        return {
          success: true,
          po_number: 'PO519527',
          po_found: true,
          supplier_name: 'Ideal S.A. (Grupo Bimbo)',
          supplier_tax_id: '82623500-4',
          warehouse_name: 'CH_24_El Belloto (Sociedad 6202)',
          total_oc_ordenado: 1181837,
          total_oc_recepcionado: 996268,
          total_facturado_neto: 1033571,
          total_facturas_monto_neto: 1033571,
          total_facturas: invoices.length,
          diferencia_preliminar: 37303,
          invoices: invoices,
          po_data: {
            po_order_id: 'PO519527',
            items: po519527Audit ? po519527Audit.all_po_items : []
          }
        };
      }

      // Caso 2.9: PO 524064 (Distribución y Excelencia S.A. Desa - CH_6 La Serena)
      if (rawDigits === '524064' || query.toUpperCase().includes('524064') || query.toLowerCase().includes('desa')) {
        const invoices = [
          {
            folio: '10207759',
            proveedor: 'Distribución y Excelencia S.A. (Desa)',
            rut: '96568970-2',
            fecha: '2026-10-09',
            monto_neto: 477667,
            monto_total: 660358,
            oc_asociada: 'PO524064',
            order_reference: 'po524064',
            aforo_tipo: 'Licores y Vinos (Desa)',
            almacen: 'CH_6_La Serena (Sociedad 6202)',
            ax_doc_id: 'do_AAABoR8NHdtRW8H1',
            tipo_dte: 'CL33',
            tipo_documento: 'Factura Electrónica',
            es_nc: false
          },
          {
            folio: '10207760',
            proveedor: 'Distribución y Excelencia S.A. (Desa)',
            rut: '96568970-2',
            fecha: '2026-10-09',
            monto_neto: 59830,
            monto_total: 80659,
            oc_asociada: 'PO524064',
            order_reference: 'po524064',
            aforo_tipo: 'Licores y Vinos (Desa)',
            almacen: 'CH_6_La Serena (Sociedad 6202)',
            ax_doc_id: 'do_AAABoR8M8nu064Rv',
            tipo_dte: 'CL33',
            tipo_documento: 'Factura Electrónica',
            es_nc: false
          },
          {
            folio: '6363032',
            proveedor: 'Distribución y Excelencia S.A. (Desa)',
            rut: '96568970-2',
            fecha: '2026-10-13',
            monto_neto: 2067,
            monto_total: 2591,
            oc_asociada: 'PO524064',
            order_reference: 'po524064',
            aforo_tipo: 'NOTA DE CRÉDITO (DTE 61)',
            almacen: 'CH_6_La Serena (Sociedad 6202)',
            ax_doc_id: 'do_AAABoTgESzwpdwmM',
            tipo_dte: 'CL61',
            tipo_documento: 'Nota de Crédito',
            es_nc: true
          }
        ];

        return {
          success: true,
          po_number: 'PO524064',
          po_found: true,
          supplier_name: 'Distribución y Excelencia S.A. (Desa)',
          supplier_tax_id: '96568970-2',
          warehouse_name: 'CH_6_La Serena (Sociedad 6202)',
          total_oc_ordenado: 526094,
          total_oc_recepcionado: 495202,
          total_facturado_neto: 535430,
          total_facturado_total: 738426,
          total_ncs_neto: 2067,
          total_ncs_total: 2591,
          count_ncs: 1,
          count_facturas: 2,
          total_facturas: 3,
          diferencia_preliminar_clp: 40228,
          dif_ml: 40228,
          invoices: invoices,
          po_data: {
            po_order_id: 'PO524064',
            supplier_id: '12046',
            supplier_name: 'Desa',
            supplier_tax_id: '96568970-2',
            warehouse_name: 'CH_6_La Serena',
            items: []
          }
        };
      }

      // Caso 3: Búsqueda por Folio específico
      if (/^\d{6,10}$/.test(query)) {
        const found = po521534Catalog.find(f => f.folio === query);
        if (found) {
          return {
            success: true,
            invoices: [found],
            po_found: false
          };
        }
      }

      // Caso 4: Proveedor Embonor
      if (query.toLowerCase().includes('embonor')) {
        return {
          success: true,
          invoices: po521534Catalog,
          po_found: false
        };
      }

      // Caso 5: Búsqueda dinámica en el Índice Maestro Completo (POs, Folios, Proveedores, RUTs)
      const qNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const rawNum = query.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
      const matchedPos = indiceCompletoPos.filter(po => {
        const pNum = (po.po_number || '').toLowerCase();
        const bDigits = po.base_digits || pNum.replace(/^po/i, '').replace(/^0+/, '');
        const pName = (po.supplier_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isDigits = /^\d+$/.test(rawNum);
        const qRut = qNorm.replace(/[^0-9k]/g, '');
        const matchPo = (qNorm.length >= 3 && pNum.includes(qNorm)) || (isDigits && rawNum.length >= 3 && bDigits.includes(rawNum));
        const matchName = qNorm.length >= 2 && pName.includes(qNorm);
        const matchRut = qRut.length >= 7 && pRut.includes(qRut);
        const matchFac = (po.facturas || []).some(f => {
          const fStr = String(f.folio);
          return (isDigits && rawNum.length >= 3 && fStr.includes(rawNum)) || (qNorm.length >= 4 && fStr.includes(qNorm));
        });
        return matchPo || matchName || matchRut || matchFac;
      });

      if (matchedPos.length > 0) {
        const allInvoices = [];
        let totalNeto = 0;
        let totalOrd = 0;
        let totalRec = 0;

        matchedPos.slice(0, 50).forEach(p => {
          totalOrd += Number(p.total_ordenado_neto) || 0;
          totalRec += Number(p.total_recepcionado_neto) || 0;
          (p.facturas || []).forEach(f => {
            const neto = Number(f.monto_neto) || 0;
            const total = Number(f.monto_total) || Math.round(neto * 1.19);
            totalNeto += neto;
            allInvoices.push({
              folio: String(f.folio),
              proveedor: f.supplier_name || p.supplier_name,
              rut: f.supplier_tax_id || p.supplier_tax_id || '-',
              fecha: f.date || p.created_date || '2026-03-24',
              monto_neto: neto,
              monto_total: total,
              oc_asociada: p.po_number,
              aforo_tipo: (matchedPos.length === 1) ? (p.condicion_aforo || 'ÍNDICE PO-FACTURAS') : 'BÚSQUEDA MULTI-OC',
              almacen: p.warehouse_name || 'CH_36_CD_Chile (Sociedad 6202)',
              items: [],
              ax_doc_id: f.id || ('mock_' + f.folio),
              tipo_doc: f.type || 'CL33',
              recepcionado_bodega: Number(p.total_recepcionado_neto) || 0,
              diferencia_ml: (p.facturas && p.facturas.length === 1) ? (Number(p.diferencia_preliminar) || 0) : 0
            });
          });
        });

        if (allInvoices.length > 0) {
          const first = matchedPos[0];
          return {
            success: true,
            po_found: true,
            is_multi_po: matchedPos.length > 1,
            po_number: (matchedPos.length === 1) ? first.po_number : `${matchedPos.length} Órdenes de Compra (${first.supplier_name})`,
            supplier_name: first.supplier_name + (matchedPos.length > 1 ? ` (+${matchedPos.length - 1} OCs)` : ''),
            supplier_tax_id: first.supplier_tax_id,
            warehouse_name: first.warehouse_name,
            condicion_aforo: (matchedPos.length === 1) ? (first.condicion_aforo || 'ÍNDICE PO-FACTURAS') : 'BÚSQUEDA PROVEEDOR',
            invoices: allInvoices,
            total_invoices: allInvoices.length,
            total_facturado_neto: totalNeto,
            total_facturado_total: Math.round(totalNeto * 1.19),
            total_oc_ordenado: totalOrd,
            total_oc_recepcionado: totalRec,
            diferencia_preliminar_clp: totalNeto - totalRec,
            pos_lote: matchedPos
          };
        }
      }

      // Caso 6: No encontrado
      return {
        success: true,
        count: 0,
        invoices: [],
        po_found: false
      };
    }

    case 'apiGetInvoiceXmlDetail': {
      const docId = args[0];
      if (docId === 'do_AAABoNmiZ3502o7z' || docId === '56458220') {
        try {
          const pPath = path.join(ROOT_DIR, 'tests/po519527_audit_block.js');
          if (fs.existsSync(pPath)) {
            const raw = fs.readFileSync(pPath, 'utf8');
            const audit = JSON.parse(raw.replace(/^const PO519527_AUDIT_DATA =\s*/, '').replace(/;\s*$/, ''));
            return { success: true, data: { items: audit.facturas['56458220'].items } };
          }
        } catch (e) { }
      }
      const match = po521534Catalog.find(f => f.ax_doc_id === docId);
      if (match && match.items) {
        return {
          success: true,
          data: {
            items: match.items
          }
        };
      }
      return {
        success: true,
        data: {
          items: [
            { linea: 1, codigo: 'SKU_GEN_01', descripcion: 'Producto Simulado DTE', cantidad_facturada: 10, precio_facturado: 1500, monto_facturado: 15000 }
          ]
        }
      };
    }

    case 'apiGetPurchaseOrder': {
      const poNum = args[0];
      if (poNum.includes('519527') || poNum === 'PO519527') {
        try {
          const pPath = path.join(ROOT_DIR, 'tests/po519527_audit_block.js');
          if (fs.existsSync(pPath)) {
            const raw = fs.readFileSync(pPath, 'utf8');
            const audit = JSON.parse(raw.replace(/^const PO519527_AUDIT_DATA =\s*/, '').replace(/;\s*$/, ''));
            return {
              success: true,
              data: {
                po_order_id: 'PO519527',
                items: audit.all_po_items || []
              }
            };
          }
        } catch (e) { }
      }
      if (po521534Audit && (poNum.includes('521534') || poNum === 'PO521534')) {
        return {
          success: true,
          data: {
            po_order_id: 'PO521534',
            items: po521534Audit.all_po_items || []
          }
        };
      }
      return {
        success: true,
        data: {
          po_order_id: poNum,
          items: []
        }
      };
    }

    case 'apiGetSystemSettings': {
      return {
        success: true,
        data: {
          masked_token: 'ax_live_...99K',
          alert_email: 'finanzas@pedidosya.com',
          threshold_clp: 1000000,
          spreadsheet_id: '1xYz_Spreadsheet_Demo_Id',
          aforos_spreadsheet_id: '1xYz_Aforos_Spreadsheet_Id',
          auto_sync_enabled: true,
          last_sync_time: '2026-10-10 18:00',
          last_sync_status: 'Completado'
        }
      };
    }

    case 'apiObtenerConfigJev': {
      return {
        success: true,
        apiKeyMasked: 'AIzaSy...DEMO',
        companyCode: '6202',
        costCenter: 'CD_36_CD_Chile'
      };
    }

    case 'apiEjecutarJevTypeSafeAudit':
    case 'apiTriageCausaRaizJev': {
      return {
        success: true,
        triages: [
          { sku: 'ALL', causa_raiz: 'SOBREPRECIO_LISTA_PROVEEDOR', explicacion: 'Diferencia en precio unitario facturado', confidence: 95 }
        ]
      };
    }

    case 'apiGetTopDiscrepanciesDashboard': {
      return {
        success: true,
        data: {
          kpis: {
            monto_total_riesgo: 28450120,
            total_pos_analizadas: 15,
            total_facturas_observadas: 15,
            total_descalces_detectados: 15,
            top_po_descalce: { po: 'PO517979', monto: 9680118, unidades_faltantes: 135 },
            top_proveedor_riesgo: { nombre: 'Empresas Carozzi S.A.', pct_compra: '28.4%' },
            top_factura_descalce: { folio: '22586659', monto: 84526 },
            category_manager_foco: { nombre: 'Daniela Reyes', categoria: 'Alimentos y Abarrotes (CD36)' }
          },
          top_pos: [
            { ranking: 1, po_order_id: 'PO517979', supplier_name: 'Empresas Carozzi S.A.', supplier_tax_id: '96591040-9', warehouse_name: 'CH_36_CD_Chile', amt_ordered_lc: 28619421, amt_delivered_lc: 12388682, descalce_monto_clp: 9680118, diferencia_ml: 9680118, sku_count: 135, facturas_count: 8, status: 'OBSERVADA' },
            { ranking: 2, po_order_id: 'PO502855', supplier_name: 'Nestlé Chile S.A.', supplier_tax_id: '96557910-9', warehouse_name: 'CH_36_CD_Chile', amt_ordered_lc: 84500000, amt_delivered_lc: 76111725, descalce_monto_clp: 8388275, diferencia_ml: 8388275, sku_count: 42, facturas_count: 3, status: 'OBSERVADA' },
            { ranking: 3, po_order_id: 'PO521015', supplier_name: 'Ideal S.A.', supplier_tax_id: '90297000-0', warehouse_name: 'CH_34_Manuel Montt', amt_ordered_lc: 1968789, amt_delivered_lc: 1789977, descalce_monto_clp: 219252, diferencia_ml: 219252, sku_count: 12, facturas_count: 2, status: 'OBSERVADA' }
          ],
          top_facturas: [
            { ranking: 1, folio: '22586659', tipo_doc: 'CL33', proveedor: 'Empresas Carozzi S.A.', rut: '96591040-9', fecha: '2026-09-22', po_asociada: 'PO517979', monto_factura: 894377, monto_recepcionado: 809851, monto_diferencia: 84526, status: 'OBSERVADA', causa_raiz: 'Sobreprecio unitario y faltante' },
            { ranking: 2, folio: '284719', tipo_doc: 'CL33', proveedor: 'Nestlé Chile S.A.', rut: '96557910-9', fecha: '2026-09-18', po_asociada: 'PO502855', monto_factura: 8450000, monto_recepcionado: 76111725, monto_diferencia: 8388275, status: 'OBSERVADA', causa_raiz: 'Faltante de entrega en bodega' },
            { ranking: 3, folio: '56500972', tipo_doc: 'CL33', proveedor: 'Ideal S.A.', rut: '90297000-0', fecha: '2026-09-29', po_asociada: 'PO521015', monto_factura: 1968789, monto_recepcionado: 1789977, monto_diferencia: 219252, status: 'OBSERVADA', causa_raiz: 'Diferencias físicas' }
          ]
        }
      };
    }

    case 'apiCrearPlanillaConciliacionOficialGoogleSheets':
    case 'apiGenerarSpreadsheetFinanzas': {
      const payload = args[0] || {};
      const items = payload.items || [];
      const difs = items.filter(it => (it.cant_fac > it.cant_rec) || (it.costo_total_fac > (it.cant_rec * it.costo_oc)));
      const montoDifs = difs.reduce((acc, it) => acc + (it.costo_total_fac - (it.cant_rec * it.costo_oc)), 0);
      return {
        success: true,
        po_number: payload.po_number || 'PO519527',
        spreadsheet_id: 'ss_mock_drive_' + Date.now(),
        url: 'https://docs.google.com/spreadsheets/d/ss_mock_drive_' + (payload.po_number || 'OC') + '/edit',
        excel_url: 'https://docs.google.com/spreadsheets/d/ss_mock_drive_' + (payload.po_number || 'OC') + '/export?format=xlsx',
        name: `Conciliación Finanzas_${payload.proveedor || 'Proveedor'}_${payload.po_number || 'OC'}`,
        total_items: items.length,
        total_diferencias: difs.length || items.length,
        monto_diferencias: Math.max(0, montoDifs) || 120000
      };
    }

    case 'apiExportarDescalcesPoExcel': {
      const poNum = args[0] || 'PO519527';
      return {
        success: true,
        po_number: poNum,
        total_items: 5,
        total_lineas_descalce: 5,
        monto_diferencias: 84526,
        spreadsheet_id: 'ss_mock_excel_' + poNum,
        url: 'https://docs.google.com/spreadsheets/d/ss_mock_excel_' + poNum + '/edit',
        excel_url: 'https://docs.google.com/spreadsheets/d/ss_mock_excel_' + poNum + '/export?format=xlsx'
      };
    }

    default:
      return { success: true, method, message: 'Mock response OK' };
  }
}

module.exports = { handleGasRpc };
