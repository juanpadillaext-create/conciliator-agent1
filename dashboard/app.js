// Dashboard Operativo de Conciliación - Cuentas por Pagar & Axteroid API

document.addEventListener('DOMContentLoaded', () => {
  const data = window.DASHBOARD_DATA;
  if (!data) {
    console.error("No se encontró window.DASHBOARD_DATA");
    return;
  }

  let selectedProvider = 'carozzi';
  let activeFilter = 'all';
  let searchQuery = '';
  let channelFilter = 'all';
  let selectedInvoice = null;

  // DOM Elements
  const providersGrid = document.getElementById('providersGrid');
  const invoicesTableBody = document.getElementById('invoicesTableBody');
  const searchInput = document.getElementById('searchInput');
  const filterPills = document.querySelectorAll('.filter-pill');
  const channelSelect = document.getElementById('channelSelect');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalContent = document.getElementById('modalContent');
  const toast = document.getElementById('toast');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnExportOfficialSheets = document.getElementById('btnExportOfficialSheets');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const lblThemeToggle = document.getElementById('lblThemeToggle');

  // Theme Management (Default Light Mode)
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('light-mode', theme === 'light');
    localStorage.setItem('dashboard_theme', theme);
    if (lblThemeToggle) {
      lblThemeToggle.textContent = theme === 'light' ? 'Modo Oscuro' : 'Modo Claro';
    }
    if (btnThemeToggle) {
      const icon = btnThemeToggle.querySelector('span:first-child');
      if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  };

  const initialTheme = localStorage.getItem('dashboard_theme') || 'light';
  setTheme(initialTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = current === 'light' ? 'dark' : 'light';
      setTheme(nextTheme);
    });
  }

  // KPI elements
  const kpiMontoTotal = document.getElementById('kpiMontoTotal');
  const kpiTotalFacturas = document.getElementById('kpiTotalFacturas');
  const kpiCarozziMonto = document.getElementById('kpiCarozziMonto');
  const kpiCarozziFacturas = document.getElementById('kpiCarozziFacturas');
  const kpiDescalceMonto = document.getElementById('kpiDescalceMonto');
  const kpiDescalceFacturas = document.getElementById('kpiDescalceFacturas');

  // Format Currency
  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Format Number
  const formatNum = (val) => {
    return new Intl.NumberFormat('es-CL').format(val || 0);
  };

  // Toast Helper
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  };

  // Render KPIs dinámicos según datos reales y proveedor seleccionado
  const renderKPIs = () => {
    const list = selectedProvider !== 'all' ? getFilteredInvoices() : data.invoices;
    const totalMonto = list.reduce((acc, curr) => acc + (curr.amount_total || 0), 0);
    const totalFacturas = list.length;

    kpiMontoTotal.textContent = formatCLP(totalMonto);
    kpiTotalFacturas.textContent = totalFacturas;

    const carozziProv = data.providers.find(p => p.id === 'carozzi');
    if (carozziProv) {
      kpiCarozziMonto.textContent = formatCLP(carozziProv.monto_ml);
      kpiCarozziFacturas.textContent = `${carozziProv.q_facturas} Facturas • CM: ${carozziProv.category_manager}`;
    }

    // Calcular facturas con retención o descalce en el conjunto actual
    const descalces = list.filter(i => 
      i.cruce_status === 'SOBREFACTURADO_DESCALCE' || 
      i.cruce_status === 'DIFERENCIA_UNIDADES' ||
      i.cruce_status === 'SIN_ORDEN_COMPRA'
    );
    const totalDescalce = descalces.reduce((acc, curr) => {
      const maxClaim = curr.amount_total || 0;
      const claim = curr.monto_a_reclamar 
        ? Math.min(curr.monto_a_reclamar, maxClaim) 
        : (curr.po_details ? Math.min(curr.po_details.descalce_monto || 0, maxClaim) : 0);
      return acc + claim;
    }, 0);
    
    kpiDescalceMonto.textContent = formatCLP(totalDescalce);
    kpiDescalceFacturas.textContent = `${descalces.length} Facturas con Retención`;
  };

  // Render Providers Carousel / Cards
  const renderProviders = () => {
    providersGrid.innerHTML = '';
    data.providers.forEach(p => {
      const card = document.createElement('div');
      card.className = `provider-card ${selectedProvider === p.id ? 'active' : ''}`;
      card.onclick = () => {
        selectedProvider = selectedProvider === p.id ? 'all' : p.id;
        renderProviders();
        renderKPIs();
        renderInvoices();
      };

      card.innerHTML = `
        <div class="provider-name" title="${p.name}">${p.name}</div>
        <div class="provider-cm">CM: ${p.category_manager}</div>
        <div class="provider-stats">
          <span class="provider-amount">${formatCLP(p.monto_ml)}</span>
          <span class="provider-badge">${p.q_facturas} DTEs (${p.share_pct}%)</span>
        </div>
      `;
      providersGrid.appendChild(card);
    });
  };

  // Filter Invoices
  const getFilteredInvoices = () => {
    return data.invoices.filter(inv => {
      // Filter by selected provider
      if (selectedProvider && selectedProvider !== 'all') {
        const prov = data.providers.find(p => p.id === selectedProvider);
        if (prov) {
          const cleanProvRut = prov.rut.replace(/[^0-9kK]/g, '').toLowerCase();
          const cleanInvRut = String(inv.tax_id || '').replace(/[^0-9kK]/g, '').toLowerCase();
          const provBase = prov.name.toLowerCase().split(' ')[0];
          const invName = String(inv.supplier_name || '').toLowerCase();
          if (cleanProvRut !== cleanInvRut && !invName.includes(provBase)) {
            return false;
          }
        }
      }

      // Filter by status pill
      if (activeFilter === 'descalce') {
        if (inv.cruce_status !== 'SOBREFACTURADO_DESCALCE' && inv.cruce_status !== 'DIFERENCIA_UNIDADES') return false;
      }
      if (activeFilter === 'pending' && inv.cruce_status !== 'PENDIENTE_RECEPCION') return false;
      if (activeFilter === 'no_oc') {
        if (inv.cruce_status !== 'SIN_ORDEN_COMPRA' && inv.cruce_status !== 'OC_NO_ENCONTRADA_CD36') return false;
      }
      if (activeFilter === 'ok' && inv.cruce_status !== 'CONCILIADO_OK') return false;

      // Filter by channel
      if (channelFilter === 'rec-docs' && inv.origin_channel.includes('woemail')) return false;
      if (channelFilter === 'woemail' && !inv.origin_channel.includes('woemail')) return false;

      // Filter by search query (PO, EAN, Folio, Razón Social, SKU)
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const rawNum = query.replace(/^po/i, '').replace(/^0+/, '');
        const serialStr = String(inv.serial || '').toLowerCase();
        const refStr = String(inv.order_reference || '').toLowerCase();
        const amountStr = String(inv.amount_total || '');
        const supplierStr = String(inv.supplier_name || inv.issuer_name || '').toLowerCase();
        const taxIdStr = String(inv.tax_id || '').toLowerCase().replace(/[^0-9k]/g, '');
        const poOrderId = inv.po_details && inv.po_details.po_order_id ? String(inv.po_details.po_order_id).toLowerCase() : '';

        // Coincidencia directa en Folio, Razón Social, RUT, Monto o PO
        const matchDirect = serialStr.includes(query) ||
                            supplierStr.includes(query) ||
                            taxIdStr.includes(query.replace(/[^0-9k]/g, '')) ||
                            refStr.includes(query) ||
                            (rawNum && refStr.includes(rawNum)) ||
                            poOrderId.includes(query) ||
                            (rawNum && poOrderId.includes(rawNum)) ||
                            amountStr.includes(query);

        if (!matchDirect) {
          // Búsqueda en items (SKU, EAN o descripción)
          const matchItem = (inv.items || []).some(it => {
            const sku = String(it.codigo || it.sku || it.sku_id || '').toLowerCase();
            const ean = String(it.ean || it.barcode || '').toLowerCase();
            const desc = String(it.descripcion || it.nombre || '').toLowerCase();
            return sku.includes(query) || ean.includes(query) || desc.includes(query);
          });

          // Búsqueda en items de la PO asociada
          const matchPoItem = (inv.po_details?.items || []).some(it => {
            const sku = String(it.sku_id || it.sku || '').toLowerCase();
            const supSku = String(it.supplier_sku || '').toLowerCase();
            const pName = String(it.product_name || '').toLowerCase();
            const barcodes = Array.isArray(it.barcodes) ? it.barcodes.join(' ') : String(it.barcodes || '');
            return sku.includes(query) || supSku.includes(query) || barcodes.includes(query) || pName.includes(query);
          });

          if (!matchItem && !matchPoItem) {
            return false;
          }
        }
      }

      return true;
    });
  };

  // Render Invoices Table
  const renderInvoices = () => {
    const list = getFilteredInvoices();
    invoicesTableBody.innerHTML = '';

    if (list.length === 0) {
      const prov = selectedProvider !== 'all' ? data.providers.find(p => p.id === selectedProvider) : null;
      invoicesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            ${prov ? `No se encontraron facturas en la muestra local para <strong>${prov.name}</strong> (RUT: ${prov.rut}).<br><span style="font-size: 0.8rem; margin-top: 6px; display: inline-block;">Actualmente la muestra operativa cargada corresponde a 208 facturas de Empresas Carozzi S.A. en CD_36.</span>` : 'No se encontraron facturas con los filtros seleccionados.'}
          </td>
        </tr>
      `;
      return;
    }

    list.forEach(inv => {
      const tr = document.createElement('tr');
      tr.onclick = () => openDetailModal(inv);

      let statusBadge = '';
      if (inv.cruce_status === 'SOBREFACTURADO_DESCALCE') {
        statusBadge = `<span class="status-badge danger"><span class="status-dot"></span> Sobrefacturado / Descalce</span>`;
      } else if (inv.cruce_status === 'DIFERENCIA_UNIDADES') {
        statusBadge = `<span class="status-badge danger"><span class="status-dot"></span> Diferencia en Unidades</span>`;
      } else if (inv.cruce_status === 'PENDIENTE_RECEPCION') {
        statusBadge = `<span class="status-badge warning"><span class="status-dot"></span> Pendiente Recepción</span>`;
      } else if (inv.cruce_status === 'SIN_ORDEN_COMPRA') {
        statusBadge = `<span class="status-badge danger"><span class="status-dot"></span> Sin Orden de Compra</span>`;
      } else if (inv.cruce_status === 'OC_NO_ENCONTRADA_CD36') {
        statusBadge = `<span class="status-badge danger" style="background: rgba(239, 68, 68, 0.15); border-color: #f87171;"><span class="status-dot"></span> OC No Encontrada CD36</span>`;
      } else if (inv.cruce_status === 'CONCILIADO_OK') {
        statusBadge = `<span class="status-badge success"><span class="status-dot"></span> Aprobado / Conforme</span>`;
      } else {
        statusBadge = `<span class="status-badge secondary"><span class="status-dot"></span> ${inv.cruce_label || 'En Revisión'}</span>`;
      }

      let bodegaStatus = '<span style="color: var(--text-muted); font-size: 0.75rem;">Sin OC asignada</span>';
      let deltaAmount = '-';
      if (inv.po_details) {
        const pod = inv.po_details;
        const missingUnits = (pod.diff_qty > 0) ? pod.diff_qty : (pod.qty_delivered < pod.qty_ordered ? (pod.qty_ordered - pod.qty_delivered) : 0);
        const isComplete = pod.qty_delivered >= pod.qty_ordered && pod.qty_ordered > 0;
        const zeroDelivered = pod.qty_delivered === 0 && pod.qty_ordered > 0;

        let diffLabel = '';
        let diffColor = '#34d399';

        if (zeroDelivered) {
          diffLabel = `Falta recepción total (0 un)`;
          diffColor = '#f87171';
        } else if (missingUnits > 0) {
          diffLabel = `Faltan ${formatNum(missingUnits)} un en bodega`;
          diffColor = '#f87171';
        } else if (isComplete) {
          diffLabel = 'Entrega 100% Completa';
          diffColor = '#34d399';
        } else {
          diffLabel = 'Sin recepción verificada';
          diffColor = '#94a3b8';
        }

        bodegaStatus = `
          <div style="font-size: 0.8rem; font-weight: 600;">
            ${formatNum(pod.qty_delivered)} / ${formatNum(pod.qty_ordered)} un
          </div>
          <span style="font-size: 0.7rem; color: ${diffColor};">
            ${diffLabel}
          </span>
        `;

        const maxClaim = inv.amount_total || 0;
        if (inv.monto_a_reclamar) {
          deltaAmount = `<span style="color: #f87171; font-weight: 700;">+${formatCLP(Math.min(inv.monto_a_reclamar, maxClaim))}</span>`;
        } else if (pod.descalce_monto > 0) {
          deltaAmount = `<span style="color: #fbbf24; font-weight: 600;">Descalce ${formatCLP(Math.min(pod.descalce_monto, maxClaim))}</span>`;
        } else {
          deltaAmount = `<span style="color: #34d399; font-weight: 600;">$0</span>`;
        }
      }

      tr.innerHTML = `
        <td>
          <div class="folio-cell">
            <span>${inv.serial}</span>
            <span class="dte-tag">${inv.type}</span>
          </div>
          <span class="channel-tag">${inv.origin_channel}</span>
        </td>
        <td>
          <span class="oc-badge">${inv.order_reference}</span>
        </td>
        <td>
          <div class="amount-cell">${formatCLP(inv.amount_total)}</div>
          <span style="font-size: 0.7rem; color: var(--text-muted);">${inv.date}</span>
        </td>
        <td>${bodegaStatus}</td>
        <td>${deltaAmount}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-action" onclick="event.stopPropagation(); window.openModalById('${inv.id}')">
            Auditar Cruce
          </button>
        </td>
      `;

      invoicesTableBody.appendChild(tr);
    });
  };

  // Open Modal Details
  const openDetailModal = (inv) => {
    selectedInvoice = inv;
    const pod = inv.po_details;

    let bannerClass = 'danger';
    let bannerIcon = '🚨';
    let bannerTitle = 'PAGO RETENIDO POR SOBREFACTURACIÓN Y DESCALCE';
    let bannerText = 'El proveedor facturó unidades no recepcionadas en bodega. Se debe exigir Nota de Crédito (CL61) al folio afectado antes de pagar.';

    if (inv.cruce_status === 'PENDIENTE_RECEPCION') {
      bannerClass = 'warning';
      bannerIcon = '⏳';
      bannerTitle = 'BODEGA NO HA INGRESADO LA RECEPCIÓN';
      bannerText = 'La Orden de Compra está emitida pero no cuenta con registro de entrada física en CH_36_CD_Chile. El pago queda en pausa hasta el ingreso.';
    } else if (inv.cruce_status === 'SIN_ORDEN_COMPRA') {
      bannerClass = 'danger';
      bannerIcon = '❌';
      bannerTitle = 'FACTURA RECHAZADA COMERCIALMENTE (SIN OC)';
      bannerText = 'Según la política contable, toda factura recibida sin Orden de Compra válida debe ser rechazada inmediatamente en el SII/Axteroid.';
    } else if (inv.cruce_status === 'OC_NO_ENCONTRADA_CD36') {
      bannerClass = 'danger';
      bannerIcon = '🔍';
      bannerTitle = 'ORDEN DE COMPRA NO ENCONTRADA EN CD_36';
      bannerText = 'La OC referenciada en la factura no existe o no pertenece al centro CH_36_CD_Chile. Se retiene el pago para regularización.';
    } else if (inv.cruce_status === 'DIFERENCIA_UNIDADES') {
      bannerClass = 'danger';
      bannerIcon = '⚖️';
      bannerTitle = 'DESCALCE FÍSICO EN UNIDADES RECEPCIONADAS';
      bannerText = 'Existen diferencias entre las unidades facturadas y las recepcionadas por bodega. Se exige emisión de Nota de Crédito.';
    } else if (inv.cruce_status === 'CONCILIADO_OK') {
      bannerClass = 'success';
      bannerIcon = '✅';
      bannerTitle = 'CONCILIACIÓN 100% CONFORME';
      bannerText = 'Las cantidades y montos facturados coinciden con la recepción física en bodega. Autorizado para programación de pago.';
    }

    const maxInvoiceAmt = inv.amount_total || 0;
    let claimAmount = 0;
    if (inv.monto_a_reclamar && inv.monto_a_reclamar > 0) {
      claimAmount = Math.min(inv.monto_a_reclamar, maxInvoiceAmt);
    } else if (pod && pod.descalce_monto > 0) {
      claimAmount = Math.min(pod.descalce_monto, maxInvoiceAmt);
    } else if (inv.cruce_status === 'SIN_ORDEN_COMPRA' || inv.cruce_status === 'OC_NO_ENCONTRADA_CD36') {
      claimAmount = maxInvoiceAmt;
    } else {
      claimAmount = 0;
    }

    const missingQtyModal = pod 
      ? ((pod.diff_qty > 0) ? pod.diff_qty : (pod.qty_delivered < pod.qty_ordered ? (pod.qty_ordered - pod.qty_delivered) : 0))
      : 0;
    const missingQtyStr = pod 
      ? (missingQtyModal > 0 ? `${formatNum(missingQtyModal)} unidades pendientes` : (pod.qty_delivered >= pod.qty_ordered && pod.qty_ordered > 0 ? '0 unidades (entrega completa)' : '0 unidades recibidas'))
      : 'Recepción no verificada en CD_36';

    const claimNotice = `========================================================================
NOTIFICACIÓN FORMAL DE RECHAZO / SOLICITUD DE NOTA DE CRÉDITO
PEDIDOSYA CHILE / DELIVERY HERO STORES CHILE (RUT: 77.125.361-K)
========================================================================
Fecha: ${new Date().toLocaleDateString('es-CL')}
A: ${inv.supplier_name} (RUT: ${inv.tax_id})
Atn: Departamento de Facturación y Crédito / Key Account Manager

Referencia:
- Factura Electrónica Folio: ${inv.serial} (Tipo: ${inv.type})
- Fecha de Emisión: ${inv.date}
- Orden de Compra Asociada: ${inv.order_reference}
- Centro de Distribución: CH_36_CD_Chile (Santiago Central)

Detalle de la Discrepancia Observada:
1. Monto Total Facturado: ${formatCLP(inv.amount_total)}
2. Monto Físico Recibido en Bodega: ${pod ? formatCLP(pod.amt_delivered) : '$0'}
3. Saldo No Entregado / Faltante Físico: ${missingQtyStr}
4. DIFERENCIA / MONTO A RECLAMAR: ${formatCLP(claimAmount)} (Tope: valor del folio)

RESOLUCIÓN CONTABLE:
Se informa que el pago del folio ${inv.serial} ha sido RETENIDO de acuerdo a la 
política comercial de Delivery Hero Chile. Para la liberación del saldo correspondiente, 
solicitamos la emisión urgente de una NOTA DE CRÉDITO (DTE 61) que referencie de 
forma explícita al folio ${inv.serial}.

Analista de Cuentas por Pagar: Cuentas por Pagar D-Marts Chile
Contacto de Conciliación: conciliacion.chile@pedidosya.com
========================================================================`;

    modalContent.innerHTML = `
      <div class="discrepancy-banner ${bannerClass}">
        <span class="discrepancy-icon">${bannerIcon}</span>
        <div class="discrepancy-text">
          <h4>${bannerTitle}</h4>
          <p>${bannerText}</p>
        </div>
      </div>

      <div class="match-grid">
        <div class="match-box">
          <div class="match-box-title">📄 1. Factura Proveedor</div>
          <div class="match-box-value">${formatCLP(inv.amount_total)}</div>
          <div class="match-box-sub">Folio ${inv.serial} (${inv.type}) • ${inv.date}</div>
        </div>

        <div class="match-box">
          <div class="match-box-title">📦 2. Orden de Compra</div>
          <div class="match-box-value">${pod ? formatCLP(pod.amt_ordered) : 'No vinculada'}</div>
          <div class="match-box-sub">OC ${inv.order_reference} • ${pod ? formatNum(pod.qty_ordered) + ' un' : '-'}</div>
        </div>

        <div class="match-box">
          <div class="match-box-title">🏢 3. Recepción en Bodega</div>
          <div class="match-box-value" style="color: ${pod && (missingQtyModal > 0 || pod.qty_delivered === 0) ? '#f87171' : '#34d399'};">
            ${pod ? formatCLP(pod.amt_delivered) : '$0'}
          </div>
          <div class="match-box-sub">${pod ? (pod.qty_delivered > 0 ? `${formatNum(pod.qty_delivered)} un recepcionadas en CD_36` : '0 unidades entregadas en bodega') : 'Sin registro de ingreso'}</div>
        </div>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
            Carta Formal de Reclamo al Proveedor (Requisito Nota de Crédito)
          </h4>
          <button class="btn-secondary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;" onclick="window.copyClaimNotice()">
            📋 Copiar al Portapapeles
          </button>
        </div>
        <div class="claim-preview-box" id="claimText">${claimNotice}</div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="window.descargarPlanillaFinanzasModal('${inv.serial}', '${inv.order_reference}')" style="border-color: #c00000; color: #f87171; font-weight: 700;">
          📊 Exportar Planilla Finanzas (.xlsx)
        </button>
        <button class="btn-secondary" onclick="window.printClaimNotice()">
          🖨️ Imprimir Carta
        </button>
        <button class="btn-secondary" onclick="window.markRetained('${inv.id}')" style="border-color: #ef4444; color: #fca5a5;">
          🛑 Retener Pago en ERP
        </button>
        <button class="btn-primary" onclick="window.approvePayment('${inv.id}')">
          ✅ Autorizar Pago Neto
        </button>
      </div>
    `;

    modalBackdrop.classList.add('open');
  };

  // Window-level functions for modal interactions
  window.openModalById = (id) => {
    const inv = data.invoices.find(i => i.id === id);
    if (inv) openDetailModal(inv);
  };

  window.descargarPlanillaFinanzasModal = (serial, po) => {
    showToast(`📊 Generando Planilla Oficial de Finanzas para Folio ${serial} / OC ${po || 'PO517979'}...`);
    const link = document.createElement("a");
    link.href = "Planilla_Conciliacion_Finanzas_Oficial.xlsx";
    link.download = `Planilla_Conciliacion_Finanzas_Oficial_Folio_${serial}_${po || 'PO517979'}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.copyClaimNotice = () => {
    const text = document.getElementById('claimText').innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast("✅ Carta de reclamo copiada al portapapeles con éxito.");
    });
  };

  window.printClaimNotice = () => {
    const text = document.getElementById('claimText').innerText;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<pre style="font-family: monospace; font-size: 13px; line-height: 1.5; padding: 20px;">${text}</pre>`);
    printWindow.document.close();
    printWindow.print();
  };

  window.markRetained = (id) => {
    modalBackdrop.classList.remove('open');
    showToast("🛑 Factura marcada con RETENCIÓN DE PAGO y notificada al equipo de pagos.");
  };

  window.approvePayment = (id) => {
    modalBackdrop.classList.remove('open');
    showToast("✅ Factura aprobada para liquidación neta.");
  };

  // Close modal
  btnCloseModal.onclick = () => modalBackdrop.classList.remove('open');
  modalBackdrop.onclick = (e) => {
    if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
  };

  // Search input handler
  searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    renderInvoices();
  };

  // Status Filter Pills
  filterPills.forEach(pill => {
    pill.onclick = () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      renderInvoices();
    };
  });

  // Channel Select
  channelSelect.onchange = (e) => {
    channelFilter = e.target.value;
    renderInvoices();
  };

  // Export CSV
  btnExportCsv.onclick = () => {
    const list = getFilteredInvoices();
    if (list.length === 0) {
      showToast("No hay datos para exportar con los filtros actuales.");
      return;
    }

    const headers = ["Folio", "Tipo", "Proveedor", "RUT", "Fecha", "OC_Referencia", "Canal_Axteroid", "Monto_Facturado", "Unidades_Pedidas", "Unidades_Recibidas_CD36", "Unidades_Faltantes", "Monto_Recibido_CD36", "Monto_Reclamo_NC", "Estado_Cruce", "Accion_Contable"];
    const rows = list.map(i => {
      const pod = i.po_details || {};
      return [
        i.serial,
        i.type,
        `"${i.supplier_name}"`,
        i.tax_id,
        i.date,
        i.order_reference,
        `"${i.origin_channel}"`,
        i.amount_total,
        pod.qty_ordered || 0,
        pod.qty_delivered || 0,
        pod.diff_qty || 0,
        pod.amt_delivered || 0,
        i.monto_a_reclamar || 0,
        `"${i.cruce_label || ''}"`,
        `"${i.action || ''}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const provSuffix = selectedProvider !== 'all' ? selectedProvider : 'todos_los_proveedores';
    link.setAttribute("download", `Cruce_Facturas_CD36_${provSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Archivo CSV exportado correctamente.");
  };

  // Exportar Planilla Oficial Formato Finanzas
  if (btnExportOfficialSheets) {
    btnExportOfficialSheets.onclick = () => {
      showToast("📊 Generando Planilla Oficial de Finanzas (Google Sheets / Excel) con todos los escenarios...");
      const link = document.createElement("a");
      link.href = "Planilla_Conciliacion_Finanzas_Oficial.xlsx";
      const provSuffix = selectedProvider !== 'all' ? selectedProvider : 'Consolidado';
      link.setAttribute("download", `Planilla_Conciliacion_Finanzas_Oficial_${provSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  // Initial Run
  renderKPIs();
  renderProviders();
  renderInvoices();
});
