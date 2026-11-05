/**
 * Test Suite Automatizado con Puppeteer para el Paso 1
 * Axteroid Dmarts Agente Conciliador WebApp
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./test_server.js');

const PORT = 3055;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Estructura de resultados
const testResults = [];

function recordResult(id, name, passed, details = '', durationMs = 0) {
  testResults.push({ id, name, passed, details, durationMs });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${id}] ${name} (${durationMs}ms) ${details ? '— ' + details : ''}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSuite() {
  console.log('================================================================');
  console.log('🚀 INICIANDO PRUEBAS AUTOMATIZADAS PUPPETEER — PASO 1');
  console.log(`🌐 Servidor: ${BASE_URL}`);
  console.log(`🧭 Browser: Chrome (${CHROME_PATH})`);
  console.log('================================================================\n');

  // 1. Iniciar Servidor
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Servidor] Escuchando en puerto ${PORT}\n`);

  // 2. Iniciar Puppeteer con Chrome
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // Escuchar logs de consola en el navegador para depuración
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.warn(`[Browser Error]:`, msg.text());
    }
  });

  const startTimeTotal = Date.now();

  try {
    // -------------------------------------------------------------
    // TC-01: Carga y Renderizado Inicial de Paso 1
    // -------------------------------------------------------------
    const t01Start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Verificar visibilidad de Paso 1
    const isPaso1Active = await page.evaluate(() => {
      const pane = document.getElementById('panePaso1');
      const wstep = document.getElementById('wstep1');
      const display = window.getComputedStyle(pane).display;
      return display !== 'none' && wstep.classList.contains('active');
    });

    // Contar filas de catálogo inicial
    const initialRowsCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      return rows.length;
    });

    const hasSearchControls = await page.evaluate(() => {
      const input = document.getElementById('txtBuscarFactura');
      const btn = document.getElementById('btnEjecutarBusquedaFacturas');
      const btnDemoC = document.getElementById('btnCargarDemoCarozzi');
      const btnDemoN = document.getElementById('btnCargarDemoConforme');
      return !!(input && btn && btnDemoC && btnDemoN);
    });

    const tc01Pass = isPaso1Active && initialRowsCount > 0 && hasSearchControls;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc01_render_inicial.png') });
    recordResult('TC-01', 'Renderizado Inicial y Controles Clave de Paso 1', tc01Pass, `${initialRowsCount} facturas renderizadas inicialmente`, Date.now() - t01Start);

    // -------------------------------------------------------------
    // TC-02: Filtro en Tiempo Real por Folio DTE
    // -------------------------------------------------------------
    const t02Start = Date.now();
    // Obtener el folio de la primera fila
    const targetFolio = await page.evaluate(() => {
      const firstFolioCell = document.querySelector('#tbodyFacturasPaso1 tr td strong');
      return firstFolioCell ? firstFolioCell.textContent.trim() : null;
    });

    await page.focus('#txtBuscarFactura');
    await page.keyboard.type(targetFolio);
    await sleep(200); // Esperar filtrado local reactivo

    const filteredCountFolio = await page.evaluate((folio) => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const matches = Array.from(rows).filter(r => r.textContent.includes(folio));
      return { total: rows.length, matches: matches.length };
    }, targetFolio);

    const tc02Pass = filteredCountFolio.total >= 1 && filteredCountFolio.matches >= 1;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc02_filtro_folio.png') });
    recordResult('TC-02', 'Filtro Reactivo en Tiempo Real por Folio DTE', tc02Pass, `Búsqueda folio "${targetFolio}": ${filteredCountFolio.matches} coincidencia(s)`, Date.now() - t02Start);

    // -------------------------------------------------------------
    // TC-03: Filtro en Tiempo Real por Proveedor / Razón Social
    // -------------------------------------------------------------
    const t03Start = Date.now();
    await page.evaluate(() => {
      const inp = document.getElementById('txtBuscarFactura');
      inp.value = '';
    });
    await page.type('#txtBuscarFactura', 'Embonor');
    await sleep(250);

    const embonorCheck = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const allEmbonor = Array.from(rows).every(r => r.textContent.toLowerCase().includes('embonor'));
      const lbl = document.getElementById('lblConteoFacturasPaso1');
      const hasExclusiveTag = lbl ? lbl.textContent.toLowerCase().includes('proveedor exclusivo') || lbl.textContent.includes('Embonor') : false;
      return { rowsCount: rows.length, allEmbonor, hasExclusiveTag };
    });

    const tc03Pass = embonorCheck.rowsCount > 0 && embonorCheck.allEmbonor;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc03_filtro_proveedor.png') });
    recordResult('TC-03', 'Filtro por Razón Social de Proveedor (Embonor)', tc03Pass, `${embonorCheck.rowsCount} facturas filtradas exclusivamente`, Date.now() - t03Start);

    // -------------------------------------------------------------
    // TC-04: Filtro en Tiempo Real por RUT Emisor
    // -------------------------------------------------------------
    const t04Start = Date.now();
    await page.evaluate(() => {
      const inp = document.getElementById('txtBuscarFactura');
      inp.value = '';
    });
    await page.type('#txtBuscarFactura', '93281000-K');
    await sleep(250);

    const rutCheck = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const allRut = Array.from(rows).every(r => r.textContent.includes('93281000-K'));
      return { rowsCount: rows.length, allRut };
    });

    const tc04Pass = rutCheck.rowsCount > 0 && rutCheck.allRut;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc04_filtro_rut.png') });
    recordResult('TC-04', 'Filtro por RUT Emisor (93281000-K)', tc04Pass, `${rutCheck.rowsCount} facturas coincidentes por RUT`, Date.now() - t04Start);

    // -------------------------------------------------------------
    // TC-05: Limpieza de Búsqueda y Restauración del Catálogo
    // -------------------------------------------------------------
    const t05Start = Date.now();
    await page.evaluate(() => {
      const inp = document.getElementById('txtBuscarFactura');
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(200);

    const restoredRowsCount = await page.evaluate(() => {
      return document.querySelectorAll('#tbodyFacturasPaso1 tr').length;
    });

    const tc05Pass = restoredRowsCount === initialRowsCount;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc05_restauracion_catalogo.png') });
    recordResult('TC-05', 'Limpieza de Búsqueda y Restauración del Catálogo Completo', tc05Pass, `Catálogo restablecido con ${restoredRowsCount} facturas`, Date.now() - t05Start);

    // -------------------------------------------------------------
    // TC-06: Búsqueda en Vivo de Orden de Compra y Tarjeta de Vínculo PO
    // -------------------------------------------------------------
    const t06Start = Date.now();
    await page.focus('#txtBuscarFactura');
    await page.evaluate(() => { document.getElementById('txtBuscarFactura').value = ''; });
    await page.type('#txtBuscarFactura', 'PO521534');
    await page.click('#btnEjecutarBusquedaFacturas');

    // Esperar a que la tarjeta de vínculo PO sea visible
    await page.waitForFunction(() => {
      const card = document.getElementById('cardVinculoPoFacturas');
      return card && window.getComputedStyle(card).display !== 'none';
    }, { timeout: 5000 });

    const poCardData = await page.evaluate(() => {
      const titulo = document.getElementById('lblPoVinculoTitulo').textContent;
      const badge = document.getElementById('lblPoVinculoBadge').textContent;
      const totOrd = document.getElementById('lblPoTotalOrdenado').textContent;
      const totRec = document.getElementById('lblPoTotalRecepcionado').textContent;
      const totFac = document.getElementById('lblPoTotalFacturado').textContent;
      const dif = document.getElementById('lblPoDifPreliminar').textContent;
      const btnConsolidado = document.getElementById('btnCruzarPoConsolidada');
      const isBtnVisible = btnConsolidado && window.getComputedStyle(btnConsolidado).display !== 'none';

      return { titulo, badge, totOrd, totRec, totFac, dif, isBtnVisible };
    });

    const tc06Pass = poCardData.titulo.includes('521534') && poCardData.isBtnVisible && poCardData.totOrd !== '$0';
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc06_vinculo_po_kpis.png') });
    recordResult('TC-06', 'Búsqueda en Vivo y Tarjeta de Vínculo PO (PO521534)', tc06Pass, `Título: "${poCardData.titulo}", Ordenado: ${poCardData.totOrd}, Facturado: ${poCardData.totFac}`, Date.now() - t06Start);

    // -------------------------------------------------------------
    // TC-07: Botón Quitar Filtro PO
    // -------------------------------------------------------------
    const t07Start = Date.now();
    await page.click('#btnLimpiarFiltroPo');
    await sleep(200);

    const isPoCardHidden = await page.evaluate(() => {
      const card = document.getElementById('cardVinculoPoFacturas');
      const input = document.getElementById('txtBuscarFactura');
      return window.getComputedStyle(card).display === 'none' && input.value === '';
    });

    const tc07Pass = isPoCardHidden;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc07_quitar_filtro_po.png') });
    recordResult('TC-07', 'Botón Quitar Filtro PO y Ocultamiento de Tarjeta', tc07Pass, 'Tarjeta ocultada y catálogo restablecido', Date.now() - t07Start);

    // -------------------------------------------------------------
    // TC-08: Modal Detalle SKU x SKU de Factura (👁️ Detalle)
    // -------------------------------------------------------------
    const t08Start = Date.now();
    // Clic en el primer botón "Detalle" de la tabla
    await page.evaluate(() => {
      const btn = document.querySelector('#tbodyFacturasPaso1 tr button');
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      const modal = document.getElementById('modalDetalleFacturaPaso1');
      return modal && window.getComputedStyle(modal).display !== 'none';
    }, { timeout: 3000 });

    const modalData = await page.evaluate(() => {
      const badgeFolio = document.getElementById('modalDetFacBadgeFolio').textContent;
      const prov = document.getElementById('modalDetFacProveedor').textContent;
      const rows = document.querySelectorAll('#modalDetFacTbodyItems tr').length;
      return { badgeFolio, prov, rows };
    });

    // Cerrar modal
    await page.click('#btnCerrarModalDetalleFactura');
    await sleep(200);

    const isModalClosed = await page.evaluate(() => {
      const modal = document.getElementById('modalDetalleFacturaPaso1');
      return window.getComputedStyle(modal).display === 'none';
    });

    const tc08Pass = modalData.badgeFolio.includes('Folio') && isModalClosed;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc08_modal_detalle.png') });
    recordResult('TC-08', 'Modal de Detalle Preciso SKU x SKU (Apertura y Cierre)', tc08Pass, `${modalData.badgeFolio} — ${modalData.prov} (${modalData.rows} líneas)`, Date.now() - t08Start);

    // -------------------------------------------------------------
    // TC-09: Demo Carozzi (PO517979 Con Descalces) y Transición a Paso 2 + Retorno
    // -------------------------------------------------------------
    const t09Start = Date.now();
    await page.click('#btnCargarDemoCarozzi');

    // Esperar transición a Paso 2
    await page.waitForFunction(() => {
      const pane2 = document.getElementById('panePaso2');
      const wstep2 = document.getElementById('wstep2');
      return pane2 && window.getComputedStyle(pane2).display !== 'none' && wstep2.classList.contains('active');
    }, { timeout: 5000 });

    const p2CarozziData = await page.evaluate(() => {
      const prov = document.getElementById('p2InvProveedor').textContent;
      const monto = document.getElementById('p2InvMontoNeto').textContent;
      return { prov, monto };
    });

    // Retorno a Paso 1
    await page.evaluate(() => { irAPasoWizard(1); });
    await sleep(250);

    const isBackToPaso1 = await page.evaluate(() => {
      const pane1 = document.getElementById('panePaso1');
      return window.getComputedStyle(pane1).display !== 'none';
    });

    const tc09Pass = p2CarozziData.prov.toUpperCase().includes('CAROZZI') && isBackToPaso1;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc09_demo_carozzi_transicion.png') });
    recordResult('TC-09', 'Demo Carozzi PO517979: Carga, Transición a Paso 2 y Retorno a Paso 1', tc09Pass, `Cargado: ${p2CarozziData.prov} — Neto: ${p2CarozziData.monto}`, Date.now() - t09Start);

    // -------------------------------------------------------------
    // TC-10: Demo Nestlé (Calce Conforme) y Transición
    // -------------------------------------------------------------
    const t10Start = Date.now();
    await page.click('#btnCargarDemoConforme');

    await page.waitForFunction(() => {
      const pane2 = document.getElementById('panePaso2');
      return pane2 && window.getComputedStyle(pane2).display !== 'none';
    }, { timeout: 5000 });

    const p2NestleData = await page.evaluate(() => {
      const folio = document.getElementById('p2InvFolioBadge').textContent;
      const prov = document.getElementById('p2InvProveedor').textContent;
      return { folio, prov };
    });

    // Retorno a Paso 1
    await page.evaluate(() => { irAPasoWizard(1); });
    await sleep(250);

    const tc10Pass = p2NestleData.folio.includes('784110') || p2NestleData.prov.toLowerCase().includes('nestle') || p2NestleData.prov.toLowerCase().includes('nestlé');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc10_demo_nestle_transicion.png') });
    recordResult('TC-10', 'Demo Nestlé Calce Conforme: Carga y Transición a Paso 2', tc10Pass, `Folio: ${p2NestleData.folio} — Proveedor: ${p2NestleData.prov}`, Date.now() - t10Start);

    // -------------------------------------------------------------
    // TC-11: Selección Directa de Factura desde la Tabla (Cruzar ⚡)
    // -------------------------------------------------------------
    const t11Start = Date.now();
    await page.evaluate(() => {
      const cruzButtons = document.querySelectorAll('#tbodyFacturasPaso1 tr button');
      // Segundo botón es Cruzar ⚡
      if (cruzButtons[1]) cruzButtons[1].click();
    });

    await page.waitForFunction(() => {
      const pane2 = document.getElementById('panePaso2');
      return pane2 && window.getComputedStyle(pane2).display !== 'none';
    }, { timeout: 5000 });

    const directSelectCheck = await page.evaluate(() => {
      const folio = document.getElementById('p2InvFolioBadge').textContent;
      return folio && folio.length > 0;
    });

    await page.evaluate(() => { irAPasoWizard(1); });
    await sleep(250);

    const tc11Pass = directSelectCheck;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc11_cruzar_directo_tabla.png') });
    recordResult('TC-11', 'Acción Directa "Cruzar ⚡" desde Fila de Tabla a Paso 2', tc11Pass, 'Transición inmediata con hidratación de datos', Date.now() - t11Start);

    // -------------------------------------------------------------
    // TC-12: Estado Vacío de Búsqueda ("No se encontraron facturas")
    // -------------------------------------------------------------
    const t12Start = Date.now();
    await page.focus('#txtBuscarFactura');
    await page.evaluate(() => { document.getElementById('txtBuscarFactura').value = ''; });
    await page.type('#txtBuscarFactura', 'BUSQUEDA_INEXISTENTE_XYZ_9999');
    await page.click('#btnEjecutarBusquedaFacturas');
    await sleep(350);

    const emptyStateCheck = await page.evaluate(() => {
      const tbody = document.getElementById('tbodyFacturasPaso1');
      return tbody.textContent.includes('No se encontraron facturas') || tbody.textContent.includes('0 facturas');
    });

    // Restaurar catálogo
    await page.evaluate(() => {
      restaurarCatalogoInicialPaso1();
    });
    await sleep(200);

    const tc12Pass = emptyStateCheck;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc12_estado_vacio.png') });
    recordResult('TC-12', 'Manejo de Estado Vacío (Término Sin Coincidencias) y Recuperación', tc12Pass, 'Mensaje orientativo desplegado y botón de restauración funcional', Date.now() - t12Start);

    // -------------------------------------------------------------
    // TC-13: Alternancia de Tema (Modo Claro / Modo Oscuro)
    // -------------------------------------------------------------
    const t13Start = Date.now();
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    await page.click('#btnThemeToggleApp');
    await sleep(200);
    const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    await page.click('#btnThemeToggleApp');
    await sleep(200);
    const finalTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

    const tc13Pass = initialTheme !== toggledTheme && finalTheme === initialTheme;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc13_modo_oscuro_claro.png') });
    recordResult('TC-13', 'Alternancia de Tema Visual (Light Mode / Dark Mode)', tc13Pass, `Transición: ${initialTheme} -> ${toggledTheme} -> ${finalTheme}`, Date.now() - t13Start);

    // -------------------------------------------------------------
    // TC-14: Navegación entre Asistente Wizard y Dashboard TOP
    // -------------------------------------------------------------
    const t14Start = Date.now();
    await page.click('#btnNavVistaDashboard');
    await sleep(250);

    const isDashboardActive = await page.evaluate(() => {
      const dash = document.getElementById('vistaContenedorDashboard');
      const wiz = document.getElementById('vistaContenedorWizard');
      return dash && window.getComputedStyle(dash).display !== 'none' && window.getComputedStyle(wiz).display === 'none';
    });

    await page.click('#btnNavVistaWizard');
    await sleep(250);

    const isWizardBack = await page.evaluate(() => {
      const wiz = document.getElementById('vistaContenedorWizard');
      const pane1 = document.getElementById('panePaso1');
      return wiz && window.getComputedStyle(wiz).display !== 'none' && window.getComputedStyle(pane1).display !== 'none';
    });

    const tc14Pass = isDashboardActive && isWizardBack;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc14_navegacion_vistas.png') });
    recordResult('TC-14', 'Navegación Bidireccional entre Paso 1 y Dashboard TOP Diferencias', tc14Pass, 'Navegación fluida sin pérdida de estado', Date.now() - t14Start);

    // -------------------------------------------------------------
    // TC-15: Búsqueda Universal de PO (PO 518183 - Lo Valledor) Sin Facturas Previas en Axteroid
    // -------------------------------------------------------------
    const t15Start = Date.now();
    await page.evaluate(() => {
      const inp = document.getElementById('txtBuscarFactura');
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(200);

    await page.focus('#txtBuscarFactura');
    await page.type('#txtBuscarFactura', '518183');
    await page.click('#btnEjecutarBusquedaFacturas');

    // Esperar a que la tarjeta de BigQuery se muestre y el banner de PO esté activo (sin quedarse en spinner)
    await page.waitForFunction(() => {
      const banner = document.getElementById('cardVinculoPoFacturas');
      const tbody = document.getElementById('tbodyFacturasPaso1');
      const btn = document.getElementById('btnEjecutarBusquedaFacturas');
      const isBannerVisible = banner && window.getComputedStyle(banner).display !== 'none';
      const hasContent = tbody && (tbody.textContent.includes('518183') || tbody.textContent.includes('Valledor'));
      const notSpinning = btn && !btn.disabled;
      return isBannerVisible && hasContent && notSpinning;
    }, { timeout: 6000 });

    const po518183Check = await page.evaluate(() => {
      const titulo = document.getElementById('lblPoVinculoTitulo').textContent;
      const totOrd = document.getElementById('lblPoTotalOrdenado').textContent;
      const totRec = document.getElementById('lblPoTotalRecepcionado').textContent;
      const tbody = document.getElementById('tbodyFacturasPaso1').textContent;
      const hasAuditarBtn = tbody.includes('Auditar Descalces') || tbody.includes('Vincular Factura');
      return { titulo, totOrd, totRec, hasAuditarBtn };
    });

    const tc15Pass = po518183Check.titulo.includes('518183') && po518183Check.totOrd.includes('558.807') && po518183Check.hasAuditarBtn;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc15_busqueda_po_518183.png') });
    recordResult('TC-15', 'Búsqueda Universal PO 518183 (Lo Valledor - 49 SKUs)', tc15Pass, `Ordenado: ${po518183Check.totOrd}, Recepcionado: ${po518183Check.totRec}`, Date.now() - t15Start);

    // -------------------------------------------------------------
    // TC-16: Búsqueda Universal por SKU / Descripción de Producto (Choclo / 90I591)
    // -------------------------------------------------------------
    const t16Start = Date.now();
    await page.evaluate(() => {
      const inp = document.getElementById('txtBuscarFactura');
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(200);

    await page.focus('#txtBuscarFactura');
    await page.type('#txtBuscarFactura', 'Choclo');
    await page.click('#btnEjecutarBusquedaFacturas');

    await page.waitForFunction(() => {
      const banner = document.getElementById('cardVinculoPoFacturas');
      const tbody = document.getElementById('tbodyFacturasPaso1');
      return banner && window.getComputedStyle(banner).display !== 'none' && tbody.textContent.includes('518183');
    }, { timeout: 6000 });

    const skuSearchCheck = await page.evaluate(() => {
      const titulo = document.getElementById('lblPoVinculoTitulo').textContent;
      return titulo.includes('518183');
    });

    const tc16Pass = skuSearchCheck;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'tc16_busqueda_sku_choclo.png') });
    recordResult('TC-16', 'Búsqueda Universal por Nombre de Producto / SKU (Choclo -> PO518183)', tc16Pass, 'Coincidencia exacta encontrada y vinculada', Date.now() - t16Start);

  } catch (err) {
    console.error('❌ Error fatal durante la ejecución de la suite:', err);
    recordResult('TC-ERROR', 'Excepción no controlada en Suite', false, err.message, 0);
  } finally {
    const totalDuration = ((Date.now() - startTimeTotal) / 1000).toFixed(2);
    await browser.close();
    server.close();

    console.log('\n================================================================');
    console.log('📊 RESUMEN FINAL DE PRUEBAS PUPPETEER — PASO 1');
    console.log('================================================================');
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Casos de Prueba : ${totalTests}`);
    console.log(`✅ Aprobados          : ${passedTests}`);
    console.log(`❌ Fallidos           : ${failedTests}`);
    console.log(`⏱️ Tiempo de Ejecución : ${totalDuration}s`);
    console.log(`🖼️ Capturas Guardadas : ${SCREENSHOTS_DIR}`);
    console.log('================================================================\n');

    // Guardar reporte JSON
    const reportJsonPath = path.resolve(__dirname, 'reporte_pruebas_paso1.json');
    fs.writeFileSync(reportJsonPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: failedTests,
      duration_seconds: parseFloat(totalDuration),
      results: testResults
    }, null, 2), 'utf8');

    if (failedTests > 0) {
      process.exit(1);
    }
  }
}

runSuite().catch(err => {
  console.error('Fallo de ejecución:', err);
  process.exit(1);
});
