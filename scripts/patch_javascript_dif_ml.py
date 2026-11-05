import json
import os
import sys

# Load compact metrics dictionary
with open('tests/compact_po_metrics.json', 'r', encoding='utf-8') as f:
    compact_data = json.load(f)

# Load existing JavaScript.html
with open('apps-script-webapp/JavaScript.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Prepare registry replacement
js_registry_block = '''  // Catálogo maestro oficial optimizado de 1.993 Órdenes de Compra sincronizadas con BigQuery y Axteroid
  const INDICE_MAESTRO_FAST_MAP = ''' + json.dumps(compact_data, ensure_ascii=False) + ''';

  function getPoMetrics(poRaw) {
    if (!poRaw) return null;
    const digits = String(poRaw).replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
    const item = INDICE_MAESTRO_FAST_MAP[digits];
    if (!item) return null;
    return {
      po_order_id: item.po,
      total_ordenado_neto: item.ord,
      total_recepcionado_neto: item.rec,
      total_facturado_neto: item.fac,
      total_facturado_con_iva: item.fac_iva,
      total_facturas: item.n_fac,
      diferencia_preliminar_clp: item.dif,
      supplier_name: item.prov,
      supplier_tax_id: item.rut,
      warehouse_name: item.wh,
      condicion_aforo: 'AUDITORÍA AUTOMÁTICA EN VIVO'
    };
  }

  const PO_METRICS_REGISTRY = new Proxy(INDICE_MAESTRO_FAST_MAP, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        const d = prop.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
        if (d in target) return getPoMetrics(d);
      }
      return target[prop];
    }
  });
'''

# Find boundaries of PO_METRICS_REGISTRY
target_start = '  // Registro maestro oficial auditado de BigQuery y Axteroid para OCs clave de Dmarts Chile\n  const PO_METRICS_REGISTRY = {'
target_end = '  function mostrarBannerVinculoPo(data) {'

idx_start = content.find(target_start)
idx_end = content.find(target_end)

if idx_start == -1 or idx_end == -1:
    print('ERROR: Could not locate PO_METRICS_REGISTRY')
    sys.exit(1)

content = content[:idx_start] + js_registry_block + '\n' + content[idx_end:]

# 2. Update dif calculation in mostrarBannerVinculoPo
old_dif_calc = '''    const dif = (reg && reg.diferencia_preliminar_clp !== undefined)
      ? safeNum(reg.diferencia_preliminar_clp)
      : (data.diferencia_preliminar_clp !== undefined && typeof data.diferencia_preliminar_clp === 'number'
          ? data.diferencia_preliminar_clp
          : (totFacNeto > 0 ? (totFacNeto - totRec) : (totOrd - totRec)));'''

new_dif_calc = '''    // REGLA OFICIAL DE DIF ML: Facturado Neto - Recepcionado Bodega
    // NUNCA se utiliza el total de la orden de compra para calcular la diferencia
    let dif = 0;
    if (totFacNeto > 0 && totRec > 0) {
      dif = totFacNeto - totRec;
    } else if (reg && reg.diferencia_preliminar_clp !== undefined && totFacNeto > 0) {
      dif = safeNum(reg.diferencia_preliminar_clp);
    } else if (data.diferencia_preliminar_clp !== undefined && typeof data.diferencia_preliminar_clp === 'number' && totFacNeto > 0) {
      dif = data.diferencia_preliminar_clp;
    } else if (totFacNeto > 0) {
      dif = totFacNeto;
    } else {
      dif = 0; // Sin facturas asociadas, la Dif ML es $0 (NUNCA el valor de la orden)
    }'''

if old_dif_calc in content:
    content = content.replace(old_dif_calc, new_dif_calc, 1)
    print('Updated dif calculation in mostrarBannerVinculoPo')
else:
    print('WARNING: old_dif_calc not found')

# Update lblDifSub labels
content = content.replace("lblDifSub.textContent = `⚠️ Faltante Físico a Reclamar en NC`;", "lblDifSub.textContent = `⚠️ Faltante Físico a Reclamar (Dif ML)`;")
content = content.replace("lblDifSub.textContent = `Facturado menor al recepcionado`;", "lblDifSub.textContent = `ℹ️ Sobrellegada Física en Bodega (Dif ML)`;")
content = content.replace("lblDifSub.textContent = `🟢 Calce Físico Conforme`;", "lblDifSub.textContent = `🟢 Calce Conforme 100% (Dif ML $0)`;")

# 3. Update renderTablaFacturasPaso1 to render Recepcionado Bodega and Dif ML
old_table_row = '''          <td class="monto-neto-cell" style="text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--color-monto-neto, #0f172a); font-size:0.95rem;">
            ${(() => {
              const netoCalc = (f.items && f.items.length > 0)
                ? f.items.reduce((acc, it) => acc + safeNum(it.monto_facturado || (it.cantidad_facturada * it.precio_facturado)), 0)
                : safeNum(f.monto_neto);
              const totalCalc = f.monto_total ? safeNum(f.monto_total) : Math.round(netoCalc * 1.19);
              return `
                $${Math.round(netoCalc).toLocaleString('es-CL')}
                <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:500;">Total: $${Math.round(totalCalc).toLocaleString('es-CL')}</div>
              `;
            })()}
          </td>
          <td>
            <span class="badge ${badgeOcClass} font-mono" style="font-size:0.8rem; letter-spacing:0.02em;" title="Vínculo confirmado con Orden de Compra">
              📦 ${ocDisplay.startsWith('PO') ? ocDisplay : 'OC: ' + ocDisplay}
            </span>
          </td>'''

new_table_row = '''          <td class="monto-neto-cell" style="text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--color-monto-neto, #0f172a); font-size:0.95rem;">
            ${(() => {
              const netoCalc = (f.items && f.items.length > 0)
                ? f.items.reduce((acc, it) => acc + safeNum(it.monto_facturado || (it.cantidad_facturada * it.precio_facturado)), 0)
                : safeNum(f.monto_neto);
              const totalCalc = f.monto_total ? safeNum(f.monto_total) : Math.round(netoCalc * 1.19);
              return `
                $${Math.round(netoCalc).toLocaleString('es-CL')}
                <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:500;">Total: $${Math.round(totalCalc).toLocaleString('es-CL')}</div>
              `;
            })()}
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-size:0.88rem;">
            ${(() => {
              const ocDigits = (ocDisplay || '').replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
              const poReg = (typeof getPoMetrics === 'function') ? getPoMetrics(ocDigits) : ((typeof PO_METRICS_REGISTRY !== 'undefined') ? PO_METRICS_REGISTRY[ocDigits] : null);
              if (poReg && poReg.total_recepcionado_neto !== undefined) {
                return `
                  <div style="font-weight:700; color:var(--accent-green);">$${Math.round(Number(poReg.total_recepcionado_neto)).toLocaleString('es-CL')}</div>
                  <div style="font-size:0.68rem; color:var(--text-secondary);">${poReg.warehouse_name || 'Bodega'}</div>
                `;
              }
              if (f.recepcionado_bodega) {
                return `<div style="font-weight:700; color:var(--accent-green);">$${Math.round(Number(f.recepcionado_bodega)).toLocaleString('es-CL')}</div>`;
              }
              return `<span style="color:var(--text-muted); font-size:0.8rem;">-</span>`;
            })()}
          </td>
          <td style="text-align:right; font-family:var(--font-mono); font-size:0.92rem;">
            ${(() => {
              const ocDigits = (ocDisplay || '').replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
              const poReg = (typeof getPoMetrics === 'function') ? getPoMetrics(ocDigits) : ((typeof PO_METRICS_REGISTRY !== 'undefined') ? PO_METRICS_REGISTRY[ocDigits] : null);
              let difVal = null;
              if (poReg && poReg.diferencia_preliminar_clp !== undefined) {
                difVal = Number(poReg.diferencia_preliminar_clp);
              } else if (f.diferencia_ml !== undefined) {
                difVal = Number(f.diferencia_ml);
              }
              if (difVal === null) return `<span style="color:var(--text-muted); font-size:0.8rem;">-</span>`;
              
              const isAlert = Math.abs(difVal) > 100;
              const difColor = isAlert ? (difVal > 0 ? 'var(--accent-red)' : 'var(--accent-blue)') : 'var(--accent-green)';
              const difPrefix = difVal > 0 ? '+' : '';
              const difTag = difVal > 100 ? '⚠️ Faltante' : (difVal < -100 ? 'ℹ️ Sobrellegada' : '🟢 Conforme');
              
              return `
                <div style="font-weight:800; color:${difColor};">
                  ${difPrefix}$${Math.round(difVal).toLocaleString('es-CL')}
                </div>
                <div style="font-size:0.68rem; color:${difColor}; font-weight:700;">${difTag}</div>
              `;
            })()}
          </td>
          <td>
            <span class="badge ${badgeOcClass} font-mono" style="font-size:0.8rem; letter-spacing:0.02em;" title="Vínculo confirmado con Orden de Compra">
              📦 ${ocDisplay.startsWith('PO') ? ocDisplay : 'OC: ' + ocDisplay}
            </span>
          </td>'''

if old_table_row in content:
    content = content.replace(old_table_row, new_table_row, 1)
    print('Updated table row in renderTablaFacturasPaso1')
else:
    print('WARNING: old_table_row not found')

# Update empty state colspans in tbodyFacturasPaso1
content = content.replace('<td colspan="8" style="text-align:center; padding:40px 20px;">', '<td colspan="10" style="text-align:center; padding:40px 20px;">')
content = content.replace('<td colspan="8" style="padding:24px; text-align:center;">', '<td colspan="10" style="padding:24px; text-align:center;">')
content = content.replace('<td colspan="8" style="text-align:center; padding:45px 20px; color:var(--text-secondary);">', '<td colspan="10" style="text-align:center; padding:45px 20px; color:var(--text-secondary);">')
content = content.replace('<td colspan="8" style="text-align:center; padding:35px 20px;">', '<td colspan="10" style="text-align:center; padding:35px 20px;">')
content = content.replace('<td colspan="8" style="text-align:center; padding:35px; color:var(--text-secondary);">', '<td colspan="10" style="text-align:center; padding:35px; color:var(--text-secondary);">')

# Write back
with open('apps-script-webapp/JavaScript.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully patched apps-script-webapp/JavaScript.html')
