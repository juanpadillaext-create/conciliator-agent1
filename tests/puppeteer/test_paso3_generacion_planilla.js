/**
 * tests/puppeteer/test_paso3_generacion_planilla.js
 * Test E2E de Paso 3: Generación de la planilla oficial de conciliación y descalces
 * para reclamo al proveedor (Google Sheets + Excel 17 Columnas).
 */
const puppeteer = require('puppeteer-core');
const { createServer } = require('./test_server.js');

const PORT = 3069;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runPaso3Test() {
  console.log('=== INICIANDO TEST E2E: PASO 3 Y GENERACIÓN DE PLANILLA CON DESCALCES ===\n');

  const server = createServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[Test Server] Servidor local escuchando en ${BASE_URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('❌ [Page Error]:', err.message);
    pageErrors.push(err.message);
  });
  await page.evaluateOnNewDocument(() => {
    window.open = () => null;
    window.confirm = () => true;
    window.prompt = () => '';
    window.alert = () => {};
  });

  try {
    console.log('1. Navegando a la WebApp...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await sleep(600);

    // Buscar PO519527 que contiene facturas y descalces
    console.log('2. Buscando PO519527 en Paso 1...');
    await page.focus('#txtBuscarFactura');
    await page.type('#txtBuscarFactura', 'PO519527');
    await page.click('#btnEjecutarBusquedaFacturas');
    await sleep(700);

    // Seleccionar la factura y pasar a Paso 2
    console.log('3. Seleccionando factura y pasando a Paso 2...');
    const btnCruceFactura = await page.$('#tbodyFacturasPaso1 tr button:last-child');
    if (!btnCruceFactura) {
      throw new Error('No se encontró el botón para cruzar factura en la tabla');
    }
    await btnCruceFactura.click();
    await sleep(600);

    // Verificar Paso 2
    const p2Visible = await page.evaluate(() => {
      const p2 = document.getElementById('panePaso2');
      return p2 && window.getComputedStyle(p2).display !== 'none';
    });
    console.log('  Paso 2 visible:', p2Visible ? '✅' : '❌');
    if (!p2Visible) throw new Error('El Paso 2 no se hizo visible');

    // Pasar a Paso 3 (Ejecutar cruce)
    console.log('4. Ejecutando Cruce hacia Paso 3...');
    await page.click('#btnIrACrucePaso3');
    await sleep(1000);

    // Validar visualización y KPIs de Paso 3
    console.log('5. Validando KPIs y tabla de diferencias en Paso 3...');
    const p3Info = await page.evaluate(() => {
      const p3 = document.getElementById('panePaso3');
      const isVisible = p3 && window.getComputedStyle(p3).display !== 'none';
      const totReclamo = document.getElementById('lblMontoReclamarTotal')?.textContent || '$0';
      const veredicto = document.getElementById('lblVeredictoTitulo')?.textContent || '';
      const bannerPlanilla = document.getElementById('boxPlanillaProveedorPaso3');
      const bannerVisible = bannerPlanilla && window.getComputedStyle(bannerPlanilla).display !== 'none';
      const provBanner = document.getElementById('lblBannerProvNombre')?.textContent || '';
      const poBanner = document.getElementById('lblBannerPoNumber')?.textContent || '';
      const ncBanner = document.getElementById('lblBannerMontoNc')?.textContent || '';
      const totalLineas = document.querySelectorAll('#tbodyDetalleConciliacion1a1 tr').length;
      return { isVisible, totReclamo, veredicto, bannerVisible, provBanner, poBanner, ncBanner, totalLineas };
    });

    console.log('  Paso 3 Visible:                  ', p3Info.isVisible ? '✅' : '❌');
    console.log('  Veredicto:                       ', p3Info.veredicto);
    console.log('  Monto Total Reclamo NC:          ', p3Info.totReclamo);
    console.log('  Total Líneas Evaluadas:          ', p3Info.totalLineas);
    console.log('  Banner Planilla Proveedor:       ', p3Info.bannerVisible ? '✅' : '❌');
    console.log('  Proveedor en Banner:             ', p3Info.provBanner);
    console.log('  PO en Banner:                    ', p3Info.poBanner);
    console.log('  Reclamo NC en Banner:            ', p3Info.ncBanner);

    if (!p3Info.isVisible) throw new Error('El Paso 3 no se hizo visible tras ejecutar cruce');

    // 6. Probar Botón 1: Generar Planilla Google Sheets (#btnBannerGenerarPlanilla)
    console.log('\n6. Probando generación de Planilla Google Sheets (#btnBannerGenerarPlanilla)...');
    await page.click('#btnBannerGenerarPlanilla');
    await sleep(1000);

    // Verificar apertura del Modal Planilla Proveedor
    const modalInfo = await page.evaluate(() => {
      const modal = document.getElementById('modalPlanillaProveedor');
      const isVisible = modal && (modal.classList.contains('active') || window.getComputedStyle(modal).display !== 'none');
      const urlValue = document.getElementById('txtModalUrlPlanilla')?.value || '';
      const provModal = document.getElementById('modalPlanillaProvLabel')?.textContent || '';
      const poModal = document.getElementById('modalPlanillaPoLabel')?.textContent || '';
      const ncModal = document.getElementById('modalPlanillaNcLabel')?.textContent || '';
      return { isVisible, urlValue, provModal, poModal, ncModal };
    });

    console.log('  Modal Planilla Visible:          ', modalInfo.isVisible ? '✅' : '❌');
    console.log('  URL de la Planilla en Modal:     ', modalInfo.urlValue);
    console.log('  Proveedor en Modal:              ', modalInfo.provModal);
    console.log('  PO en Modal:                     ', modalInfo.poModal);
    console.log('  NC en Modal:                     ', modalInfo.ncModal);

    if (!modalInfo.isVisible) {
      throw new Error('El modal modalPlanillaProveedor no se activó');
    }
    if (!modalInfo.urlValue.includes('docs.google.com/spreadsheets')) {
      throw new Error('La URL generada no corresponde a Google Spreadsheets');
    }

    // Cerrar modal
    console.log('  Cerrando modal...');
    await page.evaluate(() => {
      const btnClose = document.getElementById('btnCerrarModalPlanillaProveedor');
      if (btnClose) btnClose.click();
    });
    await sleep(400);

    // 7. Probar Botón de Descargar Excel PO Completa (#btnBannerDescargarExcel) y Solo Descalces (#btnExportarSoloDescalcesExcel)
    console.log('\n7. Probando generación de Excel Client-Side PO Completa (#btnBannerDescargarExcel)...');
    
    // Interceptar la creación de descargas de Blob en el navegador
    await page.evaluate(() => {
      window._lastDownloadedBlob = null;
      window._lastDownloadedFilename = null;
      const originalCreate = URL.createObjectURL;
      URL.createObjectURL = function(blob) {
        window._lastDownloadedBlob = blob;
        return originalCreate.apply(this, arguments);
      };
      
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) {
          window._lastDownloadedFilename = this.download;
        }
        return originalClick.apply(this, arguments);
      };
    });

    // 7a. Click en "Descargar Excel PO Completa (.xlsx)"
    await page.evaluate(() => {
      const btn = document.getElementById('btnBannerDescargarExcel');
      if (btn) btn.click();
    });
    await sleep(1000);

    const downloadFullPoInfo = await page.evaluate(() => {
      const toast = document.querySelector('.toast, [class*="toast"]')?.textContent || '';
      return {
        filename: window._lastDownloadedFilename,
        hasBlob: !!window._lastDownloadedBlob,
        blobSize: window._lastDownloadedBlob ? window._lastDownloadedBlob.size : 0,
        toast
      };
    });

    console.log('  Archivo PO Completa Generado:    ', downloadFullPoInfo.filename ? '✅ ' + downloadFullPoInfo.filename : '❌');
    console.log('  Tamaño del Blob generado:        ', downloadFullPoInfo.blobSize, 'bytes');
    console.log('  Mensaje Toast:                   ', downloadFullPoInfo.toast.trim());

    if (!downloadFullPoInfo.filename || !downloadFullPoInfo.filename.endsWith('.xlsx')) {
      throw new Error('No se generó el archivo Excel (.xlsx) para la PO completa');
    }
    if (downloadFullPoInfo.blobSize === 0) {
      throw new Error('El archivo Excel generado está vacío (0 bytes)');
    }

    // 7b. Click en "Exportar Solo Descalces (.xlsx)"
    console.log('\n7b. Probando exportación de Solo Descalces NC en Excel (#btnExportarSoloDescalcesExcel)...');
    await page.evaluate(() => {
      const btnExp = document.getElementById('btnExportarSoloDescalcesExcel');
      if (btnExp) btnExp.click();
    });
    await sleep(1000);

    const downloadDescalcesInfo = await page.evaluate(() => {
      const toast = document.querySelector('.toast, [class*="toast"]')?.textContent || '';
      return {
        filename: window._lastDownloadedFilename,
        hasBlob: !!window._lastDownloadedBlob,
        blobSize: window._lastDownloadedBlob ? window._lastDownloadedBlob.size : 0,
        toast
      };
    });

    console.log('  Archivo Solo Descalces Generado: ', downloadDescalcesInfo.filename ? '✅ ' + downloadDescalcesInfo.filename : '❌');
    console.log('  Tamaño del Blob generado:        ', downloadDescalcesInfo.blobSize, 'bytes');

    if (!downloadDescalcesInfo.filename || !downloadDescalcesInfo.filename.includes('Solo Descalces')) {
      throw new Error('No se generó el archivo Excel específico para Solo Descalces');
    }

    // 8. Verificar que no hubo excepciones no controladas
    console.log('\n8. Resumen de errores en consola de navegador:');
    if (pageErrors.length > 0) {
      throw new Error(`Se detectaron ${pageErrors.length} errores no capturados: ${pageErrors.join(', ')}`);
    } else {
      console.log('  ✅ 0 excepciones JavaScript registradas.');
    }

    console.log('\n🏆 ¡TEST DE PASO 3 Y PLANILLA DE DESCALCES COMPLETADO CON ÉXITO AL 100%!');
  } finally {
    await browser.close();
    server.close();
  }
}

runPaso3Test().catch(err => {
  console.error('\n❌ ERROR EN EL TEST:', err.message);
  process.exit(1);
});
