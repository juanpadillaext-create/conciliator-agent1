const puppeteer = require('puppeteer-core');
const { createServer } = require('./test_server.js');

const PORT = 3060;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Page Error]:', err));

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    console.log('--- Initial State ---');
    const initialRows = await page.evaluate(() => document.querySelectorAll('#tbodyFacturasPaso1 tr').length);
    console.log('Initial Facturas rows:', initialRows);

    console.log('\n--- Typing 521049 ---');
    await page.type('#txtBuscarFactura', '521049');
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n--- Clicking Buscar Button ---');
    await page.click('#btnEjecutarBusquedaFacturas');
    await new Promise(r => setTimeout(r, 2000));

    const stateAfterSearch = await page.evaluate(() => {
      const tbody = document.getElementById('tbodyFacturasPaso1');
      const lbl = document.getElementById('lblConteoFacturasPaso1');
      return {
        rowCount: tbody ? tbody.querySelectorAll('tr').length : -1,
        bodyHtml: tbody ? tbody.innerHTML.trim() : '',
        lblText: lbl ? lbl.innerText : ''
      };
    });

    console.log('After Search:');
    console.log('Row count:', stateAfterSearch.rowCount);
    console.log('Label:', stateAfterSearch.lblText);
    console.log('Body HTML:\n', stateAfterSearch.bodyHtml);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
}

run();
