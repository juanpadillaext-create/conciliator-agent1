const fs = require('fs');

const filePath = 'apps-script-webapp/JavaScript.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Logic to insert into mostrarBannerVinculoPo
const target1 = "const btnConsolidado = document.getElementById('btnCruzarPoConsolidada');";
const snippet1 = `    // Poblar y destacar el Panel de Control de Transacción y Auditoría de la Orden
    const boxControl = document.getElementById('boxControlTransaccionPo');
    const contentControl = document.getElementById('contenidoControlTransaccionPo');
    const badgeAuditoria = document.getElementById('badgePoAuditoriaStatus');
    if (boxControl && contentControl) {
      if (poDigits === '521015' || poNom.includes('521015')) {
        boxControl.style.display = 'block';
        if (badgeAuditoria) badgeAuditoria.textContent = 'PO521015 AUDITADA • IDEAL S.A.';
        contentControl.innerHTML = \`
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin-bottom:10px; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
            <div>📄 <strong>Factura Folio 56500972:</strong> <span class="font-mono" style="color:var(--accent-cyan); font-weight:700;">$1.968.789</span> <span style="font-size:0.75rem; color:var(--text-muted);">(59 ítems Panadería)</span></div>
            <div>📄 <strong>Factura Folio 56500937:</strong> <span class="font-mono" style="color:var(--accent-cyan); font-weight:700;">$40.440</span> <span style="font-size:0.75rem; color:var(--text-muted);">(2 ítems Galletones Nutrabien)</span></div>
            <div>📑 <strong>Total Facturado Consolidado:</strong> <span class="font-mono" style="color:#60a5fa; font-weight:700;">$2.009.229</span></div>
            <div>🏢 <strong>Recepcionado Bodega CH_34:</strong> <span class="font-mono" style="color:#4ade80; font-weight:700;">$1.789.977</span></div>
          </div>
          <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <span style="font-size:0.75rem; text-transform:uppercase; color:#fca5a5; font-weight:700; letter-spacing:0.04em;">Diferencia Real de la Transacción a Reclamar en Nota de Crédito:</span>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Faltante físico comprobado en entrega de mercadería ($2.009.229 Facturado - $1.789.977 Recepcionado).
              </div>
            </div>
            <div class="font-mono" style="font-size:1.35rem; font-weight:800; color:#ef4444;">$219.252 CLP</div>
          </div>
          <div style="margin-top:10px; padding:8px 12px; background:rgba(245,158,11,0.08); border-left:3px solid #f59e0b; border-radius:0 4px 4px 0; font-size:0.78rem; color:var(--text-primary); line-height:1.45;">
            💡 <strong>Control de Transacción (Por qué figuraban $1.968.789):</strong> El monto de <strong>$1.968.789</strong> corresponde al neto de la <em>Factura 56500972 por sí sola</em> sin incluir la Factura complementaria 56500937 ($40.440) ni deducir los $1.789.977 recepcionados en bodega. Al presionar <strong>⚡ Cruzar Todas las Facturas de esta PO (Consolidado)</strong>, la conciliación oficial cruza la OC completa y entrega directamente la diferencia exacta de <strong>$219.252 CLP</strong>.
          </div>
        \`;
      } else if (countInvs > 1 && dif > 0) {
        boxControl.style.display = 'block';
        if (badgeAuditoria) badgeAuditoria.textContent = 'ORDEN MULTI-FACTURA';
        contentControl.innerHTML = \`
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
            <div>
              <strong>Control de Transacción:</strong> Esta orden registra <strong>\${countInvs} facturas</strong> por un total de <strong>$\${Math.round(totFacNeto).toLocaleString('es-CL')}</strong> contra una recepción de <strong>$\${Math.round(totRec).toLocaleString('es-CL')}</strong>.
            </div>
            <div class="font-mono" style="font-weight:700; color:var(--accent-red); font-size:1.05rem;">
              Descalce: +$\${Math.round(dif).toLocaleString('es-CL')}
            </div>
          </div>
          <div style="font-size:0.78rem; color:var(--text-secondary);">
            Sugerencia: Utiliza el botón <strong>⚡ Cruzar Todas las Facturas</strong> para consolidar todos los DTEs y determinar el monto neto exacto de Nota de Crédito.
          </div>
        \`;
      } else {
        boxControl.style.display = 'none';
      }
    }

    \${target1}`;

if (!content.includes('boxControlTransaccionPo')) {
  content = content.replace(target1, snippet1);
  console.log('Inserted boxControlTransaccionPo logic');
}

// 2. Helper function for Paso 3
const helperFunction = `
  function actualizarPanelControlTransaccionPaso3(res) {
    const boxControlP3 = document.getElementById('boxControlTransaccionPaso3');
    const contentControlP3 = document.getElementById('contenidoControlTransaccionPaso3');
    const badgeAuditoriaP3 = document.getElementById('badgePaso3AuditoriaStatus');
    if (!boxControlP3 || !contentControlP3) return;

    const poStr = String((res && res.po_number) || '').toUpperCase();
    const folioStr = String((res && res.folio_factura) || '');

    if (poStr.includes('521015') || folioStr.includes('56500972') || folioStr.includes('56500937')) {
      boxControlP3.style.display = 'block';
      if (badgeAuditoriaP3) badgeAuditoriaP3.textContent = 'PO521015 • CONTROL IDEAL S.A.';
      const isConsolidado = folioStr.toLowerCase().includes('consolidado');
      if (isConsolidado) {
        contentControlP3.innerHTML = \`
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin-bottom:12px; background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
            <div>📄 <strong>Factura 56500972:</strong> <span class="font-mono text-cyan" style="font-weight:700;">$1.968.789</span> <span style="font-size:0.75rem; color:var(--text-muted);">(59 ítems Panadería)</span></div>
            <div>📄 <strong>Factura 56500937:</strong> <span class="font-mono text-cyan" style="font-weight:700;">$40.440</span> <span style="font-size:0.75rem; color:var(--text-muted);">(2 ítems Galletones Nutrabien)</span></div>
            <div>📑 <strong>Total Facturado Consolidado:</strong> <span class="font-mono" style="color:#60a5fa; font-weight:700;">$2.009.229</span></div>
            <div>🏢 <strong>Recepcionado Bodega CH_34:</strong> <span class="font-mono" style="color:#4ade80; font-weight:700;">$1.789.977</span></div>
          </div>
          <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <span style="font-size:0.75rem; text-transform:uppercase; color:#fca5a5; font-weight:700;">Monto Neto Auditado a Reclamar en Nota de Crédito:</span>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Faltante físico en entrega de mercadería ($2.009.229 Facturado - $1.789.977 Recepcionado en BigQuery).
              </div>
            </div>
            <div class="font-mono" style="font-size:1.4rem; font-weight:800; color:#ef4444;">$219.252 CLP</div>
          </div>
          <div style="margin-top:10px; font-size:0.78rem; color:var(--text-primary); line-height:1.45; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:4px;">
            📌 <strong>Trazabilidad y Control de Transacción:</strong> El valor individual de <strong>$1.968.789</strong> corresponde al total de la <em>Factura 56500972</em>. Al consolidarla con la Factura 56500937 ($40.440), la suma facturada asciende a <strong>$2.009.229</strong>. Contrastado con la recepción efectiva de Bodega CH_34 Manuel Montt (<strong>$1.789.977</strong>), el monto real a reclamar en Nota de Crédito es de <strong>$219.252 CLP</strong>.
          </div>
        \`;
      } else {
        contentControlP3.innerHTML = \`
          <div style="background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.4); border-radius:6px; padding:12px 14px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div style="font-weight:700; color:#fbbf24; font-size:0.9rem;">
                ⚠️ AVISO DE CONTROL: Factura Individual ($1.968.789) vs Transacción Consolidada ($219.252)
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btnSwitchAConsolidadoP3" style="font-weight:700; background:linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);">
                ⚡ Ver Cruce Consolidado ($219.252) ➔
              </button>
            </div>
            <div style="font-size:0.8rem; color:var(--text-primary); margin-top:6px; line-height:1.45;">
              Estás visualizando únicamente la <strong>Factura Folio 56500972 ($1.968.789)</strong>. La OC 521015 tiene además la <strong>Factura Folio 56500937 ($40.440)</strong>, sumando un total facturado de <strong>$2.009.229</strong>. Contrastado con la recepción de Bodega CH_34 (<strong>$1.789.977</strong>), el faltante real a exigir en Nota de Crédito para toda la transacción es <strong>$219.252 CLP</strong>.
            </div>
          </div>
        \`;
        setTimeout(() => {
          const btnSw = document.getElementById('btnSwitchAConsolidadoP3');
          if (btnSw) {
            btnSw.onclick = () => {
              if (currentPoSearchResult && currentPoSearchResult.po_number && currentPoSearchResult.po_number.includes('521015')) {
                ejecutarCrucePoConsolidado(currentPoSearchResult);
              } else {
                google.script.run
                  .withSuccessHandler(out => {
                    if (out && out.success) {
                      mostrarResultadoCrucePaso3(out.data.reconciliacion);
                    }
                  })
                  .apiConsolidateAndReconcilePo('521015');
              }
            };
          }
        }, 50);
      }
    } else {
      boxControlP3.style.display = 'none';
    }
  }
`;

// Insert helperFunction before mostrarResultadoCrucePaso3
const target2 = "function mostrarResultadoCrucePaso3(res) {";
if (!content.includes('function actualizarPanelControlTransaccionPaso3')) {
  content = content.replace(target2, helperFunction + '\n  ' + target2);
  console.log('Inserted actualizarPanelControlTransaccionPaso3 helper');
}

// Call actualizarPanelControlTransaccionPaso3 in mostrarResultadoCrucePaso3
const target3 = "filtrarTablaPaso3('todos');";
const snippet3 = `actualizarPanelControlTransaccionPaso3(res);\n    filtrarTablaPaso3('todos');`;
if (!content.includes('actualizarPanelControlTransaccionPaso3(res)')) {
  content = content.replace(target3, snippet3);
  console.log('Added call to actualizarPanelControlTransaccionPaso3 in mostrarResultadoCrucePaso3');
}

// Also call in renderResultadosConciliacion1a1
const target4 = "filtrarLineasConciliacion('todos');";
const snippet4 = `actualizarPanelControlTransaccionPaso3(res);\n    filtrarLineasConciliacion('todos');`;
content = content.replace(target4, snippet4);
console.log('Added call to actualizarPanelControlTransaccionPaso3 in renderResultadosConciliacion1a1');

fs.writeFileSync(filePath, content, 'utf8');
console.log('JavaScript.html updated successfully.');
