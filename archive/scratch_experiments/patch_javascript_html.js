const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'apps-script-webapp', 'JavaScript.html');
let content = fs.readFileSync(targetFile, 'utf8');

const auditData = JSON.parse(fs.readFileSync(path.join(__dirname, 'po521534_audit_block.json'), 'utf8'));
const catalogoInicial = JSON.parse(fs.readFileSync(path.join(__dirname, 'po521534_catalogo_inicial.json'), 'utf8'));

// 1. Transaction control in Step 3
if (!content.includes('es521534')) {
  const targetTrans = "    const es521015 = poDigits === '521015' || poStr.includes('521015') || folioStr === '56500972' || folioStr === '56500937';";
  const replacementTrans = `    const es521534 = poDigits === '521534' || poStr.includes('521534') || ['105275609','105275608','105275606','105275605','105275603','105275602','105275607','105275604','105275601','105275600'].includes(folioStr);

    if (es521534) {
      box.style.display = 'block';
      if (badge) badge.textContent = 'PO521534 AUDITADA • CONTROL COCA-COLA EMBONOR S.A.';
      contenido.innerHTML = \`
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin-bottom:10px; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
          <div>📄 <strong>Facturas Vinculadas:</strong> <span class="font-mono" style="color:var(--accent-cyan); font-weight:700;">10 Facturas DTE (CL33)</span></div>
          <div>📑 <strong>Total Facturado Consolidado:</strong> <span class="font-mono" style="color:#60a5fa; font-weight:700;">$2.387.107 CLP</span> <span style="font-size:0.75rem; color:var(--text-muted);">($2.840.657 c/IVA)</span></div>
          <div>📦 <strong>Total Ordenado en OC:</strong> <span class="font-mono" style="color:var(--text-muted); font-weight:700;">$2.433.481 CLP</span></div>
          <div>🏢 <strong>Recepcionado Físico CH_8:</strong> <span class="font-mono" style="color:#4ade80; font-weight:700;">$1.827.308 CLP</span></div>
        </div>
        <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:0.75rem; text-transform:uppercase; color:#fca5a5; font-weight:800; letter-spacing:0.04em;">Diferencia Real de la Transacción a Reclamar en Nota de Crédito:</span>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
              Faltante físico en bodega Viña del Mar ($2.387.107 Facturado Neto - $1.827.308 Recepcionado en Almacén CH_8).
            </div>
          </div>
          <div class="font-mono" style="font-size:1.35rem; font-weight:800; color:#ef4444;">$559.799 CLP</div>
        </div>
        <div style="margin-top:10px; padding:8px 12px; background:rgba(16,185,129,0.08); border-left:3px solid var(--accent-green); border-radius:0 4px 4px 0; font-size:0.78rem; color:var(--text-primary); line-height:1.45;">
          💡 <strong>Auditoría Multi-Factura Embonor:</strong> La OC 521534 consolida 10 facturas electrónicas emitidas por Coca-Cola Embonor S.A. en Axteroid (Folios 105275600 al 105275609). Cada línea se concilia SKU por SKU contra la recepción física en el Centro de Distribución.
        </div>
      \`;
      return;
    }

    const es521015 = poDigits === '521015' || poStr.includes('521015') || folioStr === '56500972' || folioStr === '56500937';`;
  content = content.replace(targetTrans, replacementTrans);
  console.log('1. Paso 3 Transaction control inyectado.');
}

// 2. Invoice items resolution hook
if (!content.includes('typeof PO521534_AUDIT_DATA !== \'undefined\'')) {
  const targetItems = "if ((!invItems || invItems.length === 0) && typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[inv.folio]) {";
  const replacementItems = `if ((!invItems || invItems.length === 0) && typeof PO521534_AUDIT_DATA !== 'undefined' && PO521534_AUDIT_DATA.facturas && PO521534_AUDIT_DATA.facturas[inv.folio]) {
          invItems = PO521534_AUDIT_DATA.facturas[inv.folio].items;
        } else if ((!invItems || invItems.length === 0) && typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[inv.folio]) {`;
  content = content.replace(targetItems, replacementItems);
  console.log('2. Hook de ítems para PO521534 inyectado.');
}

// 3. Define PO521534_AUDIT_DATA
if (!content.includes('const PO521534_AUDIT_DATA =')) {
  const targetAuditDef = 'const PO521015_AUDIT_DATA =';
  const replacementAuditDef = `/**
 * Auditoría Oficial PO521534 - Coca-Cola Embonor S.A. (Sociedad 6202 / Almacén CH_8 Viña del Mar)
 * Total Facturado: $2.387.107 (10 facturas: 105275600 al 105275609)
 * Total Recepcionado Bodega: $1.827.308 (BigQuery cl_dmarts)
 * Total Diferencia a Reclamar: $559.799 CLP
 */
const PO521534_AUDIT_DATA = ${JSON.stringify(auditData)};

const PO521015_AUDIT_DATA =`;
  content = content.replace(targetAuditDef, replacementAuditDef);
  console.log('3. PO521534_AUDIT_DATA inyectado.');
}

// 4. Inject the 10 invoices in FACTURAS_CATALOGO_INICIAL
if (!content.includes('105275609')) {
  const targetCat = 'const FACTURAS_CATALOGO_INICIAL = [';
  const catEntriesJson = JSON.stringify(catalogoInicial, null, 2);
  // Remove outer brackets [ and ]
  const innerEntries = catEntriesJson.slice(catEntriesJson.indexOf('[') + 1, catEntriesJson.lastIndexOf(']')).trim();
  const replacementCat = `const FACTURAS_CATALOGO_INICIAL = [\n${innerEntries},`;
  content = content.replace(targetCat, replacementCat);
  console.log('4. 10 Facturas de Embonor agregadas a FACTURAS_CATALOGO_INICIAL.');
}

// 5. Add to PO_METRICS_REGISTRY
if (!content.includes("'521534': {")) {
  const targetRegistry = "    '521015': {";
  const replacementRegistry = `    '521534': {
      po_order_id: 'PO521534',
      total_ordenado_neto: 2433481,
      total_recepcionado_neto: 1827308,
      total_facturado_neto: 2387107,
      total_facturado_con_iva: 2840657,
      total_facturas: 10,
      diferencia_preliminar_clp: 559799,
      supplier_name: 'Coca-Cola Embonor S.A.',
      supplier_tax_id: '93281000-K',
      warehouse_name: 'CH_8_Vina del Mar (Sociedad 6202)',
      condicion_aforo: 'Bebestibles - Ambiente (Coca-Cola Embonor)'
    },
    '521015': {`;
  content = content.replace(targetRegistry, replacementRegistry);
  console.log('5. PO 521534 agregada a PO_METRICS_REGISTRY.');
}

// 6. Fix filtrarPaso1 PO totals fallback
const targetFallbackOrd = "oc_asociada.includes('517979') ? 28619421 : (first.oc_asociada && first.oc_asociada.includes('521257') ? 22929315 : 0)";
const replacementFallbackOrd = "oc_asociada.includes('517979') ? 28619421 : (first.oc_asociada && first.oc_asociada.includes('521534') ? 2433481 : (first.oc_asociada && first.oc_asociada.includes('521257') ? 22929315 : (first.oc_asociada && first.oc_asociada.includes('521015') ? 2029303 : 0)))";
if (content.includes(targetFallbackOrd)) {
  content = content.replace(targetFallbackOrd, replacementFallbackOrd);
  console.log('6.1 Fallback ordenado actualizado.');
}

const targetFallbackRec = "oc_asociada.includes('517979') ? 12388682 : (first.oc_asociada && first.oc_asociada.includes('521257') ? 22929315 : 0)";
const replacementFallbackRec = "oc_asociada.includes('517979') ? 12388682 : (first.oc_asociada && first.oc_asociada.includes('521534') ? 1827308 : (first.oc_asociada && first.oc_asociada.includes('521257') ? 20463359 : (first.oc_asociada && first.oc_asociada.includes('521015') ? 1789977 : 0)))";
if (content.includes(targetFallbackRec)) {
  content = content.replace(targetFallbackRec, replacementFallbackRec);
  console.log('6.2 Fallback recepcionado actualizado.');
}

// 7. Wire chips in initWizardFlow
if (!content.includes('chipPaso1Po521534')) {
  const targetChipsDecl = "    const chipPo517979 = document.getElementById('chipPaso1Po517979');";
  const replacementChipsDecl = `    const chipPo521534 = document.getElementById('chipPaso1Po521534');
    const chipEmbonor = document.getElementById('chipPaso1Embonor');
    const chipPo517979 = document.getElementById('chipPaso1Po517979');`;
  content = content.replace(targetChipsDecl, replacementChipsDecl);

  const targetChipsArr = "    const chips = [chipTodos, chipPo517979,";
  const replacementChipsArr = "    const chips = [chipTodos, chipPo521534, chipEmbonor, chipPo517979,";
  content = content.replace(targetChipsArr, replacementChipsArr);

  const targetChipListeners = "    if (chipPo517979) chipPo517979.addEventListener('click', () => setChip(chipPo517979, 'PO517979'));";
  const replacementChipListeners = `    if (chipPo521534) chipPo521534.addEventListener('click', () => {
      setChip(chipPo521534, 'PO521534');
      buscarFacturaEnVivoPaso1('PO521534');
    });
    if (chipEmbonor) chipEmbonor.addEventListener('click', () => setChip(chipEmbonor, 'Embonor'));
    if (chipPo517979) chipPo517979.addEventListener('click', () => setChip(chipPo517979, 'PO517979'));`;
  content = content.replace(targetChipListeners, replacementChipListeners);
  console.log('7. Listeners para chips PO521534 y Embonor cableados.');
}

// 8. Fix ejecutarBusquedaAxteroidPaso1 number discrimination
const targetEjecBusq = `    const filters = {};
    const rawNum = term.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');
    if (/^[0-9]+$/.test(term)) {
      filters.serial = term;
    } else if (/^[0-9]+$/.test(rawNum)) {
      filters.order_reference = rawNum;
      filters.raw_number = rawNum;
    } else {
      filters.supplier_name_query = term;
    }`;

const replacementEjecBusq = `    const filters = {};
    const rawNum = term.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^ORDEN/i, '').replace(/^0+/, '');
    if (/^\\d{5,7}$/.test(rawNum)) {
      // Formato típico de Orden de Compra SAP Dmarts (5 a 7 dígitos)
      filters.order_reference = rawNum.padStart(10, '0');
      filters.raw_number = rawNum;
    } else if (/^[0-9]+$/.test(term)) {
      filters.serial = term;
    } else if (/^[0-9]+$/.test(rawNum)) {
      filters.order_reference = rawNum;
      filters.raw_number = rawNum;
    } else {
      filters.supplier_name_query = term;
    }`;

if (content.includes(targetEjecBusq)) {
  content = content.replace(targetEjecBusq, replacementEjecBusq);
  console.log('8. Discriminación de número en ejecutarBusquedaAxteroidPaso1 corregida.');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('JavaScript.html guardado exitosamente.');
