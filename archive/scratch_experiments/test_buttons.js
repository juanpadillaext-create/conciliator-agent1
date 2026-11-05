const puppeteer = require('puppeteer-core');
const path = require('path');
const { createServer } = require('./tests/puppeteer/test_server.js');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testAllButtons() {
  const server = createServer();
  await new Promise((resolve) => server.listen(3099, resolve));

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

  await page.goto('http://localhost:3099', { waitUntil: 'networkidle0' });

  console.log('--- Initial Page Load ---');
  console.log('Errors on load:', errors);

  // Test 1: Click btnNavVistaDashboard
  console.log('\n--- Clicking btnNavVistaDashboard ---');
  await page.click('#btnNavVistaDashboard');
  await new Promise(r => setTimeout(r, 500));
  console.log('Errors after dashboard click:', errors);

  // Test 2: Click btnNavVistaWizard
  console.log('\n--- Clicking btnNavVistaWizard ---');
  await page.click('#btnNavVistaWizard');
  await new Promise(r => setTimeout(r, 500));
  console.log('Errors after wizard click:', errors);

  // Test 3: Click btnTabModoPosIndexadas
  console.log('\n--- Clicking btnTabModoPosIndexadas ---');
  await page.click('#btnTabModoPosIndexadas');
  await new Promise(r => setTimeout(r, 500));
  console.log('Errors after tab POs click:', errors);

  // Test 4: Click btnTabModoFacturas
  console.log('\n--- Clicking btnTabModoFacturas ---');
  await page.click('#btnTabModoFacturas');
  await new Promise(r => setTimeout(r, 500));
  console.log('Errors after tab Facturas click:', errors);

  // Test 5: Click first "Conciliar" button on table
  console.log('\n--- Clicking first Conciliar button in Paso 1 ---');
  const conciliarBtn = await page.$('#tbodyFacturasPaso1 tr button.btn-primary');
  if (conciliarBtn) {
    await conciliarBtn.click();
    await new Promise(r => setTimeout(r, 500));
  } else {
    console.log('No conciliar button found!');
  }
  console.log('Errors after conciliar click:', errors);

  // Test 6: Check what step is active now
  const stepActive = await page.evaluate(() => {
    const p1 = document.getElementById('panePaso1');
    const p2 = document.getElementById('panePaso2');
    const p3 = document.getElementById('panePaso3');
    return {
      p1: window.getComputedStyle(p1).display,
      p2: window.getComputedStyle(p2).display,
      p3: window.getComputedStyle(p3).display
    };
  });
  console.log('Step visibility after conciliar click:', stepActive);

  // Test 7: Click btnIrACrucePaso3
  console.log('\n--- Clicking btnIrACrucePaso3 ---');
  const btnCruce = await page.$('#btnIrACrucePaso3');
  if (btnCruce) {
    await btnCruce.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Errors after cruce click:', errors);

  const stepActive2 = await page.evaluate(() => {
    const p3 = document.getElementById('panePaso3');
    return { p3: window.getComputedStyle(p3).display };
  });
  console.log('Step 3 visibility:', stepActive2);

  await browser.close();
  server.close();
}

testAllButtons().catch(console.error);
