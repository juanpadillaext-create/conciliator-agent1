const puppeteer = require('puppeteer-core');
const { createServer } = require('./tests/puppeteer/test_server.js');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function diagnose() {
  const server = createServer();
  await new Promise(r => server.listen(3101, r));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  const allLogs = [];
  page.on('console', msg => {
    allLogs.push({ type: msg.type(), text: msg.text() });
  });

  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message + '\n' + (err.stack || ''));
  });

  await page.goto('http://localhost:3101', { waitUntil: 'networkidle0' });

  // 1. Check if application booted
  const bootStatus = await page.evaluate(() => {
    return {
      isAppBooted: typeof isAppBooted !== 'undefined' ? isAppBooted : 'not defined',
      hasInitWizardFlow: typeof initWizardFlow === 'function',
      hasRenderTablaFacturasPaso1: typeof renderTablaFacturasPaso1 === 'function',
      wizardFacturasFiltradasLength: typeof wizardFacturasFiltradas !== 'undefined' ? wizardFacturasFiltradas.length : 'not defined',
      tableRowsCount: document.querySelectorAll('#tbodyFacturasPaso1 tr').length,
      currentStep: typeof wizardCurrentStep !== 'undefined' ? wizardCurrentStep : 'not defined'
    };
  });

  console.log('=== APPLICATION BOOT STATUS ===');
  console.log(bootStatus);

  console.log('\n=== LOGS ON LOAD ===');
  console.log(allLogs);

  console.log('\n=== PAGE ERRORS ON LOAD ===');
  console.log(pageErrors);

  // 2. Check functions on window
  const fnsOnWindow = await page.evaluate(() => {
    const list = [
      'cambiarVistaPrincipal',
      'irAPasoWizard',
      'cambiarTabPreviaPaso2',
      'cambiarPestanaTopDashboard',
      'aplicarChipProveedorTop',
      'cerrarModalDetalleFacturaPaso1',
      'switchModoPaso1',
      'toggleDetalleFacturasPo',
      'seleccionarPoParaCruceConsolidado',
      'conciliarFacturaIndividualDesdePo',
      'conciliarOcDirectaDesdeCard',
      'promptAsociarFolio',
      'buscarFacturaEnVivoPaso1',
      'restaurarCatalogoInicialPaso1',
      'verDetalleFacturaPaso1',
      'seleccionarFacturaPorIndice',
      'abrirModalReasignarSku',
      'abrirModalCalculoLinea',
      'auditarPoDesdeDashboard',
      'auditarFacturaDesdeDashboard',
      'ejecutarBusquedaPaso1',
      'cargarDemoCarozzi',
      'cargarDemoNestle',
      'ejecutarCruceWizard'
    ];
    const out = {};
    for (const f of list) {
      out[f] = typeof window[f];
    }
    return out;
  });

  console.log('\n=== FUNCTIONS ON WINDOW ===');
  console.log(fnsOnWindow);

  await browser.close();
  server.close();
}

diagnose().catch(console.error);
