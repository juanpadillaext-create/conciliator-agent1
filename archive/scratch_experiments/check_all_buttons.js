const puppeteer = require('puppeteer-core');
const { createServer } = require('./tests/puppeteer/test_server.js');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function checkAllButtons() {
  const server = createServer();
  await new Promise((resolve) => server.listen(3100, resolve));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ type: 'console.error', text: msg.text() });
  });
  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message });
  });

  await page.goto('http://localhost:3100', { waitUntil: 'networkidle0' });

  // Get all buttons on page
  const buttons = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button, .wizard-step, .nav-view-btn'));
    return allBtns.map(b => ({
      id: b.id,
      text: (b.innerText || b.textContent || '').trim().slice(0, 30),
      className: b.className,
      hasOnclick: !!b.getAttribute('onclick'),
      onclickAttr: b.getAttribute('onclick')
    }));
  });

  console.log(`Found ${buttons.length} buttons/clickable elements`);

  for (const b of buttons) {
    if (!b.id && !b.hasOnclick) continue;
    const selector = b.id ? `#${b.id}` : `[onclick="${b.onclickAttr}"]`;
    try {
      // Clear errors before click
      const currentErrorsCount = errors.length;
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el && window.getComputedStyle(el).display !== 'none') {
          el.click();
        }
      }, selector);
      await new Promise(r => setTimeout(r, 100));
      if (errors.length > currentErrorsCount) {
        console.log(`❌ ERROR clicking ${b.id || b.onclickAttr}:`, errors.slice(currentErrorsCount));
      } else {
        // console.log(`✅ OK: ${b.id || b.onclickAttr}`);
      }
    } catch (e) {
      console.log(`❌ EXCEPTION clicking ${selector}:`, e.message);
    }
  }

  console.log('\nTotal errors collected:', errors);
  await browser.close();
  server.close();
}

checkAllButtons().catch(console.error);
