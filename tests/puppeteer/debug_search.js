const puppeteer = require('puppeteer-core');
const { createServer } = require('./test_server.js');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const server = createServer();
  await new Promise(r => server.listen(3065, r));
  console.log('Server started on 3065');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', err => consoleLogs.push('PAGE_ERROR: ' + err.message));

  await page.goto('http://localhost:3065', { waitUntil: 'networkidle0' });
  console.log('Page loaded. Console logs:');
  consoleLogs.forEach(l => console.log('  ', l));

  // Check if txtBuscarFactura exists
  const inp = await page.$('#txtBuscarFactura');
  console.log('Input exists:', !!inp);

  // Type '517979'
  await page.type('#txtBuscarFactura', '517979');
  await new Promise(r => setTimeout(r, 1000));

  let tableInfo = await page.evaluate(() => {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    const banner = document.getElementById('cardVinculoPoFacturas');
    return {
      text: tbody ? tbody.textContent.trim().slice(0, 200) : null,
      rows: tbody ? tbody.querySelectorAll('tr').length : 0,
      bannerDisplay: banner ? banner.style.display : null
    };
  });
  console.log('After typing 517979:', tableInfo);

  // Press Enter
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 1500));

  tableInfo = await page.evaluate(() => {
    const tbody = document.getElementById('tbodyFacturasPaso1');
    const banner = document.getElementById('cardVinculoPoFacturas');
    return {
      text: tbody ? tbody.textContent.trim().slice(0, 200) : null,
      rows: tbody ? tbody.querySelectorAll('tr').length : 0,
      bannerDisplay: banner ? banner.style.display : null
    };
  });
  console.log('After Enter:', tableInfo);

  // Now test other search queries:
  const queries = ['PO517979', '284719', 'Carozzi', 'PO521534', 'Coca-Cola', 'xyz_no_match'];
  for (const q of queries) {
    console.log(`\nTesting search for "${q}"...`);
    await page.evaluate(() => {
      const el = document.getElementById('txtBuscarFactura');
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 200));
    await page.type('#txtBuscarFactura', q);
    await new Promise(r => setTimeout(r, 800));
    const res = await page.evaluate(() => {
      const tbody = document.getElementById('tbodyFacturasPaso1');
      const rows = tbody ? tbody.querySelectorAll('tr') : [];
      return {
        rowsCount: rows.length,
        firstRow: rows[0] ? rows[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 100) : 'none'
      };
    });
    console.log(`Result for "${q}":`, res);
  }

  console.log('\nFinal console errors:');
  consoleLogs.filter(l => l.includes('Error') || l.includes('error') || l.includes('WARN') || l.includes('warn')).forEach(l => console.log('  ', l));

  await browser.close();
  server.close();
})();
