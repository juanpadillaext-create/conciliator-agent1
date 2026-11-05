const puppeteer = require('puppeteer-core');
const { createServer } = require('./test_server.js');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const server = createServer();
  await new Promise(r => server.listen(3066, r));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3066', { waitUntil: 'networkidle0' });

  // Test 1: Typing 'Carozzi'
  console.log('--- Test 1: Carozzi ---');
  await page.type('#txtBuscarFactura', 'Carozzi');
  // Check after 200ms (local filter)
  await new Promise(r => setTimeout(r, 200));
  let state = await page.evaluate(() => {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    return {
      text: tbody ? tbody.textContent.trim().slice(0, 150) : '',
      rows: tbody ? tbody.querySelectorAll('tr').length : 0
    };
  });
  console.log('200ms after typing Carozzi:', state);

  // Check after 1200ms (after debounce server query)
  await new Promise(r => setTimeout(r, 1200));
  state = await page.evaluate(() => {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    return {
      text: tbody ? tbody.textContent.trim().slice(0, 150) : '',
      rows: tbody ? tbody.querySelectorAll('tr').length : 0
    };
  });
  console.log('1200ms after typing Carozzi:', state);

  // Clear input
  await page.evaluate(() => {
    const inp = document.getElementById('txtBuscarFactura');
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 500));

  // Test 2: Typing '284719'
  console.log('\n--- Test 2: 284719 ---');
  await page.type('#txtBuscarFactura', '284719');
  await new Promise(r => setTimeout(r, 200));
  state = await page.evaluate(() => {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    return {
      text: tbody ? tbody.textContent.trim().slice(0, 150) : '',
      rows: tbody ? tbody.querySelectorAll('tr').length : 0
    };
  });
  console.log('200ms after typing 284719:', state);

  await new Promise(r => setTimeout(r, 1200));
  state = await page.evaluate(() => {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    return {
      text: tbody ? tbody.textContent.trim().slice(0, 150) : '',
      rows: tbody ? tbody.querySelectorAll('tr').length : 0
    };
  });
  console.log('1200ms after typing 284719:', state);

  await browser.close();
  server.close();
})();
