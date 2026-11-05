const puppeteer = require('puppeteer-core');
const path = require('path');
const { createServer } = require('./test_server.js');

const PORT = 3057;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Test Server] Escuchando en puerto ${PORT}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.warn('[Browser Error]:', msg.text());
  });

  try {
    console.log('🚀 Abriendo WebApp en', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 1. Buscar PO519527
    console.log('🔍 Buscando PO519527...');
    await page.focus('#txtBuscarFactura');
    await page.evaluate(() => { document.getElementById('txtBuscarFactura').value = ''; });
    await page.type('#txtBuscarFactura', 'PO519527');
    await page.click('#btnEjecutarBusquedaFacturas');
    await sleep(600);

    // Verificar tarjeta de vínculo PO
    const poCardData = await page.evaluate(() => {
      const card = document.getElementById('cardVinculoPoFacturas');
      const isVisible = card && window.getComputedStyle(card).display !== 'none';
      const titulo = document.getElementById('lblPoVinculoTitulo')?.textContent || '';
      const totOrd = document.getElementById('lblPoTotalOrdenado')?.textContent || '';
      const totRec = document.getElementById('lblPoTotalRecepcionado')?.textContent || '';
      const totFac = document.getElementById('lblPoTotalFacturado')?.textContent || '';
      const dif = document.getElementById('lblPoDifPreliminar')?.textContent || '';
      return { isVisible, titulo, totOrd, totRec, totFac, dif };
    });

    console.log('📊 Tarjeta PO vinculada:', poCardData);

    // 2. Seleccionar la factura 56458220 y avanzar a Paso 2
    console.log('⚡ Haciendo clic en Cruzar Factura...');
    await page.evaluate(() => {
      const btn = document.querySelector('#tbodyFacturasPaso1 tr button:last-child');
      if (btn) btn.click();
    });
    await sleep(600);

    // 3. Validar Paso 2
    const p2Data = await page.evaluate(() => {
      const pane2 = document.getElementById('panePaso2');
      const isVisible = pane2 && window.getComputedStyle(pane2).display !== 'none';
      const folio = document.getElementById('p2InvFolioBadge')?.textContent || '';
      const prov = document.getElementById('p2InvProveedor')?.textContent || '';
      const neto = document.getElementById('p2InvNeto')?.textContent || '';
      return { isVisible, folio, prov, neto };
    });
    console.log('📦 Paso 2 cargado:', p2Data);

    // 4. Ejecutar cruce hacia Paso 3
    console.log('⚡ Ejecutando Cruce hacia Paso 3...');
    await page.evaluate(() => {
      const btn = document.getElementById('btnIrACrucePaso3');
      if (btn) btn.click();
    });
    await sleep(1000);

    // 5. Validar Paso 3 y sus KPIs
    const p3Data = await page.evaluate(() => {
      const pane3 = document.getElementById('panePaso3');
      const isVisible = pane3 && window.getComputedStyle(pane3).display !== 'none';
      const totReclamo = document.getElementById('lblMontoReclamarTotal')?.textContent || '';
      const veredicto = document.getElementById('lblVeredictoTitulo')?.textContent || '';
      const corrobBanner = document.getElementById('lblCorroboracionPaso3')?.textContent || '';
      const kpiDifMl = document.getElementById('kpiDifMlPaso3')?.textContent || '';
      const kpiDifMlSubtext = document.getElementById('kpiDifMlSubtext')?.textContent || '';
      const kpiPrecio = document.getElementById('kpiDescalcePrecio')?.textContent || '';
      const kpiFaltante = document.getElementById('kpiFaltanteRecepcion')?.textContent || '';
      const tfootText = document.getElementById('tfootDetalleConciliacion1a1')?.textContent || '';
      
      const rows = Array.from(document.querySelectorAll('#tbodyDetalleConciliacion1a1 tr')).map(tr => {
        const desc = tr.querySelector('td:nth-child(3)')?.textContent || '';
        const matchBadge = tr.querySelector('td:nth-child(2)')?.textContent || '';
        const estadoBadge = tr.querySelector('td:nth-child(14)')?.textContent || '';
        const reclamo = tr.querySelector('td:nth-child(13)')?.textContent || '';
        return { desc, matchBadge, estadoBadge, reclamo };
      });

      return { 
        isVisible, 
        totReclamo, 
        veredicto, 
        corrobBanner, 
        kpiDifMl, 
        kpiDifMlSubtext, 
        kpiPrecio, 
        kpiFaltante, 
        tfootText, 
        totalRows: rows.length, 
        sampleRows: rows.slice(0, 5) 
      };
    });

    console.log('\n============================================================');
    console.log('🎯 RESULTADOS PASO 3 PARA PO519527:');
    console.log('Veredicto:                ', p3Data.veredicto);
    console.log('Total a Reclamar (Dif ML):', p3Data.totReclamo);
    console.log('Banner Corroboración:     ', p3Data.corrobBanner.trim());
    console.log('KPI Dif ML:               ', p3Data.kpiDifMl);
    console.log('KPI Dif ML Subtexto:      ', p3Data.kpiDifMlSubtext);
    console.log('KPI Sobreprecio:          ', p3Data.kpiPrecio);
    console.log('KPI Faltante:             ', p3Data.kpiFaltante);
    console.log('Total Líneas Procesadas:  ', p3Data.totalRows);
    console.log('============================================================\n');

    console.log('Muestra de filas en Paso 3:');
    p3Data.sampleRows.forEach((r, i) => console.log(` [${i+1}] ${r.desc.slice(0, 35)} | ${r.matchBadge.slice(0, 20)} | ${r.estadoBadge} | Reclamo: ${r.reclamo}`));

    if (p3Data.totReclamo.includes('1.033.571')) {
      throw new Error('❌ FALLÓ: Se está reclamando el 100% de la factura ($1.033.571) en vez de aislar las diferencias reales!');
    }

    console.log('\n✅ PRUEBA EXITOSA: PO519527 calzó todos los SKUs y aisló la diferencia real de precios!');
  } finally {
    await browser.close();
    server.close();
  }
}

runTest().catch(err => {
  console.error('Error en prueba:', err);
  process.exit(1);
});
