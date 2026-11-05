/**
 * Suite Completa de Pruebas Automatizadas con Puppeteer
 * Verificación Integral de Paso 1, Paso 2, Paso 3 y Corroboración de Dif ML
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./test_server.js');

const PORT = 3058;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const testResults = [];
function record(id, title, passed, details = '') {
  testResults.push({ id, title, passed, details });
  console.log(`${passed ? '✅' : '❌'} [${id}] ${title} ${details ? '— ' + details : ''}`);
}

async function runFullSuite() {
  console.log('================================================================');
  console.log('🧪 SUITE PUPPETEER: VERIFICACIÓN INTEGRAL DE DIF ML Y PASO 3');
  console.log(`🌐 URL: ${BASE_URL}`);
  console.log('================================================================\n');

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.warn('  ⚠️ [Browser Console Error]:', msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error('  🛑 [Page Unhandled Exception]:', err.message);
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Carga inicial de la aplicación
    // -------------------------------------------------------------
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    const title = await page.title();
    const hasPaso1 = await page.evaluate(() => {
      const p1 = document.getElementById('panePaso1');
      return p1 && window.getComputedStyle(p1).display !== 'none';
    });
    record('TEST-01', 'Carga inicial y renderizado de Paso 1', hasPaso1, `Título: "${title}"`);

    // -------------------------------------------------------------
    // TEST 2: Columna "Dif ML (Preliminar)" en la tabla de facturas de Paso 1
    // -------------------------------------------------------------
    const difMlColHeader = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('#tablaFacturasPaso1 thead th'));
      return ths.map(t => t.textContent.trim()).find(txt => txt.includes('Dif ML') || txt.includes('Diferencia ML'));
    });
    record('TEST-02', 'Presencia de Columna Dif ML en Tabla de Paso 1', !!difMlColHeader, `Cabecera: "${difMlColHeader || 'No encontrada'}"`);

    // -------------------------------------------------------------
    // TEST 3: Búsqueda y vinculación de Orden de Compra (PO519527)
    // -------------------------------------------------------------
    await page.focus('#txtBuscarFactura');
    await page.evaluate(() => { document.getElementById('txtBuscarFactura').value = ''; });
    await page.type('#txtBuscarFactura', 'PO519527');
    await page.click('#btnEjecutarBusquedaFacturas');
    await sleep(700);

    const poCard = await page.evaluate(() => {
      const card = document.getElementById('cardVinculoPoFacturas');
      const isVis = card && window.getComputedStyle(card).display !== 'none';
      const tit = document.getElementById('lblPoVinculoTitulo')?.textContent || '';
      const dif = document.getElementById('lblPoDifPreliminar')?.textContent || '';
      const rec = document.getElementById('lblPoTotalRecepcionado')?.textContent || '';
      const fac = document.getElementById('lblPoTotalFacturado')?.textContent || '';
      return { isVis, tit, dif, rec, fac };
    });
    record('TEST-03', 'Tarjeta de Vínculo PO e Indicador Dif ML en Paso 1', poCard.isVis && poCard.dif.includes('$37.303'), `PO: "${poCard.tit}", Dif: ${poCard.dif}`);

    // -------------------------------------------------------------
    // TEST 4: Selección de Factura y Transición a Paso 2
    // -------------------------------------------------------------
    await page.evaluate(() => {
      const btn = document.querySelector('#tbodyFacturasPaso1 tr button:last-child');
      if (btn) btn.click();
    });
    await sleep(700);

    const paso2Vis = await page.evaluate(() => {
      const p2 = document.getElementById('panePaso2');
      return p2 && window.getComputedStyle(p2).display !== 'none';
    });
    record('TEST-04', 'Transición e hidratación hacia Paso 2', paso2Vis, 'Paso 2 activo');

    // -------------------------------------------------------------
    // TEST 5: Ejecución del Cruce y Transición a Paso 3
    // -------------------------------------------------------------
    await page.evaluate(() => {
      const btn = document.getElementById('btnIrACrucePaso3');
      if (btn) btn.click();
    });
    await sleep(1200);

    const paso3Vis = await page.evaluate(() => {
      const p3 = document.getElementById('panePaso3');
      return p3 && window.getComputedStyle(p3).display !== 'none';
    });
    record('TEST-05', 'Transición a Paso 3 (Cruce SKU x SKU)', paso3Vis, 'Paso 3 activo');

    // -------------------------------------------------------------
    // TEST 6: Banner de Veredicto y Corroboración de Dif ML en Paso 3
    // -------------------------------------------------------------
    const p3Banner = await page.evaluate(() => {
      const montoTotal = document.getElementById('lblMontoReclamarTotal')?.textContent || '';
      const corrobText = document.getElementById('lblCorroboracionPaso3')?.textContent || '';
      const veredicto = document.getElementById('lblVeredictoTitulo')?.textContent || '';
      return { montoTotal, corrobText, veredicto };
    });
    const test6Pass = (p3Banner.montoTotal.includes('$42.603') || p3Banner.montoTotal.includes('$37.303')) && p3Banner.corrobText.includes('Dif ML');
    record('TEST-06', 'Banner de Veredicto & Corroboración Dif ML en Paso 3', test6Pass, `Monto: ${p3Banner.montoTotal}, Glosa: "${p3Banner.corrobText.trim()}"`);

    // -------------------------------------------------------------
    // TEST 7: Tarjeta KPI de Diferencia Moneda Local (Dif ML)
    // -------------------------------------------------------------
    const kpiData = await page.evaluate(() => {
      const val = document.getElementById('kpiDifMlPaso3')?.textContent || '';
      const sub = document.getElementById('kpiDifMlSubtext')?.textContent || '';
      const prc = document.getElementById('kpiDescalcePrecio')?.textContent || '';
      return { val, sub, prc };
    });
    const test7Pass = (kpiData.val.includes('$42.603') || kpiData.val.includes('$37.303')) && kpiData.sub.includes('Facturado') && kpiData.sub.includes('Recepcionado');
    record('TEST-07', 'Tarjeta KPI Destacada DIFERENCIA MONEDA LOCAL (DIF ML)', test7Pass, `Valor: ${kpiData.val}, Subtexto: "${kpiData.sub}"`);

    // -------------------------------------------------------------
    // TEST 8: Panel de Control de Transacción con Dif ML
    // -------------------------------------------------------------
    const panelControlText = await page.evaluate(() => {
      const box = document.getElementById('boxControlTransaccionPaso3');
      return box ? box.textContent : '';
    });
    const test8Pass = panelControlText.includes('DIFERENCIA EN MONEDA LOCAL') && (panelControlText.includes('42.603') || panelControlText.includes('37.303'));
    record('TEST-08', 'Panel de Control de Auditoría y Trazabilidad en Paso 3', test8Pass, 'Fórmula Facturado - Recepcionado = Dif ML presente');

    // -------------------------------------------------------------
    // TEST 9: Filas de Tabla SKU x SKU y Columna "Dif ML (Reclamo NC)"
    // -------------------------------------------------------------
    const tablaPaso3 = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyDetalleConciliacion1a1 tr');
      const ths = Array.from(document.querySelectorAll('#tablaDetalleConciliacion1a1 thead th')).map(t => t.textContent.trim());
      const hasThDif = ths.some(t => t.includes('Dif ML') || t.includes('Reclamo NC'));
      return { rowCount: rows.length, hasThDif };
    });
    record('TEST-09', 'Tabla SKU x SKU de Paso 3 con Columna Dif ML', tablaPaso3.rowCount > 0 && tablaPaso3.hasThDif, `${tablaPaso3.rowCount} líneas renderizadas`);

    // -------------------------------------------------------------
    // TEST 10: Fila de Corroboración Matemática en Footer (tfoot)
    // -------------------------------------------------------------
    const tfootText = await page.evaluate(() => {
      const tf = document.getElementById('tfootDetalleConciliacion1a1');
      return tf ? tf.textContent : '';
    });
    const test10Pass = tfootText.includes('CORROBORACIÓN') && tfootText.includes('DIF ML');
    record('TEST-10', 'Fila de Corroboración Matemática en Pie de Tabla (tfoot)', test10Pass, 'Ecuación Facturado - Recepcionado Válido = Dif ML presente');

    // -------------------------------------------------------------
    // TEST 11: Modal de Desglose Matemático por Ítem ("📐 Ver Desglose & Fórmula")
    // -------------------------------------------------------------
    const callResult = await page.evaluate(() => {
      try {
        const rows = document.querySelectorAll('#tbodyDetalleConciliacion1a1 tr');
        const btns = document.querySelectorAll('.btn-drilldown-calc');
        const fnExists = typeof window.abrirModalCalculoLinea === 'function' || typeof abrirModalCalculoLinea === 'function';
        
        // Ejecutar apertura
        if (typeof abrirModalCalculoLinea === 'function') {
          abrirModalCalculoLinea(1);
        } else if (btns.length > 0) {
          btns[0].click();
        }

        const m = document.getElementById('modalDetalleCalculoLinea');
        const isAct = m && m.classList.contains('active');
        const formulaTxt = document.getElementById('calcFormulaExplicacion')?.textContent || '';
        return { ok: true, rowsCount: rows.length, btnsCount: btns.length, fnExists, isAct, formulaTxt };
      } catch (err) {
        return { ok: false, err: err.message, stack: err.stack };
      }
    });

    console.log('    [DEBUG TEST-11] callResult:', callResult);
    const test11Pass = callResult.isAct && (callResult.formulaTxt.includes('CORROBORACIÓN') || callResult.formulaTxt.includes('Corroboración') || callResult.formulaTxt.includes('DEMOSTRACIÓN'));
    record('TEST-11', 'Modal de Desglose Matemático y Corroboración SKU a SKU', test11Pass, `Demostración paso a paso visualizada (isAct: ${callResult.isAct})`);

    // Cerrar modal
    await page.evaluate(() => {
      const m = document.getElementById('modalDetalleCalculoLinea');
      if (m) m.classList.remove('active');
    });
    await sleep(300);

    // -------------------------------------------------------------
    // TEST 12: Verificación de Eliminación de Botones Obsoletos
    // -------------------------------------------------------------
    const botonesEliminados = await page.evaluate(() => {
      const btnJev = document.getElementById('btnGenerarJevPaso3');
      const btnCorreo = document.getElementById('btnBannerVerCarpetaCorreo');
      const btnReclamo = document.getElementById('btnCopiarResumenPortapapeles');
      const btnBitacora = document.getElementById('btnEnviarCasoSheet');
      return !btnJev && !btnCorreo && !btnReclamo && !btnBitacora;
    });
    record('TEST-12', 'Eliminación de botones obsoletos (JEV, Correo, Reclamo, Bitácora)', botonesEliminados, 'Botones removidos satisfactoriamente de la interfaz');

    // Captura final de evidencia
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_full_suite_dif_ml_paso3.png'), fullPage: true });

    console.log('\n================================================================');
    console.log('📊 RESUMEN FINAL DE LA SUITE COMPLETA');
    console.log('================================================================');
    const totalPassed = testResults.filter(t => t.passed).length;
    console.log(`Total Casos de Prueba : ${testResults.length}`);
    console.log(`✅ Aprobados          : ${totalPassed}`);
    console.log(`❌ Fallidos           : ${testResults.length - totalPassed}`);
    console.log(`⚠️ Errores en Consola : ${consoleErrors.length}`);
    console.log('================================================================\n');

    if (totalPassed < testResults.length) {
      throw new Error('Al menos una prueba falló en la suite.');
    }

  } finally {
    await browser.close();
    server.close();
  }
}

runFullSuite().catch(err => {
  console.error('\n❌ ERROR FATAL EN EJECUCIÓN DE PRUEBAS:', err);
  process.exit(1);
});
