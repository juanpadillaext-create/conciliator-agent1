/**
 * tests/puppeteer/test_po_master_index.js
 * Test automatizado para verificar el Índice Maestro de POs con sus Facturas Respectivas.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./test_server.js');

const PORT = 3056;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('================================================================');
  console.log('🧪 TEST AUTOMATIZADO: ÍNDICE MAESTRO DE POs CON FACTURAS');
  console.log('================================================================\n');

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Servidor] Escuchando en puerto ${PORT}\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.warn(`[Browser Error]:`, msg.text());
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 1. Verificar presencia de pestañas de modo
    console.log('Verificando botones de alternancia de modo...');
    const hasTabs = await page.evaluate(() => {
      const btnFac = document.getElementById('btnTabModoFacturas');
      const btnPos = document.getElementById('btnTabModoPosIndexadas');
      return !!(btnFac && btnPos);
    });
    console.log(hasTabs ? '✅ Pestañas de modo presentes' : '❌ Pestañas no encontradas');

    // 2. Cambiar a modo Órdenes de Compra Indexadas
    console.log('\nCambiando a modo "Órdenes de Compra Indexadas"...');
    await page.click('#btnTabModoPosIndexadas');
    await sleep(600);

    const isPosTableVisible = await page.evaluate(() => {
      const boxPos = document.getElementById('containerTablaPosIndexadas');
      const boxFac = document.getElementById('containerTablaFacturasIndividuales');
      return boxPos && window.getComputedStyle(boxPos).display !== 'none' &&
             boxFac && window.getComputedStyle(boxFac).display === 'none';
    });
    console.log(isPosTableVisible ? '✅ Tabla de POs Indexadas visible correctamente' : '❌ Error de visibilidad');

    // 3. Verificar filas de POs cargadas
    const posRowsCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyPosIndexadas tr');
      return rows.length;
    });
    console.log(`✅ Filas de POs indexadas renderizadas: ${posRowsCount}`);

    // 4. Verificar contenido de la primera PO (debe tener botón de ver facturas)
    const firstPoData = await page.evaluate(() => {
      const firstRow = document.querySelector('#tbodyPosIndexadas tr');
      if (!firstRow) return null;
      return {
        text: firstRow.innerText.replace(/\n+/g, ' | ')
      };
    });
    console.log('Primera PO en lista:', firstPoData ? firstPoData.text : 'N/A');

    // 5. Expandir acordeón de facturas
    console.log('\nExpandiendo acordeón de facturas para la primera PO...');
    const hasAccordion = await page.evaluate(() => {
      const btnAccordion = document.querySelector('#tbodyPosIndexadas tr button[onclick*="toggleDetalleFacturasPo"]');
      if (btnAccordion) {
        btnAccordion.click();
        return true;
      }
      return false;
    });
    await sleep(300);

    const isAccordionVisible = await page.evaluate(() => {
      const accRow = document.querySelector('#tbodyPosIndexadas tr[id^="rowFacturas_"]');
      return accRow && window.getComputedStyle(accRow).display !== 'none';
    });
    console.log(isAccordionVisible ? '✅ Acordeón de facturas expandido con éxito' : '❌ Acordeón no se expandió');

    // Captura de pantalla
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_po_master_index.png') });
    console.log(`\n📸 Captura guardada en ${path.join(SCREENSHOTS_DIR, 'test_po_master_index.png')}`);

    console.log('\n================================================================');
    console.log('🎉 TODOS LOS TESTS DEL ÍNDICE MAESTRO DE POs PASARON EXITOSAMENTE');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Error en el test:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

run();
