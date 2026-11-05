/**
 * tests/puppeteer/test_all_buttons.js
 * Smoke test: hace clic en TODOS los botones / elementos con handler inline y reporta
 * excepciones JS no capturadas (pageerror), para detectar botones "muertos".
 */
const puppeteer = require('puppeteer-core');
const { createServer } = require('./test_server.js');

const PORT = 3061;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Acciones destructivas / que abren pestañas o descargas: se omiten del clic automático
const SKIP = /window\.open|location\.|download|descargar/i;

(async () => {
  const server = createServer();
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
    defaultViewport: { width: 1440, height: 900 }, args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  let current = '(carga inicial)';
  page.on('pageerror', e => errors.push({ ctx: current, msg: e.message }));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.evaluateOnNewDocument(() => {
    window.open = () => null;
    window.confirm = () => true;
    window.prompt = () => '';
    window.alert = () => {};
  });

  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });
  await sleep(800);

  // Inventario de elementos clicables con handler inline
  const targets = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[onclick], button, [data-action]').forEach((el, i) => {
      const id = el.id || '';
      const oc = el.getAttribute('onclick') || '';
      out.push({ i, id, oc, text: (el.innerText || el.value || '').trim().slice(0, 40), tag: el.tagName });
    });
    return out;
  });
  console.log(`Elementos clicables detectados: ${targets.length}`);

  let clicked = 0, noHandler = [];
  for (const t of targets) {
    if (SKIP.test(t.oc)) continue;
    current = `${t.tag}#${t.id || t.i} "${t.text}" onclick="${t.oc.slice(0, 70)}"`;
    const result = await page.evaluate((idx) => {
      const el = document.querySelectorAll('[onclick], button, [data-action]')[idx];
      if (!el) return 'gone';
      const hasInline = !!el.getAttribute('onclick');
      el.click();
      return hasInline ? 'inline' : 'other';
    }, t.i);
    clicked++;
    if (result === 'other' && !t.id) noHandler.push(current);
    await sleep(60);
  }
  await sleep(1500);

  console.log(`\nClics ejecutados: ${clicked}`);
  if (!errors.length) {
    console.log('✅ Ningún botón produjo excepciones JS');
  } else {
    const uniq = new Map();
    errors.forEach(e => { const k = e.msg + ' @ ' + e.ctx; uniq.set(k, (uniq.get(k) || 0) + 1); });
    console.log(`❌ ${uniq.size} errores únicos:`);
    for (const [k, n] of uniq) console.log(`  - [x${n}] ${k}`);
  }
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
