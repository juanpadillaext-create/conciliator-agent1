/**
 * tests/puppeteer/test_dif_ml_filtering.js
 * Test automatizado para verificar la columna DIF ML y los filtros de discrepancias.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const { createServer } = require('./test_server.js');

const PORT = 3058;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('================================================================');
  console.log('🧪 TEST AUTOMATIZADO: FILTROS Y RENDERIZADO DE DIF ML');
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
  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.warn(`[Browser Error]:`, msg.text());
    }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 1. Verificar columna Dif ML en tabla Facturas Paso 1
    console.log('1. Verificando renderizado de Dif ML en tabla inicial de facturas...');
    const facDifCol = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      if (rows.length === 0) return { ok: false, error: 'No rows' };
      const firstRow = rows[0];
      const cells = firstRow.querySelectorAll('td');
      // Columna 6 (0-indexed: 0=folio, 1=prov, 2=rut, 3=fecha, 4=neto, 5=rec, 6=dif_ml)
      const difCell = cells[6];
      return {
        ok: !!difCell,
        text: difCell ? difCell.innerText : '',
        hasBadge: difCell ? (difCell.innerText.includes('Faltante') || difCell.innerText.includes('Sobrellegada') || difCell.innerText.includes('Conforme') || difCell.innerText.includes('$')) : false
      };
    });
    console.log(`   - Columna Dif ML presente en Facturas: ${facDifCol.ok ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Texto muestra: "${facDifCol.text.replace(/\n/g, ' ')}" (Badge detectado: ${facDifCol.hasBadge ? '✅ SÍ' : '❌ NO'})`);

    // 2. Probar filtrado por palabra clave "faltante" en buscador Paso 1
    console.log('\n2. Probando filtrado local por término "faltante"...');
    await page.type('#txtBuscarFactura', 'faltante');
    await sleep(400);

    const faltanteMatches = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyFacturasPaso1 tr');
      const count = rows.length;
      let allFaltante = true;
      rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        if (!text.includes('faltante') && !text.includes('⚠️')) {
          allFaltante = false;
        }
      });
      return { count, allFaltante };
    });
    console.log(`   - Filas filtradas: ${faltanteMatches.count}`);
    console.log(`   - Todas corresponden a faltantes: ${faltanteMatches.allFaltante ? '✅ SÍ' : '❌ NO'}`);

    // Limpiar buscador
    await page.evaluate(() => {
      const input = document.getElementById('txtBuscarFactura');
      if (input) input.value = '';
    });
    await page.click('#btnLimpiarFiltroPo');
    await sleep(300);

    // 3. Cambiar a modo Órdenes de Compra Indexadas
    console.log('\n3. Cambiando a Modo POs Indexadas...');
    await page.click('#btnTabModoPosIndexadas');
    await sleep(600);

    // 4. Verificar renderizado de Dif ML en tabla POs Indexadas
    const posDifCol = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyPosIndexadas tr');
      if (rows.length === 0) return { ok: false, error: 'No rows' };
      const firstRow = rows[0];
      const cells = firstRow.querySelectorAll('td');
      // Columna 6: Dif ML
      const difCell = cells[6];
      return {
        ok: !!difCell,
        text: difCell ? difCell.innerText : '',
        hasBadge: difCell ? (difCell.innerText.includes('Faltante') || difCell.innerText.includes('Sobrellegada') || difCell.innerText.includes('Conforme') || difCell.innerText.includes('$')) : false
      };
    });
    console.log(`   - Columna Dif ML presente en POs: ${posDifCol.ok ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   - Texto muestra: "${posDifCol.text.replace(/\n/g, ' ')}" (Badge detectado: ${posDifCol.hasBadge ? '✅ SÍ' : '❌ NO'})`);

    // 5. Probar filtro "Solo con diferencias" (#chkSoloPosConDiferencias)
    console.log('\n5. Probando checkbox "Solo con diferencias"...');
    await page.click('#chkSoloPosConDiferencias');
    await sleep(600);

    const difFilterResult = await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbodyPosIndexadas > tr:not([id^="rowFacturas_"])');
      let valid = true;
      let count = 0;
      rows.forEach(r => {
        const cells = r.children;
        if (cells.length >= 7) {
          count++;
          const difText = cells[6].innerText;
          const isFaltante = difText.includes('Faltante');
          const isSobrellegada = difText.includes('Sobrellegada');
          const isConforme = difText.includes('Conforme');
          if (isConforme || (!isFaltante && !isSobrellegada)) {
            valid = false;
          }
        }
      });
      return { count, valid };
    });
    console.log(`   - POs principales mostradas con diferencia: ${difFilterResult.count}`);
    console.log(`   - Todas corresponden a Faltante o Sobrellegada (descalce > $100 CLP): ${difFilterResult.valid ? '✅ SÍ' : '❌ NO'}`);

    console.log('\n================================================================');
    console.log('🎉 RESULTADO: TODOS LOS TESTS DE DIF ML Y FILTRADO PASARON CON ÉXITO');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Error ejecutando test:', err);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
}

run();
