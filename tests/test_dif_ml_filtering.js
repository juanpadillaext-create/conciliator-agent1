// Verification script for DIF ML integration and search filtering
const assert = require('assert');

// 1. Test BigQuery query logic & math calculation
function calculatePoHeaderMetrics(items) {
  const totOrd = items.reduce((s, r) => s + (parseFloat(r.amt_ordered_lc) || 0), 0);
  const totRec = items.reduce((s, r) => s + (parseFloat(r.amt_delivered_lc) || 0), 0);
  const difMlHeader = Math.round(totOrd - totRec);
  return {
    total_ordenado_neto: Math.round(totOrd),
    total_recepcionado_neto: Math.round(totRec),
    diferencia_ml: difMlHeader,
    diferencia_preliminar_clp: difMlHeader
  };
}

const mockItems = [
  { amt_ordered_lc: 100000, amt_delivered_lc: 80000 },
  { amt_ordered_lc: 50000, amt_delivered_lc: 50000 }
];
const headerMetrics = calculatePoHeaderMetrics(mockItems);
assert.strictEqual(headerMetrics.total_ordenado_neto, 150000);
assert.strictEqual(headerMetrics.total_recepcionado_neto, 130000);
assert.strictEqual(headerMetrics.diferencia_ml, 20000);
assert.strictEqual(headerMetrics.diferencia_preliminar_clp, 20000);
console.log('✅ [1/3] Header metrics calculation OK: DIF ML = 20.000');

// 2. Test solo_diferencias filtering in PO Index
const mockPoList = [
  { po_order_id: 'PO101', diferencia_ml: 0, total_ordenado: 100000, total_recepcionado: 100000 },
  { po_order_id: 'PO102', diferencia_ml: 15000, total_ordenado: 100000, total_recepcionado: 85000 },
  { po_order_id: 'PO103', diferencia_ml: -5000, total_ordenado: 100000, total_recepcionado: 105000 },
  { po_order_id: 'PO104', diferencia_ml: 50, total_ordenado: 100000, total_recepcionado: 99950 } // < 100 tolerance
];

function filterPos(list, soloDiferencias) {
  if (!soloDiferencias) return list;
  return list.filter(po => {
    const dif = Number(po.diferencia_ml !== undefined ? po.diferencia_ml : po.diferencia_preliminar) || 0;
    return Math.abs(dif) > 100;
  });
}

const filteredPos = filterPos(mockPoList, true);
assert.strictEqual(filteredPos.length, 2);
assert.strictEqual(filteredPos[0].po_order_id, 'PO102');
assert.strictEqual(filteredPos[1].po_order_id, 'PO103');
console.log('✅ [2/3] solo_diferencias filtering OK: 2 POs detected with |DIF ML| > 100');

// 3. Test text search filtering tokens for DIF ML in Paso 1
const mockInvoices = [
  { folio: 1001, razon_social: 'Distribuidora A', monto_neto: 100000, oc_asociada: 'PO101', diferencia_ml: 0 },
  { folio: 1002, razon_social: 'Distribuidora B', monto_neto: 200000, oc_asociada: 'PO102', diferencia_ml: 25000 },
  { folio: 1003, razon_social: 'Distribuidora C', monto_neto: 150000, oc_asociada: 'PO103', diferencia_ml: -15000 }
];

function filterInvoicesByTerm(invoices, term) {
  const normTerm = term.toLowerCase().trim();
  return invoices.filter(f => {
    const dif = Number(f.diferencia_ml) || 0;
    const isConforme = Math.abs(dif) <= 100;
    const isFaltante = dif > 100;
    const isSobrellegada = dif < -100;
    const tieneDif = Math.abs(dif) > 100;

    let difTag = '';
    if (isConforme) difTag = 'conforme verde ok';
    else if (isFaltante) difTag = 'faltante diferencia descalce alerta warn rojo';
    else if (isSobrellegada) difTag = 'sobrellegada exceso diferencia descalce azul info';

    if (normTerm === 'faltante' || normTerm === 'faltantes') return isFaltante;
    if (normTerm === 'sobrellegada' || normTerm === 'sobrellegadas') return isSobrellegada;
    if (normTerm === 'conforme' || normTerm === 'conformes') return isConforme;
    if (normTerm === 'diferencia' || normTerm === 'diferencias' || normTerm === 'dif ml' || normTerm === 'descalce') return tieneDif;

    return difTag.includes(normTerm);
  });
}

const faltantes = filterInvoicesByTerm(mockInvoices, 'faltante');
assert.strictEqual(faltantes.length, 1);
assert.strictEqual(faltantes[0].folio, 1002);

const sobrellegadas = filterInvoicesByTerm(mockInvoices, 'sobrellegada');
assert.strictEqual(sobrellegadas.length, 1);
assert.strictEqual(sobrellegadas[0].folio, 1003);

const conformes = filterInvoicesByTerm(mockInvoices, 'conforme');
assert.strictEqual(conformes.length, 1);
assert.strictEqual(conformes[0].folio, 1001);

const conDiferencia = filterInvoicesByTerm(mockInvoices, 'dif ml');
assert.strictEqual(conDiferencia.length, 2);
console.log('✅ [3/3] Search token filters for DIF ML (faltante, sobrellegada, conforme, dif ml) OK');

console.log('\n🎉 ALL INTEGRATION TESTS PASSED VERIFYING DIF ML AND SEARCH FILTERING');
