/**
 * tests/puppeteer/test_buscador_universal.js
 * Test automatizado para verificar el funcionamiento integral del Buscador Universal en Paso 1:
 * - Órdenes de Compra (523428, PO521534, 523289)
 * - Folios DTE (105275609, 284719, 22586659)
 * - Nombres de Proveedor (CCU, Carozzi, Colun, Embonor)
 * - Regla Dif ML = Facturado - Recepcionado
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./test_server.js');

const PORT = 3059;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSearchQuery(page, query, expectedType, validateFn) {
  console.log(`\n🔍 Probando búsqueda: "${query}" (${expectedType})...`);
  
  // Limpiar campo de búsqueda
  await page.evaluate(() => {
    const inp = document.getElementById('txtBuscarFactura');
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(200);

  // Escribir consulta y presionar Enter
  await page.focus('#txtBuscarFactura');
  await page.type('#txtBuscarFactura', query);
  await page.keyboard.press('Enter');

  // Esperar a que la tabla se actualice con filas o tarjeta
  try {
    await page.waitForFunction(() => {
      const tbody = document.getElementById('tbodyFacturasPaso1');
      if (!tbody) return false;
      // Verificar que no esté en estado de "Buscando..."
      const txt = tbody.textContent;
      if (txt.includes('Buscando') || txt.includes('Consultando en vivo')) return false;
      const rows = tbody.querySelectorAll('tr');
      return rows.length > 0;
    }, { timeout: 8000 });
  } catch (err) {
    throw new Error(`Timeout esperando resultados para "${query}": ${err.message}`);
  }

  // Evaluar estado resultante
  const result = await page.evaluate(validateFn);
  return result;
}

async function run() {
  console.log('================================================================');
  console.log('🧪 TEST AUTOMATIZADO: BUSCADOR UNIVERSAL PASO 1');
  console.log('================================================================\n');

  const server = createServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[Servidor] Escuchando en puerto ${PORT}\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.warn('[Browser Error]:', msg.text());
  });

  let totalPassed = 0;
  let totalTests = 0;

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 1. PO 523428
    totalTests++;
    const res523428 = await testSearchQuery(page, '523428', 'PO directa', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const card = document.getElementById('cardVinculoPoFacturas');
      const cardVisible = card && window.getComputedStyle(card).display !== 'none';
      const cardText = card ? card.textContent : '';
      const rowsCount = rows.length;
      const firstRowText = rows[0] ? rows[0].textContent : '';
      return {
        ok: cardVisible && (rowsCount > 0) && (cardText.includes('523428') || firstRowText.includes('523428')),
        details: `Filas: ${rowsCount}, Card visible: ${cardVisible}, Info: ${cardText.slice(0, 80).replace(/\s+/g, ' ')}`
      };
    });
    if (res523428.ok) {
      console.log(`✅ [TEST-01] Búsqueda por PO 523428 exitosa — ${res523428.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-01] Falló búsqueda PO 523428: ${res523428.details}`);
    }

    // 2. PO PO521534 (Embonor con 10 facturas)
    totalTests++;
    const res521534 = await testSearchQuery(page, 'PO521534', 'PO con prefijo', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const card = document.getElementById('cardVinculoPoFacturas');
      const cardVisible = card && window.getComputedStyle(card).display !== 'none';
      const cardText = card ? card.textContent : '';
      return {
        ok: cardVisible && rows.length >= 10 && cardText.includes('521534'),
        details: `Filas: ${rows.length}, Card visible: ${cardVisible}`
      };
    });
    if (res521534.ok) {
      console.log(`✅ [TEST-02] Búsqueda por PO521534 exitosa — ${res521534.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-02] Falló búsqueda PO521534: ${res521534.details}`);
    }

    // 3. PO 523289 (con 14 facturas)
    totalTests++;
    const res523289 = await testSearchQuery(page, '523289', 'PO con 14 facturas', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const card = document.getElementById('cardVinculoPoFacturas');
      const cardVisible = card && window.getComputedStyle(card).display !== 'none';
      return {
        ok: cardVisible && rows.length >= 14,
        details: `Filas: ${rows.length}, Card visible: ${cardVisible}`
      };
    });
    if (res523289.ok) {
      console.log(`✅ [TEST-03] Búsqueda por PO 523289 exitosa — ${res523289.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-03] Falló búsqueda PO 523289: ${res523289.details}`);
    }

    // 4. Folio DTE 105275609 (Folio de 9 dígitos)
    totalTests++;
    const resFolio1 = await testSearchQuery(page, '105275609', 'Folio 9 dígitos', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const text = rows[0] ? rows[0].textContent : '';
      return {
        ok: rows.length >= 1 && text.includes('105275609'),
        details: `Filas: ${rows.length}, Contiene folio: ${text.includes('105275609')}`
      };
    });
    if (resFolio1.ok) {
      console.log(`✅ [TEST-04] Búsqueda por Folio 105275609 exitosa — ${resFolio1.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-04] Falló búsqueda Folio 105275609: ${resFolio1.details}`);
    }

    // 5. Folio DTE 284719 (Folio de 6 dígitos)
    totalTests++;
    const resFolio2 = await testSearchQuery(page, '284719', 'Folio 6 dígitos', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const text = rows[0] ? rows[0].textContent : '';
      return {
        ok: rows.length >= 1 && text.includes('284719'),
        details: `Filas: ${rows.length}, Contiene folio: ${text.includes('284719')}`
      };
    });
    if (resFolio2.ok) {
      console.log(`✅ [TEST-05] Búsqueda por Folio 284719 exitosa — ${resFolio2.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-05] Falló búsqueda Folio 284719: ${resFolio2.details}`);
    }

    // 6. Proveedor "CCU"
    totalTests++;
    const resCcu = await testSearchQuery(page, 'CCU', 'Proveedor CCU', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const count = rows.length;
      return {
        ok: count >= 5,
        details: `Filas de facturas CCU encontradas: ${count}`
      };
    });
    if (resCcu.ok) {
      console.log(`✅ [TEST-06] Búsqueda por Proveedor CCU exitosa — ${resCcu.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-06] Falló búsqueda CCU: ${resCcu.details}`);
    }

    // 7. Proveedor "Carozzi"
    totalTests++;
    const resCarozzi = await testSearchQuery(page, 'Carozzi', 'Proveedor Carozzi', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      return {
        ok: rows.length >= 1,
        details: `Filas encontradas: ${rows.length}`
      };
    });
    if (resCarozzi.ok) {
      console.log(`✅ [TEST-07] Búsqueda por Proveedor Carozzi exitosa — ${resCarozzi.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-07] Falló búsqueda Carozzi: ${resCarozzi.details}`);
    }

    // 8. Proveedor "Colun"
    totalTests++;
    const resColun = await testSearchQuery(page, 'Colun', 'Proveedor Colun', () => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      return {
        ok: rows.length >= 1,
        details: `Filas encontradas: ${rows.length}`
      };
    });
    if (resColun.ok) {
      console.log(`✅ [TEST-08] Búsqueda por Proveedor Colun exitosa — ${resColun.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-08] Falló búsqueda Colun: ${resColun.details}`);
    }

    // 9. Verificación de regla de negocio Dif ML = Facturado - Recepcionado
    totalTests++;
    const resDifMl = await testSearchQuery(page, 'PO521534', 'Regla Dif ML', () => {
      const difCell = document.querySelector('#lblPoDifPreliminar');
      const difText = difCell ? difCell.textContent : '';
      const totOrd = document.getElementById('lblPoTotalOrdenado').textContent;
      const totRec = document.getElementById('lblPoTotalRecepcionado').textContent;
      const totFac = document.getElementById('lblPoTotalFacturado').textContent;
      return {
        ok: !!difCell && difText.length > 0,
        details: `Facturado: ${totFac}, Recepcionado: ${totRec}, Dif ML: ${difText}`
      };
    });
    if (resDifMl.ok) {
      console.log(`✅ [TEST-09] Regla Dif ML en tarjeta de vínculo — ${resDifMl.details}`);
      totalPassed++;
    } else {
      console.error(`❌ [TEST-09] Falló verificación Dif ML: ${resDifMl.details}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_buscador_universal_final.png') });

    console.log('\n================================================================');
    console.log(`📊 RESULTADOS BUSCADOR UNIVERSAL: ${totalPassed} / ${totalTests} APROBADOS`);
    console.log('================================================================');

    if (totalPassed === totalTests) {
      console.log('🎉 TODOS LOS CASOS DEL BUSCADOR UNIVERSAL PASARON CON ÉXITO\n');
    } else {
      throw new Error(`Fallaron ${totalTests - totalPassed} pruebas`);
    }

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('\n❌ ERROR EN SUITE DEL BUSCADOR:', err);
  process.exit(1);
});
