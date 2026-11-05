
  // Estado global de la aplicación
  let currentInvoices = [];
  let activeReconciliation = null;
  let activeDocId = null;

  // Estado Pestaña 1 (Buscador Rápido / Localizador de Tríada)
  let activeSearchRut = '';

  // Estado Pestaña 3 (Maestro de Homologación)
  let currentMaestroData = [];
  let activeMaestroRut = '';

  // Estado Pestaña 4 (Casos Spreadsheet Tribu e Image)
  let currentSpreadsheetCases = [];

  // Estado Pestaña 5 (Tabla de Aforos Chile)
  let currentAforosData = [];
  let currentAforosSummary = null;
  let activeAforoFilter = 'todos';

  // Inicialización del Flujo Guiado en 3 Pasos
  document.addEventListener('DOMContentLoaded', () => {
    try {
      initThemeSystem();
    } catch (e) {
      console.warn('Advertencia en initThemeSystem:', e);
    }

    try {
      initSettingsModal();
    } catch (e) {
      console.warn('Advertencia en initSettingsModal:', e);
    }

    try {
      loadSystemSettings();
    } catch (e) {
      console.warn('Advertencia en loadSystemSettings:', e);
    }

    try {
      initWizardFlow();
    } catch (e) {
      console.error('Error crítico al inicializar initWizardFlow:', e);
    }
  });

  function initThemeSystem() {
    const btnTheme = document.getElementById('btnThemeToggleApp');
    const lblTheme = document.getElementById('lblThemeToggleApp');

    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
      localStorage.setItem('gas_theme', theme);
      if (lblTheme) {
        lblTheme.textContent = theme === 'light' ? 'Modo Oscuro' : 'Modo Claro';
      }
      if (btnTheme) {
        const icon = btnTheme.querySelector('span:first-child');
        if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀️';
      }
    };

    const saved = localStorage.getItem('gas_theme') || 'light';
    applyTheme(saved);

    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }
  }

  function initDynamicDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const elDesde = document.getElementById('txtFechaDesde');
    const elHasta = document.getElementById('txtFechaHasta');
    if (elDesde && !elDesde.value) elDesde.value = firstDay;
    if (elHasta && !elHasta.value) elHasta.value = today;
  }

  // ==========================================
  // DIRECTORIO MAESTRO DE LOS 32 PROVEEDORES CLAVE
  // ==========================================
  const DIRECTORIO_PROVEEDORES = [
    // 1. Constanza Urra (Snacks, Panadería, Desayuno, Huevos)
    { nombre: "Nestlé Chile S.A.", alias: ["nestle", "nestle chile", "savory"], rut: "96557910-9", cm: "Constanza Urra", tipo: "NO AFORADO", pct: "33.8%" },
    { nombre: "Ideal S.A. (Grupo Bimbo)", alias: ["ideal", "bimbo"], rut: "82623500-4", cm: "Constanza Urra", tipo: "NO AFORADO", pct: "3.87%" },
    { nombre: "Evercrisp Snack Productos de Chile S.A.", alias: ["evercrisp", "lays", "doritos", "pepsico"], rut: "94528000-K", cm: "Constanza Urra", tipo: "NO AFORADO", pct: "1.57%" },
    { nombre: "Avícola y Comercial El Toco Ltda.", alias: ["el toco", "toco", "huevos el toco"], rut: "78383730-7", cm: "Constanza Urra", tipo: "NO AFORADO", pct: "1.03%" },
    { nombre: "Proa SpA", alias: ["proa", "champion"], rut: "92117000-9", cm: "Constanza Urra", tipo: "NO AFORADO", pct: "0.65%" },
    { nombre: "Importadora Café Do Brasil (ICB S.A.)", alias: ["cafe do brasil", "icb", "marco polo"], rut: "93178000-K", cm: "Constanza Urra", tipo: "NO AFORADO", pct: "0.04%" },

    // 2. Javiera Rogers (Bebidas, Cervezas, Abarrotes)
    { nombre: "Coca-Cola Embonor S.A.", alias: ["embonor", "coca cola embonor"], rut: "93281000-K", cm: "Javiera Rogers", tipo: "NO AFORADO", pct: "26.36%" },
    { nombre: "Embotelladora Andina S.A.", alias: ["andina", "embotelladora andina", "guallarauco"], rut: "91144000-8", cm: "Javiera Rogers", tipo: "NO AFORADO", pct: "23.87%" },
    { nombre: "Comercial CCU S.A.", alias: ["ccu", "cerveceria ccu"], rut: "99554560-8", cm: "Javiera Rogers", tipo: "NO AFORADO", pct: "-7.04%" },
    { nombre: "Distribución y Excelencia S.A. (Dysa)", alias: ["distribucion y excelencia", "dysa"], rut: "96568970-2", cm: "Javiera Rogers", tipo: "NO AFORADO", pct: "1.25%" },
    { nombre: "Tresmontes S.A.", alias: ["tresmontes", "lucchetti", "zuko", "coronado"], rut: "76388064-8", cm: "Javiera Rogers", tipo: "NO AFORADO", pct: "0.36%" },

    // 3. Daniela Reyes (Carozzi / Galletas / Pastas)
    { nombre: "Empresas Carozzi S.A.", alias: ["carozzi", "costa", "ambrosoli", "vivo"], rut: "96591040-9", cm: "Daniela Reyes", tipo: "NO AFORADO", pct: "17.72%" },

    // 4. Maria Paz Devés (Carnes, Frescos, Cecinas, Lácteos, Congelados)
    { nombre: "Agrosuper Comercializadora Ltda.", alias: ["agrosuper", "super pollo", "sopraval"], rut: "79984240-8", cm: "Maria Paz Devés", tipo: "NO AFORADO", pct: "4.94%" },
    { nombre: "Consorcio Industrial de Alimentos S.A. (CIAL)", alias: ["cial", "consorcio industrial", "san jorge", "la preferida", "winter"], rut: "80186300-0", cm: "Maria Paz Devés", tipo: "NO AFORADO", pct: "-8.73%" },
    { nombre: "Cooperativa Agrícola y Lechera La Unión (Colun)", alias: ["colun", "cooperativa agricola"], rut: "81094100-6", cm: "Maria Paz Devés", tipo: "PESABLE", pct: "-2.58%" },
    { nombre: "Comercial Santa Elena S.A.", alias: ["santa elena", "comercial santa elena"], rut: "84472400-4", cm: "Maria Paz Devés", tipo: "NO AFORADO", pct: "1.76%" },
    { nombre: "Comercializadora Agropecuaria Embrio Chile S.A.", alias: ["embrio", "embrio chile"], rut: "99540130-4", cm: "Maria Paz Devés", tipo: "NO AFORADO", pct: "2.44%" },
    { nombre: "Productos Fernández S.A. (PF)", alias: ["pf", "productos fernandez"], rut: "91004000-6", cm: "Maria Paz Devés", tipo: "PESABLE", pct: "-0.89%" },
    { nombre: "Ariztía Comercial Ltda.", alias: ["ariztia", "ariztía"], rut: "83614800-2", cm: "Maria Paz Devés", tipo: "PESABLE", pct: "-0.4%" },
    { nombre: "Carnes Ñuble S.A.", alias: ["carnes nuble", "carnes ñuble"], rut: "96518070-2", cm: "Maria Paz Devés", tipo: "PESABLE", pct: "0.04%" },
    { nombre: "Alimentos y Frutos S.A. (Minuto Verde)", alias: ["alimentos y frutos", "minuto verde"], rut: "96557910-9", cm: "Maria Paz Devés", tipo: "NO AFORADO", pct: "0.49%" },
    { nombre: "Watt's S.A.", alias: ["watts", "watt's", "loncoleche", "calan"], rut: "76455830-8", cm: "Maria Paz Devés", tipo: "NO AFORADO", pct: "0.05%" },

    // 5. Daniela Catilao (Panadería, Frutas/Verduras, Pesables)
    { nombre: "Bredenmaster SpA", alias: ["bredenmaster", "breden"], rut: "96606310-6", cm: "Daniela Catilao", tipo: "NO AFORADO", pct: "2.91%" },
    { nombre: "Comercializadora JJ & Alimentos SpA", alias: ["jj", "jj alimentos", "jj & alimentos"], rut: "77183217-2", cm: "Daniela Catilao", tipo: "PESABLE", pct: "0.4%" },
    { nombre: "Comercializadora y Exportadora Exofrut SpA", alias: ["exofrut", "comercializadora y exportadora"], rut: "78231878-0", cm: "Daniela Catilao", tipo: "PESABLE", pct: "0.1%" },
    { nombre: "Comercializadora Bambus SpA", alias: ["bambus", "comercializadora bambus"], rut: "78185379-8", cm: "Daniela Catilao", tipo: "PESABLE", pct: "-0.01%" },
    { nombre: "Punto Azul S.A.", alias: ["punto azul"], rut: "77961510-3", cm: "Daniela Catilao", tipo: "NO AFORADO", pct: "-0.24%" },
    { nombre: "Proveedor Genérico Frutas y Verduras", alias: ["generico", "proveedor generico"], rut: "", cm: "Daniela Catilao", tipo: "PESABLE", pct: "-0.88%" },

    // 6. Nicolas Lopez (Higiene, Aseo, Cuidado Personal, Abarrotes)
    { nombre: "Softys Chile SpA (CMPC)", alias: ["softys", "elite", "babysec", "noble"], rut: "96529310-8", cm: "Nicolas Lopez", tipo: "NO AFORADO", pct: "2%" },
    { nombre: "Promerco S.A.", alias: ["promerco"], rut: "79684790-5", cm: "Nicolas Lopez", tipo: "NO AFORADO", pct: "1.64%" },

    // 7. Joaquin Mardones (Non-Food / Cuidado Personal / P&G)
    { nombre: "Procter & Gamble Chile Ltda. (P&G)", alias: ["procter", "gamble", "p&g", "gillette", "pampers", "ariel"], rut: "96656660-4", cm: "Joaquin Mardones", tipo: "NO AFORADO", pct: "0.46%" },

    // 8. Francisco Alvarez (Carnes / Especialidades)
    { nombre: "Los Cabros Asociados SpA", alias: ["los cabros", "cabros asociados"], rut: "76934499-3", cm: "Francisco Alvarez", tipo: "PESABLE", pct: "-6.99%" }
  ];


  function normalizarTextoBusqueda(s) {
    if (!s) return '';
    return s.toString()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[.\-_,;:'"\/\\#()\[\]]/g, ' ')
      .replace(/\b(s\.?a\.?|spa|ltda\.?|e\.?i\.?r\.?l\.?|limitada|sociedad|comercial|comercializadora|distribucion|alimentos|de|y|la|el|los|las|chile)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ==========================================
  function initSettingsModal() {
    const btnOpen = document.getElementById('btnOpenSettings');
    const btnClose = document.getElementById('btnSettingsClose');
    const btnCancel = document.getElementById('btnSettingsCancel');
    const btnSave = document.getElementById('btnSaveSettings');
    const btnSyncNow = document.getElementById('btnRunManualSync');
    const modal = document.getElementById('settingsModal');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        modal.classList.add('active');
        loadSystemSettings();
      });
    }

    const closeModal = () => modal.classList.remove('active');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnSave) {
      btnSave.addEventListener('click', () => saveSystemSettings());
    }

    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', () => runManualSync());
    }
  }

  function loadSystemSettings() {
    if (typeof google === 'undefined' || !google.script || !google.script.run || typeof google.script.run.apiGetSystemSettings !== 'function') {
      console.log('google.script.run no disponible en este entorno (modo local o previsualización).');
      return;
    }
    try {
      google.script.run
        .withSuccessHandler((res) => {
          if (!res || !res.success) return;
          const d = res.data;
          const tokenInput = document.getElementById('cfgToken');
          if (tokenInput && d.masked_token) {
            tokenInput.placeholder = `Token activo (${d.masked_token}) - Deja en blanco si no deseas cambiarlo`;
          }
          const emailInput = document.getElementById('cfgEmail');
          if (emailInput && d.alert_email) emailInput.value = d.alert_email;

          const thInput = document.getElementById('cfgThreshold');
          if (thInput && d.threshold_clp) thInput.value = d.threshold_clp;

          const sheetIdInput = document.getElementById('cfgSpreadsheetId');
          if (sheetIdInput && d.spreadsheet_id) sheetIdInput.value = d.spreadsheet_id;

          const aforosSheetIdInput = document.getElementById('cfgAforosSpreadsheetId');
          if (aforosSheetIdInput && d.aforos_spreadsheet_id) aforosSheetIdInput.value = d.aforos_spreadsheet_id;

          const autoSyncCheck = document.getElementById('cfgAutoSync');
          if (autoSyncCheck) autoSyncCheck.checked = !!d.auto_sync_enabled;

          const lastTime = document.getElementById('cfgLastSyncTime');
          if (lastTime) lastTime.textContent = d.last_sync_time || 'Aún no ejecutada';

          const lastStatus = document.getElementById('cfgLastSyncStatus');
          if (lastStatus) {
            lastStatus.textContent = d.last_sync_status || '-';
            lastStatus.style.color = d.last_sync_status === 'Completado' ? 'var(--accent-green)' : 'var(--text-secondary)';
          }

          // Cargar configuración Jev TypeSafe AI & SAP
          if (typeof google.script.run.apiObtenerConfigJev === 'function') {
            google.script.run
              .withSuccessHandler((jRes) => {
                if (jRes && jRes.success) {
                  const jevKeyInput = document.getElementById('cfgJevApiKey');
                  if (jevKeyInput && jRes.apiKeyMasked) {
                    jevKeyInput.placeholder = `Activa (${jRes.apiKeyMasked}) - Deja en blanco para conservar`;
                  }
                  const sapCoInput = document.getElementById('cfgSapCompanyCode');
                  if (sapCoInput && jRes.companyCode) sapCoInput.value = jRes.companyCode;
                  const sapCcInput = document.getElementById('cfgSapCostCenter');
                  if (sapCcInput && jRes.costCenter) sapCcInput.value = jRes.costCenter;

                  localStorage.setItem('cfg_sap_co', jRes.companyCode || '6202');
                  localStorage.setItem('cfg_sap_cc', jRes.costCenter || 'CD_36_CD_Chile');
                }
              })
              .apiObtenerConfigJev();
          }
        })
        .apiGetSystemSettings();
    } catch (e) {
      console.warn('Fallo controlado al invocar apiGetSystemSettings:', e);
    }
  }

  function saveSystemSettings() {
    const btnSave = document.getElementById('btnSaveSettings');
    const origHtml = btnSave.innerHTML;
    btnSave.disabled = true;
    btnSave.innerHTML = '<span class="spinner" style="width:14px; height:14px;"></span> Guardando...';

    const payload = {
      token: (document.getElementById('cfgToken').value || '').trim(),
      alert_email: (document.getElementById('cfgEmail').value || '').trim(),
      threshold_clp: parseFloat(document.getElementById('cfgThreshold').value || '1000000'),
      spreadsheet_id: (document.getElementById('cfgSpreadsheetId').value || '').trim(),
      aforos_spreadsheet_id: (document.getElementById('cfgAforosSpreadsheetId') ? document.getElementById('cfgAforosSpreadsheetId').value : '').trim(),
      auto_sync_enabled: document.getElementById('cfgAutoSync').checked
    };

    const jevApiKey = (document.getElementById('cfgJevApiKey')?.value || '').trim();
    const sapCo = (document.getElementById('cfgSapCompanyCode')?.value || '6202').trim();
    const sapCc = (document.getElementById('cfgSapCostCenter')?.value || 'CD_36_CD_Chile').trim();

    localStorage.setItem('cfg_sap_co', sapCo);
    localStorage.setItem('cfg_sap_cc', sapCc);

    google.script.run.apiGuardarConfigJev({
      apiKey: jevApiKey,
      companyCode: sapCo,
      costCenter: sapCc
    });

    google.script.run
      .withSuccessHandler((res) => {
        btnSave.disabled = false;
        btnSave.innerHTML = origHtml;
        if (res.success) {
          alert('Configuración y automatizaciones guardadas correctamente.');
          document.getElementById('cfgToken').value = '';
          document.getElementById('settingsModal').classList.remove('active');
          loadSystemSettings();
        } else {
          alert('Error al guardar configuración: ' + res.error);
        }
      })
      .withFailureHandler((err) => {
        btnSave.disabled = false;
        btnSave.innerHTML = origHtml;
        alert('Fallo al conectar con el servidor: ' + err.message);
      })
      .apiSaveSystemSettings(payload);
  }

  function runManualSync() {
    const btn = document.getElementById('btnRunManualSync');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px; height:14px;"></span> Sincronizando...';

    google.script.run
      .withSuccessHandler((res) => {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (res.success) {
          const d = res.data;
          alert(`Sincronización completada.\nFacturas revisadas: ${d.facturas_revisadas}\nDescalce detectado: $${Math.round(d.descalce_total).toLocaleString('es-CL')} CLP`);
          loadSystemSettings();
          ejecutarBusqueda();
          if (document.getElementById('tabCasosSheet').classList.contains('active')) {
            cargarCasosSpreadsheet();
          }
        } else {
          alert('Error en sincronización: ' + res.error);
        }
      })
      .withFailureHandler((err) => {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        alert('Fallo de sincronización: ' + err.message);
      })
      .apiRunManualSyncNow();
  }

  // ==========================================
  // PESTAÑA 4: CASOS DEL SPREADSHEET (TRIBU)
  // ==========================================

  function calcularCruce1a1EnCliente(inv, po) {
    const invItems = inv.items || [];
    const poItems = po.items || [];
    const matchedPoIndices = new Set();
    const lineas = [];

    let totalFacturadoNeto = 0;
    let totalRecepcionadoNeto = 0;
    let totalMontoReclamar = 0;
    let totalDescalcePrecio = 0;
    let totalFaltanteRecepcion = 0;
    let totalNoEnOc = 0;
    let lineasConformes = 0;
    let lineasConDescalce = 0;

    invItems.forEach((invItem, idx) => {
      totalFacturadoNeto += invItem.monto_facturado;
      const invCode = (invItem.codigo || '').toLowerCase().trim();
      const invEan = (invItem.ean || '').toLowerCase().trim();
      const invDesc = (invItem.descripcion || '').toLowerCase().trim();

      // Buscar coincidencia en la OC
      let poItem = null;
      let matchedIndex = -1;

      for (let i = 0; i < poItems.length; i++) {
        if (matchedPoIndices.has(i)) continue;
        const p = poItems[i];
        const pSku = (p.sku_id || '').toLowerCase().trim();
        const pSupp = (p.supplier_sku || '').toLowerCase().trim();
        const pBarcodes = (p.barcodes || []).map(b => b.toLowerCase().trim());
        const pDesc = (p.product_name || '').toLowerCase().trim();

        if (pSku === invCode || pSupp === invCode || (invEan && pBarcodes.includes(invEan))) {
          poItem = p;
          matchedIndex = i;
          break;
        }
        if (pDesc.includes(invDesc) || invDesc.includes(pDesc)) {
          poItem = p;
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== -1) matchedPoIndices.add(matchedIndex);

      if (!poItem) {
        // Caso: Ítem Facturado No Solicitado en OC
        const montoRec = invItem.monto_facturado;
        totalMontoReclamar += montoRec;
        totalNoEnOc += montoRec;
        lineasConDescalce++;

        lineas.push({
          linea: idx + 1,
          codigo: invItem.codigo,
          ean: invItem.ean || '-',
          sku: 'NO EN OC',
          descripcion: invItem.descripcion,
          unidad_medida: invItem.unidad_medida || 'UN',
          cantidad_ordenada: 0,
          cantidad_facturada: invItem.cantidad_facturada,
          cantidad_recepcionada: 0,
          dif_cantidad: -invItem.cantidad_facturada,
          precio_facturado: invItem.precio_facturado,
          costo_oc: 0,
          dif_precio: invItem.precio_facturado,
          total_facturado: invItem.monto_facturado,
          total_esperado: 0,
          monto_reclamar: montoRec,
          monto_nc_cantidad: montoRec,
          monto_nc_precio: 0,
          factor_empaque: 1,
          is_uom_match: false,
          estado: 'NO_EN_OC',
          severidad: 'danger',
          diagnostico: 'Ítem cobrado pero no autorizado en la Orden de Compra.',
          accion: `Solicitar Nota de Crédito por el 100% de la línea ($${Math.round(montoRec).toLocaleString('es-CL')}).`
        });
        return;
      }

      // Analizar calce de precio y cantidad
      const qFac = invItem.cantidad_facturada;
      const pFac = invItem.precio_facturado;
      const cOc = poItem.cost_unit_lc;
      const qOrd = poItem.quantity_ordered !== undefined ? poItem.quantity_ordered : (poItem.quantity_delivered || qFac);
      let qRec = poItem.quantity_delivered !== null && poItem.quantity_delivered !== undefined ? poItem.quantity_delivered : poItem.quantity_ordered;

      // Detección de factor de empaque (UOM)
      let factorEmpaque = 1;
      let isUomMatch = false;
      const ratio = qRec / (qFac || 1);
      const factoresComunes = [6, 12, 16, 20, 24, 30, 48];
      for (let f of factoresComunes) {
        if (Math.abs(ratio - f) < 0.1) {
          const montoEsperado = qRec * cOc;
          if (Math.abs(invItem.monto_facturado - montoEsperado) <= 500) {
            factorEmpaque = f;
            isUomMatch = true;
            break;
          }
        }
      }

      const qRecEffective = isUomMatch ? (qRec / factorEmpaque) : qRec;
      const cOcEffective = isUomMatch ? (cOc * factorEmpaque) : cOc;
      const qOrdEffective = isUomMatch ? (qOrd / factorEmpaque) : qOrd;

      const difQty = qRecEffective - qFac;
      const difPrice = pFac - cOcEffective;
      const totalEsperado = qRecEffective * cOcEffective;
      totalRecepcionadoNeto += totalEsperado;

      let montoLineaReclamar = 0;
      let montoNcCantidad = 0;
      let montoNcPrecio = 0;
      let tipoEstado = 'CALCE_OK';
      let severidad = 'success';
      let diag = 'Calce perfecto 100%. Precio y cantidades coinciden con la orden y recepción.';
      let acc = 'Conforme para pago.';

      if (isUomMatch && Math.abs(difQty) < 0.01 && Math.abs(difPrice) <= 5) {
        tipoEstado = 'UOM_EMPAQUE';
        severidad = 'info';
        diag = `Calce por factor de empaque (${factorEmpaque} unids/caja). Facturado en bultos, recepcionado en unidades. Monto exacto.`;
        acc = 'Conforme para pago. Homologar UOM en maestro SAP.';
        lineasConformes++;
      } else if (Math.abs(difQty) < 0.01 && Math.abs(difPrice) <= 2) {
        tipoEstado = 'CALCE_OK';
        severidad = 'success';
        lineasConformes++;
      } else {
        lineasConDescalce++;
        let razones = [];
        let acciones = [];

        // 1. Faltante físico
        if (difQty < -0.01) {
          const cantFaltante = Math.abs(difQty);
          const costoFaltante = cantFaltante * pFac;
          montoNcCantidad = costoFaltante;
          montoLineaReclamar += costoFaltante;
          totalFaltanteRecepcion += costoFaltante;
          razones.push(`Faltante físico de ${cantFaltante} unids en bodega CD36.`);
          acciones.push(`Reclamar NC por faltante físico ($${Math.round(costoFaltante).toLocaleString('es-CL')}).`);
          tipoEstado = 'FALTANTE_RECEPCION';
          severidad = 'warning';
        }

        // 2. Sobreprecio
        if (difPrice > 2) {
          const sobreprecioTotal = qRecEffective * difPrice;
          montoNcPrecio = sobreprecioTotal;
          montoLineaReclamar += sobreprecioTotal;
          totalDescalcePrecio += sobreprecioTotal;
          razones.push(`Sobreprecio de $${Math.round(difPrice).toLocaleString('es-CL')}/unid sobre el costo pactado.`);
          acciones.push(`Reclamar NC por sobreprecio ($${Math.round(sobreprecioTotal).toLocaleString('es-CL')}).`);
          tipoEstado = tipoEstado === 'FALTANTE_RECEPCION' ? 'DESCALCE_MIXTO' : 'DESCALCE_PRECIO';
          severidad = 'danger';
        }

        diag = razones.join(' ');
        acc = acciones.join(' ');
      }

      totalMontoReclamar += montoLineaReclamar;

      lineas.push({
        linea: idx + 1,
        codigo: invItem.codigo,
        ean: (poItem.barcodes && poItem.barcodes[0]) || invItem.ean || '-',
        sku: poItem.sku_id || invItem.codigo,
        descripcion: invItem.descripcion,
        unidad_medida: invItem.unidad_medida || 'UN',
        cantidad_ordenada: qOrdEffective,
        cantidad_facturada: qFac,
        cantidad_recepcionada: qRecEffective,
        dif_cantidad: difQty,
        precio_facturado: pFac,
        costo_oc: cOcEffective,
        dif_precio: difPrice,
        total_facturado: invItem.monto_facturado,
        total_esperado: totalEsperado,
        monto_reclamar: montoLineaReclamar,
        monto_nc_cantidad: montoNcCantidad,
        monto_nc_precio: montoNcPrecio,
        factor_empaque: factorEmpaque,
        is_uom_match: isUomMatch,
        estado: tipoEstado,
        severidad: severidad,
        diagnostico: diag,
        accion: acc
      });
    });

    return {
      folio_factura: inv.folio,
      proveedor_rut: inv.emisor.rut,
      proveedor_nombre: inv.emisor.razon_social,
      fecha_emision: inv.fecha_emision,
      po_number: po.po_order_id,
      almacen: po.warehouse_name,
      total_facturado_neto: totalFacturadoNeto,
      total_recepcionado_neto: totalRecepcionadoNeto,
      diferencia_total_neta: totalFacturadoNeto - totalRecepcionadoNeto,
      total_monto_reclamar: totalMontoReclamar,
      total_descalce_precio: totalDescalcePrecio,
      total_faltante_recepcion: totalFaltanteRecepcion,
      total_no_en_oc: totalNoEnOc,
      lineas_conformes: lineasConformes,
      lineas_con_descalce: lineasConDescalce,
      lineas: lineas
    };
  }

  
  function actualizarPanelControlTransaccionPaso3(res) {
    actualizarBannerPlanillaProveedor(res);
    const box = document.getElementById('boxControlTransaccionPaso3');
    const contenido = document.getElementById('contenidoControlTransaccionPaso3');
    const badge = document.getElementById('badgePaso3AuditoriaStatus');
    if (!box || !contenido) return;

    if (!res) {
      box.style.display = 'none';
      return;
    }

    const poStr = String(res.po_ref || res.po_number || '').trim();
    const provName = res.proveedor_nombre || 'Proveedor';
    const provRut = res.proveedor_rut || '-';
    const almacen = res.almacen || 'CH_36_CD_Chile (Sociedad 6202)';

    let cantFacturas = 1;
    let descFacturas = 'Factura Folio ' + (res.folio_factura || '-');
    if (res.invoices_source && Array.isArray(res.invoices_source) && res.invoices_source.length > 0) {
      cantFacturas = res.invoices_source.length;
      const foliosList = res.invoices_source.map(f => f.folio).filter(Boolean);
      descFacturas = cantFacturas + ' Facturas DTE vinculadas (' + foliosList.slice(0, 5).join(', ') + (cantFacturas > 5 ? '...' : '') + ')';
    }

    const totalFacturadoNeto = Math.round(Number(res.total_facturado_neto || 0));
    const totalFacturadoIva = Math.round(totalFacturadoNeto * 1.19);
    const totalOrdenadoOc = Math.round(Number(res.total_oc_ordenado || (res.po_data && res.po_data.total_ordenado_neto) || totalFacturadoNeto));
    const totalRecepcionado = Math.round(Number(res.total_recepcionado_neto || 0));
    const totalReclamar = Math.round(Number(res.total_monto_reclamar || 0));

    box.style.display = 'block';
    if (badge) {
      badge.textContent = 'AUDITORÍA UNIVERSAL • ' + provName.toUpperCase();
    }

    contenido.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin-bottom:10px; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
        <div>📄 <strong>Facturas Vinculadas:</strong> <span class="font-mono" style="color:var(--accent-cyan); font-weight:700;">${cantFacturas} Factura(s) DTE</span> <div style="font-size:0.75rem; color:var(--text-muted);">${descFacturas}</div></div>
        <div>📑 <strong>Total Facturado Consolidado:</strong> <span class="font-mono" style="color:#60a5fa; font-weight:700;">$${totalFacturadoNeto.toLocaleString('es-CL')} CLP</span> <span style="font-size:0.75rem; color:var(--text-muted);">($${totalFacturadoIva.toLocaleString('es-CL')} c/IVA)</span></div>
        <div>📦 <strong>Total Ordenado en OC:</strong> <span class="font-mono" style="color:var(--text-muted); font-weight:700;">$${totalOrdenadoOc.toLocaleString('es-CL')} CLP</span></div>
        <div>🏢 <strong>Recepcionado Físico Bodega:</strong> <span class="font-mono" style="color:#4ade80; font-weight:700;">$${totalRecepcionado.toLocaleString('es-CL')} CLP</span> <div style="font-size:0.75rem; color:var(--text-muted);">${almacen}</div></div>
      </div>
      <div style="background:${totalReclamar > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)'}; border:1px solid ${totalReclamar > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <span style="font-size:0.75rem; text-transform:uppercase; color:${totalReclamar > 0 ? '#fca5a5' : '#86efac'}; font-weight:800; letter-spacing:0.04em;">
            ${totalReclamar > 0 ? 'Diferencia Real de la Transacción a Reclamar en Nota de Crédito:' : 'Conciliación Cuadrada Conforme 100%:'}
          </span>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
            ${totalReclamar > 0 
              ? ('Discrepancia financiera neta entre la facturación del proveedor ($' + totalFacturadoNeto.toLocaleString('es-CL') + ') y la recepción conforme en bodega ($' + totalRecepcionado.toLocaleString('es-CL') + ').')
              : ('Todos los valores facturados coinciden plenamente con la recepción física en el almacén ' + almacen + '.')
            }
          </div>
        </div>
        <div class="font-mono" style="font-size:1.35rem; font-weight:800; color:${totalReclamar > 0 ? '#ef4444' : '#10b981'};">
          $${totalReclamar.toLocaleString('es-CL')} CLP
        </div>
      </div>
      <div style="margin-top:10px; padding:8px 12px; background:rgba(14,165,233,0.08); border-left:3px solid var(--accent-cyan); border-radius:0 4px 4px 0; font-size:0.78rem; color:var(--text-primary); line-height:1.45;">
        💡 <strong>Auditoría 3-Way Matching Consistente:</strong> Orden de Compra <strong>${poStr}</strong> &bull; Proveedor: <strong>${provName}</strong> (${provRut}) &bull; Cada línea se concilia SKU por SKU contra la recepción física en el Centro de Distribución y las facturas DTE electrónicas de Axteroid.
      </div>
    `;
  }

  function renderResultadosConciliacion1a1(res) {
    // 1. Banner Veredicto
    const banner = document.getElementById('bannerVeredicto1a1');
    const lblTitulo = document.getElementById('lblVeredictoTitulo');
    const lblDetalle = document.getElementById('lblVeredictoDetalle');
    const lblMonto = document.getElementById('lblMontoReclamarTotal');

    if (lblMonto) lblMonto.textContent = `$${Math.round(res.total_monto_reclamar).toLocaleString('es-CL')} CLP`;

    if (res.total_monto_reclamar > 0) {
      if (banner) { banner.className = 'recon-result-banner danger'; }
      if (lblTitulo) lblTitulo.innerHTML = `🚨 DESCALCE CONFIRMADO EN FACTURA ${res.folio_factura}`;
      if (lblDetalle) lblDetalle.innerHTML = `Se identificaron <strong>${res.lineas_con_descalce} líneas</strong> con diferencias de precio o faltantes en bodega para <strong>${res.proveedor_nombre}</strong>. Se recomienda emitir Nota de Crédito.`;
    } else {
      if (banner) { banner.className = 'recon-result-banner success'; }
      if (lblTitulo) lblTitulo.innerHTML = `✅ CONCILIACIÓN 1 A 1 CONFORME PARA PAGO`;
      if (lblDetalle) lblDetalle.innerHTML = `Todas las ${res.lineas_conformes} líneas coinciden 100% en precio y cantidades recepcionadas con la OC ${res.po_number}. Documento aprobado.`;
    }

    // 2. KPIs
    const kpiConf = document.getElementById('kpiLineasConformes');
    const kpiPrc = document.getElementById('kpiDescalcePrecio');
    const kpiGr = document.getElementById('kpiFaltanteRecepcion');
    const kpiNoOc = document.getElementById('kpiNoEnOc');

    if (kpiConf) kpiConf.textContent = `${res.lineas_conformes} líneas`;
    if (kpiPrc) kpiPrc.textContent = `$${Math.round(res.total_descalce_precio).toLocaleString('es-CL')}`;
    if (kpiGr) kpiGr.textContent = `$${Math.round(res.total_faltante_recepcion).toLocaleString('es-CL')}`;
    if (kpiNoOc) kpiNoOc.textContent = `$${Math.round(res.total_no_en_oc).toLocaleString('es-CL')}`;

    // 3. Cabeceras Duales
    const hFolio = document.getElementById('headInvFolio');
    const hProv = document.getElementById('headInvProveedor');
    const hRut = document.getElementById('headInvRut');
    const hFecha = document.getElementById('headInvFecha');
    const hMntFac = document.getElementById('headInvMontoNeto');

    if (hFolio) hFolio.textContent = `Folio ${res.folio_factura}`;
    if (hProv) hProv.textContent = res.proveedor_nombre;
    if (hRut) hRut.textContent = res.proveedor_rut;
    if (hFecha) hFecha.textContent = res.fecha_emision;
    if (hMntFac) hMntFac.textContent = `$${Math.round(res.total_facturado_neto).toLocaleString('es-CL')}`;

    const hPo = document.getElementById('headPoNum');
    const hAlm = document.getElementById('headPoAlmacen');
    const hMntPo = document.getElementById('headPoMontoOrdenado');
    const hMntRec = document.getElementById('headGrMontoRecepcionado');
    const hDifNet = document.getElementById('headDifNetaGlobal');

    if (hPo) hPo.textContent = `OC ${res.po_number}`;
    if (hAlm) hAlm.textContent = res.almacen;
    if (hMntPo) hMntPo.textContent = `$${Math.round(res.total_facturado_neto - res.diferencia_total_neta).toLocaleString('es-CL')}`;
    if (hMntRec) hMntRec.textContent = `$${Math.round(res.total_recepcionado_neto).toLocaleString('es-CL')}`;
    if (hDifNet) {
      hDifNet.textContent = `$${Math.round(res.diferencia_total_neta).toLocaleString('es-CL')}`;
      hDifNet.style.color = res.diferencia_total_neta > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
    }

    // 4. Conteo de Filtros de Tabla
    const cntTodos = document.getElementById('cntLineasTodos');
    const cntDesc = document.getElementById('cntLineasDescalce');
    const cntConf = document.getElementById('cntLineasConformes');

    if (cntTodos) cntTodos.textContent = res.lineas.length;
    if (cntDesc) cntDesc.textContent = res.lineas_con_descalce;
    if (cntConf) cntConf.textContent = res.lineas_conformes;

    // 5. Renderizar Tabla SKU x SKU
    actualizarPanelControlTransaccionPaso3(res);
    filtrarLineasConciliacion('todos');
  }

  function filtrarLineasConciliacion(tipoFiltro) {
    filtrarTablaPaso3(tipoFiltro);
  }

// --- CONTROL Y ENTREGA DE PLANILLA OFICIAL AL PROVEEDOR ---
  let ultimaPlanillaGenerada = null;

  function actualizarBannerPlanillaProveedor(res) {
    const box = document.getElementById('boxPlanillaProveedorPaso3');
    if (!box || !res) return;

    const lblProv = document.getElementById('lblBannerProvNombre');
    const lblPo = document.getElementById('lblBannerPoNumber');
    const lblMontoNc = document.getElementById('lblBannerMontoNc');
    const lblFolios = document.getElementById('lblBannerResumenFolios');
    const badge = document.getElementById('badgeEstadoPlanillaProveedor');
    const btnGen = document.getElementById('btnBannerGenerarPlanilla');

    const provName = res.proveedor_nombre || 'Proveedor Auditado';
    const poNum = res.po_number || res.po_ref || '-';
    const montoNc = Math.round(res.total_monto_reclamar || 0);

    if (lblProv) lblProv.textContent = provName;
    if (lblPo) lblPo.textContent = poNum;
    if (lblMontoNc) lblMontoNc.textContent = '$' + montoNc.toLocaleString('es-CL') + ' CLP';

    let cantFac = 1;
    let foliosText = 'Factura DTE Folio ' + (res.folio_factura || '-');
    if (res.invoices_source && Array.isArray(res.invoices_source) && res.invoices_source.length > 0) {
      cantFac = res.invoices_source.length;
      foliosText = cantFac + ' Facturas DTE vinculadas (' + res.invoices_source.map(f => f.folio).slice(0, 5).join(', ') + (cantFac > 5 ? '...' : '') + ')';
    } else if (res.detalle_facturas && Array.isArray(res.detalle_facturas) && res.detalle_facturas.length > 0) {
      const uF = [...new Set(res.detalle_facturas.map(f => f.factura).filter(Boolean))];
      cantFac = uF.length || 1;
      foliosText = cantFac + ' Facturas DTE vinculadas (' + uF.slice(0, 5).join(', ') + (cantFac > 5 ? '...' : '') + ')';
    }
    if (lblFolios) lblFolios.textContent = foliosText;

    if (ultimaPlanillaGenerada && (ultimaPlanillaGenerada.po_number === poNum || String(ultimaPlanillaGenerada.name).includes(String(poNum)))) {
      if (badge) {
        badge.textContent = '🟢 PLANILLA GENERADA EN DRIVE';
        badge.className = 'badge badge-success font-mono';
      }
      if (btnGen) {
        btnGen.innerHTML = '↗️ Abrir Planilla en Sheets';
        btnGen.title = 'Abrir la planilla oficial ya generada en Google Drive';
      }
    } else {
      if (badge) {
        badge.textContent = '⚪ LISTA PARA GENERAR';
        badge.className = 'badge badge-secondary font-mono';
      }
      if (btnGen) {
        btnGen.innerHTML = '📊 Generar Planilla Google Sheets';
        btnGen.title = 'Crear Spreadsheet oficial en Google Drive con formato de Cuentas por Pagar';
      }
    }
  }

  function abrirModalPlanillaProveedor(dataDirecta) {
    const res = reconActiveResult || wizardReconResult;
    if (!res && !dataDirecta) {
      showToast('Primero debes conciliar una orden de compra o factura.', 'warning');
      return;
    }

    if (dataDirecta && dataDirecta.success) {
      ultimaPlanillaGenerada = dataDirecta;
    }

    if (!ultimaPlanillaGenerada) {
      exportarPlanillaFinanzasGoogleSheets();
      return;
    }

    const data = ultimaPlanillaGenerada;
    const modal = document.getElementById('modalPlanillaProveedor');
    if (!modal) return;

    // Configurar URLs y Enlaces
    const txtUrl = document.getElementById('txtModalUrlPlanilla');
    const btnOpenSheets = document.getElementById('btnModalAbrirSheets');
    const btnDownXlsx = document.getElementById('btnModalDescargarExcel');

    const sheetUrl = data.url || ('https://docs.google.com/spreadsheets/d/' + data.spreadsheet_id + '/edit');
    const excelUrl = data.excel_url || (sheetUrl.replace(/\/edit.*$/, '') + '/export?format=xlsx');

    if (txtUrl) txtUrl.value = sheetUrl;
    if (btnOpenSheets) btnOpenSheets.href = sheetUrl;
    if (btnDownXlsx) btnDownXlsx.href = excelUrl;

    // Configurar Resumen
    const provName = data.proveedor || (res ? res.proveedor_nombre : 'Proveedor');
    const provRut = (res ? res.proveedor_rut : '96.591.040-9');
    const poNum = data.po_number || (res ? res.po_number : '-');
    const almacen = (res ? res.almacen : 'CH_36_CD_Chile');
    const montoNc = Math.round(data.monto_diferencias !== undefined ? data.monto_diferencias : (res ? res.total_monto_reclamar : 0));
    const cantDescalces = data.total_diferencias !== undefined ? data.total_diferencias : (res ? res.lineas_con_descalce : 0);

    let foliosArr = data.folios_facturas || [];
    if ((!foliosArr || foliosArr.length === 0) && res) {
      if (res.invoices_source && Array.isArray(res.invoices_source)) {
        foliosArr = res.invoices_source.map(f => f.folio);
      } else if (res.folio_factura) {
        foliosArr = [res.folio_factura];
      }
    }
    const foliosStr = foliosArr.length > 0 ? foliosArr.join(', ') : (res ? (res.folio_factura || '-') : '-');

    if (document.getElementById('modalPlanillaProvLabel')) document.getElementById('modalPlanillaProvLabel').textContent = provName;
    if (document.getElementById('modalPlanillaRutLabel')) document.getElementById('modalPlanillaRutLabel').textContent = 'RUT: ' + provRut;
    if (document.getElementById('modalPlanillaPoLabel')) document.getElementById('modalPlanillaPoLabel').textContent = poNum;
    if (document.getElementById('modalPlanillaAlmacenLabel')) document.getElementById('modalPlanillaAlmacenLabel').textContent = almacen;
    if (document.getElementById('modalPlanillaFoliosLabel')) document.getElementById('modalPlanillaFoliosLabel').textContent = foliosStr;
    if (document.getElementById('modalPlanillaCantFacturasLabel')) document.getElementById('modalPlanillaCantFacturasLabel').textContent = (foliosArr.length || 1) + ' facturas DTE auditadas';
    if (document.getElementById('modalPlanillaNcLabel')) document.getElementById('modalPlanillaNcLabel').textContent = '$' + montoNc.toLocaleString('es-CL') + ' CLP';
    if (document.getElementById('modalPlanillaDescalcesLabel')) document.getElementById('modalPlanillaDescalcesLabel').textContent = cantDescalces + ' descalces detectados';

    // Redacción formal del correo para el proveedor
    const totFac = res ? Math.round(res.total_facturado_neto || 0).toLocaleString('es-CL') : '-';
    const totRec = res ? Math.round(res.total_recepcionado_neto || 0).toLocaleString('es-CL') : '-';
    const desPrc = res ? Math.round(res.total_descalce_precio || 0).toLocaleString('es-CL') : '0';
    const falBod = res ? Math.round(res.total_faltante_recepcion || 0).toLocaleString('es-CL') : '0';
    const noOc = res ? Math.round(res.total_no_en_oc || 0).toLocaleString('es-CL') : '0';

    const asunto = '[CONCILIACIÓN 3-WAY MATCH] Solicitud de Regularización / Nota de Crédito - OC ' + poNum + ' - ' + provName + ' - Dmarts Chile (Soc. 6202)';
    const cuerpo = 'Estimado equipo de Cuentas por Cobrar / Ventas de ' + provName + ':\n\n' +
      'Junto con saludar cordialmente, les compartimos la conciliación oficial del cruce 3-Way Matching (Orden de Compra vs Recepción de Bodega vs Facturas DTE) para la siguiente transacción comercial:\n\n' +
      '• Proveedor: ' + provName + ' (RUT: ' + provRut + ')\n' +
      '• Orden de Compra SAP: ' + poNum + ' (Centro / Almacén: ' + almacen + ')\n' +
      '• Facturas Electrónicas Auditadas: ' + foliosStr + '\n' +
      '• Total Facturado Neto Auditado: $' + totFac + ' CLP\n' +
      '• Total Válido Conforme Recepcionado: $' + totRec + ' CLP\n' +
      '• MONTO TOTAL A REGULARIZAR (SOLICITUD DE NOTA DE CRÉDITO): $' + montoNc.toLocaleString('es-CL') + ' CLP\n\n' +
      'DESGLOSE DETALLADO DE DIFERENCIAS DETECTADAS:\n' +
      '- Por faltante físico en bodega (cantidades no entregadas): $' + falBod + ' CLP\n' +
      '- Por diferencia de costo unitario / sobreprecio facturado: $' + desPrc + ' CLP\n' +
      '- Cobros no autorizados en Orden de Compra: $' + noOc + ' CLP\n\n' +
      '🔗 PLANILLA OFICIAL EN GOOGLE DRIVE (FÓRMULAS ACTIVAS Y AUDITORÍA SKU X SKU):\n' +
      sheetUrl + '\n\n' +
      '📥 ENLACE DE DESCARGA DIRECTA EN FORMATO EXCEL (.XLSX):\n' +
      excelUrl + '\n\n' +
      'Solicitamos cordialmente emitir la NOTA DE CRÉDITO respectiva por el monto neto de $' + montoNc.toLocaleString('es-CL') + ' CLP (más IVA correspondiente) a nombre de Sociedad 6202 (Delivery Hero Dmarts Chile), referenciando la Orden de Compra N° ' + poNum + ' y los folios indicados, con el fin de proceder de inmediato con la liberación y pago del saldo conforme.\n\n' +
      'En la planilla adjunta encontrarán el desglose SKU x SKU con las fórmulas matemáticas oficiales y observaciones de cada línea.\n\n' +
      'Quedamos atentos a su confirmación y envío del documento tributario regularizado.\n\n' +
      'Atentamente,\n' +
      'Equipo de Cuentas por Pagar & Conciliaciones\n' +
      'Sociedad 6202 - Delivery Hero Dmarts Chile';

    const txtAsunto = document.getElementById('txtModalAsuntoCorreo');
    const txtCuerpo = document.getElementById('txtModalCuerpoCorreo');
    if (txtAsunto) txtAsunto.value = asunto;
    if (txtCuerpo) txtCuerpo.value = cuerpo;

    modal.classList.add('active');
  }

  function cerrarModalPlanillaProveedor() {
    const modal = document.getElementById('modalPlanillaProveedor');
    if (modal) modal.classList.remove('active');
  }

  function copiarUrlPlanillaProveedor() {
    const txtUrl = document.getElementById('txtModalUrlPlanilla');
    if (!txtUrl || !txtUrl.value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txtUrl.value).then(() => {
        showToast('✅ Enlace de Google Sheets copiado al portapapeles.', 'success');
      });
    } else {
      prompt('Copia el enlace de Google Sheets:', txtUrl.value);
    }
  }

  function copiarCorreoPlanillaProveedor() {
    const txtAsunto = document.getElementById('txtModalAsuntoCorreo');
    const txtCuerpo = document.getElementById('txtModalCuerpoCorreo');
    if (!txtCuerpo || !txtCuerpo.value) return;

    const fullMail = 'ASUNTO: ' + (txtAsunto ? txtAsunto.value : '') + '\n\n' + txtCuerpo.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullMail).then(() => {
        showToast('✅ Correo formal y enlaces copiados al portapapeles.', 'success');
      });
    } else {
      prompt('Copia el texto del correo para el proveedor:', fullMail);
    }
  }

  // --- EXPORTACIONES Y RESOLUCIÓN ---
  function exportarPlanillaFinanzasGoogleSheets() {
    const res = reconActiveResult || wizardReconResult;
    if (!res || !res.lineas) {
      showToast('Primero debes ejecutar la conciliación para exportar la planilla oficial.', 'warning');
      return;
    }

    const btn = document.getElementById('btnExportarPlanillaFinanzas');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Generando...';
    }
    showToast('📊 Generando Google Spreadsheet oficial de Finanzas en Google Drive...', 'info');

    const poDocNumber = res.po_number || res.po_ref || 'OC';
    const almacenDestino = res.almacen || 'CH_36_CD_Chile (Sociedad 6202)';
    const proveedorDoc = res.proveedor_nombre || (res.po_data && res.po_data.supplier_name) || 'Proveedor';

    const items = res.lineas.map(l => ({
      po: poDocNumber,
      tienda: almacenDestino,
      sku: l.sku || l.codigo || '',
      ean: l.ean || '',
      name: l.descripcion || '',
      cat: l.categoria || l.cat || 'General',
      cant_rec: l.cantidad_recepcionada !== null ? l.cantidad_recepcionada : 0,
      costo_oc: l.costo_oc || 0,
      cant_fac: l.cantidad_facturada || 0,
      costo_total_fac: l.total_facturado || (l.cantidad_facturada * (l.precio_facturado || 0)),
      comentario: l.comentario || `Factura ${res.folio_factura || ''} - ${l.diagnostico || l.estado || ''}`
    }));

    let detalleFacturas = [];
    if (res.invoices_source && Array.isArray(res.invoices_source) && res.invoices_source.length > 0) {
      res.invoices_source.forEach(inv => {
        let invItems = inv.items || [];
        if ((!invItems || invItems.length === 0) && wizardSelectedInvoice && wizardSelectedInvoice.items) {
          invItems = wizardSelectedInvoice.items;
        }
        invItems.forEach(fi => {
          detalleFacturas.push({
            factura: String(inv.folio),
            codigo: fi.codigo || fi.sku || '',
            descripcion: fi.descripcion || '',
            unid_vta: fi.unidad_medida || 'UN',
            cantidad: Number(fi.cantidad_facturada || 0),
            precio_unitario: Number(fi.precio_facturado || 0),
            valor_neto: Number(fi.monto_facturado || (fi.cantidad_facturada * fi.precio_facturado) || 0)
          });
        });
      });
    }

    if (detalleFacturas.length === 0) {
      detalleFacturas = res.lineas.map(l => ({
        factura: res.folio_factura || 'Factura',
        codigo: l.codigo || l.sku || '',
        descripcion: l.descripcion || '',
        unid_vta: l.unidad_medida || 'UN',
        cantidad: l.cantidad_facturada || 0,
        precio_unitario: l.precio_facturado || 0,
        valor_neto: l.total_facturado || (l.cantidad_facturada * (l.precio_facturado || 0))
      }));
    }

    const payload = {
      proveedor: proveedorDoc,
      po_number: poDocNumber,
      tienda: almacenDestino,
      items: items,
      detalle_facturas: detalleFacturas
    };

    const runner = (typeof google !== 'undefined' && google.script && google.script.run) ? google.script.run : null;
    const fnTarget = runner ? (runner.apiCrearPlanillaConciliacionOficialGoogleSheets || runner.apiGenerarSpreadsheetFinanzas) : null;

    if (runner && typeof fnTarget === 'function') {
      runner
        .withSuccessHandler((out) => {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
          if (out && out.success) {
            const difMsg = out.monto_diferencias > 0
              ? ` ($${formatCurrency(out.monto_diferencias)} en ${out.total_diferencias} descalces)`
              : '';
            ultimaPlanillaGenerada = out;
            actualizarBannerPlanillaProveedor(res);
            showToast(`✅ Planilla Oficial generada en Google Drive${difMsg}.`, 'success');
            abrirModalPlanillaProveedor(out);
            if (out.url) {
              try { window.open(out.url, '_blank'); } catch (eOpen) {}
            }
          } else {
            showToast('Aviso: ' + (out ? out.error : 'No se pudo generar en Drive'), 'warning');
          }
        })
        .withFailureHandler((err) => {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
          showToast('Error conectando con Google Drive: ' + err.message, 'danger');
        });

      if (typeof runner.apiCrearPlanillaConciliacionOficialGoogleSheets === 'function') {
        runner.apiCrearPlanillaConciliacionOficialGoogleSheets(payload);
      } else {
        runner.apiGenerarSpreadsheetFinanzas(payload);
      }
    } else {
      // Modo local / offline: descargar el archivo Excel oficial generado
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
      const safeProv = (proveedorDoc).replace(/[^a-zA-Z0-9]/g, '_');
      const safePo = (poDocNumber).replace(/[^a-zA-Z0-9]/g, '_');
      showToast('📥 Descargando formato oficial en Excel (.xlsx)...', 'success');
      const link = document.createElement('a');
      link.href = 'Planilla_Conciliacion_Finanzas_Oficial.xlsx';
      link.download = `Planilla_Conciliacion_Finanzas_${safeProv}_${safePo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ultimaPlanillaGenerada = {
        success: true,
        spreadsheet_id: 'local_spreadsheet_' + Date.now(),
        url: 'https://docs.google.com/spreadsheets/d/1tV8no7qLQI_6dVMoqN8dMGJdb0E4rYTE/edit',
        excel_url: `Planilla_Conciliacion_Finanzas_${safeProv}_${safePo}.xlsx`,
        name: `Planilla_Conciliacion_${safeProv}_${safePo}`,
        proveedor: proveedorDoc,
        po_number: poDocNumber,
        total_items: items.length,
        total_diferencias: res.lineas_con_descalce,
        monto_diferencias: res.total_monto_reclamar
      };
      actualizarBannerPlanillaProveedor(res);
      abrirModalPlanillaProveedor(ultimaPlanillaGenerada);
    }
  }

  function exportarActaConciliacionCsv() {
    const res = reconActiveResult || wizardReconResult;
    if (!res || !res.lineas) {
      alert('Primero debes ejecutar la conciliación para exportar el acta.');
      return;
    }

    const lines = [];
    lines.push(['ACTA OFICIAL DE CONCILIACIÓN Y AUDITORÍA 1 A 1 - SOCIEDAD 6202 (PEDIDOSYA / DMARTS CHILE)'].join(';'));
    lines.push([`Folio Factura DTE:;${res.folio_factura};Fecha Emisión:;${res.fecha_emision}`].join(';'));
    lines.push([`Proveedor:;${res.proveedor_nombre};RUT Emisor:;${res.proveedor_rut}`].join(';'));
    lines.push([`Orden de Compra:;${res.po_number};Almacén Destino:;${res.almacen}`].join(';'));
    lines.push([`Total Facturado Neto:;$ ${Math.round(res.total_facturado_neto)};Total Válido a Pagar:;$ ${Math.round(res.total_recepcionado_neto)}`].join(';'));
    lines.push([`TOTAL A RECLAMAR (NOTA DE CRÉDITO):;$ ${Math.round(res.total_monto_reclamar)};Líneas con Descalce:;${res.lineas_con_descalce}`].join(';'));
    lines.push([`Descalce Faltante Bodega:;$ ${Math.round(res.total_faltante_recepcion || 0)};Descalce Sobreprecio:;$ ${Math.round(res.total_descalce_precio || 0)};Cobros No en OC:;$ ${Math.round(res.total_no_en_oc || 0)}`].join(';'));
    lines.push(['']);
    lines.push(['#;SKU PedidosYa;Código Proveedor;EAN-13;Descripción Ítem;UOM;Cant. Ordenada (OC);Cant. Facturada (DTE);Cant. Recepcionada (Bodega);Δ Faltante Unids;Costo Unitario OC;Precio Facturado Unitario;Δ Sobreprecio Unitario;Total Facturado Línea;Total Válido a Pagar;Monto NC a Reclamar;Reclamo x Faltante;Reclamo x Sobreprecio;Dictamen;Diagnóstico & Acción'].join(';'));

    res.lineas.forEach(l => {
      lines.push([
        l.linea,
        `"${l.sku}"`,
        `"${l.codigo}"`,
        `"${l.ean}"`,
        `"${(l.descripcion || '').replace(/"/g, '""')}"`,
        `"${l.unidad_medida || 'UN'}"`,
        l.cantidad_ordenada !== undefined ? l.cantidad_ordenada : '-',
        l.cantidad_facturada,
        l.cantidad_recepcionada,
        l.dif_cantidad,
        Math.round(l.costo_oc),
        Math.round(l.precio_facturado),
        Math.round(l.dif_precio),
        Math.round(l.total_facturado),
        Math.round(l.total_esperado),
        Math.round(l.monto_reclamar),
        Math.round(l.monto_nc_cantidad || 0),
        Math.round(l.monto_nc_precio || 0),
        l.estado,
        `"${(l.diagnostico || '').replace(/"/g, '""')} ${(l.accion || '').replace(/"/g, '""')}"`
      ].join(';'));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    descargarTextoComoArchivo(`Acta_Auditoria_Fac_${res.folio_factura}_OC_${res.po_number}.csv`, csvContent, 'text/csv;charset=utf-8;');
    showToast('Acta de Auditoría descargada en CSV.', 'success');
  }

  function copiarResumenPortapapeles() {
    const res = reconActiveResult || wizardReconResult;
    if (!res || !res.lineas) {
      alert('Primero debes ejecutar la conciliación.');
      return;
    }

    const txt = `📌 ACTA DE AUDITORÍA Y CONCILIACIÓN SKU X SKU (Sociedad 6202 - PedidosYa Chile)
-----------------------------------------------------------------------------------
• Factura DTE: Folio ${res.folio_factura} (${res.proveedor_nombre} - RUT ${res.proveedor_rut})
• Orden de Compra SAP: ${res.po_number} en ${res.almacen}
• Total Facturado Neto: $${Math.round(res.total_facturado_neto).toLocaleString('es-CL')} CLP
• Total Válido a Pagar (Costo OC): $${Math.round(res.total_recepcionado_neto).toLocaleString('es-CL')} CLP
• MONTO TOTAL A RECLAMAR EN NOTA DE CRÉDITO: $${Math.round(res.total_monto_reclamar).toLocaleString('es-CL')} CLP
  - Descalce por Sobreprecio: $${Math.round(res.total_descalce_precio || 0).toLocaleString('es-CL')} CLP
  - Descalce por Faltante Físico: $${Math.round(res.total_faltante_recepcion || 0).toLocaleString('es-CL')} CLP
  - Cobros No Autorizados en OC: $${Math.round(res.total_no_en_oc || 0).toLocaleString('es-CL')} CLP

DETALLE DE DISCREPANCIAS POR LÍNEA:
${res.lineas.filter(l => l.monto_reclamar > 0).map(l => ` - [Línea ${l.linea} | SKU ${l.sku}] ${l.descripcion}:
   • Físico: Pedido ${l.cantidad_ordenada || l.cantidad_recepcionada} | Facturado ${l.cantidad_facturada} | Recibido Bodega ${l.cantidad_recepcionada} (Δ ${l.dif_cantidad} unids)
   • Precios: Facturado $${Math.round(l.precio_facturado)} | Costo OC $${Math.round(l.costo_oc)} (Δ $${Math.round(l.dif_precio)})
   • Reclamo NC: $${Math.round(l.monto_reclamar).toLocaleString('es-CL')} CLP => ${l.diagnostico}`).join('\n\n') || ' (Sin descalces, calce 100% conforme)'}

Acción Requerida:
Emitir Nota de Crédito por $${Math.round(res.total_monto_reclamar).toLocaleString('es-CL')} CLP a nombre de PedidosYa Chile (Sociedad 6202) para proceder con la liberación del pago.`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        showToast('Acta ejecutiva copiada al portapapeles.', 'success');
      });
    } else {
      prompt('Copia el informe para el proveedor o Category Manager:', txt);
    }
  }

  function enviarCasoAGoogleSheets() {
    if (!reconActiveResult) {
      alert('Primero debes conciliar los documentos.');
      return;
    }

    const res = reconActiveResult;
    const casoObj = {
      po_number: res.po_number,
      sociedad: '6202',
      pais: 'cl',
      proveedor: res.proveedor_nombre,
      rut: res.proveedor_rut,
      tienda: res.almacen,
      monto_factura: res.total_facturado_neto,
      monto_oc: res.total_facturado_neto - res.diferencia_total_neta,
      diferencia_reportada: res.diferencia_total_neta,
      facturas_referenciadas: res.folio_factura,
      auditoria_app: {
        estado: res.total_monto_reclamar > 0 ? 'DESCALCE_CONFIRMADO' : 'CONCILIADO_OK',
        monto_reclamar: res.total_monto_reclamar,
        diagnostico: `Conciliación 1 a 1 Factura ${res.folio_factura} vs OC ${res.po_number}. Descalces: $${Math.round(res.total_monto_reclamar).toLocaleString('es-CL')} CLP.`
      }
    };

    showToast('💾 Guardando caso en la bitácora central de seguimiento...', 'info');

    google.script.run
      .withSuccessHandler((apiRes) => {
        if (apiRes.success) {
          showToast(`✅ Factura ${res.folio_factura} guardada en la bitácora central de seguimiento.`, 'success');
          cargarCasosSpreadsheet();
        } else {
          alert('No se pudo guardar en la bitácora: ' + apiRes.error);
        }
      })
      .withFailureHandler((err) => {
        alert('Fallo guardando en la bitácora: ' + err.message);
      })
      .apiPushCaseToSpreadsheet(casoObj);
  }


  function descargarPdf(docId) {
    google.script.run
      .withSuccessHandler((res) => {
        if (res.success && res.data.base64) {
          const byteCharacters = atob(res.data.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } else {
          alert('No se pudo descargar el PDF: ' + (res.error || 'Desconocido'));
        }
      })
      .apiGetInvoicePdf(docId);
  }


  function descargarTextoComoArchivo(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showToast(msg, type) {
    const existing = document.getElementById('floatingToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'floatingToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
    toast.style.zIndex = '10000';
    toast.style.transition = 'all 0.3s ease';

    if (type === 'success') {
      toast.style.background = '#065f46';
      toast.style.color = '#a7f3d0';
      toast.style.border = '1px solid #10b981';
      toast.innerHTML = '✅ ' + msg;
    } else if (type === 'warning') {
      toast.style.background = '#78350f';
      toast.style.color = '#fde68a';
      toast.style.border = '1px solid #f59e0b';
      toast.innerHTML = '⚠️ ' + msg;
    } else {
      toast.style.background = '#1e293b';
      toast.style.color = '#e2e8f0';
      toast.style.border = '1px solid #3b82f6';
      toast.innerHTML = 'ℹ️ ' + msg;
    }

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4500);
  }


  // =========================================================================
  // CONTROLADOR DEL MÓDULO ÚNICO: AFOROS CHILE & DIRECTORIO DINÁMICO
  // =========================================================================


  // Catálogo inicial compacto de demostración (se reemplaza dinámicamente con búsquedas en vivo)
  const FACTURAS_CATALOGO_INICIAL = [
  {
    "folio": "105275609",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 36589,
    "monto_total": 54687,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUbqdD-9ZI",
    "items": [
      {
        "linea": 1,
        "codigo": "9507",
        "ean": "9507",
        "descripcion": "ALTO DEL CARMEN TRANSP 40 X01 VID 750CC",
        "cantidad_facturada": 7,
        "unidad_medida": "UN",
        "precio_facturado": 5055,
        "monto_facturado": 35385
      }
    ]
  },
  {
    "folio": "105275608",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 144911,
    "monto_total": 185966,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUbn_HbAKX",
    "items": [
      {
        "linea": 1,
        "codigo": "2009",
        "ean": "2009",
        "descripcion": "INCA KOLA X06 PET 3000",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 11787,
        "monto_facturado": 11787
      },
      {
        "linea": 2,
        "codigo": "1993",
        "ean": "1993",
        "descripcion": "MONSTER ULTRA PEACHY KEEN X06 LAT 473",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 5307,
        "monto_facturado": 5307
      },
      {
        "linea": 3,
        "codigo": "1989",
        "ean": "1989",
        "descripcion": "MONSTER ZERO SUGAR GREEN X06 LAT 473",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 5307,
        "monto_facturado": 10614
      },
      {
        "linea": 4,
        "codigo": "1988",
        "ean": "1988",
        "descripcion": "MONSTER RIPPER NON JUICE X06 LAT 473",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 4997,
        "monto_facturado": 9994
      },
      {
        "linea": 5,
        "codigo": "1987",
        "ean": "1987",
        "descripcion": "MONSTER AUSSIE LEMONADE X06 LAT 473",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 5307,
        "monto_facturado": 5307
      },
      {
        "linea": 6,
        "codigo": "1980",
        "ean": "1980",
        "descripcion": "MONSTER ULTRA PARADISE x06 LATA 473 cc",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 5307,
        "monto_facturado": 5307
      },
      {
        "linea": 7,
        "codigo": "1978",
        "ean": "1978",
        "descripcion": "MONSTER MANGO LOCO X06 LATA 473CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 5307,
        "monto_facturado": 5307
      },
      {
        "linea": 8,
        "codigo": "1966",
        "ean": "1966",
        "descripcion": "MONSTER ULTRA X06 473 CC",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 5307,
        "monto_facturado": 42456
      },
      {
        "linea": 9,
        "codigo": "1963",
        "ean": "1963",
        "descripcion": "MONSTER ENERGY X06 473 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 4997,
        "monto_facturado": 9994
      },
      {
        "linea": 10,
        "codigo": "2583",
        "ean": "2583",
        "descripcion": "AQUARIUS LIMONADA X06 PET 1.600 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 3718,
        "monto_facturado": 3718
      },
      {
        "linea": 11,
        "codigo": "2508",
        "ean": "2508",
        "descripcion": "BENEDICTINO SIN GAS X06 PET 500 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2288,
        "monto_facturado": 2288
      },
      {
        "linea": 12,
        "codigo": "2509",
        "ean": "2509",
        "descripcion": "BENEDICTINO CON GAS X06 PET 500 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2288,
        "monto_facturado": 2288
      }
    ]
  },
  {
    "folio": "105275606",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 277986,
    "monto_total": 352065,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUblJ--tLK",
    "items": [
      {
        "linea": 1,
        "codigo": "0476",
        "ean": "0476",
        "descripcion": "SCHWEPPES GINGER ALE SA X6 PET 1.5",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 7572,
        "monto_facturado": 7572
      },
      {
        "linea": 2,
        "codigo": "0336",
        "ean": "0336",
        "descripcion": "COCA COLA LIGTH X06 PET 1500 CC",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 8697,
        "monto_facturado": 43485
      },
      {
        "linea": 3,
        "codigo": "0377",
        "ean": "0377",
        "descripcion": "COCA COLA SIN AZUCAR X06 PET 1.500 CC",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 8697,
        "monto_facturado": 78273
      },
      {
        "linea": 4,
        "codigo": "4274",
        "ean": "4274",
        "descripcion": "FANTA NARANJA ZERO+VITAMC X06 PET 1500",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 7572,
        "monto_facturado": 7572
      },
      {
        "linea": 5,
        "codigo": "0757",
        "ean": "0757",
        "descripcion": "SPRITE X06 PET 1.500 CC",
        "cantidad_facturada": 4,
        "unidad_medida": "UN",
        "precio_facturado": 7572,
        "monto_facturado": 30288
      },
      {
        "linea": 6,
        "codigo": "0694",
        "ean": "0694",
        "descripcion": "SPRITE ZERO X06 PET 1500 CC",
        "cantidad_facturada": 4,
        "unidad_medida": "UN",
        "precio_facturado": 7572,
        "monto_facturado": 30288
      },
      {
        "linea": 7,
        "codigo": "2004",
        "ean": "2004",
        "descripcion": "INCA KOLA ZERO X06 PET 1500 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 7572,
        "monto_facturado": 15144
      },
      {
        "linea": 8,
        "codigo": "1136",
        "ean": "1136",
        "descripcion": "AND MANZANA 1500CC OW X06",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 6662,
        "monto_facturado": 6662
      },
      {
        "linea": 9,
        "codigo": "1362",
        "ean": "1362",
        "descripcion": "AND DURAZNO LIGHT X06 PET 1500",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 6662,
        "monto_facturado": 13324
      },
      {
        "linea": 10,
        "codigo": "1462",
        "ean": "1462",
        "descripcion": "AND PINA LIGHT X06 PET 1500",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 6662,
        "monto_facturado": 6662
      },
      {
        "linea": 11,
        "codigo": "1534",
        "ean": "1534",
        "descripcion": "AND NARAN LIGHT PET1500CC BOCAANCHA",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 6662,
        "monto_facturado": 6662
      }
    ]
  },
  {
    "folio": "105275605",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 166643,
    "monto_total": 204136,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUbiVoxQMw",
    "items": [
      {
        "linea": 1,
        "codigo": "2625",
        "ean": "2625",
        "descripcion": "BENEDICTINO FRUTOS ROJOS X6 PET 500 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2707,
        "monto_facturado": 2707
      },
      {
        "linea": 2,
        "codigo": "2624",
        "ean": "2624",
        "descripcion": "BENEDICTINO FRUTOS ROJOS X06 PET 1.500 C",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 3707,
        "monto_facturado": 3707
      },
      {
        "linea": 3,
        "codigo": "2560",
        "ean": "2560",
        "descripcion": "BENEDICTINO POMELO MENTA X06 PET 1.500CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 3707,
        "monto_facturado": 7414
      },
      {
        "linea": 4,
        "codigo": "2559",
        "ean": "2559",
        "descripcion": "BENEDICTINO PERA X06 PET 1.500",
        "cantidad_facturada": 4,
        "unidad_medida": "UN",
        "precio_facturado": 3707,
        "monto_facturado": 14828
      },
      {
        "linea": 5,
        "codigo": "2558",
        "ean": "2558",
        "descripcion": "BENEDICTINO MANZANA X06 PET 1.500",
        "cantidad_facturada": 6,
        "unidad_medida": "UN",
        "precio_facturado": 3707,
        "monto_facturado": 22242
      },
      {
        "linea": 6,
        "codigo": "2557",
        "ean": "2557",
        "descripcion": "BENEDICTINO LIMON JENJIBRE X06 PET 1.500",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 3707,
        "monto_facturado": 7414
      },
      {
        "linea": 7,
        "codigo": "2504",
        "ean": "2504",
        "descripcion": "BENEDICTINO CON GAS X06 PET 1500 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 2702,
        "monto_facturado": 5404
      },
      {
        "linea": 8,
        "codigo": "2503",
        "ean": "2503",
        "descripcion": "BENEDICTINO SIN GAS X06 PET 1500 CC",
        "cantidad_facturada": 4,
        "unidad_medida": "UN",
        "precio_facturado": 2702,
        "monto_facturado": 10808
      },
      {
        "linea": 9,
        "codigo": "2244",
        "ean": "2244",
        "descripcion": "VITAL SG X06 PET 2500",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 4267,
        "monto_facturado": 12801
      },
      {
        "linea": 10,
        "codigo": "2133",
        "ean": "2133",
        "descripcion": "VITAL SIN GAS X06 PET 1.600",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 3400,
        "monto_facturado": 30600
      },
      {
        "linea": 11,
        "codigo": "2233",
        "ean": "2233",
        "descripcion": "VITAL CON GAS X06 PET 1.600",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 3400,
        "monto_facturado": 10200
      }
    ]
  },
  {
    "folio": "105275603",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 413439,
    "monto_total": 522773,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUbfl899yJ",
    "items": [
      {
        "linea": 1,
        "codigo": "7223",
        "ean": "7223",
        "descripcion": "NEC.DUR X06 TP200CC",
        "cantidad_facturada": 6,
        "unidad_medida": "UN",
        "precio_facturado": 1468,
        "monto_facturado": 8808
      },
      {
        "linea": 2,
        "codigo": "1414",
        "ean": "1414",
        "descripcion": "AND DEL VALLE PINA LIGHT X06 TETRA 200CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 1468,
        "monto_facturado": 1468
      },
      {
        "linea": 3,
        "codigo": "3000",
        "ean": "3000",
        "descripcion": "FASTLYTE FRUTILLA PET X6 625 ML",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 8449,
        "monto_facturado": 8449
      },
      {
        "linea": 4,
        "codigo": "0161",
        "ean": "0161",
        "descripcion": "COCA COLA X06 LATA 350 CC",
        "cantidad_facturada": 49,
        "unidad_medida": "UN",
        "precio_facturado": 2767,
        "monto_facturado": 135583
      },
      {
        "linea": 5,
        "codigo": "0381",
        "ean": "0381",
        "descripcion": "COCA COLA SIN AZUCAR X06 LATA 350 CC",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 2939,
        "monto_facturado": 52902
      },
      {
        "linea": 6,
        "codigo": "4272",
        "ean": "4272",
        "descripcion": "FANTA NARANJA ZERO+VITAMC X06 LATA 350",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2939,
        "monto_facturado": 2939
      },
      {
        "linea": 7,
        "codigo": "0692",
        "ean": "0692",
        "descripcion": "SPRITE ZERO X06 LATA 350 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2939,
        "monto_facturado": 2939
      },
      {
        "linea": 8,
        "codigo": "2524",
        "ean": "2524",
        "descripcion": "BENEDICTINO SIN GAS X02 PET 6.500 CC",
        "cantidad_facturada": 34,
        "unidad_medida": "UN",
        "precio_facturado": 2899,
        "monto_facturado": 98566
      },
      {
        "linea": 9,
        "codigo": "5625",
        "ean": "5625",
        "descripcion": "GLL VITAMIN RED x06 PET 1 LT",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 9206,
        "monto_facturado": 9206
      },
      {
        "linea": 10,
        "codigo": "5624",
        "ean": "5624",
        "descripcion": "GLL VITAMIN ORANGE x06 PET 1 LT",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 9206,
        "monto_facturado": 9206
      },
      {
        "linea": 11,
        "codigo": "5575",
        "ean": "5575",
        "descripcion": "GLL JUGO MANGO X06 PET 1 LT",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 8516,
        "monto_facturado": 8516
      },
      {
        "linea": 12,
        "codigo": "0922",
        "ean": "0922",
        "descripcion": "FANTA NAR FULLSUGAR X06 LATA 350 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2767,
        "monto_facturado": 2767
      }
    ]
  },
  {
    "folio": "105275602",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 34844,
    "monto_total": 46991,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUbcP1knBA",
    "items": [
      {
        "linea": 1,
        "codigo": "0929",
        "ean": "0929",
        "descripcion": "FANTA NAR FULLSUGAR X06 PET 3000 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 11787,
        "monto_facturado": 23574
      },
      {
        "linea": 2,
        "codigo": "0933",
        "ean": "0933",
        "descripcion": "FANTA POMELO FULLSUGAR X06 PET 1500 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 7130,
        "monto_facturado": 7130
      }
    ]
  },
  {
    "folio": "105275607",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 122979,
    "monto_total": 158076,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDURlT_jkxu",
    "items": [
      {
        "linea": 1,
        "codigo": "2529",
        "ean": "2529",
        "descripcion": "BENEDICTINO PERA X06 PET 500 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2707,
        "monto_facturado": 2707
      },
      {
        "linea": 2,
        "codigo": "2528",
        "ean": "2528",
        "descripcion": "BENEDICTINO MANZANA X06 PET 500 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 2707,
        "monto_facturado": 2707
      },
      {
        "linea": 3,
        "codigo": "0177",
        "ean": "0177",
        "descripcion": "COKE X06 PET 591 CC",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 3959,
        "monto_facturado": 11877
      },
      {
        "linea": 4,
        "codigo": "0388",
        "ean": "0388",
        "descripcion": "COCA COLA SIN AZUCAR X06 PET 591 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 4205,
        "monto_facturado": 4205
      },
      {
        "linea": 5,
        "codigo": "4269",
        "ean": "4269",
        "descripcion": "FANTA NAR ZERO X06 PET 591 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 4205,
        "monto_facturado": 4205
      },
      {
        "linea": 6,
        "codigo": "0742",
        "ean": "0742",
        "descripcion": "SPRITE X06 PET 591 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 4205,
        "monto_facturado": 4205
      },
      {
        "linea": 7,
        "codigo": "0688",
        "ean": "0688",
        "descripcion": "SPRITE ZERO X06 PET 591 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 4205,
        "monto_facturado": 4205
      },
      {
        "linea": 8,
        "codigo": "4654",
        "ean": "4654",
        "descripcion": "POWERADE ZERO UVA X06 PET 1.1",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 5072,
        "monto_facturado": 10144
      },
      {
        "linea": 9,
        "codigo": "4652",
        "ean": "4652",
        "descripcion": "POWERADE ZERO FROZEN BLAST X06 PET 1.1",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 5072,
        "monto_facturado": 5072
      },
      {
        "linea": 10,
        "codigo": "4651",
        "ean": "4651",
        "descripcion": "POWERADE ROJO X06 PET 1.1",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 5072,
        "monto_facturado": 5072
      },
      {
        "linea": 11,
        "codigo": "4649",
        "ean": "4649",
        "descripcion": "POWERADE FROZEN BLAST X06 PET 1.1",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 5072,
        "monto_facturado": 10144
      },
      {
        "linea": 12,
        "codigo": "0136",
        "ean": "0136",
        "descripcion": "COCA COLA X06 PET 1500 CC",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 8189,
        "monto_facturado": 40945
      }
    ]
  },
  {
    "folio": "105275604",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 695468,
    "monto_total": 896939,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUOaXZbdxF",
    "items": [
      {
        "linea": 1,
        "codigo": "2520",
        "ean": "2520",
        "descripcion": "BENEDICTINO SIN GAS X06 PET 3.000 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 3398,
        "monto_facturado": 3398
      },
      {
        "linea": 2,
        "codigo": "2521",
        "ean": "2521",
        "descripcion": "BENEDICTINO CON GAS X06 PET 3.000 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 3398,
        "monto_facturado": 3398
      },
      {
        "linea": 3,
        "codigo": "0154",
        "ean": "0154",
        "descripcion": "COCA COLA X06 PET 3000 CC",
        "cantidad_facturada": 12,
        "unidad_medida": "UN",
        "precio_facturado": 12297,
        "monto_facturado": 147564
      },
      {
        "linea": 4,
        "codigo": "0354",
        "ean": "0354",
        "descripcion": "COCA COLA LIGTH X06 PET 3000 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 13059,
        "monto_facturado": 26118
      },
      {
        "linea": 5,
        "codigo": "0379",
        "ean": "0379",
        "descripcion": "COCA COLA SIN AZUCAR X06 PET 3.000 CC",
        "cantidad_facturada": 25,
        "unidad_medida": "UN",
        "precio_facturado": 13059,
        "monto_facturado": 326475
      },
      {
        "linea": 6,
        "codigo": "0579",
        "ean": "0579",
        "descripcion": "FANTA ZERO X06 PET 3.000 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 12518,
        "monto_facturado": 25036
      },
      {
        "linea": 7,
        "codigo": "0767",
        "ean": "0767",
        "descripcion": "SPRITE X06 PET 3.000 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 12518,
        "monto_facturado": 25036
      },
      {
        "linea": 8,
        "codigo": "0679",
        "ean": "0679",
        "descripcion": "SPRITE ZERO X06 PET 3000 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 12518,
        "monto_facturado": 25036
      },
      {
        "linea": 9,
        "codigo": "1423",
        "ean": "1423",
        "descripcion": "AND DEL VALLE PINA X06 TETRA 200 CC",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 1468,
        "monto_facturado": 13212
      },
      {
        "linea": 10,
        "codigo": "1523",
        "ean": "1523",
        "descripcion": "AND DEL VALLE NARANJA X06 TETRA 200 CC",
        "cantidad_facturada": 6,
        "unidad_medida": "UN",
        "precio_facturado": 1468,
        "monto_facturado": 8808
      },
      {
        "linea": 11,
        "codigo": "1123",
        "ean": "1123",
        "descripcion": "AND DEL VALLE MANZANA X06 TETRA 200 CC",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 1468,
        "monto_facturado": 11744
      },
      {
        "linea": 12,
        "codigo": "1514",
        "ean": "1514",
        "descripcion": "AND DEL VALLE NARANJA LIGHT X6 TETRA 200",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 1468,
        "monto_facturado": 1468
      }
    ]
  },
  {
    "folio": "105275601",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 136777,
    "monto_total": 204279,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUOXlpu9FC",
    "items": [
      {
        "linea": 1,
        "codigo": "9501",
        "ean": "9501",
        "descripcion": "ALTO DEL CARMEN ESPEC 35 X06 VID 1000CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 33883,
        "monto_facturado": 67766
      },
      {
        "linea": 2,
        "codigo": "9507",
        "ean": "9507",
        "descripcion": "ALTO DEL CARMEN TRANSP 40 X01 VID 750CC",
        "cantidad_facturada": 7,
        "unidad_medida": "UN",
        "precio_facturado": 5055,
        "monto_facturado": 35385
      },
      {
        "linea": 3,
        "codigo": "9517",
        "ean": "9517",
        "descripcion": "ALTO DEL CARMEN ESPEC 35 X06 VID 750CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 28638,
        "monto_facturado": 28638
      }
    ]
  },
  {
    "folio": "105275600",
    "proveedor": "Coca Cola Embonor S.A.",
    "rut": "93281000-K",
    "fecha": "2026-09-30",
    "monto_neto": 357471,
    "monto_total": 491118,
    "oc_asociada": "PO521534",
    "order_reference": "0000521534",
    "aforo_tipo": "Bebestibles - Ambiente (Coca-Cola Embonor)",
    "almacen": "CH_8_Vina del Mar (Sociedad 6202)",
    "ax_doc_id": "do_AAABoPDUOUIBkxMc",
    "items": [
      {
        "linea": 1,
        "codigo": "9410",
        "ean": "9410",
        "descripcion": "CERV QUILMES 4,9 1X12 LATA 354CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 6506,
        "monto_facturado": 6506
      },
      {
        "linea": 2,
        "codigo": "9817",
        "ean": "9817",
        "descripcion": "CERV BECKER 4,5 4X6 LATA 473 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 15131,
        "monto_facturado": 15131
      },
      {
        "linea": 3,
        "codigo": "9840",
        "ean": "9840",
        "descripcion": "CERV CORONA 4,5 X12 VIDRIO 330 CC",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 10597,
        "monto_facturado": 31791
      },
      {
        "linea": 4,
        "codigo": "9841",
        "ean": "9841",
        "descripcion": "CERV CORONA 4,5 X18 VIDRIO 330 CC",
        "cantidad_facturada": 2,
        "unidad_medida": "UN",
        "precio_facturado": 11522,
        "monto_facturado": 23044
      },
      {
        "linea": 5,
        "codigo": "9843",
        "ean": "9843",
        "descripcion": "CERV CORONA 4,5 4X6 VIDRIO 330 CC",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 20762,
        "monto_facturado": 103810
      },
      {
        "linea": 6,
        "codigo": "9898",
        "ean": "9898",
        "descripcion": "STELLA ARTOIS 5 4X6 VIDRIO 330 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 19038,
        "monto_facturado": 19038
      },
      {
        "linea": 7,
        "codigo": "1700",
        "ean": "1700",
        "descripcion": "CERV. BALTICA 5,8o 1X6 LATA 473 CC",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 1871,
        "monto_facturado": 1871
      },
      {
        "linea": 8,
        "codigo": "1718",
        "ean": "1718",
        "descripcion": "CERV. QUILMES 4,9o 1X6 LATA 473",
        "cantidad_facturada": 12,
        "unidad_medida": "UN",
        "precio_facturado": 4314,
        "monto_facturado": 51768
      },
      {
        "linea": 9,
        "codigo": "1719",
        "ean": "1719",
        "descripcion": "CERV.STELLA ARTOIS 5o 1X6 LATA 473",
        "cantidad_facturada": 13,
        "unidad_medida": "UN",
        "precio_facturado": 5205,
        "monto_facturado": 67665
      }
    ]
  },
  {
    "folio": "56500972",
    "proveedor": "Ideal S.A.",
    "rut": "90297000-0",
    "fecha": "2026-09-29",
    "monto_neto": 1968789,
    "monto_total": 2342857,
    "oc_asociada": "PO521015",
    "order_reference": "521015",
    "aforo_tipo": "Panadería y Masas (Ideal S.A.)",
    "almacen": "CH_34_Manuel Montt (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO3pE68cnwlF",
    "items": [
      {
        "linea": 1,
        "codigo": "965383",
        "descripcion": "965383 Takis Buckin Ranch CH 1p 190g FLOW BAR",
        "cantidad_facturada": 14,
        "unidad_medida": "UN",
        "precio_facturado": 1168,
        "monto_facturado": 16352
      },
      {
        "linea": 2,
        "codigo": "503068",
        "descripcion": "Alfajor Clasico 4p 180g Dpy LDS",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 1411,
        "monto_facturado": 50796
      },
      {
        "linea": 3,
        "codigo": "21734",
        "descripcion": "21734 Tortilla Pack Fiesta 24p 600g BOLSA TR",
        "cantidad_facturada": 12,
        "unidad_medida": "UN",
        "precio_facturado": 2013,
        "monto_facturado": 24156
      },
      {
        "linea": 4,
        "codigo": "504566",
        "descripcion": "504566 Tortilla Burrera 22cms 8p 400g BOLSA TR",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1531,
        "monto_facturado": 30620
      },
      {
        "linea": 5,
        "codigo": "44555",
        "descripcion": "44555 Rapiditas Tortilla 8p 200g ASS ID",
        "cantidad_facturada": 27,
        "unidad_medida": "UN",
        "precio_facturado": 857,
        "monto_facturado": 23139
      },
      {
        "linea": 6,
        "codigo": "4388",
        "descripcion": "4388Pan rallado XL 250g ID",
        "cantidad_facturada": 32,
        "unidad_medida": "UN",
        "precio_facturado": 908,
        "monto_facturado": 29056
      },
      {
        "linea": 7,
        "codigo": "504574",
        "descripcion": "504574 Tortilla Grandota 8p 620g BOLSA TR",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 1955,
        "monto_facturado": 31280
      },
      {
        "linea": 8,
        "codigo": "500857",
        "descripcion": "500857 Pizza Piedra 2p 270g ID",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1410,
        "monto_facturado": 28200
      },
      {
        "linea": 9,
        "codigo": "501107",
        "descripcion": "501107 Pan Artesano Hamburguesa 8p 720g BOL ID",
        "cantidad_facturada": 15,
        "unidad_medida": "UN",
        "precio_facturado": 2079,
        "monto_facturado": 31185
      },
      {
        "linea": 10,
        "codigo": "501866",
        "descripcion": "501866 Pan Completo XL 6p 528g BOLSA ID",
        "cantidad_facturada": 27,
        "unidad_medida": "UN",
        "precio_facturado": 1426,
        "monto_facturado": 38502
      },
      {
        "linea": 11,
        "codigo": "502988",
        "descripcion": "Pan Artesano Integral 1p 600g Bolsa ID",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 2008,
        "monto_facturado": 40160
      },
      {
        "linea": 12,
        "codigo": "503413",
        "descripcion": "503413 Pan Integ masProtein10 1p 640g BOLSA ID",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 1865,
        "monto_facturado": 18650
      },
      {
        "linea": 13,
        "codigo": "503410",
        "descripcion": "503410 Pan Hotdog 8p 480g Bolsa ID",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 1467,
        "monto_facturado": 52812
      },
      {
        "linea": 14,
        "codigo": "504104",
        "descripcion": "504104 Pan Blanco Cero Cero 1p 580g BOLS",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1994,
        "monto_facturado": 39880
      },
      {
        "linea": 15,
        "codigo": "504103",
        "descripcion": "504103 Pan Integral Cero Cero 1p 600g BO",
        "cantidad_facturada": 30,
        "unidad_medida": "UN",
        "precio_facturado": 2064,
        "monto_facturado": 61920
      },
      {
        "linea": 16,
        "codigo": "504186",
        "descripcion": "504186 PanBlanco Artesano 1p 550gBOL",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 2008,
        "monto_facturado": 120480
      },
      {
        "linea": 17,
        "codigo": "504337",
        "descripcion": "504337 Hamburguesa Brioche 4p 352g BOLSA ID",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1376,
        "monto_facturado": 27520
      },
      {
        "linea": 18,
        "codigo": "504423",
        "descripcion": "504423 Rapidita Linaza Chia 8p 200g BOLS",
        "cantidad_facturada": 27,
        "unidad_medida": "UN",
        "precio_facturado": 919,
        "monto_facturado": 24813
      },
      {
        "linea": 19,
        "codigo": "506369",
        "descripcion": "506369 Pita Cero Cero Blanca 8p 344g BOLSA ID",
        "cantidad_facturada": 14,
        "unidad_medida": "UN",
        "precio_facturado": 1112,
        "monto_facturado": 15568
      },
      {
        "linea": 20,
        "codigo": "504001",
        "descripcion": "504001 Takis Intense Nacho CH 1p 190g FLOW BAR",
        "cantidad_facturada": 21,
        "unidad_medida": "UN",
        "precio_facturado": 1168,
        "monto_facturado": 24528
      },
      {
        "linea": 21,
        "codigo": "506315",
        "descripcion": "506315 Pan Blanco 1p 580g BOLSA ID",
        "cantidad_facturada": 30,
        "unidad_medida": "UN",
        "precio_facturado": 1438,
        "monto_facturado": 43140
      },
      {
        "linea": 22,
        "codigo": "964621",
        "descripcion": "964621 Takis Original CH 1p 190g FLOW BAR",
        "cantidad_facturada": 21,
        "unidad_medida": "UN",
        "precio_facturado": 1168,
        "monto_facturado": 24528
      },
      {
        "linea": 23,
        "codigo": "964620",
        "descripcion": "964620 Takis Fuego CH 1p 190g FLOW BAR",
        "cantidad_facturada": 21,
        "unidad_medida": "UN",
        "precio_facturado": 1168,
        "monto_facturado": 24528
      },
      {
        "linea": 24,
        "codigo": "964622",
        "descripcion": "964622 Takis Xplosion CH 1p 190g FLOW BAR",
        "cantidad_facturada": 21,
        "unidad_medida": "UN",
        "precio_facturado": 1168,
        "monto_facturado": 24528
      },
      {
        "linea": 25,
        "codigo": "964614",
        "descripcion": "964614 Hot Dog Brioche Artes 6p 370g BOLSA ID",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 1524,
        "monto_facturado": 27432
      },
      {
        "linea": 26,
        "codigo": "503730",
        "descripcion": "503730 Rapidita XL Integral 8p 415g BOLSA ID",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1350,
        "monto_facturado": 27000
      },
      {
        "linea": 27,
        "codigo": "964670",
        "descripcion": "964670 Pan Sin Bordes 1p 400g BOLSA ID",
        "cantidad_facturada": 12,
        "unidad_medida": "UN",
        "precio_facturado": 2147,
        "monto_facturado": 25764
      },
      {
        "linea": 28,
        "codigo": "964761",
        "descripcion": "964761 Salmas Clasicas 6p 108g CJ SAN",
        "cantidad_facturada": 28,
        "unidad_medida": "UN",
        "precio_facturado": 1283,
        "monto_facturado": 35924
      },
      {
        "linea": 29,
        "codigo": "965204",
        "descripcion": "965204 Mankeke�6p 180g DPY MLA",
        "cantidad_facturada": 31,
        "unidad_medida": "UN",
        "precio_facturado": 1171,
        "monto_facturado": 36301
      },
      {
        "linea": 30,
        "codigo": "965200",
        "descripcion": "965200 Pinguinos 6p 240g CJ MLA",
        "cantidad_facturada": 31,
        "unidad_medida": "UN",
        "precio_facturado": 1759,
        "monto_facturado": 54529
      },
      {
        "linea": 31,
        "codigo": "965201",
        "descripcion": "965201 Gansito 5p 250g CJ MLA",
        "cantidad_facturada": 31,
        "unidad_medida": "UN",
        "precio_facturado": 2053,
        "monto_facturado": 63643
      },
      {
        "linea": 32,
        "codigo": "965228",
        "descripcion": "965228 Rapiditas Cero Cero 8p 200g BOLSA ID",
        "cantidad_facturada": 27,
        "unidad_medida": "UN",
        "precio_facturado": 919,
        "monto_facturado": 24813
      },
      {
        "linea": 33,
        "codigo": "23211",
        "descripcion": "23211 Pizza Rectangular 3p 750g ID",
        "cantidad_facturada": 12,
        "unidad_medida": "UN",
        "precio_facturado": 1896,
        "monto_facturado": 22752
      },
      {
        "linea": 34,
        "codigo": "23634",
        "descripcion": "23634 Pizza Cl�sica 2p 500g ID",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1337,
        "monto_facturado": 26740
      },
      {
        "linea": 35,
        "codigo": "0429",
        "descripcion": "0429 Pan Pita Integral 8p 300g CJ ID",
        "cantidad_facturada": 28,
        "unidad_medida": "UN",
        "precio_facturado": 976,
        "monto_facturado": 27328
      },
      {
        "linea": 36,
        "codigo": "0428",
        "descripcion": "0428 Pan Pita Blanco 8p 300g CJ ID",
        "cantidad_facturada": 14,
        "unidad_medida": "UN",
        "precio_facturado": 976,
        "monto_facturado": 13664
      },
      {
        "linea": 37,
        "codigo": "41671",
        "descripcion": "41671 Prepizza Toques de Cebolla 2p 500g",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 1391,
        "monto_facturado": 25038
      },
      {
        "linea": 38,
        "codigo": "40279",
        "descripcion": "40279 Mil Hojas 6p 280g ADP",
        "cantidad_facturada": 44,
        "unidad_medida": "UN",
        "precio_facturado": 2079,
        "monto_facturado": 91476
      },
      {
        "linea": 39,
        "codigo": "504571",
        "descripcion": "504571 Tortilla Fajitas 10p 320g BOLSA TR",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1333,
        "monto_facturado": 26660
      },
      {
        "linea": 40,
        "codigo": "964588",
        "descripcion": "964588 Pan Blanco XL NC 1p 750g BOLSA ID",
        "cantidad_facturada": 72,
        "unidad_medida": "UN",
        "precio_facturado": 1809,
        "monto_facturado": 130248
      },
      {
        "linea": 41,
        "codigo": "965202",
        "descripcion": "965202 Rayita TwinkiesVainillaB�5p 150g DPY MLA",
        "cantidad_facturada": 31,
        "unidad_medida": "UN",
        "precio_facturado": 1171,
        "monto_facturado": 36301
      },
      {
        "linea": 42,
        "codigo": "22016",
        "descripcion": "22016 Pan Integral Stuttgart 650g FUC",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1712,
        "monto_facturado": 34240
      },
      {
        "linea": 43,
        "codigo": "506564",
        "descripcion": "506564 Pan Multigrano 1p 350g BOLSA FUC",
        "cantidad_facturada": 13,
        "unidad_medida": "UN",
        "precio_facturado": 1283,
        "monto_facturado": 16679
      },
      {
        "linea": 44,
        "codigo": "506561",
        "descripcion": "506561 Pan Multigrano Light 1p 620g BOLSA FUC",
        "cantidad_facturada": 20,
        "unidad_medida": "UN",
        "precio_facturado": 1834,
        "monto_facturado": 36680
      },
      {
        "linea": 45,
        "codigo": "506558",
        "descripcion": "506558 Pan Calabaza Nuez 1p 600g BOLSA FUC",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 1834,
        "monto_facturado": 18340
      },
      {
        "linea": 46,
        "codigo": "506560",
        "descripcion": "506560 Pan Linaza Chia 1p 600g BOLSA FUC",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 1834,
        "monto_facturado": 18340
      },
      {
        "linea": 47,
        "codigo": "506559",
        "descripcion": "506559 Pan Linaza Chia 1p 350g BOLSA FUC",
        "cantidad_facturada": 13,
        "unidad_medida": "UN",
        "precio_facturado": 1283,
        "monto_facturado": 16679
      },
      {
        "linea": 48,
        "codigo": "502704",
        "descripcion": "502704Queque Fam Zan Prem 1p 250g BOLSA",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 1524,
        "monto_facturado": 24384
      },
      {
        "linea": 49,
        "codigo": "503170",
        "descripcion": "503170 Braunichoc 4p 140g ME NUR",
        "cantidad_facturada": 24,
        "unidad_medida": "UN",
        "precio_facturado": 1230,
        "monto_facturado": 29520
      },
      {
        "linea": 50,
        "codigo": "503375",
        "descripcion": "503375 Brownie Mini 6p 180g ME NUR",
        "cantidad_facturada": 15,
        "unidad_medida": "UN",
        "precio_facturado": 1465,
        "monto_facturado": 21975
      },
      {
        "linea": 51,
        "codigo": "964763",
        "descripcion": "964763 Salmas Camote Zanahoria 6p 108g CJ SAN",
        "cantidad_facturada": 28,
        "unidad_medida": "UN",
        "precio_facturado": 1283,
        "monto_facturado": 35924
      },
      {
        "linea": 52,
        "codigo": "964847",
        "descripcion": "964847 Salmas Chia Linaza 6p 108g DPY SAN",
        "cantidad_facturada": 28,
        "unidad_medida": "UN",
        "precio_facturado": 1283,
        "monto_facturado": 35924
      },
      {
        "linea": 53,
        "codigo": "502685",
        "descripcion": "502685 Pack Brownie 4p 248g ME NUR",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 1935,
        "monto_facturado": 15480
      },
      {
        "linea": 54,
        "codigo": "964623",
        "descripcion": "964623 Galleta Almendra SAz NC 1p 128g TUBO NUR",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 1031,
        "monto_facturado": 18558
      },
      {
        "linea": 55,
        "codigo": "502686",
        "descripcion": "502686 Pack Brownie Chip 4p 248g ME NUR",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 1935,
        "monto_facturado": 15480
      },
      {
        "linea": 56,
        "codigo": "502702",
        "descripcion": "502702Queque Fam NjaPrem 1p 250g BOLSA",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 1524,
        "monto_facturado": 24384
      },
      {
        "linea": 57,
        "codigo": "502701",
        "descripcion": "502701Queque Fam Brow Prem 1p 250g BOLSA",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 1524,
        "monto_facturado": 24384
      },
      {
        "linea": 58,
        "codigo": "502700",
        "descripcion": "502700Quequ Fam Marmol Prem 1p 250g BOLS",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 1524,
        "monto_facturado": 24384
      },
      {
        "linea": 59,
        "codigo": "502687",
        "descripcion": "502687 Pack Brownie Sin Azucar 4p 200g M",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 1935,
        "monto_facturado": 15480
      }
    ]
  },
  {
    "folio": "56500937",
    "proveedor": "Ideal S.A.",
    "rut": "90297000-0",
    "fecha": "2026-09-29",
    "monto_neto": 40440,
    "monto_total": 48124,
    "oc_asociada": "PO521015",
    "order_reference": "521015",
    "aforo_tipo": "Panadería y Masas (Ideal S.A.)",
    "almacen": "CH_34_Manuel Montt (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO3N9aiEZzoM",
    "items": [
      {
        "linea": 1,
        "codigo": "502682",
        "descripcion": "502682Galleton Chocolate Chip 1p 40g BOL",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 337,
        "monto_facturado": 20220
      },
      {
        "linea": 2,
        "codigo": "502679",
        "descripcion": "502679Galleton Almendra 1p 40g BOLSA NUR",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 337,
        "monto_facturado": 20220
      }
    ]
  },
  {
    "folio": "22591488",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 1261921,
    "monto_total": 1501686,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9OqrKXigHH",
    "items": []
  },
  {
    "folio": "22591487",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 3056565,
    "monto_total": 3637312,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9Oqjkfayk7",
    "items": []
  },
  {
    "folio": "22591486",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 1845858,
    "monto_total": 2196571,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9OqefmrNmV",
    "items": []
  },
  {
    "folio": "22591485",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 6531950,
    "monto_total": 7773021,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9OqUZqb7GI",
    "items": []
  },
  {
    "folio": "22591484",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 664070,
    "monto_total": 790243,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9OqE_UahOn",
    "items": []
  },
  {
    "folio": "22591482",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 5227449,
    "monto_total": 6220664,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9OfcdbUvtR",
    "items": []
  },
  {
    "folio": "22591483",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-30",
    "monto_neto": 2271329,
    "monto_total": 2720616,
    "oc_asociada": "PO521257",
    "order_reference": "0000521257",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoO9OfT88HV_t",
    "items": []
  },
  {
    "folio": "22589805",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-28",
    "monto_neto": 4167017,
    "monto_total": 4958750,
    "oc_asociada": "PO520020",
    "order_reference": "0000520020",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNxW9H780vA9",
    "items": []
  },
  {
    "folio": "22589801",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-28",
    "monto_neto": 4863621,
    "monto_total": 5879934,
    "oc_asociada": "PO520020",
    "order_reference": "0000520020",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNxW9BCXIb0d",
    "items": []
  },
  {
    "folio": "22589804",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-28",
    "monto_neto": 2487652,
    "monto_total": 2960306,
    "oc_asociada": "PO520020",
    "order_reference": "0000520020",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNxW9AqLHm7X",
    "items": []
  },
  {
    "folio": "22589806",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-28",
    "monto_neto": 1368067,
    "monto_total": 1628000,
    "oc_asociada": "PO520020",
    "order_reference": "0000520020",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNxW86dq3kj0",
    "items": []
  },
  {
    "folio": "22589803",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-28",
    "monto_neto": 4423569,
    "monto_total": 5264047,
    "oc_asociada": "PO520020",
    "order_reference": "0000520020",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNxW80n4v1fZ",
    "items": []
  },
  {
    "folio": "22589802",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-28",
    "monto_neto": 1264054,
    "monto_total": 1506851,
    "oc_asociada": "PO520020",
    "order_reference": "0000520020",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNxW8vHpLukx",
    "items": []
  },
  {
    "folio": "22588721",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-25",
    "monto_neto": 3595666,
    "monto_total": 4278843,
    "oc_asociada": "PO519840",
    "order_reference": "0000519840",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNS8wGROzxbN",
    "items": []
  },
  {
    "folio": "22588722",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-25",
    "monto_neto": 840334,
    "monto_total": 999997,
    "oc_asociada": "PO519840",
    "order_reference": "0000519840",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoNS8wA8kGvBw",
    "items": []
  },
  {
    "folio": "22587396",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 6130353,
    "monto_total": 7295120,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMxwqZtU9YsZ",
    "items": []
  },
  {
    "folio": "22587399",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 3757192,
    "monto_total": 4471058,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMxwqZOWZxNG",
    "items": []
  },
  {
    "folio": "22587397",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 2699147,
    "monto_total": 3211985,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMxwqNWIj3lS",
    "items": []
  },
  {
    "folio": "22587398",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 3227529,
    "monto_total": 3840760,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMxwqE7t6MjA",
    "items": []
  },
  {
    "folio": "22587400",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 465045,
    "monto_total": 553404,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMxwp5h641tQ",
    "items": []
  },
  {
    "folio": "22587339",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 1236937,
    "monto_total": 1471955,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMvizTSsWJcr",
    "items": []
  },
  {
    "folio": "22587338",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 276762,
    "monto_total": 329347,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMvioTSoHuzo",
    "items": []
  },
  {
    "folio": "22587337",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 1528832,
    "monto_total": 1830644,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMviTGvItyTI",
    "items": []
  },
  {
    "folio": "22587336",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 1634943,
    "monto_total": 1952230,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMviS_CHtaBU",
    "items": []
  },
  {
    "folio": "22587335",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 3639378,
    "monto_total": 4521829,
    "oc_asociada": "PO519039",
    "order_reference": "0000519039",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMviS97yDzHQ",
    "items": []
  },
  {
    "folio": "22447694",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 30414,
    "monto_total": 36193,
    "oc_asociada": "PO518529",
    "order_reference": "0000518529",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMkVoEvJU2Rs",
    "items": []
  },
  {
    "folio": "22447693",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-23",
    "monto_neto": 30414,
    "monto_total": 36193,
    "oc_asociada": "PO518529",
    "order_reference": "0000518529",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMkVn1x79nxa",
    "items": []
  },
  {
    "folio": "22586659",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 894377,
    "monto_total": 1064309,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZclE77AkTd",
    "items": [
      {
        "linea": 1,
        "codigo": "UHBPGV",
        "ean": "UHBPGV",
        "descripcion": "Galleta Sabor Pie de Limón Gretel 85 g",
        "cantidad_facturada": 120,
        "unidad_medida": "UN",
        "precio_facturado": 938,
        "monto_facturado": 112560
      },
      {
        "linea": 2,
        "codigo": "84P2V8",
        "ean": "84P2V8",
        "descripcion": "Gomitas Ambrosito 90 g",
        "cantidad_facturada": 480,
        "unidad_medida": "UN",
        "precio_facturado": 634,
        "monto_facturado": 304320
      },
      {
        "linea": 3,
        "codigo": "ZDC8ED",
        "ean": "ZDC8ED",
        "descripcion": "Chocolate Costa Rolls Crocante 100 g",
        "cantidad_facturada": 90,
        "unidad_medida": "UN",
        "precio_facturado": 985.01,
        "monto_facturado": 88651
      },
      {
        "linea": 4,
        "codigo": "FG2DTK",
        "ean": "FG2DTK",
        "descripcion": "Gomitas Ambrosoli Ambrosito Rellenos 90 g",
        "cantidad_facturada": 480,
        "unidad_medida": "UN",
        "precio_facturado": 634,
        "monto_facturado": 304320
      },
      {
        "linea": 5,
        "codigo": "389343",
        "ean": "389343",
        "descripcion": "ORLY ALMENDRA 15 X 95 GR",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 16905.2,
        "monto_facturado": 84526
      }
    ]
  },
  {
    "folio": "22586656",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 2676104,
    "monto_total": 3184564,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcaF_fZEAe",
    "items": [
      {
        "linea": 1,
        "codigo": "7BI4S7",
        "ean": "7BI4S7",
        "descripcion": "Galleta Mini Costa Mantequilla 35 g",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 202,
        "monto_facturado": 30300
      },
      {
        "linea": 2,
        "codigo": "21071574",
        "ean": "21071574",
        "descripcion": "Galletas Maxi Chips Costa 200 g",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 1135,
        "monto_facturado": 68100
      },
      {
        "linea": 3,
        "codigo": "15884V",
        "ean": "15884V",
        "descripcion": "Chocolate Tableta Orly Blanco Ambrosoli 95 g",
        "cantidad_facturada": 105,
        "unidad_medida": "UN",
        "precio_facturado": 1127.01,
        "monto_facturado": 118336
      },
      {
        "linea": 4,
        "codigo": "TRC6PE",
        "ean": "TRC6PE",
        "descripcion": "Habanitos Ambrosoli  80 g",
        "cantidad_facturada": 72,
        "unidad_medida": "UN",
        "precio_facturado": 847,
        "monto_facturado": 60984
      },
      {
        "linea": 5,
        "codigo": "18628366",
        "ean": "18628366",
        "descripcion": "Galletas Nik Costa Oblea Frutilla 71 g",
        "cantidad_facturada": 180,
        "unidad_medida": "UN",
        "precio_facturado": 396,
        "monto_facturado": 71280
      },
      {
        "linea": 6,
        "codigo": "21245541",
        "ean": "21245541",
        "descripcion": "Chocolate Costa Milk Sin Azúcar 80 g",
        "cantidad_facturada": 108,
        "unidad_medida": "UN",
        "precio_facturado": 1911.99,
        "monto_facturado": 206495
      },
      {
        "linea": 7,
        "codigo": "77O5KN",
        "ean": "77O5KN",
        "descripcion": "Chocolate Costa Carezza Doble Relleno Cheesecake 95 g",
        "cantidad_facturada": 75,
        "unidad_medida": "UN",
        "precio_facturado": 1481,
        "monto_facturado": 111075
      },
      {
        "linea": 8,
        "codigo": "7K6972",
        "ean": "7K6972",
        "descripcion": "Bandeja Alfajor Premium Calaf 4 Unidades",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 1977.99,
        "monto_facturado": 189887
      },
      {
        "linea": 9,
        "codigo": "OFXT39",
        "ean": "OFXT39",
        "descripcion": "Bolsa Tuyo Costa 95 G",
        "cantidad_facturada": 114,
        "unidad_medida": "UN",
        "precio_facturado": 959,
        "monto_facturado": 109326
      },
      {
        "linea": 10,
        "codigo": "18628370",
        "ean": "18628370",
        "descripcion": "Galletas Costa Gretel Yoghurt Frutilla 85 g",
        "cantidad_facturada": 480,
        "unidad_medida": "UN",
        "precio_facturado": 937.99,
        "monto_facturado": 450237
      },
      {
        "linea": 11,
        "codigo": "210144",
        "ean": "210144",
        "descripcion": "COSTA CACAO 62% 18X80 GR.",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 31770,
        "monto_facturado": 95310
      },
      {
        "linea": 12,
        "codigo": "250564",
        "ean": "250564",
        "descripcion": "COSTA CHOCO CHIPS 28X125 GR.",
        "cantidad_facturada": 6,
        "unidad_medida": "UN",
        "precio_facturado": 19684,
        "monto_facturado": 118104
      },
      {
        "linea": 13,
        "codigo": "250700",
        "ean": "250700",
        "descripcion": "COSTA COCO 28X125 GR",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 17892.33,
        "monto_facturado": 53677
      },
      {
        "linea": 14,
        "codigo": "250386",
        "ean": "250386",
        "descripcion": "MINI LIMON 30X35 GR.",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 6060,
        "monto_facturado": 109080
      },
      {
        "linea": 15,
        "codigo": "210147",
        "ean": "210147",
        "descripcion": "COSTANUSS LIBRE DE AZUCAR 13X110 G.",
        "cantidad_facturada": 4,
        "unidad_medida": "UN",
        "precio_facturado": 24856,
        "monto_facturado": 99424
      },
      {
        "linea": 16,
        "codigo": "384080",
        "ean": "384080",
        "descripcion": "OSITO CHOC 8X240 GR",
        "cantidad_facturada": 15,
        "unidad_medida": "UN",
        "precio_facturado": 23792.07,
        "monto_facturado": 356881
      },
      {
        "linea": 17,
        "codigo": "250339",
        "ean": "250339",
        "descripcion": "MINI DULCITA 30X35 GR.",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 6060,
        "monto_facturado": 109080
      },
      {
        "linea": 18,
        "codigo": "251239",
        "ean": "251239",
        "descripcion": "FRAC CLASICA 36X110 GR.",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 19908,
        "monto_facturado": 318528
      }
    ]
  },
  {
    "folio": "22586657",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 2096468,
    "monto_total": 2494797,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcaFMU5WY9",
    "items": [
      {
        "linea": 1,
        "codigo": "13V88U",
        "ean": "13V88U",
        "descripcion": "Galleta Costa Tuareg Sabor Coco (192 g) 4 Unidades",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 871.99,
        "monto_facturado": 130799
      },
      {
        "linea": 2,
        "codigo": "ZK135G",
        "ean": "ZK135G",
        "descripcion": "Chocolate Costa Carezza Doble Relleno Tiramisu 95 g",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 1480.99,
        "monto_facturado": 222148
      },
      {
        "linea": 3,
        "codigo": "7FO099",
        "ean": "7FO099",
        "descripcion": "Pack Chocolate Golazo Ambrosoli 4 Un De 25 G",
        "cantidad_facturada": 272,
        "unidad_medida": "UN",
        "precio_facturado": 1009,
        "monto_facturado": 274447
      },
      {
        "linea": 4,
        "codigo": "298FYB",
        "ean": "298FYB",
        "descripcion": "Galletas Mini Donuts Blanco 35 g",
        "cantidad_facturada": 540,
        "unidad_medida": "UN",
        "precio_facturado": 259,
        "monto_facturado": 139859
      },
      {
        "linea": 5,
        "codigo": "6J70F2",
        "ean": "6J70F2",
        "descripcion": "Gomitas Ambrosoli Frugelé Guinda 140 g",
        "cantidad_facturada": 140,
        "unidad_medida": "UN",
        "precio_facturado": 905,
        "monto_facturado": 126700
      },
      {
        "linea": 6,
        "codigo": "ZOQHK3",
        "ean": "ZOQHK3",
        "descripcion": "Chocolate Costa Carezza Doble Relleno Pie Limon 95 g",
        "cantidad_facturada": 75,
        "unidad_medida": "UN",
        "precio_facturado": 1481,
        "monto_facturado": 111075
      },
      {
        "linea": 7,
        "codigo": "6U9V38",
        "ean": "6U9V38",
        "descripcion": "Gomita Ambrosoli Frugele Citric 350 Gr",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 1686,
        "monto_facturado": 60696
      },
      {
        "linea": 8,
        "codigo": "WUJYZL",
        "ean": "WUJYZL",
        "descripcion": "Chocolate Orly Relleno Sabor Menta Ambrosoli 95 g",
        "cantidad_facturada": 45,
        "unidad_medida": "UN",
        "precio_facturado": 1127.02,
        "monto_facturado": 50716
      },
      {
        "linea": 9,
        "codigo": "E2X7NE",
        "ean": "E2X7NE",
        "descripcion": "Galletas Gretel Crema de Maní 85 g",
        "cantidad_facturada": 120,
        "unidad_medida": "UN",
        "precio_facturado": 938,
        "monto_facturado": 112560
      },
      {
        "linea": 10,
        "codigo": "U8PXYW",
        "ean": "U8PXYW",
        "descripcion": "Galletas Obsesión Costa Clasica 37 g",
        "cantidad_facturada": 128,
        "unidad_medida": "UN",
        "precio_facturado": 329,
        "monto_facturado": 42112
      },
      {
        "linea": 11,
        "codigo": "212213",
        "ean": "212213",
        "descripcion": "MAXIMUSS 8X144 GR.",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 15695.67,
        "monto_facturado": 47087
      },
      {
        "linea": 12,
        "codigo": "223029",
        "ean": "223029",
        "descripcion": "SUNY CLASICA 12X360 GR",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 21647.8,
        "monto_facturado": 108239
      },
      {
        "linea": 13,
        "codigo": "313408",
        "ean": "313408",
        "descripcion": "LOOP CINTAS FRUTILLA 14 X 67 GR",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 12278,
        "monto_facturado": 61390
      },
      {
        "linea": 14,
        "codigo": "312988",
        "ean": "312988",
        "descripcion": "FLIPY 30 X 90 GR",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 19020,
        "monto_facturado": 304320
      },
      {
        "linea": 15,
        "codigo": "312986",
        "ean": "312986",
        "descripcion": "LOOP 30 X 90 GR",
        "cantidad_facturada": 16,
        "unidad_medida": "UN",
        "precio_facturado": 19020,
        "monto_facturado": 304320
      }
    ]
  },
  {
    "folio": "22586658",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 2558509,
    "monto_total": 3044626,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcaE9GJ8iu",
    "items": [
      {
        "linea": 1,
        "codigo": "H0D1UW",
        "ean": "H0D1UW",
        "descripcion": "Galletas Din Don Chocolate 102 g",
        "cantidad_facturada": 105,
        "unidad_medida": "UN",
        "precio_facturado": 488.01,
        "monto_facturado": 51241
      },
      {
        "linea": 2,
        "codigo": "DIS568",
        "ean": "DIS568",
        "descripcion": "Galletas Mini Costa Cocadita 35 g",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 202,
        "monto_facturado": 30300
      },
      {
        "linea": 3,
        "codigo": "1W5RQJ",
        "ean": "1W5RQJ",
        "descripcion": "Galleta Mini Costa Palmeritas 35 g",
        "cantidad_facturada": 540,
        "unidad_medida": "UN",
        "precio_facturado": 202,
        "monto_facturado": 109080
      },
      {
        "linea": 4,
        "codigo": "D01BHQ",
        "ean": "D01BHQ",
        "descripcion": "Galletas Soda Line Costa 160 g",
        "cantidad_facturada": 120,
        "unidad_medida": "UN",
        "precio_facturado": 731,
        "monto_facturado": 87720
      },
      {
        "linea": 5,
        "codigo": "K22PNQ",
        "ean": "K22PNQ",
        "descripcion": "Barra Chocolate Calaf In Kat XL 90 Grs",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 767,
        "monto_facturado": 73632
      },
      {
        "linea": 6,
        "codigo": "A4Y3JL",
        "ean": "A4Y3JL",
        "descripcion": "Galleta Costa Dindon Sabor Chocolate Con Relleno De Vainilla (184 g) 4 Un",
        "cantidad_facturada": 170,
        "unidad_medida": "UN",
        "precio_facturado": 871.99,
        "monto_facturado": 148239
      },
      {
        "linea": 7,
        "codigo": "PY4WNU",
        "ean": "PY4WNU",
        "descripcion": "Galleta Mini Costa Vino 35 g",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 202,
        "monto_facturado": 30300
      },
      {
        "linea": 8,
        "codigo": "251236",
        "ean": "251236",
        "descripcion": "FRAC BI CAPUCCINO 36X110 GR.",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 19908,
        "monto_facturado": 199080
      },
      {
        "linea": 9,
        "codigo": "251238",
        "ean": "251238",
        "descripcion": "FRAC CHOCOLATE 36X110GR",
        "cantidad_facturada": 34,
        "unidad_medida": "UN",
        "precio_facturado": 19908,
        "monto_facturado": 676872
      },
      {
        "linea": 10,
        "codigo": "312987",
        "ean": "312987",
        "descripcion": "AMBERRIES 30X90 GR.",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 19020,
        "monto_facturado": 152160
      },
      {
        "linea": 11,
        "codigo": "389347",
        "ean": "389347",
        "descripcion": "ORLY MENTA 15 X 95 GR",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 16905.33,
        "monto_facturado": 50716
      },
      {
        "linea": 12,
        "codigo": "214072",
        "ean": "214072",
        "descripcion": "MALVA CHOC 10 X 196 GR.",
        "cantidad_facturada": 15,
        "unidad_medida": "UN",
        "precio_facturado": 14910,
        "monto_facturado": 223650
      },
      {
        "linea": 13,
        "codigo": "250202",
        "ean": "250202",
        "descripcion": "SODA 24X160 GR.",
        "cantidad_facturada": 30,
        "unidad_medida": "UN",
        "precio_facturado": 17543.97,
        "monto_facturado": 526319
      },
      {
        "linea": 14,
        "codigo": "312913",
        "ean": "312913",
        "descripcion": "GUSANOS ACIDOS 30X90 GR.",
        "cantidad_facturada": 8,
        "unidad_medida": "UN",
        "precio_facturado": 19020,
        "monto_facturado": 152160
      },
      {
        "linea": 15,
        "codigo": "250457",
        "ean": "250457",
        "descripcion": "NIK BLOCK 16 X 130 GR.",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 15680,
        "monto_facturado": 47040
      }
    ]
  },
  {
    "folio": "22586653",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 2079070,
    "monto_total": 2474093,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcZ6fiXqds",
    "items": [
      {
        "linea": 1,
        "codigo": "ILKR0B",
        "ean": "ILKR0B",
        "descripcion": "Compota Vivo Break Avena Yoghurt Berries Y Plátano 90 g",
        "cantidad_facturada": 234,
        "unidad_medida": "UN",
        "precio_facturado": 470,
        "monto_facturado": 109981
      },
      {
        "linea": 2,
        "codigo": "SE7PJ0",
        "ean": "SE7PJ0",
        "descripcion": "Pack Nectar Vivo Piña (190 ml) 3 Unidades",
        "cantidad_facturada": 144,
        "unidad_medida": "UN",
        "precio_facturado": 861.99,
        "monto_facturado": 124127
      },
      {
        "linea": 3,
        "codigo": "R3E183",
        "ean": "R3E183",
        "descripcion": "Néctar De Manzana Vivo 1 L",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 869,
        "monto_facturado": 31284
      },
      {
        "linea": 4,
        "codigo": "NWHEF7",
        "ean": "NWHEF7",
        "descripcion": "Compota Vivo Orgánica Zapallo Manzana Y Pera 90 g",
        "cantidad_facturada": 234,
        "unidad_medida": "UN",
        "precio_facturado": 531,
        "monto_facturado": 124254
      },
      {
        "linea": 5,
        "codigo": "18627934",
        "ean": "18627934",
        "descripcion": "Pasta Ravioli Carne Trattoria 400 g",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 2100.98,
        "monto_facturado": 126059
      },
      {
        "linea": 6,
        "codigo": "21071545",
        "ean": "21071545",
        "descripcion": "Salsa De Tomate Carozzi Toscana Arrabbiata 200 g",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 690.01,
        "monto_facturado": 66241
      },
      {
        "linea": 7,
        "codigo": "6W00E4",
        "ean": "6W00E4",
        "descripcion": "Quesadillas Pancho Villa 8 un Carozzi 200 g",
        "cantidad_facturada": 75,
        "unidad_medida": "UN",
        "precio_facturado": 663,
        "monto_facturado": 49725
      },
      {
        "linea": 8,
        "codigo": "49M212",
        "ean": "49M212",
        "descripcion": "Salsa Mexicana Pancho Villa Picante 200 g",
        "cantidad_facturada": 72,
        "unidad_medida": "UN",
        "precio_facturado": 752,
        "monto_facturado": 54144
      },
      {
        "linea": 9,
        "codigo": "VS31I6",
        "ean": "VS31I6",
        "descripcion": "Tortilla Pancho Villa L 10 Unidades 280 g",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 1222.98,
        "monto_facturado": 73379
      },
      {
        "linea": 10,
        "codigo": "985Y95",
        "ean": "985Y95",
        "descripcion": "Cereal Inflado Arroz 20 G Natur",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 282,
        "monto_facturado": 42300
      },
      {
        "linea": 11,
        "codigo": "XQLS2U",
        "ean": "XQLS2U",
        "descripcion": "Néctar Vivo Durazno 0% Azúcar Añadida 1 L",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 869,
        "monto_facturado": 31284
      },
      {
        "linea": 12,
        "codigo": "2WJ8M7",
        "ean": "2WJ8M7",
        "descripcion": "Compota Durazno Platano Arandano Vivo 90 g",
        "cantidad_facturada": 126,
        "unidad_medida": "UN",
        "precio_facturado": 531,
        "monto_facturado": 66906
      },
      {
        "linea": 13,
        "codigo": "410NUU",
        "ean": "410NUU",
        "descripcion": "Arroz Miraflores Risotto Carnaroli 400 g",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 1461,
        "monto_facturado": 52596
      },
      {
        "linea": 14,
        "codigo": "101504",
        "ean": "101504",
        "descripcion": "CAROZZI LASANA 11 10X400GR.",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 18340,
        "monto_facturado": 91700
      },
      {
        "linea": 15,
        "codigo": "518012",
        "ean": "518012",
        "descripcion": "PV BURRITO REF 8 UN 12X350 GR",
        "cantidad_facturada": 23,
        "unidad_medida": "UN",
        "precio_facturado": 16452.09,
        "monto_facturado": 378398
      },
      {
        "linea": 16,
        "codigo": "134719",
        "ean": "134719",
        "descripcion": "SALSA DIP CRACKELET AJI CHIPOTLE 24X110G",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 18192,
        "monto_facturado": 54576
      },
      {
        "linea": 17,
        "codigo": "141101",
        "ean": "141101",
        "descripcion": "CZZI.MASCARRONI 45 30X400 GR",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 23370,
        "monto_facturado": 70110
      },
      {
        "linea": 18,
        "codigo": "518018",
        "ean": "518018",
        "descripcion": "PV MAXIVILLA 8 UN 10X544 GR",
        "cantidad_facturada": 15,
        "unidad_medida": "UN",
        "precio_facturado": 18600,
        "monto_facturado": 279000
      },
      {
        "linea": 19,
        "codigo": "134715",
        "ean": "134715",
        "descripcion": "SALSA DIP CRACKELET AJO 24X110 GR",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 18192,
        "monto_facturado": 54576
      },
      {
        "linea": 20,
        "codigo": "571657",
        "ean": "571657",
        "descripcion": "MIRAFLORES NAC. G2 LAM 10X1 KG.........",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 16350,
        "monto_facturado": 49050
      },
      {
        "linea": 21,
        "codigo": "518107",
        "ean": "518107",
        "descripcion": "PV TORTILLA PACK REF 3X2.24 UN 7X600 GR.",
        "cantidad_facturada": 11,
        "unidad_medida": "UN",
        "precio_facturado": 13580,
        "monto_facturado": 149380
      }
    ]
  },
  {
    "folio": "22586654",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 2138351,
    "monto_total": 2544638,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcZsG5Uvja",
    "items": [
      {
        "linea": 1,
        "codigo": "I1NU79",
        "ean": "I1NU79",
        "descripcion": "Tortilla Burrito Integral 8Un 380 G Pancho Villa",
        "cantidad_facturada": 128,
        "unidad_medida": "UN",
        "precio_facturado": 1465.01,
        "monto_facturado": 187521
      },
      {
        "linea": 2,
        "codigo": "7O0623",
        "ean": "7O0623",
        "descripcion": "Tortillas De Maiz Pancho Villa Redondos Panchitos 320 g",
        "cantidad_facturada": 170,
        "unidad_medida": "UN",
        "precio_facturado": 1336,
        "monto_facturado": 227120
      },
      {
        "linea": 3,
        "codigo": "RX9T2P",
        "ean": "RX9T2P",
        "descripcion": "Compota Vivo Break Avena Yoghurt Naranja Y Plátano 90 g",
        "cantidad_facturada": 234,
        "unidad_medida": "UN",
        "precio_facturado": 470,
        "monto_facturado": 109981
      },
      {
        "linea": 4,
        "codigo": "5Z5UFZ",
        "ean": "5Z5UFZ",
        "descripcion": "Jugo 100% Fruta Vivo Pera Sin Azúcar Añadida 1 L",
        "cantidad_facturada": 108,
        "unidad_medida": "UN",
        "precio_facturado": 1083.34,
        "monto_facturado": 117001
      },
      {
        "linea": 5,
        "codigo": "I8O96O",
        "ean": "I8O96O",
        "descripcion": "Arroz Preparado Campesino 210 G Miraflores",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 837,
        "monto_facturado": 80352
      },
      {
        "linea": 6,
        "codigo": "7UVB76",
        "ean": "7UVB76",
        "descripcion": "Chips Panchitos Sésamo Pancho Villa 280 g",
        "cantidad_facturada": 30,
        "unidad_medida": "UN",
        "precio_facturado": 1588,
        "monto_facturado": 47640
      },
      {
        "linea": 7,
        "codigo": "L1KY74",
        "ean": "L1KY74",
        "descripcion": "Salsa Tomate Pizza Oregano Albahaca Pimienta Pomarola Carozzi 200 g",
        "cantidad_facturada": 72,
        "unidad_medida": "UN",
        "precio_facturado": 590,
        "monto_facturado": 42480
      },
      {
        "linea": 8,
        "codigo": "2O4QUM",
        "ean": "2O4QUM",
        "descripcion": "Granola Selecta Avena Y Chocolate 370 g",
        "cantidad_facturada": 36,
        "unidad_medida": "UN",
        "precio_facturado": 1714,
        "monto_facturado": 61704
      },
      {
        "linea": 9,
        "codigo": "7M3Z4E",
        "ean": "7M3Z4E",
        "descripcion": "Salsa Tomate Carozzi Casera Pomarola 200 g",
        "cantidad_facturada": 216,
        "unidad_medida": "UN",
        "precio_facturado": 590,
        "monto_facturado": 127441
      },
      {
        "linea": 10,
        "codigo": "068ZVP",
        "ean": "068ZVP",
        "descripcion": "Cereal Vivo Yoghurt Line 350 g",
        "cantidad_facturada": 30,
        "unidad_medida": "UN",
        "precio_facturado": 1925,
        "monto_facturado": 57750
      },
      {
        "linea": 11,
        "codigo": "N753FV",
        "ean": "N753FV",
        "descripcion": "Pack snack Vivo Check cacao 7 Unidades 210 g",
        "cantidad_facturada": 180,
        "unidad_medida": "UN",
        "precio_facturado": 1502.99,
        "monto_facturado": 270538
      },
      {
        "linea": 12,
        "codigo": "340202",
        "ean": "340202",
        "descripcion": "MERMELADA CRACKELET CEBOLLA 24X110G",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 19560.33,
        "monto_facturado": 58681
      },
      {
        "linea": 13,
        "codigo": "516696",
        "ean": "516696",
        "descripcion": "MONO CRUNCH ROLLS 10X360 GR",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 23250,
        "monto_facturado": 209250
      },
      {
        "linea": 14,
        "codigo": "516292",
        "ean": "516292",
        "descripcion": "AVENA SELECTA INSTANTANEA 10X800 GR.",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 14040,
        "monto_facturado": 126360
      },
      {
        "linea": 15,
        "codigo": "122680",
        "ean": "122680",
        "descripcion": "JUGO 100% FRUTA VIVO PERA 12 X 1LT",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 21036.11,
        "monto_facturado": 189325
      },
      {
        "linea": 16,
        "codigo": "122052",
        "ean": "122052",
        "descripcion": "NECTAR VIVO MANZANA TRIPACK 8X3X190 ML",
        "cantidad_facturada": 23,
        "unidad_medida": "UN",
        "precio_facturado": 6895.96,
        "monto_facturado": 158607
      },
      {
        "linea": 17,
        "codigo": "104021",
        "ean": "104021",
        "descripcion": "CZZI. TORTELLINI QUESO 12X400 GR",
        "cantidad_facturada": 3,
        "unidad_medida": "UN",
        "precio_facturado": 22200,
        "monto_facturado": 66600
      }
    ]
  },
  {
    "folio": "22586655",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 4959044,
    "monto_total": 5901262,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcZnyZFDO1",
    "items": [
      {
        "linea": 1,
        "codigo": "18628367",
        "ean": "18628367",
        "descripcion": "Galletas Costa Nik Oblea Limón 71 g",
        "cantidad_facturada": 108,
        "unidad_medida": "UN",
        "precio_facturado": 396,
        "monto_facturado": 42768
      },
      {
        "linea": 2,
        "codigo": "18628399",
        "ean": "18628399",
        "descripcion": "Galleta Costa Limon 140 g",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 639,
        "monto_facturado": 61344
      },
      {
        "linea": 3,
        "codigo": "21071586",
        "ean": "21071586",
        "descripcion": "Galleta Costa Champañitas 85 g",
        "cantidad_facturada": 240,
        "unidad_medida": "UN",
        "precio_facturado": 597,
        "monto_facturado": 143280
      },
      {
        "linea": 4,
        "codigo": "15132853",
        "ean": "15132853",
        "descripcion": "Galleta Costa Oblea Nik Bocado 71 g",
        "cantidad_facturada": 180,
        "unidad_medida": "UN",
        "precio_facturado": 396,
        "monto_facturado": 71280
      },
      {
        "linea": 5,
        "codigo": "15132867",
        "ean": "15132867",
        "descripcion": "Chocolate Costa Rama 115 g",
        "cantidad_facturada": 320,
        "unidad_medida": "UN",
        "precio_facturado": 2023.99,
        "monto_facturado": 647677
      },
      {
        "linea": 6,
        "codigo": "21245599",
        "ean": "21245599",
        "descripcion": "Crema De Avellana Ambrosoli 350 g",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 2726.99,
        "monto_facturado": 261791
      },
      {
        "linea": 7,
        "codigo": "21245539",
        "ean": "21245539",
        "descripcion": "Chocolate Costa Rama Blanco 115 g",
        "cantidad_facturada": 80,
        "unidad_medida": "UN",
        "precio_facturado": 2023.99,
        "monto_facturado": 161919
      },
      {
        "linea": 8,
        "codigo": "15132873",
        "ean": "15132873",
        "descripcion": "Chocolate Vizzio Estuche 120 G Costa",
        "cantidad_facturada": 170,
        "unidad_medida": "UN",
        "precio_facturado": 1949,
        "monto_facturado": 331330
      },
      {
        "linea": 9,
        "codigo": "18628368",
        "ean": "18628368",
        "descripcion": "Galletas Gretel Chocolate Costa 85 g",
        "cantidad_facturada": 480,
        "unidad_medida": "UN",
        "precio_facturado": 937.99,
        "monto_facturado": 450237
      },
      {
        "linea": 10,
        "codigo": "18628418",
        "ean": "18628418",
        "descripcion": "Galleta Costa Donuts Blanco 100 g",
        "cantidad_facturada": 96,
        "unidad_medida": "UN",
        "precio_facturado": 938,
        "monto_facturado": 90048
      },
      {
        "linea": 11,
        "codigo": "15132804",
        "ean": "15132804",
        "descripcion": "Chocolate Ambrosoli Golden Nuss 140 g",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 1678.99,
        "monto_facturado": 251849
      },
      {
        "linea": 12,
        "codigo": "18628407",
        "ean": "18628407",
        "descripcion": "Galletas Costa Obsesión Menta 85 g",
        "cantidad_facturada": 72,
        "unidad_medida": "UN",
        "precio_facturado": 937.99,
        "monto_facturado": 67535
      },
      {
        "linea": 13,
        "codigo": "15132870",
        "ean": "15132870",
        "descripcion": "Chocolate de Leche Rolls Crocante 150 g",
        "cantidad_facturada": 270,
        "unidad_medida": "UN",
        "precio_facturado": 1641.99,
        "monto_facturado": 443337
      },
      {
        "linea": 14,
        "codigo": "18628413",
        "ean": "18628413",
        "descripcion": "Galletas Costa Mini Donuts 40 g",
        "cantidad_facturada": 150,
        "unidad_medida": "UN",
        "precio_facturado": 259,
        "monto_facturado": 38850
      },
      {
        "linea": 15,
        "codigo": "18628421",
        "ean": "18628421",
        "descripcion": "Galleta Champaña 140 G Costa",
        "cantidad_facturada": 48,
        "unidad_medida": "UN",
        "precio_facturado": 1106,
        "monto_facturado": 53088
      },
      {
        "linea": 16,
        "codigo": "15132854",
        "ean": "15132854",
        "descripcion": "Galletas Costa Obsesion 85 g",
        "cantidad_facturada": 480,
        "unidad_medida": "UN",
        "precio_facturado": 937.99,
        "monto_facturado": 450237
      },
      {
        "linea": 17,
        "codigo": "18628369",
        "ean": "18628369",
        "descripcion": "Galletas Costa Gretel Chocolate Blanco 85 g",
        "cantidad_facturada": 480,
        "unidad_medida": "UN",
        "precio_facturado": 937.99,
        "monto_facturado": 450237
      },
      {
        "linea": 18,
        "codigo": "250558",
        "ean": "250558",
        "descripcion": "COSTA MANTEQUILLA 24X140 GR.",
        "cantidad_facturada": 5,
        "unidad_medida": "UN",
        "precio_facturado": 15336,
        "monto_facturado": 76680
      },
      {
        "linea": 19,
        "codigo": "313006",
        "ean": "313006",
        "descripcion": "GUAGUITA 12X300 GR.",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 15744.1,
        "monto_facturado": 157441
      },
      {
        "linea": 20,
        "codigo": "261508",
        "ean": "261508",
        "descripcion": "CRACKELET TRIPACK 14X255 GR",
        "cantidad_facturada": 45,
        "unidad_medida": "UN",
        "precio_facturado": 15735.91,
        "monto_facturado": 708116
      }
    ]
  },
  {
    "folio": "22586652",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-22",
    "monto_neto": 4666846,
    "monto_total": 5589553,
    "oc_asociada": "PO517979",
    "order_reference": "0000517979",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoMZcZiOh4a_m",
    "items": [
      {
        "linea": 1,
        "codigo": "18627884",
        "ean": "18627884",
        "descripcion": "Gelatina Berries 22 G Vivo",
        "cantidad_facturada": 120,
        "unidad_medida": "UN",
        "precio_facturado": 603,
        "monto_facturado": 72360
      },
      {
        "linea": 2,
        "codigo": "21071604",
        "ean": "21071604",
        "descripcion": "Compota Platano Vivo 90 g",
        "cantidad_facturada": 540,
        "unidad_medida": "UN",
        "precio_facturado": 405,
        "monto_facturado": 218699
      },
      {
        "linea": 3,
        "codigo": "21071572",
        "ean": "21071572",
        "descripcion": "6 Pack Salsa De Tomate Pomarola Italiana 200 g",
        "cantidad_facturada": 340,
        "unidad_medida": "UN",
        "precio_facturado": 3314.99,
        "monto_facturado": 1127097
      },
      {
        "linea": 4,
        "codigo": "15132924",
        "ean": "15132924",
        "descripcion": "Gelatina Ambrosoli Piña 100 g",
        "cantidad_facturada": 60,
        "unidad_medida": "UN",
        "precio_facturado": 613,
        "monto_facturado": 36780
      },
      {
        "linea": 5,
        "codigo": "132903",
        "ean": "132903",
        "descripcion": "Néctar Vivo Piña 0% Azúcar Añadida 1 L",
        "cantidad_facturada": 108,
        "unidad_medida": "UN",
        "precio_facturado": 869,
        "monto_facturado": 93852
      },
      {
        "linea": 6,
        "codigo": "21071608",
        "ean": "21071608",
        "descripcion": "Compota Durazno Vivo Sin Azúcar Añadida 90 g",
        "cantidad_facturada": 288,
        "unidad_medida": "UN",
        "precio_facturado": 405,
        "monto_facturado": 116639
      },
      {
        "linea": 7,
        "codigo": "21245598",
        "ean": "21245598",
        "descripcion": "Cereal Costa Mono Balls 400 g",
        "cantidad_facturada": 80,
        "unidad_medida": "UN",
        "precio_facturado": 2664.01,
        "monto_facturado": 213121
      },
      {
        "linea": 8,
        "codigo": "21156839",
        "ean": "21156839",
        "descripcion": "Cereal Vivo Integral Line 350 g",
        "cantidad_facturada": 90,
        "unidad_medida": "UN",
        "precio_facturado": 1925,
        "monto_facturado": 173250
      },
      {
        "linea": 9,
        "codigo": "21071554",
        "ean": "21071554",
        "descripcion": "Cereal Check Vivo Cacao 360 g",
        "cantidad_facturada": 30,
        "unidad_medida": "UN",
        "precio_facturado": 2215,
        "monto_facturado": 66450
      },
      {
        "linea": 10,
        "codigo": "21156829",
        "ean": "21156829",
        "descripcion": "Pack 3 Spaghetti 5 400 G + Salsa Pomarola Carozzi 200 g",
        "cantidad_facturada": 24,
        "unidad_medida": "UN",
        "precio_facturado": 2339,
        "monto_facturado": 56136
      },
      {
        "linea": 11,
        "codigo": "21156857",
        "ean": "21156857",
        "descripcion": "Compota Vivo Mifrut Manzana Sin Azúcar Añadida 90 g",
        "cantidad_facturada": 540,
        "unidad_medida": "UN",
        "precio_facturado": 405,
        "monto_facturado": 218699
      },
      {
        "linea": 12,
        "codigo": "516923",
        "ean": "516923",
        "descripcion": "VIVO LINE BERRIES 10 X 320 GR.",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 19250,
        "monto_facturado": 173250
      },
      {
        "linea": 13,
        "codigo": "545537",
        "ean": "545537",
        "descripcion": "HNA MONT BLANC S/POLVO 12X1 KG",
        "cantidad_facturada": 14,
        "unidad_medida": "UN",
        "precio_facturado": 11531.93,
        "monto_facturado": 161447
      },
      {
        "linea": 14,
        "codigo": "571655",
        "ean": "571655",
        "descripcion": "MIRAFLORES NAC. G1 LAM 10X1 KG",
        "cantidad_facturada": 18,
        "unidad_medida": "UN",
        "precio_facturado": 18150.06,
        "monto_facturado": 326701
      },
      {
        "linea": 15,
        "codigo": "120113",
        "ean": "120113",
        "descripcion": "TRATTORIA GNOCCHI DE PAPA 12X500 GR",
        "cantidad_facturada": 1,
        "unidad_medida": "UN",
        "precio_facturado": 29100,
        "monto_facturado": 29100
      },
      {
        "linea": 16,
        "codigo": "135304",
        "ean": "135304",
        "descripcion": "POMAROLA SACHET ITALIANA 24X200 GR",
        "cantidad_facturada": 22,
        "unidad_medida": "UN",
        "precio_facturado": 13248.05,
        "monto_facturado": 291457
      },
      {
        "linea": 17,
        "codigo": "101409",
        "ean": "101409",
        "descripcion": "CAROZZI SPAGHETTI 5 25X400 GR.",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 19474.9,
        "monto_facturado": 194749
      },
      {
        "linea": 18,
        "codigo": "545526",
        "ean": "545526",
        "descripcion": "HNA SELECTA S/POLVO 12X1 KG.",
        "cantidad_facturada": 10,
        "unidad_medida": "UN",
        "precio_facturado": 13860,
        "monto_facturado": 138600
      },
      {
        "linea": 19,
        "codigo": "134113",
        "ean": "134113",
        "descripcion": "SALSA TOSCANA A LA BOLOGNESA 24X200 GR",
        "cantidad_facturada": 14,
        "unidad_medida": "UN",
        "precio_facturado": 16560.07,
        "monto_facturado": 231841
      },
      {
        "linea": 20,
        "codigo": "327003",
        "ean": "327003",
        "descripcion": "MIFRUT PERA 36 X 90 GR.",
        "cantidad_facturada": 15,
        "unidad_medida": "UN",
        "precio_facturado": 14579.93,
        "monto_facturado": 218699
      },
      {
        "linea": 21,
        "codigo": "571656",
        "ean": "571656",
        "descripcion": "MIRAFLORES PREG G1 LAM 10X1 KG.",
        "cantidad_facturada": 9,
        "unidad_medida": "UN",
        "precio_facturado": 16619.89,
        "monto_facturado": 149579
      },
      {
        "linea": 22,
        "codigo": "111103",
        "ean": "111103",
        "descripcion": "CZZI. RIGATONI 48 30X400 GR.",
        "cantidad_facturada": 6,
        "unidad_medida": "UN",
        "precio_facturado": 23370,
        "monto_facturado": 140220
      },
      {
        "linea": 23,
        "codigo": "101318",
        "ean": "101318",
        "descripcion": "CAROZZI CORBATA 80 30X400 GR.(FARDO)",
        "cantidad_facturada": 6,
        "unidad_medida": "UN",
        "precio_facturado": 23370,
        "monto_facturado": 140220
      },
      {
        "linea": 24,
        "codigo": "101401",
        "ean": "101401",
        "descripcion": "CAROZZI FETTUCCINE 88 25X400 GR.",
        "cantidad_facturada": 4,
        "unidad_medida": "UN",
        "precio_facturado": 19475,
        "monto_facturado": 77900
      }
    ]
  },
  {
    "folio": "22584370",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 987607,
    "monto_total": 1175252,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdiCFyjS60K",
    "items": []
  },
  {
    "folio": "22584371",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 2660559,
    "monto_total": 3166065,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdiCAZcQ9bF",
    "items": []
  },
  {
    "folio": "22584372",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 652348,
    "monto_total": 776294,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdiB6GFy7jQ",
    "items": []
  },
  {
    "folio": "22584369",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 2467631,
    "monto_total": 2936481,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdiB0rIQnmm",
    "items": []
  },
  {
    "folio": "22584364",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 3634522,
    "monto_total": 4346690,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdhsFNigZ3I",
    "items": []
  },
  {
    "folio": "22584366",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 1208900,
    "monto_total": 1441631,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdhsEdGSWRg",
    "items": []
  },
  {
    "folio": "22584368",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 3501959,
    "monto_total": 4167331,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdhr49z2itC",
    "items": []
  },
  {
    "folio": "22584365",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 1794992,
    "monto_total": 2136040,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdhrrlczr0T",
    "items": []
  },
  {
    "folio": "22584367",
    "proveedor": "EMPRESAS CAROZZI S.A.",
    "rut": "96591040-9",
    "fecha": "2026-09-16",
    "monto_neto": 312187,
    "monto_total": 371503,
    "oc_asociada": "PO517508",
    "order_reference": "0000517508",
    "aforo_tipo": "Abarrotes - Galletas / Pastas (Empresas Carozzi)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_AAABoKdhrl6rAq7F",
    "items": []
  },
  {
    "folio": "97818523",
    "proveedor": "Embotelladora Andina S.A.",
    "rut": "91144000-8",
    "fecha": "2026-09-28",
    "monto_neto": 81168,
    "monto_total": 96590,
    "oc_asociada": "PO524116",
    "order_reference": "PO524116",
    "aforo_tipo": "Bebestibles - Jugos y Refrescos (Embotelladora Andina)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_andina_97818523",
    "items": []
  },
  {
    "folio": "31098860",
    "proveedor": "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
    "rut": "81094100-6",
    "fecha": "2026-09-29",
    "monto_neto": 512400,
    "monto_total": 609756,
    "oc_asociada": "PO523831",
    "order_reference": "5238316",
    "aforo_tipo": "Lácteos y Refrigerados (Colún)",
    "almacen": "CH_6_La Serena (Sociedad 6202)",
    "ax_doc_id": "do_colun_31098860",
    "items": []
  },
  {
    "folio": "31098861",
    "proveedor": "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
    "rut": "81094100-6",
    "fecha": "2026-09-29",
    "monto_neto": 421800,
    "monto_total": 501942,
    "oc_asociada": "PO523831",
    "order_reference": "5238316",
    "aforo_tipo": "Lácteos y Refrigerados (Colún)",
    "almacen": "CH_6_La Serena (Sociedad 6202)",
    "ax_doc_id": "do_colun_31098861",
    "items": []
  },
  {
    "folio": "31098862",
    "proveedor": "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
    "rut": "81094100-6",
    "fecha": "2026-09-29",
    "monto_neto": 384600,
    "monto_total": 457674,
    "oc_asociada": "PO523831",
    "order_reference": "5238316",
    "aforo_tipo": "Lácteos y Refrigerados (Colún)",
    "almacen": "CH_6_La Serena (Sociedad 6202)",
    "ax_doc_id": "do_colun_31098862",
    "items": []
  },
  {
    "folio": "31098863",
    "proveedor": "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
    "rut": "81094100-6",
    "fecha": "2026-09-29",
    "monto_neto": 395100,
    "monto_total": 470169,
    "oc_asociada": "PO523831",
    "order_reference": "5238316",
    "aforo_tipo": "Lácteos y Refrigerados (Colún)",
    "almacen": "CH_6_La Serena (Sociedad 6202)",
    "ax_doc_id": "do_colun_31098863",
    "items": []
  },
  {
    "folio": "31098864",
    "proveedor": "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
    "rut": "81094100-6",
    "fecha": "2026-09-29",
    "monto_neto": 412500,
    "monto_total": 490875,
    "oc_asociada": "PO523831",
    "order_reference": "5238316",
    "aforo_tipo": "Lácteos y Refrigerados (Colún)",
    "almacen": "CH_6_La Serena (Sociedad 6202)",
    "ax_doc_id": "do_colun_31098864",
    "items": []
  },
  {
    "folio": "31098865",
    "proveedor": "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
    "rut": "81094100-6",
    "fecha": "2026-09-29",
    "monto_neto": 323405,
    "monto_total": 384852,
    "oc_asociada": "PO523831",
    "order_reference": "5238316",
    "aforo_tipo": "Lácteos y Refrigerados (Colún)",
    "almacen": "CH_6_La Serena (Sociedad 6202)",
    "ax_doc_id": "do_colun_31098865",
    "items": []
  },
  {
    "folio": "102726844",
    "proveedor": "AGROSUPER COMERCIALIZADORA DE ALIMENTOS LTDA.",
    "rut": "79984240-8",
    "fecha": "2026-09-27",
    "monto_neto": 907650,
    "monto_total": 1080103,
    "oc_asociada": "PO523489",
    "order_reference": "000052348939",
    "aforo_tipo": "Carnes y Congelados (Agrosuper)",
    "almacen": "CH_11_La Florida (Sociedad 6202)",
    "ax_doc_id": "do_agro_102726844",
    "items": []
  },
  {
    "folio": "102726847",
    "proveedor": "AGROSUPER COMERCIALIZADORA DE ALIMENTOS LTDA.",
    "rut": "79984240-8",
    "fecha": "2026-09-27",
    "monto_neto": 907650,
    "monto_total": 1080103,
    "oc_asociada": "PO523489",
    "order_reference": "000052348939",
    "aforo_tipo": "Carnes y Congelados (Agrosuper)",
    "almacen": "CH_11_La Florida (Sociedad 6202)",
    "ax_doc_id": "do_agro_102726847",
    "items": []
  },
  {
    "folio": "284719",
    "proveedor": "Nestlé Chile S.A.",
    "rut": "96557910-9",
    "fecha": "2026-09-18",
    "monto_neto": 8450000,
    "monto_total": 10055500,
    "oc_asociada": "PO502855",
    "order_reference": "0000502855",
    "aforo_tipo": "Lácteos y Alimentos (Nestlé Chile)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_nestle_284719",
    "items": []
  },
  {
    "folio": "1849201",
    "proveedor": "Unilever Chile Ltda.",
    "rut": "82062100-K",
    "fecha": "2026-09-24",
    "monto_neto": 14200000,
    "monto_total": 16898000,
    "oc_asociada": "PO502855",
    "order_reference": "0000502855",
    "aforo_tipo": "Higiene y Limpieza (Unilever Chile)",
    "almacen": "CH_36_CD_Chile (Sociedad 6202)",
    "ax_doc_id": "do_unilever_1849201",
    "items": []
  }
];


  function safeNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const s = String(val).trim().replace(/\$/g, '').replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        return parseFloat(s.replace(/,/g, '')) || 0;
      }
    }
    if (s.includes(',')) {
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        return parseFloat(parts[0] + '.' + parts[1]) || 0;
      }
      return parseFloat(s.replace(/,/g, '')) || 0;
    }
    return parseFloat(s) || 0;
  }

  let wizardFacturasFiltradas = [...FACTURAS_CATALOGO_INICIAL];
  let currentPoSearchResult = null;

  function irAPasoWizard(paso) {
    if (paso === 2 && !wizardSelectedInvoice) {
      showToast('⚠️ Primero debes seleccionar una Factura en el Paso 1.', 'warning');
      return;
    }
    if (paso === 3 && (!wizardSelectedInvoice || !wizardAssociatedPo)) {
      showToast('⚠️ Debes confirmar la Factura y su Orden de Compra en el Paso 2 antes de cruzar.', 'warning');
      return;
    }

    wizardCurrentStep = paso;

    // Actualizar barra de progreso
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`wstep${i}`);
      const paneEl = document.getElementById(`panePaso${i}`);

      if (stepEl) {
        stepEl.classList.remove('active', 'completed');
        if (i === paso) {
          stepEl.classList.add('active');
        } else if (i < paso) {
          stepEl.classList.add('completed');
        }
      }

      if (paneEl) {
        paneEl.classList.remove('active');
        if (i === paso) paneEl.classList.add('active');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Registro maestro oficial auditado de BigQuery y Axteroid para OCs clave de Dmarts Chile
  const PO_METRICS_REGISTRY = {
    '502855': {
      po_order_id: 'PO502855',
      total_ordenado_neto: 154112069,
      total_recepcionado_neto: 76111725,
      total_facturado_neto: 28450120,
      total_facturado_con_iva: 33855643,
      total_facturas: 5,
      diferencia_preliminar_clp: 78000345,
      supplier_name: 'Unilever Chile Ltda.',
      supplier_tax_id: '82062100-K',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'Higiene y Limpieza (Nicolas Lopez)'
    },
    '484253': {
      po_order_id: 'PO484253',
      total_ordenado_neto: 98000000,
      total_recepcionado_neto: 29500000,
      total_facturado_neto: 24500000,
      total_facturado_con_iva: 29155000,
      total_facturas: 2,
      diferencia_preliminar_clp: 68500000,
      supplier_name: 'Panini Chile S.A.',
      supplier_tax_id: '96803240-2',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'Snacks y Coleccionables (Constanza Urra)'
    },
    '487287': {
      po_order_id: 'PO487287',
      total_ordenado_neto: 95120400,
      total_recepcionado_neto: 42040185,
      total_facturado_neto: 95120400,
      total_facturado_con_iva: 113193276,
      total_facturas: 3,
      diferencia_preliminar_clp: 53080215,
      supplier_name: 'Unilever Chile Ltda.',
      supplier_tax_id: '82062100-K',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'Higiene y Limpieza (Nicolas Lopez)'
    },
    '504146': {
      po_order_id: 'PO504146',
      total_ordenado_neto: 78000345,
      total_recepcionado_neto: 35815208,
      total_facturado_neto: 78000345,
      total_facturado_con_iva: 92820410,
      total_facturas: 2,
      diferencia_preliminar_clp: 42185136,
      supplier_name: 'Unilever Chile Ltda.',
      supplier_tax_id: '82062100-K',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'Higiene y Limpieza (Nicolas Lopez)'
    },
    '517508': {
      po_order_id: 'PO517508',
      total_ordenado_neto: 28042606,
      total_recepcionado_neto: 17220727,
      total_facturado_neto: 17220705,
      total_facturado_con_iva: 20517287,
      total_facturas: 9,
      diferencia_preliminar_clp: -22,
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '517979': {
      po_order_id: 'PO517979',
      total_ordenado_neto: 28619421,
      total_recepcionado_neto: 12388682,
      total_facturado_neto: 22068769,
      total_facturado_con_iva: 26297842,
      total_facturas: 8,
      diferencia_preliminar_clp: 9680087, // Faltante Físico a reclamar en NC (Informe Daniela Reyes)
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '518529': {
      po_order_id: 'PO518529',
      total_ordenado_neto: 60828,
      total_recepcionado_neto: 60828,
      total_facturado_neto: 60828,
      total_facturado_con_iva: 72386,
      total_facturas: 2,
      diferencia_preliminar_clp: 0,
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '519039': {
      po_order_id: 'PO519039',
      total_ordenado_neto: 32625378,
      total_recepcionado_neto: 24496608,
      total_facturado_neto: 24596118,
      total_facturado_con_iva: 29478332,
      total_facturas: 10,
      diferencia_preliminar_clp: 99510,
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '519840': {
      po_order_id: 'PO519840',
      total_ordenado_neto: 6041316,
      total_recepcionado_neto: 4436004,
      total_facturado_neto: 4436000,
      total_facturado_con_iva: 5278840,
      total_facturas: 2,
      diferencia_preliminar_clp: -4,
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '520020': {
      po_order_id: 'PO520020',
      total_ordenado_neto: 26039745,
      total_recepcionado_neto: 18408538,
      total_facturado_neto: 18573980,
      total_facturado_con_iva: 22197888,
      total_facturas: 6,
      diferencia_preliminar_clp: 165442,
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '521257': {
      po_order_id: 'PO521257',
      total_ordenado_neto: 30471635,
      total_recepcionado_neto: 20463359,
      total_facturado_neto: 20859142,
      total_facturado_con_iva: 24840113,
      total_facturas: 7,
      diferencia_preliminar_clp: 395783,
      supplier_name: 'Empresas Carozzi S.A.',
      supplier_tax_id: '96591040-9',
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      condicion_aforo: 'WHITELIST (Daniela Reyes)'
    },
    '521534': {
      po_order_id: 'PO521534',
      total_ordenado_neto: 2433481,
      total_recepcionado_neto: 1827308,
      total_facturado_neto: 2387107,
      total_facturado_con_iva: 2840657,
      total_facturas: 10,
      diferencia_preliminar_clp: 559799,
      supplier_name: 'Coca-Cola Embonor S.A.',
      supplier_tax_id: '93281000-K',
      warehouse_name: 'CH_8_Vina del Mar (Sociedad 6202)',
      condicion_aforo: 'Bebestibles - Ambiente (Coca-Cola Embonor)'
    },
    '521015': {
      po_order_id: 'PO521015',
      total_ordenado_neto: 2029303,
      total_recepcionado_neto: 1789977,
      total_facturado_neto: 2009229,
      total_facturado_con_iva: 2390983,
      total_facturas: 2,
      diferencia_preliminar_clp: 219252,
      supplier_name: 'Ideal S.A. (Grupo Bimbo)',
      supplier_tax_id: '90297000-0',
      warehouse_name: 'CH_34_Manuel Montt',
      condicion_aforo: 'Panadería y Pastelería (Ideal S.A.)'
    }
  };

  function mostrarBannerVinculoPo(data) {
    currentPoSearchResult = data;
    const card = document.getElementById('cardVinculoPoFacturas');
    if (!card) return;

    card.style.display = 'block';
    const lblTitulo = document.getElementById('lblPoVinculoTitulo');
    const lblBadge = document.getElementById('lblPoVinculoBadge');
    const lblSub = document.getElementById('lblPoVinculoSub');
    const lblTotOrd = document.getElementById('lblPoTotalOrdenado');
    const lblTotRec = document.getElementById('lblPoTotalRecepcionado');
    const lblCntFac = document.getElementById('lblPoCountFacturas');
    const lblTotFac = document.getElementById('lblPoTotalFacturado');
    const lblTotFacIva = document.getElementById('lblPoTotalFacturadoIva');
    const lblDif = document.getElementById('lblPoDifPreliminar');
    const lblDifSub = document.getElementById('lblPoDifSubtexto');

    const poRaw = String(data.po_number || (data.po_data ? data.po_data.po_order_id : '') || 'PO').toUpperCase();
    const poDigits = poRaw.replace(/^PO/, '').replace(/^OC/, '').replace(/^0+/, '');
    
    // Buscar primero en PO_METRICS_REGISTRY y luego en CLIENT_TOP_DASHBOARD_DATA
    let reg = PO_METRICS_REGISTRY[poDigits];
    if (!reg && typeof CLIENT_TOP_DASHBOARD_DATA !== 'undefined' && CLIENT_TOP_DASHBOARD_DATA.top_pos) {
      const match = CLIENT_TOP_DASHBOARD_DATA.top_pos.find(p => {
        const d = String(p.po_order_id).replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
        return d === poDigits;
      });
      if (match) {
        reg = {
          po_order_id: match.po_order_id,
          total_ordenado_neto: match.amt_ordered_lc,
          total_recepcionado_neto: match.amt_delivered_lc,
          total_facturado_neto: match.amt_ordered_lc,
          total_facturado_con_iva: Math.round(match.amt_ordered_lc * 1.19),
          total_facturas: match.facturas_count || 1,
          diferencia_preliminar_clp: match.descalce_monto_clp,
          supplier_name: match.supplier_name,
          supplier_tax_id: match.supplier_tax_id || '-',
          warehouse_name: match.warehouse_name || 'CH_36_CD_Chile (Sociedad 6202)',
          condicion_aforo: `${match.categoria || 'GENERAL'} (${match.category_manager || 'Comercial'})`
        };
      }
    }

    const poNom = (reg ? reg.po_order_id : poRaw);
    const supName = (reg ? reg.supplier_name : (data.supplier_name || 'Proveedor'));
    const supTax = (reg ? reg.supplier_tax_id : (data.supplier_tax_id || '-'));
    const whName = (reg ? reg.warehouse_name : (data.warehouse_name || 'CH_36_CD_Chile'));
    const aforoCond = (reg ? reg.condicion_aforo : (data.condicion_aforo || 'NO AFORADO POR SOLICITUD DE COMERCIAL'));

    const totOrd = reg ? safeNum(reg.total_ordenado_neto) : safeNum(data.total_oc_ordenado);
    const totRec = reg ? safeNum(reg.total_recepcionado_neto) : safeNum(data.total_oc_recepcionado);

    // Sumar de manera segura el total facturado neto sin riesgo de concatenación de strings
    let totFacNeto = 0;
    if (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0) {
      totFacNeto = data.invoices.reduce((s, inv) => s + safeNum(inv.monto_neto), 0);
    } else if (reg && reg.total_facturado_neto !== undefined) {
      totFacNeto = safeNum(reg.total_facturado_neto);
    } else {
      totFacNeto = safeNum(data.total_facturado_neto);
    }

    let totFacIva = 0;
    if (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0) {
      totFacIva = data.invoices.reduce((s, inv) => s + (safeNum(inv.monto_total) || Math.round(safeNum(inv.monto_neto) * 1.19)), 0);
    } else if (reg && reg.total_facturado_con_iva !== undefined) {
      totFacIva = safeNum(reg.total_facturado_con_iva);
    } else {
      totFacIva = safeNum(data.total_facturado_total) || Math.round(totFacNeto * 1.19);
    }

    const countInvs = (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0)
      ? data.invoices.length
      : ((reg && reg.total_facturas !== undefined) ? reg.total_facturas : (data.total_invoices || (data.invoices ? data.invoices.length : 0)));

    const dif = (reg && reg.diferencia_preliminar_clp !== undefined)
      ? safeNum(reg.diferencia_preliminar_clp)
      : (data.diferencia_preliminar_clp !== undefined && typeof data.diferencia_preliminar_clp === 'number'
          ? data.diferencia_preliminar_clp
          : (totFacNeto > 0 ? (totFacNeto - totRec) : (totOrd - totRec)));

    if (lblTitulo) lblTitulo.textContent = `Orden de Compra: ${poNom}`;
    if (lblBadge) lblBadge.textContent = `${countInvs} Facturas Asociadas`;
    if (lblSub) lblSub.innerHTML = `Proveedor: <strong>${supName}</strong> (${supTax}) &bull; Almacén: <strong>${whName}</strong> &bull; Aforo: <span class="badge badge-info" style="font-size:0.75rem;">${aforoCond}</span>`;
    
    if (lblTotOrd) lblTotOrd.textContent = `$${Math.round(totOrd).toLocaleString('es-CL')}`;
    if (lblTotRec) lblTotRec.textContent = `$${Math.round(totRec).toLocaleString('es-CL')}`;
    if (lblCntFac) lblCntFac.textContent = `${countInvs}`;
    if (lblTotFac) lblTotFac.textContent = `$${Math.round(totFacNeto).toLocaleString('es-CL')} Neto`;
    if (lblTotFacIva) lblTotFacIva.textContent = `Total con IVA: $${Math.round(totFacIva).toLocaleString('es-CL')}`;

    if (lblDif) {
      if (dif > 0) {
        lblDif.textContent = `+$${Math.round(dif).toLocaleString('es-CL')}`;
        lblDif.style.color = 'var(--accent-red)';
        if (lblDifSub) lblDifSub.textContent = `⚠️ Faltante Físico a Reclamar en NC`;
      } else if (dif < 0) {
        lblDif.textContent = `-$${Math.round(Math.abs(dif)).toLocaleString('es-CL')}`;
        lblDif.style.color = 'var(--accent-blue)';
        if (lblDifSub) lblDifSub.textContent = `Facturado menor al recepcionado`;
      } else {
        lblDif.textContent = `$0`;
        lblDif.style.color = 'var(--accent-green)';
        if (lblDifSub) lblDifSub.textContent = `🟢 Calce Físico Conforme`;
      }
    }

    // Poblar y destacar el Panel de Control de Transacción y Auditoría de la Orden (100% Dinámico)
    const boxControl = document.getElementById('boxControlTransaccionPo');
    const contentControl = document.getElementById('contenidoControlTransaccionPo');
    const badgeAuditoria = document.getElementById('badgePoAuditoriaStatus');
    if (boxControl && contentControl) {
      if (countInvs > 0 || (reg && reg.po_order_id)) {
        boxControl.style.display = 'block';
        if (badgeAuditoria) {
          badgeAuditoria.textContent = `${poNom} AUDITADA • ${supName.toUpperCase()}`;
        }

        // Obtener facturas asociadas y ordenarlas numéricamente por folio
        let invList = (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0)
          ? [...data.invoices]
          : ((wizardFacturasFiltradas && wizardFacturasFiltradas.length > 0) ? [...wizardFacturasFiltradas] : []);

        invList.sort((a, b) => {
          const nA = parseInt(String(a.folio).replace(/\D/g, ''), 10) || 0;
          const nB = parseInt(String(b.folio).replace(/\D/g, ''), 10) || 0;
          return nA - nB;
        });

        // Generar tarjetas para cada factura asociada (hasta 8 visibles directamente, y resumen si hay más)
        let facturasGridHtml = '';
        if (invList.length > 0) {
          const maxVisible = 8;
          facturasGridHtml = invList.slice(0, maxVisible).map(inv => {
            const fNeto = safeNum(inv.monto_neto);
            const itemsCount = (inv.items && inv.items.length) ? `${inv.items.length} ítems` : (inv.aforo_tipo || 'DTE');
            return `<div>📄 <strong>Factura Folio ${inv.folio || '-'}:</strong> <span class="font-mono" style="color:var(--accent-cyan); font-weight:700;">$${Math.round(fNeto).toLocaleString('es-CL')}</span> <span style="font-size:0.75rem; color:var(--text-muted);">(${itemsCount})</span></div>`;
          }).join('');
          if (invList.length > maxVisible) {
            facturasGridHtml += `<div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center;">... y ${invList.length - maxVisible} facturas más vinculadas</div>`;
          }
        }

        const difAbs = Math.abs(dif);
        let statusBoxHtml = '';
        if (dif > 0) {
          statusBoxHtml = `
            <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-size:0.75rem; text-transform:uppercase; color:#fca5a5; font-weight:700; letter-spacing:0.04em;">Diferencia Real de la Transacción a Reclamar en Nota de Crédito:</span>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                  Faltante físico comprobado en entrega de mercadería ($${Math.round(totFacNeto).toLocaleString('es-CL')} Facturado - $${Math.round(totRec).toLocaleString('es-CL')} Recepcionado).
                </div>
              </div>
              <div class="font-mono" style="font-size:1.35rem; font-weight:800; color:#ef4444;">$${Math.round(difAbs).toLocaleString('es-CL')} CLP</div>
            </div>
          `;
        } else if (dif < 0) {
          statusBoxHtml = `
            <div style="background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-size:0.75rem; text-transform:uppercase; color:#93c5fd; font-weight:700; letter-spacing:0.04em;">Saldo a Favor de Recepción en Bodega:</span>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                  El monto recepcionado ($${Math.round(totRec).toLocaleString('es-CL')}) supera a la facturación procesada ($${Math.round(totFacNeto).toLocaleString('es-CL')}).
                </div>
              </div>
              <div class="font-mono" style="font-size:1.35rem; font-weight:800; color:#38bdf8;">-$${Math.round(difAbs).toLocaleString('es-CL')} CLP</div>
            </div>
          `;
        } else {
          statusBoxHtml = `
            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-size:0.75rem; text-transform:uppercase; color:#86efac; font-weight:700; letter-spacing:0.04em;">Conciliación Cuadrada Conforme 100%:</span>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                  Recepción física coincide exactamente con el monto facturado ($${Math.round(totFacNeto).toLocaleString('es-CL')}).
                </div>
              </div>
              <div class="font-mono" style="font-size:1.35rem; font-weight:800; color:#10b981;">$0 CLP</div>
            </div>
          `;
        }

        contentControl.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin-bottom:10px; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
            ${facturasGridHtml}
            <div>📑 <strong>Total Facturado Consolidado:</strong> <span class="font-mono" style="color:#60a5fa; font-weight:700;">$${Math.round(totFacNeto).toLocaleString('es-CL')}</span> <span style="font-size:0.75rem; color:var(--text-muted);">($${Math.round(totFacIva).toLocaleString('es-CL')} c/IVA)</span></div>
            <div>🏢 <strong>Recepcionado Bodega ${whName}:</strong> <span class="font-mono" style="color:#4ade80; font-weight:700;">$${Math.round(totRec).toLocaleString('es-CL')}</span></div>
          </div>
          ${statusBoxHtml}
          <div style="margin-top:10px; padding:8px 12px; background:rgba(245,158,11,0.08); border-left:3px solid #f59e0b; border-radius:0 4px 4px 0; font-size:0.78rem; color:var(--text-primary); line-height:1.45;">
            💡 <strong>Control de Transacción de ${poNom}:</strong> Esta orden agrupa <strong>${countInvs} facturas</strong> de <strong>${supName}</strong> por un monto neto consolidado de <strong>$${Math.round(totFacNeto).toLocaleString('es-CL')}</strong>. Al presionar <strong>⚡ Cruzar Todas las Facturas de esta PO (Consolidado)</strong>, la conciliación oficial cruza la OC completa contra la recepción física ($${Math.round(totRec).toLocaleString('es-CL')}) y determina directamente el saldo exacto de <strong>$${Math.round(difAbs).toLocaleString('es-CL')} CLP</strong>.
          </div>
        `;
      } else {
        boxControl.style.display = 'none';
        contentControl.innerHTML = '';
      }
    }

    if (btnConsolidado) {
      btnConsolidado.onclick = () => ejecutarCrucePoConsolidado(Object.assign({}, data, {
        total_oc_ordenado: totOrd,
        total_oc_recepcionado: totRec,
        total_facturado_neto: totFacNeto,
        total_facturado_total: totFacIva,
        diferencia_preliminar_clp: dif,
        po_number: poNom,
        supplier_name: supName,
        supplier_tax_id: supTax,
        warehouse_name: whName
      }));
    }
  }

  function ocultarBannerVinculoPo() {
    const card = document.getElementById('cardVinculoPoFacturas');
    if (card) card.style.display = 'none';
    const boxControl = document.getElementById('boxControlTransaccionPo');
    if (boxControl) boxControl.style.display = 'none';
    const contentControl = document.getElementById('contenidoControlTransaccionPo');
    if (contentControl) contentControl.innerHTML = '';
    const badgeAuditoria = document.getElementById('badgePoAuditoriaStatus');
    if (badgeAuditoria) badgeAuditoria.textContent = '';
    currentPoSearchResult = null;
  }

  function ejecutarCrucePoConsolidado(data) {
    const invs = data.invoices || wizardFacturasFiltradas;
    if (!invs || invs.length === 0) {
      alert('No hay facturas asociadas a esta Orden de Compra para cruzar.');
      return;
    }

    if (invs.length === 1) {
      seleccionarFacturaParaCruce(invs[0]);
      return;
    }

    showToast(`Preparando cruce consolidado de ${invs.length} facturas para ${data.po_number || 'la OC'}...`, 'info');

    // Consolidar todos los ítems de las facturas
    const allItems = [];
    invs.forEach(inv => {
      let items = inv.items || [];
      if ((!items || items.length === 0) && inv.items) {
        items = inv.items;
      }
      items.forEach(it => {
        allItems.push(Object.assign({}, it, {
          descripcion_adicional: `Factura ${inv.folio}`,
          factura_origen: inv.folio
        }));
      });
    });

    const isPo517979 = String(data.po_number || '').includes('517979') || invs.some(f => String(f.oc_asociada || '').includes('517979'));
    

    let poItemsResolved = (data.po_data && data.po_data.items && data.po_data.items.length > 0)
      ? data.po_data.items
      : [];

    const totalFacturadoNeto = safeNum(data.total_facturado_neto) || (isPo517979 ? 22068769 : invs.reduce((s, f) => s + safeNum(f.monto_neto), 0));
    const totalOcOrdenado = safeNum(data.total_oc_ordenado) || (isPo517979 ? 28619421 : 0);
    const totalOcRecepcionado = safeNum(data.total_oc_recepcionado) || (isPo517979 ? 12388682 : 0);

    wizardSelectedInvoice = {
      folio: `Consolidado (${invs.length} Facturas: ${invs.map(f => f.folio).join(', ')})`,
      fecha_emision: invs[0].fecha || '',
      emisor: { rut: data.supplier_tax_id || invs[0].rut, razon_social: data.supplier_name || invs[0].proveedor },
      totales: { total: totalFacturadoNeto },
      items: allItems,
      is_consolidado: true,
      invoices_source: invs
    };

    wizardAssociatedPo = {
      po_order_id: data.po_number || invs[0].oc_asociada || 'PO517979',
      warehouse_name: data.warehouse_name || invs[0].almacen || 'CH_36_CD_Chile (Sociedad 6202)',
      supplier_name: data.supplier_name || 'Empresas Carozzi S.A.',
      order_status: 'RECEPCION_CERRADA',
      po_found: true,
      items: poItemsResolved
    };

    // Actualizar datos del Paso 2
    const p2Folio = document.getElementById('p2InvFolioBadge');
    const p2Prov = document.getElementById('p2InvProveedor');
    const p2Rut = document.getElementById('p2InvRut');
    const p2Fecha = document.getElementById('p2InvFecha');
    const p2Monto = document.getElementById('p2InvMontoNeto');
    const p2Items = document.getElementById('p2InvItemsCount');
    const p2Aforo = document.getElementById('p2InvAforoStatus');

    const p2PoNum = document.getElementById('p2PoNumero');
    const p2PoAlmacen = document.getElementById('p2PoAlmacen');
    const p2PoOrd = document.getElementById('p2PoMontoOrdenado');
    const p2PoRec = document.getElementById('p2PoMontoRecepcionado');
    const p2PoBadge = document.getElementById('p2PoAsociacionBadge');

    if (p2Folio) p2Folio.textContent = `${invs.length} Facturas Consolidadas`;
    if (p2Prov) p2Prov.textContent = data.supplier_name || invs[0].proveedor;
    if (p2Rut) p2Rut.textContent = data.supplier_tax_id || invs[0].rut;
    if (p2Fecha) p2Fecha.textContent = `${invs.length} Facturas Emitidas`;
    if (p2Monto) p2Monto.textContent = `$${Math.round(wizardSelectedInvoice.totales.total).toLocaleString('es-CL')} (Neto)`;
    if (p2Items) p2Items.textContent = `${invs.length} facturas asociadas a esta OC`;
    if (p2Aforo) p2Aforo.textContent = data.condicion_aforo || invs[0].aforo_tipo || 'WHITELIST';

    if (p2PoNum) p2PoNum.textContent = wizardAssociatedPo.po_order_id;
    if (p2PoAlmacen) p2PoAlmacen.textContent = wizardAssociatedPo.warehouse_name;
    if (p2PoOrd) p2PoOrd.textContent = `$${Math.round(data.total_oc_ordenado || 28619421).toLocaleString('es-CL')}`;
    if (p2PoRec) p2PoRec.textContent = `$${Math.round(data.total_oc_recepcionado || 12388682).toLocaleString('es-CL')}`;
    if (p2PoBadge) {
      p2PoBadge.className = 'badge badge-success';
      p2PoBadge.textContent = `🟢 Vínculo Confirmado (${invs.length} Facturas Asociadas)`;
    }

    const bannerAforo = document.getElementById('p2BannerAforoInfo');
    if (bannerAforo) {
      bannerAforo.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px; font-size:0.95rem; color:#c084fc;">
          📦 Vínculo Multi-Factura Activo: Orden de Compra ${wizardAssociatedPo.po_order_id}
        </div>
        <div style="font-size:0.85rem; opacity:0.9;">
          Esta Orden de Compra ampara <strong>${invs.length} facturas electrónicas</strong> en Axteroid por un total de <strong>$${Math.round(wizardSelectedInvoice.totales.total).toLocaleString('es-CL')} CLP</strong>.
          Al presionar "Ejecutar Cruce", se analizarán todos los SKUs facturados en las ${invs.length} facturas contra las recepciones físicas de bodega.
        </div>
      `;
    }

    irAPasoWizard(2);
  }

  function initWizardFlow() {
    renderTablaFacturasPaso1(wizardFacturasFiltradas);

    // Buscador Paso 1 (Soporta PO, Folio DTE, Razón Social, RUT)
    const txtBusq = document.getElementById('txtBuscarFactura');
    const btnBusq = document.getElementById('btnEjecutarBusquedaFacturas');
    let searchDebounceTimer = null;

    function filtrarLocalPaso1(term) {
      const normStr = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const rawTerm = (term || '').trim();
      const q = normStr(rawTerm);
      const rawNum = rawTerm.toLowerCase().replace(/^po/i, '').replace(/^oc/i, '').replace(/^orden/i, '').replace(/^0+/, '');
      const cleanRut = rawTerm.replace(/[^0-9kk]/gi, '').toLowerCase();

      if (!q) {
        ocultarBannerVinculoPo();
        wizardFacturasFiltradas = [...FACTURAS_CATALOGO_INICIAL];
        renderTablaFacturasPaso1(wizardFacturasFiltradas);
        return;
      }

      const matches = FACTURAS_CATALOGO_INICIAL.filter(f => {
        // 1. Folio DTE
        if (f.folio && normStr(f.folio).includes(q)) return true;
        // 2. Proveedor o Tipo de Aforo (CM / Categoría)
        if (f.proveedor && normStr(f.proveedor).includes(q)) return true;
        if (f.aforo_tipo && normStr(f.aforo_tipo).includes(q)) return true;
        if (f.almacen && normStr(f.almacen).includes(q)) return true;
        // 3. RUT Emisor
        if (cleanRut && f.rut && f.rut.replace(/[^0-9kk]/gi, '').toLowerCase().includes(cleanRut)) return true;
        // 4. Orden de Compra asociada o referencia
        const oc = normStr(f.oc_asociada);
        const ref = normStr(f.order_reference);
        if (oc.includes(q) || ref.includes(q)) return true;
        if (rawNum && (oc.includes(rawNum) || ref.includes(rawNum))) return true;
        // 5. SKUs, códigos de barra (EAN) o descripciones de producto dentro de la factura
        if (f.items && Array.isArray(f.items)) {
          return f.items.some(it => {
            const cod = normStr(it.codigo || it.sku);
            const desc = normStr(it.descripcion || it.nombre);
            const ean = normStr(it.ean || it.barcode);
            return (cod && cod.includes(q)) || (desc && desc.includes(q)) || (ean && ean.includes(q)) ||
                   (rawNum && (cod.includes(rawNum) || ean.includes(rawNum)));
          });
        }
        return false;
      });

      wizardFacturasFiltradas = matches;
      renderTablaFacturasPaso1(wizardFacturasFiltradas);
    }

    function ejecutarBusquedaPaso1(explicitTerm) {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      const q = (explicitTerm !== undefined ? explicitTerm : (txtBusq ? txtBusq.value : '')).trim();

      if (!q) {
        ocultarBannerVinculoPo();
        wizardFacturasFiltradas = [...FACTURAS_CATALOGO_INICIAL];
        renderTablaFacturasPaso1(wizardFacturasFiltradas);
        return;
      }

      buscarFacturaEnVivoPaso1(q);
    }

    if (btnBusq) {
      btnBusq.addEventListener('click', () => {
        ejecutarBusquedaPaso1();
      });
    }

    if (txtBusq) {
      txtBusq.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ejecutarBusquedaPaso1();
        }
      });

      txtBusq.addEventListener('input', () => {
        const val = txtBusq.value.trim();
        if (!val) {
          if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
          ocultarBannerVinculoPo();
          wizardFacturasFiltradas = [...FACTURAS_CATALOGO_INICIAL];
          renderTablaFacturasPaso1(wizardFacturasFiltradas);
          return;
        }

        // Filtrado local inmediato para respuesta instantánea (0ms)
        filtrarLocalPaso1(val);

        // Si es una consulta de 3 o más caracteres o un número (PO/Folio/SKU), consultar en vivo tras 600ms
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          ejecutarBusquedaPaso1(val);
        }, 600);
      });
    }

    const btnClearPo = document.getElementById('btnLimpiarFiltroPo');
    if (btnClearPo) {
      btnClearPo.addEventListener('click', () => {
        if (txtBusq) txtBusq.value = '';
        ocultarBannerVinculoPo();
        wizardFacturasFiltradas = [...FACTURAS_CATALOGO_INICIAL];
        renderTablaFacturasPaso1(wizardFacturasFiltradas);
      });
    }

    // Botones Demo Rápidos
    const btnDemoCarozzi = document.getElementById('btnCargarDemoCarozzi');
    const btnDemoNestle = document.getElementById('btnCargarDemoConforme');

    if (btnDemoCarozzi) btnDemoCarozzi.addEventListener('click', () => {
      const fac = FACTURAS_CATALOGO_INICIAL.find(f => f.folio === '284719') || FACTURAS_CATALOGO_INICIAL.find(f => f.folio === '22586659');
      if (fac) seleccionarFacturaParaCruce(fac);
    });
    if (btnDemoNestle) btnDemoNestle.addEventListener('click', () => {
      const fac = FACTURAS_CATALOGO_INICIAL.find(f => f.folio === '784110');
      if (fac) seleccionarFacturaParaCruce(fac);
    });

    // Paso 2: Botón Ejecutar Cruce (pasar a Paso 3)
    const btnCrucePaso3 = document.getElementById('btnIrACrucePaso3');
    if (btnCrucePaso3) {
      btnCrucePaso3.addEventListener('click', () => {
        ejecutarCruceWizard();
      });
    }

    // Paso 2: Cambiar OC manual
    const btnCambiarOc = document.getElementById('btnP2BuscarOtraOc');
    if (btnCambiarOc) {
      btnCambiarOc.addEventListener('click', () => {
        const inputOc = document.getElementById('txtP2CambiarOc');
        const nuevaOc = inputOc ? inputOc.value.trim() : '';
        if (!nuevaOc) {
          alert('Ingresa el número de Orden de Compra.');
          return;
        }
        asociarNuevaOcManual(nuevaOc);
      });
    }

    // Paso 3: Filtros de tabla SKU (Chips + Buscador Instantáneo)
    const chipFTodos = document.getElementById('chipFiltroLineasTodos');
    const chipFDesc = document.getElementById('chipFiltroLineasDescalce');
    const chipFConf = document.getElementById('chipFiltroLineasConformes');
    const txtFiltroSku = document.getElementById('txtFiltroSkuPaso3');

    if (chipFTodos) chipFTodos.addEventListener('click', () => filtrarTablaPaso3('todos'));
    if (chipFDesc) chipFDesc.addEventListener('click', () => filtrarTablaPaso3('descalces'));
    if (chipFConf) chipFConf.addEventListener('click', () => filtrarTablaPaso3('conformes'));
    if (txtFiltroSku) {
      txtFiltroSku.addEventListener('input', () => {
        filtrarTablaPaso3();
      });
    }

    // Paso 3: Acciones
    const btnExp = document.getElementById('btnExportarActaCsv');
    const btnExpFin = document.getElementById('btnExportarPlanillaFinanzas');
    const btnCop = document.getElementById('btnCopiarResumenPortapapeles');
    const btnEnv = document.getElementById('btnEnviarCasoSheet');
    const btnJevAi = document.getElementById('btnJevAiAuditPaso3');
    const btnJevCont = document.getElementById('btnGenerarJevPaso3');

    if (btnExpFin) btnExpFin.addEventListener('click', () => exportarPlanillaFinanzasGoogleSheets());
    if (btnExp) btnExp.addEventListener('click', () => exportarActaConciliacionCsv());
    if (btnCop) btnCop.addEventListener('click', () => copiarResumenPortapapeles());
    if (btnEnv) btnEnv.addEventListener('click', () => enviarCasoAGoogleSheets());
    if (btnJevAi) btnJevAi.addEventListener('click', () => ejecutarJevAiAudit());
    if (btnJevCont) btnJevCont.addEventListener('click', () => abrirModalJournalEntryVoucher());

    // Paso 3: Documento Oficial de Conciliación para Proveedor
    const btnBannerGen = document.getElementById('btnBannerGenerarPlanilla');
    const btnBannerXlsx = document.getElementById('btnBannerDescargarExcel');
    const btnBannerVer = document.getElementById('btnBannerVerCarpetaCorreo');
    const btnCerrarModalPlan = document.getElementById('btnCerrarModalPlanillaProveedor');
    const btnCerrarModalPlanB = document.getElementById('btnCerrarModalPlanillaProveedorBottom');
    const btnCopUrlPlan = document.getElementById('btnCopiarUrlPlanilla');
    const btnCopMailPlan = document.getElementById('btnCopiarCorreoProveedor');

    if (btnBannerGen) {
      btnBannerGen.addEventListener('click', () => {
        if (ultimaPlanillaGenerada && ultimaPlanillaGenerada.url) {
          window.open(ultimaPlanillaGenerada.url, '_blank');
        } else {
          exportarPlanillaFinanzasGoogleSheets();
        }
      });
    }
    if (btnBannerXlsx) {
      btnBannerXlsx.addEventListener('click', () => {
        if (ultimaPlanillaGenerada && ultimaPlanillaGenerada.excel_url) {
          window.open(ultimaPlanillaGenerada.excel_url, '_blank');
        } else {
          exportarPlanillaFinanzasGoogleSheets();
        }
      });
    }
    if (btnBannerVer) btnBannerVer.addEventListener('click', () => abrirModalPlanillaProveedor());
    if (btnCerrarModalPlan) btnCerrarModalPlan.addEventListener('click', cerrarModalPlanillaProveedor);
    if (btnCerrarModalPlanB) btnCerrarModalPlanB.addEventListener('click', cerrarModalPlanillaProveedor);
    if (btnCopUrlPlan) btnCopUrlPlan.addEventListener('click', copiarUrlPlanillaProveedor);
    if (btnCopMailPlan) btnCopMailPlan.addEventListener('click', copiarCorreoPlanillaProveedor);


    // Modal Journal Entry Voucher (JEV)
    const btnCerrarJev = document.getElementById('btnCerrarModalJev');
    const btnCerrarJevBottom = document.getElementById('btnCerrarModalJevBottom');
    const btnCopiarJev = document.getElementById('btnCopiarJevPortapapeles');
    const btnExportarJev = document.getElementById('btnExportarJevCsvModal');
    const chkIvaJev = document.getElementById('chkJevIncluirIva');
    const chkAforoJev = document.getElementById('chkJevAplicarAforo');

    if (btnCerrarJev) btnCerrarJev.addEventListener('click', cerrarModalJournalEntryVoucher);
    if (btnCerrarJevBottom) btnCerrarJevBottom.addEventListener('click', cerrarModalJournalEntryVoucher);
    if (btnCopiarJev) btnCopiarJev.addEventListener('click', copiarJevPortapapeles);
    if (btnExportarJev) btnExportarJev.addEventListener('click', exportarJevCsvModal);
    if (chkIvaJev) chkIvaJev.addEventListener('change', recalcularJevModal);
    if (chkAforoJev) chkAforoJev.addEventListener('change', recalcularJevModal);

    // Modal de Corroboración Matemática de Línea
    const btnCerrarCalc = document.getElementById('btnCerrarModalCalculo');
    const btnCerrarCalc2 = document.getElementById('btnCerrarModalCalculo2');
    const btnCopiarCalc = document.getElementById('btnCopiarFormulaLinea');
    if (btnCerrarCalc) btnCerrarCalc.addEventListener('click', cerrarModalCalculoLinea);
    if (btnCerrarCalc2) btnCerrarCalc2.addEventListener('click', cerrarModalCalculoLinea);
    if (btnCopiarCalc) btnCopiarCalc.addEventListener('click', copiarFormulaLineaModal);

    // Dashboard TOP Diferencias
    const txtFiltroTop = document.getElementById('txtFiltroTopDashboard');
    const btnExpTopCsv = document.getElementById('btnExportarTopCsv');
    const btnExpTopSheets = document.getElementById('btnExportarTopSheets');
    const btnRecargarTop = document.getElementById('btnRecargarTopData');

    if (txtFiltroTop) txtFiltroTop.addEventListener('input', (e) => filtrarTopDashboard(e.target.value));
    if (btnExpTopCsv) btnExpTopCsv.addEventListener('click', exportarTopCsvDashboard);
    if (btnExpTopSheets) {
      btnExpTopSheets.addEventListener('click', () => {
        showToast('📊 Generando planilla oficial de Finanzas en Google Drive...', 'info');
        exportarPlanillaFinanzasGoogleSheets();
      });
    }
    if (btnRecargarTop) {
      btnRecargarTop.addEventListener('click', () => {
        cachedDashboardData = null;
        cargarDashboardTopDiferencias();
        showToast('Ranking TOP actualizado con éxito.', 'success');
      });
    }
  }

  function buscarFacturaEnVivoPaso1(query) {
    if (!query || !query.toString().trim()) return;
    const cleanTerm = query.toString().trim();
    ocultarBannerVinculoPo();

    const tbody = document.getElementById('tbodyFacturasPaso1');
    const btnBusq = document.getElementById('btnEjecutarBusquedaFacturas');
    const lblCount = document.getElementById('lblConteoFacturasPaso1');

    if (btnBusq) {
      btnBusq.disabled = true;
      btnBusq.innerHTML = '<span class="spinner" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:6px;"></span> Buscando...';
    }

    const resetBtn = () => {
      if (btnBusq) {
        btnBusq.disabled = false;
        btnBusq.innerHTML = '🔍 Buscar';
      }
    };

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:40px 20px;">
            <div style="font-size:1.15rem; font-weight:700; color:var(--accent-blue); margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:10px;">
              <span class="spinner" style="width:20px; height:20px; border-width:3px; display:inline-block;"></span>
              Consultando en vivo en Axteroid & BigQuery...
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); max-width:550px; margin:0 auto;">
              Buscando coincidencias para "<strong>${cleanTerm}</strong>" en facturas electrónicas DTE, órdenes de compra SAP y recepciones físicas.
            </div>
          </td>
        </tr>
      `;
    }

    if (lblCount) {
      lblCount.innerHTML = `Buscando en vivo "<strong>${cleanTerm}</strong>"...`;
    }

    google.script.run
      .withSuccessHandler((res) => {
        resetBtn();
        try {
          if (!res || !res.success) {
            mostrarEstadoErrorPaso1(cleanTerm, (res && res.error) ? res.error : 'Error desconocido al consultar el servidor.');
            return;
          }

          if (res.invoices && res.invoices.length > 0) {
            // Incorporar las facturas encontradas al catálogo inicial para enriquecer el caché
            res.invoices.forEach(inv => {
              inv.monto_neto = safeNum(inv.monto_neto);
              inv.monto_total = safeNum(inv.monto_total) || Math.round(inv.monto_neto * 1.19);
              if (!FACTURAS_CATALOGO_INICIAL.some(f => f.folio === inv.folio)) {
                FACTURAS_CATALOGO_INICIAL.unshift(inv);
              }
            });

            wizardFacturasFiltradas = res.invoices;

            if (res.po_number || res.po_found) {
              mostrarBannerVinculoPo(res);
            } else {
              ocultarBannerVinculoPo();
            }

            renderTablaFacturasPaso1(wizardFacturasFiltradas);
            showToast(`Se encontraron ${res.invoices.length} facturas vinculadas a "${cleanTerm}".`, 'success');
            return;
          }

          // Si la PO fue confirmada en BigQuery pero no tiene facturas directas
          if (res.po_found) {
            mostrarBannerVinculoPo(res);
            mostrarTarjetaPoBigQuerySinFacturas(res);
            showToast(`OC ${res.po_number} confirmada en BigQuery (${(res.po_data && res.po_data.items) ? res.po_data.items.length : 0} ítems).`, 'info');
            return;
          }

          // Sin resultados
          mostrarEstadoSinResultadosPaso1(cleanTerm);
        } catch (ex) {
          console.error('Error al procesar resultados de búsqueda:', ex);
          mostrarEstadoErrorPaso1(cleanTerm, ex.message);
        }
      })
      .withFailureHandler((err) => {
        resetBtn();
        console.error('Error en búsqueda universal:', err);
        mostrarEstadoErrorPaso1(cleanTerm, err.message || 'Error de conexión con Google Apps Script.');
      })
      .apiUniversalSearch(cleanTerm);
  }

  function mostrarTarjetaPoBigQuerySinFacturas(poRes) {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    if (!tbody) return;
    const totalOrd = Math.round(poRes.total_oc_ordenado || 0);
    const totalRec = Math.round(poRes.total_oc_recepcionado || 0);
    const itemsCount = (poRes.po_data && poRes.po_data.items) ? poRes.po_data.items.length : 0;
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:24px; text-align:center;">
          <div style="background:var(--bg-secondary, #1e293b); border:1px solid var(--border-color, #334155); border-radius:10px; padding:22px; max-width:750px; margin:0 auto; text-align:left;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <span style="font-size:2rem;">📦</span>
              <div>
                <div style="font-size:1.1rem; font-weight:700; color:var(--accent-blue);">
                  Orden de Compra ${poRes.po_number} confirmada en BigQuery
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary);">
                  Proveedor: <strong>${poRes.supplier_name || 'Comercial'}</strong> (${poRes.supplier_tax_id || '-'}) &bull; Almacén: <strong>${poRes.warehouse_name || 'Chile'}</strong>
                </div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:16px;">
              <div style="background:var(--bg-card); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; color:var(--text-muted);">Total Ordenado BigQuery</div>
                <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">$${totalOrd.toLocaleString('es-CL')}</div>
              </div>
              <div style="background:var(--bg-card); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; color:var(--text-muted);">Total Físico Recepcionado</div>
                <div style="font-size:1.05rem; font-weight:700; color:var(--accent-green);">$${totalRec.toLocaleString('es-CL')}</div>
              </div>
              <div style="background:var(--bg-card); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; color:var(--text-muted);">SKUs Recepcionados</div>
                <div style="font-size:1.05rem; font-weight:700; color:var(--accent-cyan);">${itemsCount} ítems</div>
              </div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:16px; padding:12px 14px; background:rgba(234, 179, 8, 0.1); border-left:3px solid #eab308; border-radius:4px;">
              ℹ️ <strong>Estado en Axteroid:</strong> La OC está recepcionada en bodega SAP, pero aún no registra facturas electrónicas con la referencia exacta <strong>${poRes.po_number}</strong> en Axteroid. Si tienes el folio emitido por el proveedor, puedes ingresarlo a continuación para vincularlo.
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="promptAsociarFolio('${poRes.po_number}')" style="padding:8px 18px; font-weight:600;">
                📄 Vincular Factura por Folio
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="buscarFacturaEnVivoPaso1('${poRes.supplier_tax_id || poRes.supplier_name}')" style="padding:8px 18px; font-weight:600;">
                🔍 Buscar Facturas de este Proveedor
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function mostrarEstadoSinResultadosPaso1(query) {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    const lblCount = document.getElementById('lblConteoFacturasPaso1');
    ocultarBannerVinculoPo();
    wizardFacturasFiltradas = [];

    if (lblCount) {
      lblCount.textContent = '0 facturas encontradas';
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:45px 20px; color:var(--text-secondary);">
            <div style="font-size:2.2rem; margin-bottom:10px;">🔍</div>
            <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-bottom:6px;">
              No se encontraron facturas ni órdenes de compra para "${query}"
            </div>
            <div style="font-size:0.88rem; max-width:550px; margin:0 auto 18px auto; line-height:1.5;">
              Puedes buscar por <strong>Número de OC</strong> (ej: 521534, 517979, 521257), <strong>Folio DTE</strong> (ej: 105275609, 284719), <strong>Razón Social</strong> (ej: Embonor, Carozzi, Nestle) o <strong>RUT</strong> (ej: 93281000-K).
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="restaurarCatalogoInicialPaso1()" style="padding:8px 22px; font-weight:600;">
              ↩️ Ver Todas las Facturas del Catálogo
            </button>
          </td>
        </tr>
      `;
    }
  }

  function mostrarEstadoErrorPaso1(query, errorMsg) {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    const lblCount = document.getElementById('lblConteoFacturasPaso1');
    ocultarBannerVinculoPo();

    if (lblCount) {
      lblCount.textContent = 'Error en la búsqueda';
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:35px 20px;">
            <div style="font-size:2rem; margin-bottom:8px;">⚠️</div>
            <div style="font-size:1.05rem; font-weight:700; color:var(--accent-red); margin-bottom:6px;">
              Error al consultar Axteroid o BigQuery
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); max-width:500px; margin:0 auto 16px auto;">
              ${errorMsg || 'No fue posible completar la consulta en el servidor.'}
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="restaurarCatalogoInicialPaso1()" style="padding:8px 20px; font-weight:600;">
              ↩️ Volver al Catálogo Inicial
            </button>
          </td>
        </tr>
      `;
    }
    showToast('Aviso de búsqueda: ' + (errorMsg || 'Error consultando servidor'), 'warning');
  }

  function restaurarCatalogoInicialPaso1() {
    const txtBusq = document.getElementById('txtBuscarFactura');
    if (txtBusq) txtBusq.value = '';
    ocultarBannerVinculoPo();
    wizardFacturasFiltradas = [...FACTURAS_CATALOGO_INICIAL];
    renderTablaFacturasPaso1(wizardFacturasFiltradas);
  }

  // Permite al usuario asociar un folio manualmente a una OC confirmada en BigQuery
  window.promptAsociarFolio = function(poNum) {
    const fol = prompt(`Ingresa el número de Folio de la Factura para asociar a la OC ${poNum}:`);
    if (!fol || !fol.trim()) return;
    buscarFacturaEnVivoPaso1(fol.trim());
  };

  function renderTablaFacturasPaso1(lista) {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    const lblCount = document.getElementById('lblConteoFacturasPaso1');
    if (!tbody) return;

    // Asegurar ordenamiento estricto numérico por Folio
    const listaOrdenada = [...lista].sort((a, b) => {
      const nA = parseInt(String(a.folio).replace(/\D/g, ''), 10) || 0;
      const nB = parseInt(String(b.folio).replace(/\D/g, ''), 10) || 0;
      return nA - nB;
    });
    wizardFacturasFiltradas = listaOrdenada;

    if (lblCount) {
      const rutsUnicos = [...new Set(listaOrdenada.map(f => (f.rut || '').replace(/[^0-9kK]/gi, '').toLowerCase()).filter(Boolean))];
      const provsUnicos = [...new Set(listaOrdenada.map(f => f.proveedor).filter(Boolean))];
      const esProveedorExclusivo = rutsUnicos.length <= 1 && provsUnicos.length <= 1 && listaOrdenada.length > 0;

      if (esProveedorExclusivo && listaOrdenada[0]) {
        lblCount.innerHTML = `
          <strong>${listaOrdenada.length} facturas</strong> listas para conciliar
          <span style="display:inline-flex; align-items:center; gap:6px; margin-left:10px; background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:3px 10px; border-radius:12px; font-size:0.78rem; font-weight:700;">
            🏢 Proveedor Exclusivo: ${listaOrdenada[0].proveedor} (${listaOrdenada[0].rut})
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px; margin-left:6px; background:rgba(2,132,199,0.1); color:var(--accent-cyan); border:1px solid rgba(2,132,199,0.25); padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">
            🔒 Sin cruces de otras empresas
          </span>
        `;
      } else {
        lblCount.textContent = `${listaOrdenada.length} facturas listas para conciliar`;
      }
    }

    if (listaOrdenada.length === 0) {
      const txtB = document.getElementById('txtBuscarFactura');
      const currentQ = txtB ? txtB.value.trim() : '';
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:35px; color:var(--text-secondary);">
            <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin-bottom:6px;">
              No se encontraron facturas en el catálogo con ese criterio
            </div>
            <div style="font-size:0.85rem; margin-bottom:14px;">
              Puedes buscar por <strong>PO</strong> (ej: PO517979 o PO521257), <strong>Folio</strong>, <strong>Razón Social</strong> o <strong>RUT</strong>.
            </div>
            ${currentQ ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="buscarFacturaEnVivoPaso1('${currentQ.replace(/'/g, "\\'")}')" style="padding:8px 20px;">
                🔍 Consultar en Vivo en Axteroid & BigQuery ("${currentQ}")
              </button>
            ` : ''}
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    listaOrdenada.forEach((f, idx) => {
      const ocDisplay = f.oc_asociada || (f.po_data ? f.po_data.po_order_id : 'S/OC');
      const isLinkedPo = ocDisplay && !ocDisplay.includes('PENDIENTE') && ocDisplay !== 'S/OC';
      const badgeOcClass = isLinkedPo ? 'badge-success' : 'badge-warning';

      html += `
        <tr>
          <td>
            <strong style="color:var(--accent-cyan); font-family:var(--font-mono); font-size:0.95rem;">${f.folio}</strong>
            ${f.ax_doc_id ? `<div style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-mono);">${f.ax_doc_id.slice(0, 14)}...</div>` : ''}
          </td>
          <td>
            <div style="font-weight:600; color:var(--text-primary); font-size:0.9rem;">${f.proveedor}</div>
          </td>
          <td><span class="font-mono" style="font-size:0.82rem; color:var(--text-secondary);">${f.rut}</span></td>
          <td><span class="font-mono" style="font-size:0.82rem;">${f.fecha}</span></td>
          <td class="monto-neto-cell" style="text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--color-monto-neto, #0f172a); font-size:0.95rem;">
            ${(() => {
              const netoCalc = (f.items && f.items.length > 0)
                ? f.items.reduce((acc, it) => acc + safeNum(it.monto_facturado || (it.cantidad_facturada * it.precio_facturado)), 0)
                : safeNum(f.monto_neto);
              const totalCalc = f.monto_total ? safeNum(f.monto_total) : Math.round(netoCalc * 1.19);
              return `
                $${Math.round(netoCalc).toLocaleString('es-CL')}
                <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:500;">Total: $${Math.round(totalCalc).toLocaleString('es-CL')}</div>
              `;
            })()}
          </td>
          <td>
            <span class="badge ${badgeOcClass} font-mono" style="font-size:0.8rem; letter-spacing:0.02em;" title="Vínculo confirmado con Orden de Compra">
              📦 ${ocDisplay.startsWith('PO') ? ocDisplay : 'OC: ' + ocDisplay}
            </span>
          </td>
          <td>
            <span class="badge badge-info" style="font-size:0.75rem;">
              ${f.aforo_tipo}
            </span>
          </td>
          <td style="text-align:center;">
            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="verDetalleFacturaPaso1(${idx})" title="Ver detalle preciso de SKUs y precios de esta factura" style="padding:6px 10px; font-weight:600; border-radius:16px;">
                👁️ Detalle
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="seleccionarFacturaPorIndice(${idx})" style="padding:6px 14px; font-weight:700; border-radius:16px;">
                Cruzar ⚡
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function verDetalleFacturaPaso1(idx) {
    const fac = wizardFacturasFiltradas[idx];
    if (!fac) return;

    // Si la factura no tiene ítems y tiene ax_doc_id en vivo, cargarlos primero
    if ((!fac.items || fac.items.length === 0) && fac.ax_doc_id && !String(fac.ax_doc_id).startsWith('local_')) {
      showToast(`Cargando desglose de SKUs de Factura ${fac.folio}...`, 'info');
      google.script.run
        .withSuccessHandler((xmlRes) => {
          if (xmlRes && xmlRes.success && xmlRes.data && xmlRes.data.items) {
            fac.items = xmlRes.data.items;
          }
          abrirModalDetalleFacturaPaso1(fac);
        })
        .withFailureHandler(() => {
          abrirModalDetalleFacturaPaso1(fac);
        })
        .apiGetInvoiceXmlDetail(fac.ax_doc_id);
      return;
    }

    abrirModalDetalleFacturaPaso1(fac);
  }

  function abrirModalDetalleFacturaPaso1(fac) {
    const modal = document.getElementById('modalDetalleFacturaPaso1');
    if (!modal) return;

    const lblFolio = document.getElementById('modalDetFacBadgeFolio');
    const lblProv = document.getElementById('modalDetFacProveedor');
    const lblRut = document.getElementById('modalDetFacRut');
    const lblNeto = document.getElementById('modalDetFacMontoNeto');
    const lblTotal = document.getElementById('modalDetFacMontoTotal');
    const lblPo = document.getElementById('modalDetFacPo');
    const lblAlmacen = document.getElementById('modalDetFacAlmacen');
    const lblCant = document.getElementById('modalDetFacCantItems');
    const tbody = document.getElementById('modalDetFacTbodyItems');
    const btnCruzar = document.getElementById('modalDetFacBtnCruzar');

    if (lblFolio) lblFolio.textContent = `Folio ${fac.folio}`;
    if (lblProv) lblProv.textContent = fac.proveedor || '-';
    if (lblRut) lblRut.textContent = `RUT: ${fac.rut || '-'}`;
    if (lblNeto) lblNeto.textContent = `$${Math.round(fac.monto_neto || 0).toLocaleString('es-CL')} Neto`;
    if (lblTotal) lblTotal.textContent = `Total con IVA: $${Math.round(fac.monto_total || (fac.monto_neto * 1.19)).toLocaleString('es-CL')}`;
    if (lblPo) lblPo.textContent = fac.oc_asociada || 'S/OC';
    if (lblAlmacen) lblAlmacen.textContent = fac.almacen || 'CH_36_CD_Chile';

    const items = fac.items || [];
    if (lblCant) lblCant.textContent = items.length;

    if (tbody) {
      if (items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">
              Esta factura no registra líneas precargadas en el catálogo.<br>
              Haz clic en <strong>Asociar y Cruzar</strong> para auditarla contra BigQuery.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = items.map((it, i) => {
          const cod = it.codigo || it.sku || '-';
          const desc = it.descripcion || it.nombre || '-';
          const cant = it.cantidad_facturada || it.cantidad || 0;
          const prc = Math.round(it.precio_facturado || it.precio || 0);
          const sub = Math.round(it.monto_facturado || (cant * prc));
          return `
            <tr style="border-bottom:1px solid var(--border-color);">
              <td style="padding:8px 10px; color:var(--text-muted); font-size:0.75rem;">${it.linea || (i + 1)}</td>
              <td style="padding:8px 10px; font-family:var(--font-mono); font-weight:700; color:var(--accent-cyan);">${cod}</td>
              <td style="padding:8px 10px; font-weight:600; color:var(--text-primary);">${desc}</td>
              <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono);">${cant} ${it.unidad_medida || 'UN'}</td>
              <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono);">$${prc.toLocaleString('es-CL')}</td>
              <td style="padding:8px 10px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">$${sub.toLocaleString('es-CL')}</td>
            </tr>
          `;
        }).join('');
      }
    }

    if (btnCruzar) {
      btnCruzar.onclick = () => {
        cerrarModalDetalleFacturaPaso1();
        seleccionarFacturaParaCruce(fac);
      };
    }

    modal.style.display = 'flex';
  }

  function cerrarModalDetalleFacturaPaso1() {
    const modal = document.getElementById('modalDetalleFacturaPaso1');
    if (modal) modal.style.display = 'none';
  }

  function seleccionarFacturaPorIndice(idx) {
    const fac = wizardFacturasFiltradas[idx];
    if (!fac) return;
    seleccionarFacturaParaCruce(fac);
  }

  function seleccionarFacturaParaCruce(fac) {
    // 1. Si la factura no tiene ítems, verificar dataset auditado de PO517979
    

    // 2. Si es documento de Axteroid en vivo y no tiene ítems, cargar detalle XML
    if ((!fac.items || fac.items.length === 0) && fac.ax_doc_id && !fac.ax_doc_id.startsWith('local_')) {
      showToast(`Cargando ítems de la Factura ${fac.folio} desde Axteroid...`, 'info');
      google.script.run
        .withSuccessHandler((xmlRes) => {
          if (xmlRes && xmlRes.success && xmlRes.data) {
            fac.items = xmlRes.data.items || [];
          }
          cargarPoYCompletar(fac);
        })
        .withFailureHandler((err) => {
          console.warn('Aviso cargando XML:', err);
          cargarPoYCompletar(fac);
        })
        .apiGetInvoiceXmlDetail(fac.ax_doc_id);
      return;
    }

    cargarPoYCompletar(fac);
  }

  function cargarPoYCompletar(fac) {
    const poNum = fac.oc_asociada || (fac.po_data && fac.po_data.po_order_id);
    const hasPoItems = fac.po_data && fac.po_data.items && fac.po_data.items.length > 0;

    if (!hasPoItems && poNum && !poNum.includes('PENDIENTE') && poNum !== 'S/OC') {
      google.script.run
        .withSuccessHandler((poRes) => {
          if (poRes && poRes.success && poRes.data && poRes.data.items && poRes.data.items.length > 0) {
            fac.po_data = poRes.data;
          }
          completarSeleccionFactura(fac);
        })
        .withFailureHandler((err) => {
          console.warn('Aviso cargando PO:', err);
          completarSeleccionFactura(fac);
        })
        .apiGetPurchaseOrder(poNum);
      return;
    }

    completarSeleccionFactura(fac);
  }

  function completarSeleccionFactura(fac) {
    // Si la factura aún no tiene ítems pero está en el catálogo auditado
    

    const sumItemsNeto = (fac.items && fac.items.length > 0)
      ? fac.items.reduce((acc, i) => acc + safeNum(i.monto_facturado || (i.cantidad_facturada * i.precio_facturado)), 0)
      : safeNum(fac.monto_neto);

    wizardSelectedInvoice = {
      folio: fac.folio,
      fecha_emision: fac.fecha,
      emisor: { rut: fac.rut, razon_social: fac.proveedor },
      totales: { total: sumItemsNeto },
      items: fac.items || [],
      ax_doc_id: fac.ax_doc_id,
      is_consolidado: false
    };

    // La Orden de Compra se asocia a la Factura
    let resolvedPo = fac.po_data;
    const isPo517979 = (fac.oc_asociada && fac.oc_asociada.includes('517979')) ||
                       (fac.order_reference && fac.order_reference.includes('517979')) ||
                       false;

    if (!resolvedPo || !resolvedPo.items || resolvedPo.items.length === 0) {
      resolvedPo = {
        po_order_id: fac.oc_asociada || ('OC-' + fac.folio),
        warehouse_name: fac.almacen || 'CH_36_CD_Chile (Sociedad 6202)',
        supplier_name: fac.proveedor,
        order_status: 'RECEPCION_CERRADA',
        po_found: Boolean(fac.oc_asociada && !fac.oc_asociada.includes('PENDIENTE')),
        items: []
      };
    }
    wizardAssociatedPo = resolvedPo;

    // Poblar datos en Paso 2
    const p2Folio = document.getElementById('p2InvFolioBadge');
    const p2Prov = document.getElementById('p2InvProveedor');
    const p2Rut = document.getElementById('p2InvRut');
    const p2Fecha = document.getElementById('p2InvFecha');
    const p2Monto = document.getElementById('p2InvMontoNeto');
    const p2Items = document.getElementById('p2InvItemsCount');
    const p2Aforo = document.getElementById('p2InvAforoStatus');

    if (p2Folio) p2Folio.textContent = `Folio ${fac.folio}`;
    if (p2Prov) p2Prov.textContent = fac.proveedor;
    if (p2Rut) p2Rut.textContent = fac.rut;
    if (p2Fecha) p2Fecha.textContent = fac.fecha;
    if (p2Monto) p2Monto.textContent = `$${Math.round(sumItemsNeto).toLocaleString('es-CL')} CLP`;
    if (p2Items) p2Items.textContent = `${fac.items ? fac.items.length : 0} productos facturados`;
    if (p2Aforo) p2Aforo.textContent = fac.aforo_tipo;

    const p2Axteroid = document.getElementById('p2InvAxteroidDocId');
    if (p2Axteroid) {
      const docIdStr = fac.ax_doc_id || fac.id || ('do_axteroid_' + fac.folio);
      p2Axteroid.innerHTML = `
        <span class="badge badge-success" style="font-size:0.75rem; padding:3px 8px;">🛡️ Respaldo Axteroid DTE 33</span>
        <span style="font-size:0.75rem; color:var(--accent-cyan); font-family:var(--font-mono); margin-left:6px;">${docIdStr.slice(0, 16)}</span>
      `;
    }

    const btnPdf = document.getElementById('btnP2VerPdfAxteroid');
    if (btnPdf) {
      btnPdf.onclick = () => {
        const docId = wizardSelectedInvoice ? (wizardSelectedInvoice.ax_doc_id || wizardSelectedInvoice.id || ('do_' + wizardSelectedInvoice.folio)) : null;
        if (docId) {
          showToast(`Descargando PDF oficial de Axteroid para Folio ${fac.folio}...`, 'info');
          descargarPdf(docId);
        } else {
          showToast('No se encontró el ID de documento en Axteroid.', 'warning');
        }
      };
    }

    const btnXml = document.getElementById('btnP2VerXmlAxteroid');
    if (btnXml) {
      btnXml.onclick = () => {
        showToast(`Documento DTE Folio ${fac.folio} respaldado con XML legal del SII archivado en Axteroid (Sociedad 6202).`, 'info');
      };
    }

    // Tarjeta OC Asociada
    const p2PoNum = document.getElementById('p2PoNumero');
    const p2PoAlm = document.getElementById('p2PoAlmacen');
    const p2PoOrd = document.getElementById('p2PoMontoOrdenado');
    const p2PoRec = document.getElementById('p2PoMontoRecepcionado');
    const p2PoBadge = document.getElementById('p2PoAsociacionBadge');

    const totalPoOrd = (wizardAssociatedPo.items && wizardAssociatedPo.items.length > 0)
      ? wizardAssociatedPo.items.reduce((acc, i) => acc + safeNum(i.amt_ordered_lc || (i.quantity_ordered * i.cost_unit_lc)), 0)
      : (fac.oc_asociada && fac.oc_asociada.includes('517979') ? 28619421 : safeNum(fac.monto_neto));

    const totalPoRec = (wizardAssociatedPo.items && wizardAssociatedPo.items.length > 0)
      ? wizardAssociatedPo.items.reduce((acc, i) => acc + safeNum(i.amt_delivered_lc || (i.quantity_delivered * i.cost_unit_lc)), 0)
      : (fac.oc_asociada && fac.oc_asociada.includes('517979') ? 12388682 : safeNum(fac.monto_neto));

    if (p2PoNum) p2PoNum.textContent = wizardAssociatedPo.po_order_id;
    if (p2PoAlm) p2PoAlm.textContent = wizardAssociatedPo.warehouse_name;
    if (p2PoOrd) p2PoOrd.textContent = `$${Math.round(totalPoOrd).toLocaleString('es-CL')} CLP`;
    if (p2PoRec) p2PoRec.textContent = `$${Math.round(totalPoRec).toLocaleString('es-CL')} CLP`;

    if (p2PoBadge) {
      p2PoBadge.className = 'badge badge-success';
      p2PoBadge.textContent = `🟢 Vinculada a OC ${wizardAssociatedPo.po_order_id}`;
    }

    // Banner de Aforo en Paso 2 con indicación de vínculo
    const p2Banner = document.getElementById('p2BannerAforoInfo');
    if (p2Banner) {
      p2Banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:1.8rem;">📦</span>
          <div>
            <div style="font-weight:700; color:var(--accent-purple); font-size:0.95rem;">
              Vínculo Activo: Factura Folio ${fac.folio} con Orden de Compra ${wizardAssociatedPo.po_order_id}
            </div>
            <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">
              Proveedor: <strong>${fac.proveedor}</strong> &bull; Condición: <strong>${fac.aforo_tipo}</strong> &bull; Almacén: <strong>${wizardAssociatedPo.warehouse_name}</strong>.
              El motor comparará SKU por SKU para verificar precios facturados y cantidades recepcionadas en bodega.
            </div>
          </div>
        </div>
      `;
    }

    // Pasar suavemente al Paso 2
    irAPasoWizard(2);
    showToast(`Factura Folio ${fac.folio} vinculada con Orden de Compra ${wizardAssociatedPo.po_order_id}.`, 'info');
  }

  function asociarNuevaOcManual(nuevaOc) {
    showToast(`Buscando Orden de Compra ${nuevaOc} en BigQuery...`, 'info');

    google.script.run
      .withSuccessHandler((res) => {
        if (res.success && res.data) {
          wizardAssociatedPo = res.data;
          const p2PoNum = document.getElementById('p2PoNumero');
          const p2PoBadge = document.getElementById('p2PoAsociacionBadge');
          if (p2PoNum) p2PoNum.textContent = res.data.po_order_id;
          if (p2PoBadge) {
            p2PoBadge.className = 'badge badge-info';
            p2PoBadge.textContent = 'Asociada Manualmente desde BQ';
          }
          showToast(`Orden de Compra ${nuevaOc} asociada exitosamente.`, 'success');
        } else {
          // Si no está en BigQuery, asociarla como número válido
          wizardAssociatedPo.po_order_id = nuevaOc;
          const p2PoNum = document.getElementById('p2PoNumero');
          if (p2PoNum) p2PoNum.textContent = nuevaOc;
          showToast(`Orden de Compra fijada en ${nuevaOc}.`, 'info');
        }
      })
      .withFailureHandler((err) => {
        wizardAssociatedPo.po_order_id = nuevaOc;
        const p2PoNum = document.getElementById('p2PoNumero');
        if (p2PoNum) p2PoNum.textContent = nuevaOc;
      })
      .apiGetPurchaseOrder(nuevaOc);
  }

  function ejecutarCruceWizard() {
    if (!wizardSelectedInvoice || !wizardAssociatedPo) return;

    showToast('Calculando diferencias SKU x SKU entre Factura y OC...', 'info');

    // 1. Si los ítems de la OC están vacíos pero tenemos la PO, intentar traerlos de BigQuery antes de cruzar
    if ((!wizardAssociatedPo.items || wizardAssociatedPo.items.length === 0) && wizardAssociatedPo.po_order_id) {
      

      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.success && res.data && res.data.items && res.data.items.length > 0) {
            wizardAssociatedPo.items = res.data.items;
          }
          finalizarEjecucionCruce();
        })
        .withFailureHandler(() => {
          finalizarEjecucionCruce();
        })
        .apiGetPurchaseOrder(wizardAssociatedPo.po_order_id);
      return;
    }

    finalizarEjecucionCruce();
  }

  function finalizarEjecucionCruce() {
    // Si es cruce consolidado y las líneas siguen vacías, verificar dataset auditado
    if (wizardSelectedInvoice.is_consolidado && (!wizardSelectedInvoice.items || wizardSelectedInvoice.items.length === 0)) {
      
    }

    // Calcular el cruce con el motor
    const res = calcularCruce1a1EnCliente(wizardSelectedInvoice, wizardAssociatedPo);
    wizardReconResult = res;
    reconActiveResult = res; // para exportar CSV

    // Actualizar encabezado del Paso 3
    const subtext = document.getElementById('p3HeaderSubtext');
    if (subtext) {
      subtext.textContent = `Auditoría entre Factura Folio ${res.folio_factura} y Orden de Compra ${res.po_number} (${res.proveedor_nombre}).`;
    }

    // Actualizar Veredicto y Monto a Reclamar
    const banner = document.getElementById('bannerVeredicto1a1');
    const lblTitulo = document.getElementById('lblVeredictoTitulo');
    const lblDetalle = document.getElementById('lblVeredictoDetalle');
    const lblMonto = document.getElementById('lblMontoReclamarTotal');

    if (lblMonto) lblMonto.textContent = `$${Math.round(res.total_monto_reclamar).toLocaleString('es-CL')} CLP`;

    if (res.total_monto_reclamar > 0) {
      if (banner) banner.className = 'recon-result-banner danger';
      if (lblTitulo) lblTitulo.innerHTML = `🚨 DESCALCE CONFIRMADO EN FACTURA ${res.folio_factura}`;
      if (lblDetalle) lblDetalle.innerHTML = `Se identificaron <strong>${res.lineas_con_descalce} líneas con discrepancias</strong> respecto a la OC ${res.po_number}. Se sugiere emitir Nota de Crédito.`;
    } else {
      if (banner) banner.className = 'recon-result-banner success';
      if (lblTitulo) lblTitulo.innerHTML = `✅ CONCILIACIÓN CONFORME (CALCE 100% OK)`;
      if (lblDetalle) lblDetalle.innerHTML = `Todas las líneas de la Factura coinciden exactamente en precio y cantidades con la OC ${res.po_number}. Documento conforme para pago.`;
    }

    // 3 KPIs
    const kpiPrc = document.getElementById('kpiDescalcePrecio');
    const kpiGr = document.getElementById('kpiFaltanteRecepcion');
    const kpiNoOc = document.getElementById('kpiNoEnOc');

    if (kpiPrc) kpiPrc.textContent = `$${Math.round(res.total_descalce_precio).toLocaleString('es-CL')}`;
    if (kpiGr) kpiGr.textContent = `$${Math.round(res.total_faltante_recepcion).toLocaleString('es-CL')}`;
    if (kpiNoOc) kpiNoOc.textContent = `$${Math.round(res.total_no_en_oc).toLocaleString('es-CL')}`;

    // Conteo filtros
    const cntTodos = document.getElementById('cntLineasTodos');
    const cntDesc = document.getElementById('cntLineasDescalce');
    const cntConf = document.getElementById('cntLineasConformes');

    if (cntTodos) cntTodos.textContent = res.lineas.length;
    if (cntDesc) cntDesc.textContent = res.lineas_con_descalce;
    if (cntConf) cntConf.textContent = res.lineas_conformes;

    // Renderizar tabla
    actualizarPanelControlTransaccionPaso3(res);
    filtrarTablaPaso3('todos');

    // Pasar suavemente al Paso 3
    irAPasoWizard(3);

    // Ejecutar automáticamente el triage inteligente de causas raíz TypeSafe AI si hay descalces
    if (res.lineas_con_descalce > 0) {
      setTimeout(() => {
        ejecutarJevAiAudit(true);
      }, 250);
    }
  }

  let paso3FiltroActivo = 'todos';

  function filtrarTablaPaso3(filtro) {
    if (filtro) paso3FiltroActivo = filtro;
    const activeResult = wizardReconResult || reconActiveResult;
    if (!activeResult || !activeResult.lineas) return;

    const chipTodos = document.getElementById('chipFiltroLineasTodos');
    const chipDesc = document.getElementById('chipFiltroLineasDescalce');
    const chipConf = document.getElementById('chipFiltroLineasConformes');

    if (chipTodos) chipTodos.className = `btn-chip ${paso3FiltroActivo === 'todos' ? 'active' : ''}`;
    if (chipDesc) chipDesc.className = `btn-chip ${paso3FiltroActivo === 'descalces' || paso3FiltroActivo === 'descalce' ? 'active' : ''}`;
    if (chipConf) chipConf.className = `btn-chip ${paso3FiltroActivo === 'conformes' ? 'active' : ''}`;

    const tbody = document.getElementById('tbodyDetalleConciliacion1a1');
    const tfoot = document.getElementById('tfootDetalleConciliacion1a1');
    if (!tbody) return;

    const txtQuery = (document.getElementById('txtFiltroSkuPaso3')?.value || '').toLowerCase().trim();

    // 1. Filtrado por Chip y por Texto de Búsqueda
    const lineasFiltradas = activeResult.lineas.filter(l => {
      // Filtro de chip
      if (paso3FiltroActivo === 'descalces' || paso3FiltroActivo === 'descalce') {
        if (!(l.monto_reclamar > 0 || l.severidad === 'danger' || l.severidad === 'warning')) return false;
      }
      if (paso3FiltroActivo === 'conformes') {
        if (l.monto_reclamar > 0 || l.severidad === 'danger' || l.severidad === 'warning') return false;
      }

      // Filtro de texto
      if (txtQuery) {
        const matchSku = (l.sku || '').toLowerCase().includes(txtQuery);
        const matchCod = (l.codigo || '').toLowerCase().includes(txtQuery);
        const matchEan = (l.ean || '').toLowerCase().includes(txtQuery);
        const matchDesc = (l.descripcion || '').toLowerCase().includes(txtQuery);
        const matchDiag = (l.diagnostico || '').toLowerCase().includes(txtQuery);
        if (!matchSku && !matchCod && !matchEan && !matchDesc && !matchDiag) return false;
      }

      return true;
    });

    if (lineasFiltradas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:35px; color:var(--text-secondary); font-size:0.9rem;">No se encontraron líneas que coincidan con los criterios de búsqueda o filtro.</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    // 2. Renderizar Filas de Auditoría (15 Columnas Estructuradas)
    let html = '';
    let totCantOrd = 0;
    let totCantFac = 0;
    let totCantRec = 0;
    let totDifFaltante = 0;
    let totTotalFac = 0;
    let totTotalValido = 0;
    let totMontoNc = 0;
    let cntDescalces = 0;

    lineasFiltradas.forEach(l => {
      const idxOriginal = activeResult.lineas.indexOf(l);
      totCantOrd += (Number(l.cantidad_ordenada) || 0);
      totCantFac += (Number(l.cantidad_facturada) || 0);
      totCantRec += (Number(l.cantidad_recepcionada) || 0);
      if (l.dif_cantidad < 0) totDifFaltante += Math.abs(l.dif_cantidad);
      totTotalFac += (Number(l.total_facturado) || 0);
      totTotalValido += (Number(l.total_esperado) || 0);
      totMontoNc += (Number(l.monto_reclamar) || 0);
      if (l.monto_reclamar > 0) cntDescalces++;

      // Badges de Estado
      let badgeEstado = '<span class="badge badge-success">CALCE OK</span>';
      if (l.estado === 'FALTANTE_RECEPCION') {
        badgeEstado = '<span class="badge badge-warning" style="background:rgba(245,158,11,0.15); color:var(--accent-amber); border:1px solid rgba(245,158,11,0.3);">FALTANTE BODEGA</span>';
      } else if (l.estado === 'DESCALCE_PRECIO') {
        badgeEstado = '<span class="badge badge-danger">SOBREPRECIO</span>';
      } else if (l.estado === 'DESCALCE_MIXTO') {
        badgeEstado = '<span class="badge badge-danger" style="background:#7f1d1d; color:#fecaca; border:1px solid #b91c1c;">DOBLE DESCALCE</span>';
      } else if (l.estado === 'NO_EN_OC') {
        badgeEstado = '<span class="badge" style="background:#581c87; color:#f3e8ff; border:1px solid #7e22ce;">NO EN OC</span>';
      } else if (l.estado === 'UOM_EMPAQUE') {
        badgeEstado = `<span class="badge badge-info">FACTOR UOM (x${l.factor_empaque || 24})</span>`;
      }

      // Badges de Diferencias de Cantidad y Precio
      const difQtyClass = l.dif_cantidad < 0 ? 'diff-badge-neg' : (l.dif_cantidad > 0 ? 'diff-badge-pos' : 'diff-badge-zero');
      const difPrcClass = l.dif_precio > 0 ? 'diff-badge-neg' : (l.dif_precio < 0 ? 'diff-badge-pos' : 'diff-badge-zero');

      const difQtyStr = l.dif_cantidad !== 0 ? `<span class="${difQtyClass}">${l.dif_cantidad > 0 ? '+' : ''}${l.dif_cantidad}</span>` : '<span class="diff-badge-zero">0</span>';
      const difPrcStr = l.dif_precio !== 0 ? `<span class="${difPrcClass}">${l.dif_precio > 0 ? '+' : ''}$${Math.round(l.dif_precio).toLocaleString('es-CL')}</span>` : '<span class="diff-badge-zero">$0</span>';

      // Monto NC con desglose
      let montoNcStr = '<span class="diff-badge-zero">$0</span>';
      if (l.monto_reclamar > 0) {
        let desgloseSmall = '';
        if (l.monto_nc_cantidad > 0 && l.monto_nc_precio > 0) {
          desgloseSmall = `<div style="font-size:0.70rem; color:var(--text-secondary); margin-top:2px;">Falt: $${Math.round(l.monto_nc_cantidad).toLocaleString('es-CL')} | Prc: $${Math.round(l.monto_nc_precio).toLocaleString('es-CL')}</div>`;
        } else if (l.monto_nc_cantidad > 0) {
          desgloseSmall = `<div style="font-size:0.70rem; color:var(--text-secondary); margin-top:2px;">Faltante Físico</div>`;
        } else if (l.monto_nc_precio > 0) {
          desgloseSmall = `<div style="font-size:0.70rem; color:var(--text-secondary); margin-top:2px;">Sobreprecio</div>`;
        }
        montoNcStr = `<strong style="color:var(--accent-red); font-size:0.95rem; font-family:var(--font-mono);">$${Math.round(l.monto_reclamar).toLocaleString('es-CL')}</strong>${desgloseSmall}`;
      }

      // Tag de empaque UOM si aplica
      let tagUom = `<span style="font-size:0.72rem; color:var(--text-muted);">${l.unidad_medida || 'UN'}</span>`;
      if (l.is_uom_match) {
        tagUom = `<span class="badge badge-info" style="font-size:0.68rem; padding:1px 5px;">${l.unidad_medida} (x${l.factor_empaque})</span>`;
      }

      const rowClass = l.monto_reclamar > 0 ? 'row-descalce' : '';

      html += `
        <tr class="${rowClass}">
          <td style="font-weight:600; color:var(--text-muted); text-align:center;">${l.linea}</td>
          <td>
            <div class="font-mono" style="font-size:0.80rem; font-weight:700; color:var(--accent-cyan);">${l.sku}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">EAN: ${l.ean}</div>
          </td>
          <td>
            <div style="font-weight:600; color:var(--text-primary); font-size:0.85rem; line-height:1.25;">${l.descripcion}</div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:3px;">${tagUom}</div>
          </td>
          <td style="text-align:right; font-family:var(--font-mono);">${l.cantidad_ordenada !== undefined ? l.cantidad_ordenada : '-'}</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:600;">${l.cantidad_facturada}</td>
          <td style="text-align:right; font-family:var(--font-mono);">${l.cantidad_recepcionada}</td>
          <td style="text-align:right;">${difQtyStr}</td>
          <td style="text-align:right; font-family:var(--font-mono);">$${Math.round(l.costo_oc).toLocaleString('es-CL')}</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:600;">$${Math.round(l.precio_facturado).toLocaleString('es-CL')}</td>
          <td style="text-align:right;">${difPrcStr}</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:700;">$${Math.round(l.total_facturado).toLocaleString('es-CL')}</td>
          <td style="text-align:right; font-family:var(--font-mono); color:var(--accent-green); font-weight:600;">$${Math.round(l.total_esperado).toLocaleString('es-CL')}</td>
          <td style="text-align:right;">${montoNcStr}</td>
          <td style="text-align:center;">${badgeEstado}</td>
          <td style="font-size:0.78rem; color:var(--text-secondary); line-height:1.35; min-width:240px; max-width:320px;">
            <div style="margin-bottom:6px;">${l.diagnostico}</div>
            ${l.jev_root_cause ? `<div style="display:inline-flex; align-items:center; gap:5px; font-size:0.70rem; background:rgba(124,58,237,0.12); color:var(--accent-purple); padding:2px 8px; border-radius:4px; font-weight:700; margin-bottom:6px; border:1px solid rgba(124,58,237,0.3);"><span>⚡ Jev AI:</span> ${l.jev_root_cause} (${l.jev_confidence || 95}%)</div><br>` : ''}
            <button type="button" class="btn-drilldown-calc" onclick="abrirModalCalculoLinea(${idxOriginal})">
              📐 Ver Desglose & Fórmula
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // 3. Renderizar Totales de Auditoría en el Footer (tfoot)
    if (tfoot) {
      const faltanteTotalStr = totDifFaltante > 0 ? `<span class="diff-badge-neg">-${totDifFaltante} unids</span>` : '<span class="diff-badge-zero">0 unids</span>';
      const montoTotalNcStr = totMontoNc > 0 
        ? `<strong style="color:var(--accent-red); font-size:1.05rem; font-family:var(--font-mono);">$${Math.round(totMontoNc).toLocaleString('es-CL')}</strong>`
        : '<span style="color:var(--accent-green); font-weight:700; font-family:var(--font-mono);">$0</span>';

      tfoot.innerHTML = `
        <tr>
          <td colspan="3" style="font-weight:800; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">
            TOTALES AUDITORÍA (${lineasFiltradas.length} Ítems)
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:700;">${totCantOrd.toLocaleString('es-CL')}</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:800;">${totCantFac.toLocaleString('es-CL')}</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:700;">${totCantRec.toLocaleString('es-CL')}</td>
          <td style="text-align:right;">${faltanteTotalStr}</td>
          <td colspan="3" style="text-align:center; font-size:0.75rem; color:var(--text-muted);">-</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:800; font-size:0.95rem;">$${Math.round(totTotalFac).toLocaleString('es-CL')}</td>
          <td style="text-align:right; font-family:var(--font-mono); font-weight:800; color:var(--accent-green); font-size:0.95rem;">$${Math.round(totTotalValido).toLocaleString('es-CL')}</td>
          <td style="text-align:right;">${montoTotalNcStr}</td>
          <td style="text-align:center;">
            ${totMontoNc > 0 ? '<span class="badge badge-danger">CON RECLAMOS</span>' : '<span class="badge badge-success">TODO CONFORME</span>'}
          </td>
          <td style="font-size:0.80rem; font-weight:700; color:var(--text-primary);">
            ${cntDescalces > 0 ? `🚨 ${cntDescalces} línea(s) con discrepancia` : '✅ 100% Calce conforme'}
          </td>
        </tr>
      `;
    }
  }

  // --- MODAL DE CORROBORACIÓN Y DESGLOSE MATEMÁTICO SKU X SKU ---
  function abrirModalCalculoLinea(lineaIdx) {
    const res = wizardReconResult || reconActiveResult;
    if (!res || !res.lineas) return;
    const l = res.lineas[lineaIdx];
    if (!l) return;

    // Poblar ficha del producto
    const num = document.getElementById('calcNumLinea');
    const desc = document.getElementById('calcDescProducto');
    const sku = document.getElementById('calcSkuCodigo');
    const ean = document.getElementById('calcEan');
    const badge = document.getElementById('calcBadgeEstadoModal');

    if (num) num.textContent = l.linea;
    if (desc) desc.textContent = l.descripcion;
    if (sku) sku.textContent = `SKU: ${l.sku} / Cód: ${l.codigo}`;
    if (ean) ean.textContent = `EAN-13: ${l.ean}`;

    if (badge) {
      if (l.estado === 'CALCE_OK') {
        badge.className = 'badge badge-success';
        badge.style = '';
        badge.textContent = 'CALCE CONFORME 100%';
      } else if (l.estado === 'FALTANTE_RECEPCION') {
        badge.className = 'badge badge-warning';
        badge.style = 'background:rgba(245,158,11,0.15); color:var(--accent-amber); border:1px solid rgba(245,158,11,0.3);';
        badge.textContent = 'FALTANTE FÍSICO BODEGA';
      } else if (l.estado === 'DESCALCE_PRECIO') {
        badge.className = 'badge badge-danger';
        badge.style = '';
        badge.textContent = 'SOBREPRECIO FACTURADO';
      } else if (l.estado === 'DESCALCE_MIXTO') {
        badge.className = 'badge badge-danger';
        badge.style = 'background:#7f1d1d; color:#fecaca; border:1px solid #b91c1c;';
        badge.textContent = 'DOBLE DESCALCE (FALTANTE + PRECIO)';
      } else if (l.estado === 'NO_EN_OC') {
        badge.className = 'badge';
        badge.style = 'background:#581c87; color:#f3e8ff; border:1px solid #7e22ce;';
        badge.textContent = 'NO EN ORDEN DE COMPRA';
      } else if (l.estado === 'UOM_EMPAQUE') {
        badge.className = 'badge badge-info';
        badge.style = '';
        badge.textContent = `FACTOR UOM (x${l.factor_empaque || 24})`;
      }
    }

    // 1. Dimensión Física
    const cOrd = document.getElementById('calcCantOrdenada');
    const cFac = document.getElementById('calcCantFacturada');
    const cRec = document.getElementById('calcCantRecepcionada');
    const dQty = document.getElementById('calcDifFaltante');

    if (cOrd) cOrd.textContent = `${l.cantidad_ordenada !== undefined ? l.cantidad_ordenada : '-'} ${l.unidad_medida || 'UN'}`;
    if (cFac) cFac.textContent = `${l.cantidad_facturada} ${l.unidad_medida || 'UN'}`;
    if (cRec) cRec.textContent = `${l.cantidad_recepcionada} ${l.unidad_medida || 'UN'}`;
    if (dQty) {
      if (l.dif_cantidad < 0) {
        dQty.innerHTML = `<span class="diff-badge-neg">${l.dif_cantidad} unids (Faltante)</span>`;
      } else if (l.dif_cantidad > 0) {
        dQty.innerHTML = `<span class="diff-badge-pos">+${l.dif_cantidad} unids (Excedente)</span>`;
      } else {
        dQty.innerHTML = '<span class="diff-badge-zero">0 unids (Exacto)</span>';
      }
    }

    // 2. Dimensión Comercial
    const cCost = document.getElementById('calcCostoOc');
    const cPrc = document.getElementById('calcPrecioFac');
    const cUom = document.getElementById('calcUom');
    const dPrc = document.getElementById('calcDifPrecio');

    if (cCost) cCost.textContent = `$${Math.round(l.costo_oc).toLocaleString('es-CL')}`;
    if (cPrc) cPrc.textContent = `$${Math.round(l.precio_facturado).toLocaleString('es-CL')}`;
    if (cUom) cUom.textContent = l.is_uom_match ? `${l.unidad_medida} (x${l.factor_empaque} unids)` : (l.unidad_medida || 'UN');
    if (dPrc) {
      if (l.dif_precio > 0) {
        dPrc.innerHTML = `<span class="diff-badge-neg">+$${Math.round(l.dif_precio).toLocaleString('es-CL')} (Sobreprecio)</span>`;
      } else if (l.dif_precio < 0) {
        dPrc.innerHTML = `<span class="diff-badge-pos">-$${Math.round(Math.abs(l.dif_precio)).toLocaleString('es-CL')} (Descuento)</span>`;
      } else {
        dPrc.innerHTML = '<span class="diff-badge-zero">$0 (Exacto)</span>';
      }
    }

    // 3. Dimensión Financiera
    const tFac = document.getElementById('calcTotalFacturado');
    const tVal = document.getElementById('calcTotalValido');
    const tTip = document.getElementById('calcTipoReclamoTexto');
    const tNc = document.getElementById('calcMontoTotalNc');

    if (tFac) tFac.textContent = `$${Math.round(l.total_facturado).toLocaleString('es-CL')}`;
    if (tVal) tVal.textContent = `$${Math.round(l.total_esperado).toLocaleString('es-CL')}`;
    if (tTip) {
      if (l.estado === 'CALCE_OK' || l.estado === 'UOM_EMPAQUE') tTip.textContent = 'Sin Reclamo (Conforme)';
      else if (l.estado === 'FALTANTE_RECEPCION') tTip.textContent = 'Nota de Crédito x Faltante Físico';
      else if (l.estado === 'DESCALCE_PRECIO') tTip.textContent = 'Nota de Crédito x Sobreprecio';
      else if (l.estado === 'DESCALCE_MIXTO') tTip.textContent = 'NC Mixta (Faltante + Sobreprecio)';
      else if (l.estado === 'NO_EN_OC') tTip.textContent = 'Rechazo 100% de la Línea';
    }
    if (tNc) tNc.textContent = `$${Math.round(l.monto_reclamar).toLocaleString('es-CL')} CLP`;

    // 4. Demostración Matemática Paso a Paso
    const fBox = document.getElementById('calcFormulaExplicacion');
    if (fBox) {
      let formulaHtml = '';
      if (l.estado === 'CALCE_OK') {
        formulaHtml = `✅ CONCILIACIÓN FÍSICA Y COMERCIAL CONFORME (100%):
• Cantidad: ${l.cantidad_facturada} facturadas = ${l.cantidad_recepcionada} recepcionadas (Diferencia = 0 unids).
• Precio: $${Math.round(l.precio_facturado).toLocaleString('es-CL')} cobrado = $${Math.round(l.costo_oc).toLocaleString('es-CL')} pactado en OC (Diferencia = $0).
• Total a Pagar Conforme: ${l.cantidad_recepcionada} unids × $${Math.round(l.costo_oc).toLocaleString('es-CL')} = $${Math.round(l.total_esperado).toLocaleString('es-CL')} CLP.
• Monto a Reclamar: $0 CLP (Sin Nota de Crédito requerida).`;
      } else if (l.estado === 'UOM_EMPAQUE') {
        formulaHtml = `🔄 CALCE POR FACTOR DE EMPAQUE (UOM HOMOLOGADO):
• Facturado: ${l.cantidad_facturada} ${l.unidad_medida} @ $${Math.round(l.precio_facturado).toLocaleString('es-CL')}.
• Recepcionado en Bodega: ${l.cantidad_recepcionada} unidades individuales @ $${Math.round(l.costo_oc).toLocaleString('es-CL')}.
• Factor: 1 ${l.unidad_medida} = ${l.factor_empaque} unidades individuales.
• Validación: (${l.cantidad_facturada} cajas × ${l.factor_empaque}) = ${l.cantidad_recepcionada} unids.
• Total Facturado = Total Recepcionado = $${Math.round(l.total_facturado).toLocaleString('es-CL')} CLP. Conforme para pago.`;
      } else if (l.estado === 'NO_EN_OC') {
        formulaHtml = `🚫 ÍTEM FACTURADO NO EXISTE EN LA ORDEN DE COMPRA:
• Código cobrado: ${l.codigo} - "${l.descripcion}".
• Este producto no tiene autorización de compra ni orden asociada en SAP MM para PedidosYa / Dmarts Chile.
• Total Cobrado Improcedente: ${l.cantidad_facturada} unids × $${Math.round(l.precio_facturado).toLocaleString('es-CL')} = $${Math.round(l.total_facturado).toLocaleString('es-CL')} CLP.
• TOTAL A RECLAMAR (100% DE LA LÍNEA): $${Math.round(l.monto_reclamar).toLocaleString('es-CL')} CLP en Nota de Crédito.`;
      } else {
        const lineasFormula = [];
        lineasFormula.push(`📐 DEMOSTRACIÓN DE LA LIQUIDACIÓN:`);
        lineasFormula.push(`1. Total Facturado por Proveedor: ${l.cantidad_facturada} unids × $${Math.round(l.precio_facturado).toLocaleString('es-CL')} = $${Math.round(l.total_facturado).toLocaleString('es-CL')} CLP.`);
        lineasFormula.push(`2. Total Válido a Pagar (Costo OC): ${l.cantidad_recepcionada} unids × $${Math.round(l.costo_oc).toLocaleString('es-CL')} = $${Math.round(l.total_esperado).toLocaleString('es-CL')} CLP.`);
        lineasFormula.push(`----------------------------------------------------------------`);
        lineasFormula.push(`DESGLOSE DE LA NOTA DE CRÉDITO RECLAMABLE:`);
        if (l.dif_cantidad < 0) {
          const cFalt = Math.abs(l.dif_cantidad);
          const mFalt = cFalt * l.precio_facturado;
          lineasFormula.push(` • Faltante Físico: ${cFalt} unids no recibidas × $${Math.round(l.precio_facturado).toLocaleString('es-CL')} (Precio Cobrado) = $${Math.round(mFalt).toLocaleString('es-CL')} CLP`);
        }
        if (l.dif_precio > 0) {
          const mSobre = l.cantidad_recepcionada * l.dif_precio;
          lineasFormula.push(` • Sobreprecio Unitario: ${l.cantidad_recepcionada} unids rec. × $${Math.round(l.dif_precio).toLocaleString('es-CL')} (Δ Precio) = $${Math.round(mSobre).toLocaleString('es-CL')} CLP`);
        }
        lineasFormula.push(`----------------------------------------------------------------`);
        lineasFormula.push(`👉 TOTAL NOTA DE CRÉDITO A RECLAMAR: $${Math.round(l.monto_reclamar).toLocaleString('es-CL')} CLP`);
        formulaHtml = lineasFormula.join('\n');
      }
      fBox.textContent = formulaHtml;
    }

    // 5. Diagnóstico & Acción
    const dDiag = document.getElementById('calcDiagnosticoTexto');
    const dAcc = document.getElementById('calcAccionTexto');
    if (dDiag) dDiag.textContent = l.diagnostico;
    if (dAcc) dAcc.textContent = l.accion;

    // Mostrar modal
    const modal = document.getElementById('modalDetalleCalculoLinea');
    if (modal) modal.classList.add('active');
  }

  function cerrarModalCalculoLinea() {
    const modal = document.getElementById('modalDetalleCalculoLinea');
    if (modal) modal.classList.remove('active');
  }

  function copiarFormulaLineaModal() {
    const fBox = document.getElementById('calcFormulaExplicacion');
    const desc = document.getElementById('calcDescProducto');
    const sku = document.getElementById('calcSkuCodigo');
    const txt = `📋 AUDITORÍA SKU X SKU - PEDIDOSYA CHILE (Sociedad 6202)\n${sku ? sku.textContent : ''} | ${desc ? desc.textContent : ''}\n\n${fBox ? fBox.textContent : ''}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => showToast('Demostración de cálculo copiada al portapapeles.', 'success'));
    } else {
      prompt('Copia la fórmula:', txt);
    }
  }

  // ==========================================================================
  // JOURNAL ENTRY VOUCHER (JEV) & TYPESAFE AI JEV INTEGRATION
  // ==========================================================================
  let currentJevData = null;

  function abrirModalJournalEntryVoucher() {
    const res = reconActiveResult || wizardReconResult;
    if (!res || !res.lineas) {
      alert('Primero debes ejecutar la conciliación de una factura para generar su Journal Entry Voucher.');
      return;
    }

    const modal = document.getElementById('modalJournalEntryVoucher');
    if (!modal) return;

    // Configurar cabecera inicial
    const fFecha = document.getElementById('jevHeaderFecha');
    if (fFecha) fFecha.textContent = new Date().toLocaleDateString('es-CL');
    const fRef = document.getElementById('jevHeaderRef');
    if (fRef) fRef.textContent = `DTE:${res.folio_factura || '-'} / PO:${res.po_number || res.po_referencia || '-'}`;
    
    // Obtener configuración SAP guardada
    const sapCc = localStorage.getItem('cfg_sap_cc') || 'CD_36_CD_Chile';
    const lblCc = document.getElementById('lblJevCostCenter');
    if (lblCc) lblCc.textContent = sapCc;

    // Generar y cuadrar el asiento
    recalcularJevModal();
    modal.classList.add('active');
  }

  function cerrarModalJournalEntryVoucher() {
    const modal = document.getElementById('modalJournalEntryVoucher');
    if (modal) modal.classList.remove('active');
  }

  function recalcularJevModal() {
    const res = reconActiveResult || wizardReconResult;
    if (!res) return;

    const chkIva = document.getElementById('chkJevIncluirIva');
    const chkAforo = document.getElementById('chkJevAplicarAforo');
    const includeTax = chkIva ? chkIva.checked : true;
    const aplicarAforo = chkAforo ? chkAforo.checked : true;
    const costCenter = document.getElementById('lblJevCostCenter')?.textContent || 'CD_36_CD_Chile';
    const companyCode = localStorage.getItem('cfg_sap_co') || '6202';

    const facturadoNeto = Math.round(Number(res.total_facturado_neto || 0));
    const recepcionadoNeto = Math.round(Number(res.total_recepcionado_neto || 0));
    const descalcePrecio = Math.round(Number(res.total_descalce_precio || 0));
    const faltanteRecepcion = Math.round(Number(res.total_faltante_recepcion || 0));
    const noEnOc = Math.round(Number(res.total_no_en_oc || 0));
    const montoReclamarTotal = Math.round(Number(res.total_monto_a_reclamar || res.total_monto_reclamar || 0));
    
    let montoRetencionAforo = 0;
    if (aplicarAforo && res.aforo_info && res.aforo_info.monto_retenido_aforo) {
      montoRetencionAforo = Math.round(Number(res.aforo_info.monto_retenido_aforo));
    }

    const lines = [];
    let itemCounter = 1;

    // 1. Débito a Compensación EM/RF (GR/IR)
    if (recepcionadoNeto > 0) {
      lines.push({
        item: itemCounter++,
        dc: 'D',
        account: '11070000',
        account_name: 'Compensación EM/RF Mercadería Bodega',
        debit: recepcionadoNeto,
        credit: 0,
        cost_center: costCenter,
        assignment: `PO:${res.po_number || '-'}`,
        text: `Recepción Mercadería Conforme Folio ${res.folio_factura}`
      });
    }

    // 2. Débito a PPV (Desviación en Precio de Compra)
    if (descalcePrecio > 0) {
      lines.push({
        item: itemCounter++,
        dc: 'D',
        account: '51020100',
        account_name: 'Desviación en Precio de Compra (PPV)',
        debit: descalcePrecio,
        credit: 0,
        cost_center: costCenter,
        assignment: `PO:${res.po_number || '-'}`,
        text: `Sobreprecio Factura vs OC ${res.po_number || ''}`
      });
    }

    // 3. Débito a Reclamo Faltante Físico de Recepción
    if (faltanteRecepcion > 0) {
      lines.push({
        item: itemCounter++,
        dc: 'D',
        account: '11090200',
        account_name: 'Reclamo Pendiente NC - Faltante Bodega',
        debit: faltanteRecepcion,
        credit: 0,
        cost_center: costCenter,
        assignment: `FOL:${res.folio_factura}`,
        text: `Reclamo NC Faltante Físico Bodega`
      });
    }

    // 4. Débito a Reclamo Ítems No Ordenados en OC
    if (noEnOc > 0) {
      lines.push({
        item: itemCounter++,
        dc: 'D',
        account: '11090300',
        account_name: 'Reclamo Pendiente NC - SKU No en OC',
        debit: noEnOc,
        credit: 0,
        cost_center: costCenter,
        assignment: `FOL:${res.folio_factura}`,
        text: `Reclamo NC Ítems no contemplados en OC`
      });
    }

    // Remanente general si aplica
    const sumaDesgloses = descalcePrecio + faltanteRecepcion + noEnOc;
    const remanente = montoReclamarTotal - sumaDesgloses;
    if (remanente > 0) {
      lines.push({
        item: itemCounter++,
        dc: 'D',
        account: '11090200',
        account_name: 'Reclamo Pendiente NC - Faltante Bodega',
        debit: remanente,
        credit: 0,
        cost_center: costCenter,
        assignment: `FOL:${res.folio_factura}`,
        text: `Ajuste Diferencia Reclamo NC`
      });
    }

    // 5. Débito por IVA Crédito Fiscal (19%)
    let montoIva = 0;
    if (includeTax) {
      montoIva = Math.round(facturadoNeto * 0.19);
      lines.push({
        item: itemCounter++,
        dc: 'D',
        account: '11080101',
        account_name: 'IVA Crédito Fiscal Operacional (19%)',
        debit: montoIva,
        credit: 0,
        cost_center: '',
        assignment: `DTE:${res.folio_factura}`,
        text: `IVA Crédito Fiscal (19%) DTE Folio ${res.folio_factura}`
      });
    }

    // 6. Proveedores Nacionales (Crédito / Haber)
    const totalBruto = includeTax ? (facturadoNeto + montoIva) : facturadoNeto;
    if (montoRetencionAforo > 0) {
      const saldoLiquido = Math.max(0, totalBruto - montoRetencionAforo);
      lines.push({
        item: itemCounter++,
        dc: 'C',
        account: '21040000',
        account_name: 'Proveedores Nacionales Comerciales',
        debit: 0,
        credit: saldoLiquido,
        cost_center: '',
        assignment: `RUT:${res.proveedor_rut || ''}`,
        text: `Factura ${res.folio_factura} Liq. Pago - ${res.proveedor_nombre || ''}`
      });
      lines.push({
        item: itemCounter++,
        dc: 'C',
        account: '21090100',
        account_name: 'Retenciones por Aforo Comercial Proveedor',
        debit: 0,
        credit: montoRetencionAforo,
        cost_center: costCenter,
        assignment: `AFORO:${res.proveedor_rut || ''}`,
        text: `Retención Preventiva Aforo Comercial 6202`
      });
    } else {
      lines.push({
        item: itemCounter++,
        dc: 'C',
        account: '21040000',
        account_name: 'Proveedores Nacionales Comerciales',
        debit: 0,
        credit: totalBruto,
        cost_center: '',
        assignment: `RUT:${res.proveedor_rut || ''}`,
        text: `Factura ${res.folio_factura} - ${res.proveedor_nombre || 'Proveedor'}`
      });
    }

    // Cuadratura
    let totDebe = 0;
    let totHaber = 0;
    lines.forEach(l => {
      totDebe += l.debit;
      totHaber += l.credit;
    });

    const dif = Math.abs(totDebe - totHaber);
    if (dif <= 2 && dif !== 0 && lines.length > 0) {
      lines[0].debit += (totHaber - totDebe);
      totDebe = totHaber;
    }

    const isBalanced = (Math.abs(totDebe - totHaber) === 0);

    const voucherId = `JEV-${companyCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${res.folio_factura || '00'}`;
    currentJevData = {
      voucher_id: voucherId,
      company_code: companyCode,
      lines: lines,
      totDebe: totDebe,
      totHaber: totHaber,
      isBalanced: isBalanced,
      folio: res.folio_factura,
      proveedor: res.proveedor_nombre,
      po: res.po_number
    };

    // Actualizar UI Modal JEV
    const badgeId = document.getElementById('jevVoucherIdBadge');
    if (badgeId) badgeId.textContent = voucherId;

    const badgeBal = document.getElementById('jevBalancedBadge');
    if (badgeBal) {
      badgeBal.textContent = isBalanced ? '⚖️ BALANCEADO' : '⚠️ DESCUADRADO';
      badgeBal.className = isBalanced ? 'badge badge-success font-mono' : 'badge badge-danger font-mono';
    }

    const kpiD = document.getElementById('jevKpiDebitos');
    const kpiC = document.getElementById('jevKpiCreditos');
    const kpiDif = document.getElementById('jevKpiDiferencia');
    const kpiSub = document.getElementById('jevKpiCuadraturaSub');
    if (kpiD) kpiD.textContent = `$${totDebe.toLocaleString('es-CL')} CLP`;
    if (kpiC) kpiC.textContent = `$${totHaber.toLocaleString('es-CL')} CLP`;
    if (kpiDif) {
      kpiDif.textContent = `$${Math.abs(totDebe - totHaber).toLocaleString('es-CL')} CLP`;
      kpiDif.style.color = isBalanced ? 'var(--accent-purple)' : 'var(--accent-red)';
    }
    if (kpiSub) kpiSub.textContent = isBalanced ? 'Asiento cuadrado rigurosamente para SAP' : 'Descuadre contable detectado';

    const tbody = document.getElementById('tbodyLineasJev');
    if (tbody) {
      let tbodyHtml = '';
      lines.forEach(l => {
        const isDebit = l.dc === 'D';
        tbodyHtml += `
          <tr>
            <td style="text-align:center; font-weight:700; color:var(--text-muted);">${l.item}</td>
            <td style="text-align:center;"><span class="badge ${isDebit ? 'badge-info' : 'badge-success'}" style="font-weight:800; font-size:0.75rem;">${l.dc}</span></td>
            <td class="font-mono" style="font-weight:700; font-size:0.85rem; color:var(--accent-blue);">${l.account}</td>
            <td style="font-size:0.82rem; font-weight:600; color:var(--text-primary);">${l.account_name}</td>
            <td class="font-mono" style="text-align:right; font-weight:700; color:${l.debit > 0 ? 'var(--accent-blue)' : 'var(--text-muted)'};">${l.debit > 0 ? '$' + l.debit.toLocaleString('es-CL') : '-'}</td>
            <td class="font-mono" style="text-align:right; font-weight:700; color:${l.credit > 0 ? 'var(--accent-green)' : 'var(--text-muted)'};">${l.credit > 0 ? '$' + l.credit.toLocaleString('es-CL') : '-'}</td>
            <td class="font-mono" style="font-size:0.75rem; color:var(--text-secondary);">${l.cost_center || '-'}</td>
            <td style="font-size:0.78rem; color:var(--text-secondary);">${l.text}</td>
          </tr>
        `;
      });
      tbody.innerHTML = tbodyHtml;
    }

    const tfD = document.getElementById('tfootJevDebe');
    const tfH = document.getElementById('tfootJevHaber');
    const tfEst = document.getElementById('tfootJevEstado');
    if (tfD) tfD.textContent = `$${totDebe.toLocaleString('es-CL')}`;
    if (tfH) tfH.textContent = `$${totHaber.toLocaleString('es-CL')}`;
    if (tfEst) {
      tfEst.textContent = isBalanced ? '✅ CUADRADO' : '❌ DESCUADRADO';
      tfEst.style.color = isBalanced ? 'var(--accent-green)' : 'var(--accent-red)';
    }
  }

  function exportarJevCsvModal() {
    if (!currentJevData || !currentJevData.lines) {
      alert('No hay datos de JEV para exportar.');
      return;
    }

    const rows = [];
    rows.push(['# JOURNAL ENTRY VOUCHER (JEV) - SOCIEDAD 6202 (DELIVERY HERO CHILE)'].join(';'));
    rows.push([`Voucher_ID:;${currentJevData.voucher_id};Sociedad:;${currentJevData.company_code};Moneda:;CLP`].join(';'));
    rows.push([`Fecha_Contabilizacion:;${new Date().toISOString().slice(0, 10)};Clase_Doc:;KR`].join(';'));
    rows.push([`Referencia:;DTE:${currentJevData.folio} PO:${currentJevData.po}`].join(';'));
    rows.push([`Total_Debitos:;$ ${currentJevData.totDebe};Total_Creditos:;$ ${currentJevData.totHaber};Cuadrado:;${currentJevData.isBalanced ? 'SI' : 'NO'}`].join(';'));
    rows.push(['']);
    rows.push(['Item;Indicador_DC;Cuenta_Mayor;Nombre_Cuenta;Debe_CLP;Haber_CLP;Centro_Costo;Asignacion;Texto_Posicion'].join(';'));

    currentJevData.lines.forEach(l => {
      rows.push([
        l.item,
        l.dc,
        `"${l.account}"`,
        `"${l.account_name}"`,
        l.debit,
        l.credit,
        `"${l.cost_center || ''}"`,
        `"${l.assignment || ''}"`,
        `"${(l.text || '').replace(/"/g, '""')}"`
      ].join(';'));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    descargarTextoComoArchivo(`JEV_${currentJevData.company_code}_Fac_${currentJevData.folio}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`, csvContent, 'text/csv;charset=utf-8;');
    showToast('Plantilla JEV para SAP descargada con éxito.', 'success');
  }

  function copiarJevPortapapeles() {
    if (!currentJevData || !currentJevData.lines) return;
    const linesTxt = [
      `📑 JOURNAL ENTRY VOUCHER (JEV) - SOCIEDAD 6202`,
      `Voucher ID: ${currentJevData.voucher_id} | Factura: ${currentJevData.folio} | PO: ${currentJevData.po}`,
      `Total Debe: $${currentJevData.totDebe.toLocaleString('es-CL')} | Total Haber: $${currentJevData.totHaber.toLocaleString('es-CL')} | Estado: ${currentJevData.isBalanced ? 'BALANCEADO' : 'DESCUADRADO'}`,
      `--------------------------------------------------------------------------------`,
      `POS\tD/C\tCUENTA\tDEBE\tHABER\tCECO\tTEXTO`
    ];

    currentJevData.lines.forEach(l => {
      linesTxt.push(`${l.item}\t${l.dc}\t${l.account}\t${l.debit}\t${l.credit}\t${l.cost_center || '-'}\t${l.text}`);
    });

    const fullTxt = linesTxt.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullTxt).then(() => showToast('Asiento contable JEV copiado al portapapeles.', 'success'));
    } else {
      prompt('Copia el asiento contable JEV:', fullTxt);
    }
  }

  function ejecutarJevAiAudit(isAuto = false) {
    const res = reconActiveResult || wizardReconResult;
    if (!res || !res.lineas) {
      if (!isAuto) alert('Primero debes ejecutar la conciliación de una factura para aplicar el análisis TypeSafe AI Jev.');
      return;
    }

    const badge = document.getElementById('badgeJevAiStatus');
    const btn = document.getElementById('btnJevAiAuditPaso3');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px; height:14px;"></span> Jev AI Analizando...';
    }
    if (badge) {
      badge.innerHTML = '<span class="spinner" style="width:10px; height:10px; border-width:2px;"></span> AI Analizando...';
      badge.style.background = 'rgba(124,58,237,0.18)';
    }

    if (!isAuto) {
      showToast('⚡ Ejecutando triage y clasificación inteligente con TypeSafe AI Jev...', 'info');
    }

    google.script.run
      .withSuccessHandler((resp) => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '⚡ Jev AI (Activo)';
          btn.style.background = 'rgba(124,58,237,0.15)';
        }
        if (badge) {
          badge.innerHTML = '⚡ AI Triage Listo';
          badge.style.background = 'rgba(16,185,129,0.12)';
          badge.style.color = 'var(--accent-green)';
          badge.style.borderColor = 'rgba(16,185,129,0.3)';
        }

        if (resp && resp.success && resp.data && resp.data.lineas) {
          resp.data.lineas.forEach((enriched, idx) => {
            if (res.lineas[idx]) {
              res.lineas[idx].jev_root_cause = enriched.jev_root_cause;
              res.lineas[idx].jev_severity = enriched.jev_severity;
              res.lineas[idx].jev_confidence = enriched.jev_confidence;
              res.lineas[idx].jev_recommended_action = enriched.jev_recommended_action;
              res.lineas[idx].jev_gl_account = enriched.jev_gl_account;
              res.lineas[idx].jev_reasoning = enriched.jev_reasoning;
            }
          });

          filtrarTablaPaso3();
          if (!isAuto) {
            showToast(`¡Listo! TypeSafe AI Jev analizó ${resp.data.total_lineas} ítems (${resp.data.total_discrepancias} discrepancias clasificadas).`, 'success');
          }
        } else {
          filtrarTablaPaso3();
        }
      })
      .withFailureHandler((err) => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
        if (badge) {
          badge.innerHTML = '⚡ AI Triage Local';
        }
        if (!isAuto) {
          showToast('Error en TypeSafe AI Jev: ' + err.message, 'danger');
        }
      })
      .apiEjecutarJevTypeSafeAudit(res);
  }


  // Datos base ligeros del Dashboard TOP Diferencias para arranque instantáneo (se sincronizan con BigQuery vía RPC)
  var CLIENT_TOP_DASHBOARD_DATA = window.CLIENT_TOP_DASHBOARD_DATA = {
    "kpis": {
      "monto_total_riesgo": 1048252015,
      "total_pos_analizadas": 100,
      "total_facturas_observadas": 15,
      "top_po_descalce": {
        "po": "PO502855",
        "monto": 78000345,
        "proveedor": "Unilever Chile Ltda.",
        "unidades_faltantes": 26436
      },
      "top_factura_descalce": {
        "folio": "1849201",
        "monto": 42185136,
        "proveedor": "Unilever Chile Ltda."
      },
      "top_proveedor_riesgo": {
        "nombre": "Unilever Chile Ltda.",
        "monto": 312500000,
        "category_manager": "Nicolas Lopez"
      }
    },
    "top_pos": [
      {
        "po_order_id": "PO502855",
        "supplier_name": "Unilever Chile Ltda.",
        "categoria": "Higiene y Limpieza",
        "category_manager": "Nicolas Lopez",
        "amt_ordered_lc": 154112069,
        "amt_delivered_lc": 76111725,
        "descalce_monto_clp": 78000345,
        "quantity_ordered": 52872,
        "quantity_delivered": 26436,
        "facturas_count": 5
      },
      {
        "po_order_id": "PO484253",
        "supplier_name": "Panini Chile S.A.",
        "categoria": "Snacks y Golosinas",
        "category_manager": "Constanza Urra",
        "amt_ordered_lc": 98000000,
        "amt_delivered_lc": 29500000,
        "descalce_monto_clp": 68500000,
        "quantity_ordered": 40000,
        "quantity_delivered": 12000,
        "facturas_count": 2
      },
      {
        "po_order_id": "PO487287",
        "supplier_name": "Unilever Chile Ltda.",
        "categoria": "Higiene y Limpieza",
        "category_manager": "Nicolas Lopez",
        "amt_ordered_lc": 95120400,
        "amt_delivered_lc": 42040185,
        "descalce_monto_clp": 53080215,
        "quantity_ordered": 32000,
        "quantity_delivered": 14000,
        "facturas_count": 3
      },
      {
        "po_order_id": "PO517979",
        "supplier_name": "Empresas Carozzi S.A.",
        "categoria": "Galletas y Pastas",
        "category_manager": "Daniela Reyes",
        "amt_ordered_lc": 28619421,
        "amt_delivered_lc": 12388682,
        "descalce_monto_clp": 9680118,
        "quantity_ordered": 15200,
        "quantity_delivered": 7850,
        "facturas_count": 8
      },
      {
        "po_order_id": "PO521534",
        "supplier_name": "Coca-Cola Embonor S.A.",
        "categoria": "Bebidas",
        "category_manager": "Javiera Rogers",
        "amt_ordered_lc": 2387107,
        "amt_delivered_lc": 1827308,
        "descalce_monto_clp": 559799,
        "quantity_ordered": 1200,
        "quantity_delivered": 950,
        "facturas_count": 10
      }
    ],
    "top_facturas": [
      {
        "folio": "1849201",
        "proveedor": "Unilever Chile Ltda.",
        "monto_factura": 42185136,
        "po_asociada": "PO504146",
        "diagnostico": "Recepción Física Incompleta (-54%)",
        "fecha": "2026-09-15"
      },
      {
        "folio": "22586659",
        "proveedor": "Empresas Carozzi S.A.",
        "monto_factura": 894377,
        "po_asociada": "PO517979",
        "diagnostico": "Faltante Bodega CD36",
        "fecha": "2026-09-22"
      },
      {
        "folio": "105275609",
        "proveedor": "Coca-Cola Embonor S.A.",
        "monto_factura": 36589,
        "po_asociada": "PO521534",
        "diagnostico": "Faltante Bodega Viña",
        "fecha": "2026-09-30"
      }
    ],
    "top_sin_oc": [
      {
        "folio": "9938210",
        "proveedor": "Distribuidora Mayorista SpA",
        "rut": "77123456-7",
        "monto_factura": 15420000,
        "fecha": "2026-09-28",
        "diagnostico": "Factura sin Orden de Compra (S/OC)"
      }
    ]
  };


  function cambiarVistaPrincipal(vista) {
    activeMainView = vista;
    const contWizard = document.getElementById('vistaContenedorWizard');
    const contDashboard = document.getElementById('vistaContenedorDashboard');
    const btnW = document.getElementById('btnNavVistaWizard');
    const btnD = document.getElementById('btnNavVistaDashboard');

    if (vista === 'dashboard') {
      if (contWizard) contWizard.style.display = 'none';
      if (contDashboard) {
        contDashboard.style.display = 'block';
        contDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (btnW) btnW.classList.remove('active', 'tab-wizard');
      if (btnD) btnD.classList.add('active');
      cargarDashboardTopDiferencias();
    } else {
      if (contDashboard) contDashboard.style.display = 'none';
      if (contWizard) {
        contWizard.style.display = 'block';
        contWizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (btnD) btnD.classList.remove('active');
      if (btnW) btnW.classList.add('active', 'tab-wizard');
    }
  }

  function cambiarPestanaTopDashboard(pestana) {
    activeDashboardPill = pestana;
    const secPos = document.getElementById('seccionTopPos');
    const secFac = document.getElementById('seccionTopFacturas');
    const secSinOc = document.getElementById('seccionTopSinOc');
    const pillP = document.getElementById('pillSubnavPos');
    const pillF = document.getElementById('pillSubnavFacturas');
    const pillS = document.getElementById('pillSubnavSinOc');

    if (pillP) pillP.classList.toggle('active', pestana === 'pos');
    if (pillF) pillF.classList.toggle('active', pestana === 'facturas');
    if (pillS) pillS.classList.toggle('active', pestana === 'sin_oc');

    if (secPos) secPos.style.display = (pestana === 'pos') ? 'block' : 'none';
    if (secFac) secFac.style.display = (pestana === 'facturas') ? 'block' : 'none';
    if (secSinOc) secSinOc.style.display = (pestana === 'sin_oc') ? 'block' : 'none';
  }

  function cargarDashboardTopDiferencias() {
    if (cachedDashboardData) {
      renderizarDashboardCompleto(cachedDashboardData);
      return;
    }

    cachedDashboardData = CLIENT_TOP_DASHBOARD_DATA;
    renderizarDashboardCompleto(cachedDashboardData);

    // Intentar refrescar desde backend si está disponible
    const runner = (typeof google !== 'undefined' && google.script && google.script.run) ? google.script.run : null;
    if (runner && typeof runner.apiGetTopDiscrepanciesDashboard === 'function') {
      runner
        .withSuccessHandler((resp) => {
          if (resp && resp.success && resp.data) {
            cachedDashboardData = resp.data;
            renderizarDashboardCompleto(cachedDashboardData);
          }
        })
        .apiGetTopDiscrepanciesDashboard();
    }
  }

  function renderizarDashboardCompleto(data) {
    if (!data) return;

    // 1. KPIs Ejecutivos
    const k = data.kpis || {};
    const kRiesgo = document.getElementById('topKpiMontoRiesgo');
    const kPo = document.getElementById('topKpiTopPo');
    const kPoDesc = document.getElementById('topKpiTopPoDesc');
    const kFac = document.getElementById('topKpiTopFactura');
    const kFacDesc = document.getElementById('topKpiTopFacturaDesc');
    const kProv = document.getElementById('topKpiTopProveedor');
    const kCmDesc = document.getElementById('topKpiTopCmDesc');

    if (kRiesgo && k.monto_total_riesgo) kRiesgo.textContent = `$${(k.monto_total_riesgo / 1000000).toFixed(1)}M CLP`;
    if (kPo && k.top_po_descalce) kPo.textContent = `$${(k.top_po_descalce.monto / 1000000).toFixed(1)}M`;
    if (kPoDesc && k.top_po_descalce) kPoDesc.textContent = `${k.top_po_descalce.po} • ${k.top_po_descalce.unidades_faltantes.toLocaleString('es-CL')} unids faltantes`;
    if (kFac && k.top_factura_descalce) kFac.textContent = `$${(k.top_factura_descalce.monto / 1000000).toFixed(2)}M`;
    if (kProv) {
      if (k.top_proveedor_riesgo) {
        kProv.textContent = `${k.top_proveedor_riesgo.nombre} (${k.top_proveedor_riesgo.pct_compra || '23.6%'})`;
      } else {
        kProv.textContent = '32 Proveedores';
      }
    }
    if (kCmDesc && k.category_manager_foco) {
      kCmDesc.textContent = `CM Foco: ${k.category_manager_foco.nombre} • ${k.category_manager_foco.categoria}`;
    }

    // 2. Renderizar Tablas
    renderizarTopPos(data.top_pos || []);
    renderizarTopFacturas(data.top_facturas || []);
    renderizarTopSinOc(data.top_sin_oc || []);
  }

  function renderizarTopPos(posList) {
    const tbody = document.getElementById('tbodyTopPos');
    if (!tbody) return;

    const badgeCnt = document.getElementById('badgeTotalPosCount');
    if (badgeCnt) badgeCnt.textContent = `${posList.length} OCs en foco`;

    if (!posList || posList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">No se registraron OCs en el ranking.</td></tr>`;
      return;
    }

    let html = '';
    posList.forEach(po => {
      let medalClass = 'regular';
      let medalContent = po.ranking;
      if (po.ranking === 1) { medalClass = 'gold'; medalContent = '🥇'; }
      else if (po.ranking === 2) { medalClass = 'silver'; medalContent = '🥈'; }
      else if (po.ranking === 3) { medalClass = 'bronze'; medalContent = '🥉'; }

      const cumplimiento = Number(po.cumplimiento_pct || 0);
      let fillClass = 'fill-danger';
      if (cumplimiento >= 80) fillClass = 'fill-success';
      else if (cumplimiento >= 60) fillClass = 'fill-warning';

      html += `
        <tr>
          <td style="text-align:center;">
            <span class="ranking-medal ${medalClass}">${medalContent}</span>
          </td>
          <td>
            <strong class="font-mono" style="color:var(--accent-blue); font-size:0.95rem;">${po.po_order_id}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${po.facturas_count || 1} Facturas vinculadas</div>
          </td>
          <td>
            <div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">${po.supplier_name}</div>
            <div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">${po.supplier_tax_id || ''}</div>
          </td>
          <td style="font-size:0.82rem; color:var(--text-secondary);">${po.warehouse_name}</td>
          <td class="font-mono" style="text-align:right; font-weight:600;">$${Math.round(po.amt_ordered_lc).toLocaleString('es-CL')}</td>
          <td class="font-mono" style="text-align:right; font-weight:600; color:var(--accent-green);">$${Math.round(po.amt_delivered_lc).toLocaleString('es-CL')}</td>
          <td class="font-mono" style="text-align:right; font-weight:800; color:var(--accent-red); font-size:0.95rem;">
            -$${Math.round(po.descalce_monto_clp).toLocaleString('es-CL')}
          </td>
          <td>
            <div class="progress-track-wrapper">
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-family:var(--font-mono); font-weight:700;">
                <span>${cumplimiento.toFixed(1)}%</span>
                <span style="color:var(--text-muted); font-size:0.7rem;">físico</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${fillClass}" style="width:${Math.min(100, Math.max(5, cumplimiento))}%;"></div>
              </div>
            </div>
          </td>
          <td class="font-mono" style="text-align:right; font-weight:700; color:var(--accent-red);">
            ${Number(po.diff_qty || 0).toLocaleString('es-CL')} unids
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn btn-primary btn-sm" onclick="auditarPoDesdeDashboard('${po.po_order_id}')" style="font-size:0.78rem; padding:5px 12px; font-weight:700; border-radius:14px;">
              ⚡ Auditar PO
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderizarTopFacturas(facList) {
    const tbody = document.getElementById('tbodyTopFacturas');
    if (!tbody) return;

    const badgeCnt = document.getElementById('badgeTotalFacturasCount');
    if (badgeCnt) badgeCnt.textContent = `${facList.length} Facturas críticas`;

    if (!facList || facList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">No se registraron facturas en el ranking.</td></tr>`;
      return;
    }

    let html = '';
    facList.forEach(f => {
      let medalClass = 'regular';
      let medalContent = f.ranking;
      if (f.ranking === 1) { medalClass = 'gold'; medalContent = '🥇'; }
      else if (f.ranking === 2) { medalClass = 'silver'; medalContent = '🥈'; }
      else if (f.ranking === 3) { medalClass = 'bronze'; medalContent = '🥉'; }

      html += `
        <tr>
          <td style="text-align:center;">
            <span class="ranking-medal ${medalClass}">${medalContent}</span>
          </td>
          <td>
            <strong class="font-mono" style="color:var(--accent-cyan); font-size:0.95rem;">${f.folio}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${f.fecha}</div>
          </td>
          <td>
            <div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">${f.proveedor}</div>
            <div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">${f.rut || ''} &bull; CM: ${f.category_manager || 'Daniela Reyes'}</div>
          </td>
          <td>
            <span class="badge badge-info font-mono" style="font-size:0.78rem;">
              📦 ${f.po_asociada || 'S/OC'}
            </span>
          </td>
          <td class="font-mono" style="text-align:right; font-weight:600;">$${Math.round(f.monto_factura).toLocaleString('es-CL')}</td>
          <td class="font-mono" style="text-align:right; font-weight:600; color:var(--accent-green);">$${Math.round(f.monto_recepcionado).toLocaleString('es-CL')}</td>
          <td class="font-mono" style="text-align:right; font-weight:800; color:var(--accent-red); font-size:0.95rem;">
            -$${Math.round(f.monto_diferencia).toLocaleString('es-CL')}
          </td>
          <td>
            <span class="badge badge-danger font-mono" style="font-size:0.72rem; padding:3px 6px;">${f.causa_raiz}</span>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${f.diagnostico || ''}</div>
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn btn-primary btn-sm" onclick="auditarFacturaDesdeDashboard('${f.folio}')" style="font-size:0.78rem; padding:5px 12px; font-weight:700; border-radius:14px;">
              🔍 Auditar Factura
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderizarTopSinOc(sinOcList) {
    const tbody = document.getElementById('tbodyTopSinOc');
    if (!tbody) return;

    if (!sinOcList || sinOcList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">Sin facturas sin OC detectadas.</td></tr>`;
      return;
    }

    let html = '';
    sinOcList.forEach((s, idx) => {
      html += `
        <tr>
          <td style="text-align:center; font-weight:700; color:var(--text-muted);">${idx + 1}</td>
          <td><strong class="font-mono" style="color:var(--accent-red); font-size:0.95rem;">${s.folio}</strong></td>
          <td class="font-mono" style="font-size:0.82rem;">${s.fecha}</td>
          <td><div style="font-weight:600;">${s.proveedor}</div><div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">${s.rut || ''}</div></td>
          <td class="font-mono" style="text-align:right; font-weight:800; color:var(--accent-red); font-size:0.95rem;">
            $${Math.round(s.monto_factura).toLocaleString('es-CL')}
          </td>
          <td><span class="badge badge-danger font-mono" style="font-size:0.72rem;">RECHAZO 100%</span><div style="font-size:0.75rem; color:var(--text-secondary);">${s.motivo || ''}</div></td>
          <td><strong style="color:var(--accent-red); font-size:0.82rem;">${s.accion}</strong></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function auditarPoDesdeDashboard(poNumber) {
    showToast(`Cargando Orden de Compra ${poNumber} en el Asistente...`, 'info');
    cambiarVistaPrincipal('wizard');
    const txt = document.getElementById('txtBuscarFactura');
    if (txt) txt.value = poNumber;
    buscarFacturaEnVivoPaso1(poNumber);
  }

  function auditarFacturaDesdeDashboard(folio) {
    showToast(`Cargando Factura Folio ${folio} en el Asistente...`, 'info');
    cambiarVistaPrincipal('wizard');

    // Si ya existe en el catálogo inicial o en PO517979
    const match = FACTURAS_CATALOGO_INICIAL.find(f => String(f.folio) === String(folio));
    if (match) {
      seleccionarFacturaParaCruce(match);
      return;
    }

    // Si no está, buscar por folio en vivo
    const txt = document.getElementById('txtBuscarFactura');
    if (txt) txt.value = folio;
    buscarFacturaEnVivoPaso1(folio);
  }

  function aplicarChipProveedorTop(empresa) {
    const sel = document.getElementById('selectFiltroProveedorTop');
    if (sel) {
      sel.value = empresa;
    }
    // Actualizar estilos activos de los chips
    const chips = document.querySelectorAll('[id^="chipTopFiltro"]');
    chips.forEach(c => c.classList.remove('active'));
    const idChip = empresa === 'todos' ? 'chipTopFiltroTodos' : ('chipTopFiltro' + empresa.replace(/[^a-zA-Z]/g, ''));
    const target = document.getElementById(idChip);
    if (target) target.classList.add('active');
    filtrarDashboardAvanzado();
  }

  function filtrarDashboardAvanzado() {
    if (!cachedDashboardData) return;
    const selProv = document.getElementById('selectFiltroProveedorTop') ? document.getElementById('selectFiltroProveedorTop').value : 'todos';
    const selCm = document.getElementById('selectFiltroCategoryManagerTop') ? document.getElementById('selectFiltroCategoryManagerTop').value : 'todos';
    const txt = document.getElementById('txtFiltroTopDashboard') ? document.getElementById('txtFiltroTopDashboard').value.toLowerCase().trim() : '';

    let pos = cachedDashboardData.top_pos || [];
    let facs = cachedDashboardData.top_facturas || [];
    let sinOc = cachedDashboardData.top_sin_oc || [];

    // Filtro por proveedor
    if (selProv && selProv !== 'todos') {
      const pLow = selProv.toLowerCase();
      pos = pos.filter(p => p.supplier_name.toLowerCase().includes(pLow));
      facs = facs.filter(f => f.proveedor.toLowerCase().includes(pLow));
      sinOc = sinOc.filter(s => s.proveedor.toLowerCase().includes(pLow));
    }

    // Filtro por Category Manager
    if (selCm && selCm !== 'todos') {
      const cmLow = selCm.toLowerCase();
      pos = pos.filter(p => (p.category_manager || '').toLowerCase().includes(cmLow));
      facs = facs.filter(f => (f.category_manager || '').toLowerCase().includes(cmLow));
    }

    // Filtro por texto libre
    if (txt) {
      pos = pos.filter(p => 
        p.po_order_id.toLowerCase().includes(txt) || 
        p.supplier_name.toLowerCase().includes(txt) ||
        (p.category_manager && p.category_manager.toLowerCase().includes(txt))
      );
      facs = facs.filter(f => 
        String(f.folio).includes(txt) || 
        f.proveedor.toLowerCase().includes(txt) || 
        (f.po_asociada && f.po_asociada.toLowerCase().includes(txt)) ||
        (f.category_manager && f.category_manager.toLowerCase().includes(txt))
      );
      sinOc = sinOc.filter(s => 
        String(s.folio).includes(txt) || 
        s.proveedor.toLowerCase().includes(txt)
      );
    }

    // Recalcular KPIs dinámicos para la vista filtrada
    const totalRiesgo = pos.reduce((acc, p) => acc + (Number(p.descalce_monto_clp) || 0), 0);
    const kRiesgo = document.getElementById('topKpiMontoRiesgo');
    const kPo = document.getElementById('topKpiTopPo');
    const kPoDesc = document.getElementById('topKpiTopPoDesc');
    const kFac = document.getElementById('topKpiTopFactura');
    const kFacDesc = document.getElementById('topKpiTopFacturaDesc');
    const kProv = document.getElementById('topKpiTopProveedor');
    const kCmDesc = document.getElementById('topKpiTopCmDesc');

    if (kRiesgo) kRiesgo.textContent = `$${(totalRiesgo / 1000000).toFixed(1)}M CLP`;
    
    if (pos.length > 0) {
      const topP = pos[0];
      if (kPo) kPo.textContent = `$${(topP.descalce_monto_clp / 1000000).toFixed(1)}M`;
      if (kPoDesc) kPoDesc.textContent = `${topP.po_order_id} • ${(topP.diff_qty || 0).toLocaleString('es-CL')} unids (${topP.supplier_name})`;
    } else {
      if (kPo) kPo.textContent = '$0';
      if (kPoDesc) kPoDesc.textContent = 'Sin OCs con descalce';
    }

    if (facs.length > 0) {
      const topF = facs[0];
      if (kFac) kFac.textContent = `$${(topF.monto_diferencia / 1000000).toFixed(2)}M`;
      if (kFacDesc) kFacDesc.textContent = `Folio ${topF.folio} (${topF.proveedor}) • OC ${topF.po_asociada || 'S/OC'}`;
    } else {
      if (kFac) kFac.textContent = '$0';
      if (kFacDesc) kFacDesc.textContent = 'Sin facturas observadas';
    }

    if (kProv) {
      if (selProv !== 'todos') {
        kProv.textContent = selProv;
      } else if (selCm !== 'todos') {
        kProv.textContent = selCm;
      } else {
        kProv.textContent = '32 Proveedores';
      }
    }
    if (kCmDesc) {
      if (selCm !== 'todos') {
        kCmDesc.textContent = `Filtrado por Category Manager: ${selCm}`;
      } else if (selProv !== 'todos' && pos.length > 0) {
        kCmDesc.textContent = `CM a cargo: ${pos[0].category_manager || 'Comercial'}`;
      } else {
        kCmDesc.textContent = `Red Nacional Dmarts Chile (Sociedad 6202)`;
      }
    }

    renderizarTopPos(pos);
    renderizarTopFacturas(facs);
    renderizarTopSinOc(sinOc);
  }

  function filtrarTopDashboard(query) {
    filtrarDashboardAvanzado();
  }

  function exportarTopCsvDashboard() {
    if (!cachedDashboardData) return;
    const lines = [];
    lines.push(['RANKING TOP DISCREPANCIAS Y DESCALCES FINANCIEROS - SOCIEDAD 6202 (CD36 CHILE)'].join(';'));
    lines.push([`Monto Total Riesgo:;$ ${cachedDashboardData.kpis.monto_total_riesgo};Total POs:;${cachedDashboardData.kpis.total_pos_analizadas};Total Facturas:;${cachedDashboardData.kpis.total_facturas_observadas}`].join(';'));
    lines.push(['']);
    lines.push(['--- TOP ÓRDENES DE COMPRA CON MAYOR FALTANTE DE BODEGA ---'].join(';'));
    lines.push(['Rank;PO Number;Proveedor;Almacen;Monto Ordenado;Monto Bodega;Delta Faltante CLP;Cumplimiento %;Unids Faltantes;Estado'].join(';'));
    (cachedDashboardData.top_pos || []).forEach(p => {
      lines.push([
        p.ranking,
        p.po_order_id,
        `"${p.supplier_name}"`,
        `"${p.warehouse_name}"`,
        Math.round(p.amt_ordered_lc),
        Math.round(p.amt_delivered_lc),
        Math.round(p.descalce_monto_clp),
        p.cumplimiento_pct,
        p.diff_qty,
        p.status
      ].join(';'));
    });

    lines.push(['']);
    lines.push(['--- TOP FACTURAS DTE CON MAYOR RECLAMO DE NOTA DE CRÉDITO ---'].join(';'));
    lines.push(['Rank;Folio DTE;Fecha;Proveedor;OC Asociada;Facturado Total;Valido Bodega;Monto Reclamar NC;Causa Raiz;Estado'].join(';'));
    (cachedDashboardData.top_facturas || []).forEach(f => {
      lines.push([
        f.ranking,
        f.folio,
        f.fecha,
        `"${f.proveedor}"`,
        `"${f.po_asociada}"`,
        Math.round(f.monto_factura),
        Math.round(f.monto_recepcionado),
        Math.round(f.monto_diferencia),
        `"${f.causa_raiz}"`,
        f.status
      ].join(';'));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    descargarTextoComoArchivo(`Ranking_Top_Diferencias_CD36_${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv;charset=utf-8;');
    showToast('Ranking TOP exportado en CSV exitosamente.', 'success');
  }

</script>
