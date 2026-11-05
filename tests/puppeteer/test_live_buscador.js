// tests/puppeteer/test_live_buscador.js
// Verifica que el buscador en vivo en Google Apps Script responda correctamente
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIVE_URL = 'https://script.google.com/macros/s/AKfycbyOmvY0AzF6jKDdQutzQgidq2oXVWoMzhL2j2CJW1riVmdraeT9DzFfxtBldO6cszbMIg/exec';

async function testLive() {
  console.log('Iniciando prueba en vivo contra:', LIVE_URL);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    console.log('Navegando a la URL en vivo...');
    await page.goto(LIVE_URL, { waitUntil: 'networkidle2', timeout: 45000 });

    // Esperar a que el buscador exista
    await page.waitForSelector('#txtBuscarFactura', { timeout: 30000 });
    console.log('✅ Buscador #txtBuscarFactura encontrado en la página en vivo');

    // Tomar captura inicial
    await page.screenshot({ path: 'tests/puppeteer/screenshots/live_inicial.png' });

    // Probar búsqueda de PO 521534
    console.log('Escribiendo "PO521534" en el buscador...');
    await page.focus('#txtBuscarFactura');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('PO521534');
    await page.keyboard.press('Enter');

    console.log('Esperando respuesta...');
    // Esperar que la tarjeta de vínculo o las filas aparezcan
    await page.waitForFunction(() => {
      const card = document.getElementById('cardVinculoPoFacturas');
      const tbody = document.getElementById('tbodyFacturasPaso1');
      const isCardVisible = card && card.style.display !== 'none';
      const hasRows = tbody && tbody.querySelectorAll('tr').length > 0 && !tbody.innerText.includes('Consultando en vivo');
      return isCardVisible || hasRows;
    }, { timeout: 35000 });

    const cardText = await page.evaluate(() => {
      const card = document.getElementById('cardVinculoPoFacturas');
      const tbody = document.getElementById('tbodyFacturasPaso1');
      return {
        cardDisplay: card ? card.style.display : 'none',
        cardText: card ? card.innerText : '',
        rowCount: tbody ? tbody.querySelectorAll('tr').length : 0,
        firstRowText: tbody && tbody.querySelector('tr') ? tbody.querySelector('tr').innerText.slice(0, 100) : ''
      };
    });

    console.log('✅ Resultado de búsqueda en vivo para PO521534:', cardText);
    await page.screenshot({ path: 'tests/puppeteer/screenshots/live_po521534_result.png' });

    // Probar búsqueda por folio 105275609
    console.log('Escribiendo folio "105275609"...');
    await page.focus('#txtBuscarFactura');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('105275609');
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => {
      const tbody = document.getElementById('tbodyFacturasPaso1');
      return tbody && tbody.querySelectorAll('tr').length > 0 && !tbody.innerText.includes('Consultando en vivo');
    }, { timeout: 35000 });

    const folioRes = await page.evaluate(() => {
      const tbody = document.getElementById('tbodyFacturasPaso1');
      return {
        rowCount: tbody ? tbody.querySelectorAll('tr').length : 0,
        firstRowText: tbody && tbody.querySelector('tr') ? tbody.querySelector('tr').innerText.slice(0, 120) : ''
      };
    });
    console.log('✅ Resultado de búsqueda en vivo para Folio 105275609:', folioRes);
    await page.screenshot({ path: 'tests/puppeteer/screenshots/live_folio_result.png' });

    console.log('🎉 PRUEBA EN VIVO EXITOSA');
  } catch (err) {
    console.error('❌ Error en prueba en vivo:', err.message);
    await page.screenshot({ path: 'tests/puppeteer/screenshots/live_error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
}

testLive();
