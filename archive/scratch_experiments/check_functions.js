const fs = require('fs');

const jsContent = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');

const functionsToCheck = [
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
  'ejecutarCruceWizard',
  'filtrarTablaPaso3',
  'exportarPlanillaFinanzasGoogleSheets',
  'exportarActaConciliacionCsv',
  'copiarResumenPortapapeles',
  'enviarCasoAGoogleSheets',
  'ejecutarJevAiAudit',
  'abrirModalJournalEntryVoucher',
  'abrirModalPlanillaProveedor',
  'cerrarModalPlanillaProveedor',
  'copiarUrlPlanillaProveedor',
  'copiarCorreoPlanillaProveedor',
  'cerrarModalJournalEntryVoucher',
  'copiarJevPortapapeles',
  'exportarJevCsvModal',
  'recalcularJevModal',
  'filtrarTopDashboard',
  'exportarTopCsvDashboard'
];

const results = {};
for (const fn of functionsToCheck) {
  const isGlobalAssign = jsContent.includes(`window.${fn} =`);
  const isFunctionDef = jsContent.includes(`function ${fn}`);
  results[fn] = {
    isFunctionDef,
    isGlobalAssign
  };
}

console.log(JSON.stringify(results, null, 2));
