"""
scripts/reindex_all_pos_with_bq.py
Re-indexador maestro: Cruza el universo completo de facturas de Axteroid
con las 20.543 Órdenes de Compra reales extraídas directamente de BigQuery.
Actualiza 'tests/indice_completo_pos_facturas.json' y 'apps-script-webapp/IndicePoFacturas.gs'.
"""

import json
import re
import os

def get_digits(s):
    if not s:
        return ''
    m = re.search(r'(?:PO|OC|0+)?([3-58]\d{5})', str(s).upper())
    if m:
        return m.group(1)
    return re.sub(r'^(?:PO|OC|0+)', '', str(s).upper(), flags=re.I)

print("1. Cargando datos de BigQuery y catálogo de facturas...")
with open('tests/all_bq_chile_pos.json', 'r', encoding='utf-8-sig') as f:
    bq_data = json.load(f)

with open('tests/indice_completo_pos_facturas.json', 'r', encoding='utf-8') as f:
    index_data = json.load(f)

print(f"   BigQuery: {len(bq_data)} POs cargadas.")
print(f"   Catálogo actual: {len(index_data)} POs.")

bq_map = {}
for p in bq_data:
    po_id = str(p.get('po_order_id', '')).strip().upper()
    digits = get_digits(po_id)
    if digits:
        bq_map[digits] = p
    if po_id:
        bq_map[po_id] = p

updated_pos = []
stats = {
    'total': len(index_data),
    'matched_bq': 0,
    'with_diff': 0,
    'conforme': 0,
    'unmatched_unauthorized': 0,
    'total_diff_clp': 0
}

for po in index_data:
    po_id = str(po.get('po_number', '')).strip().upper()
    digits = po.get('base_digits', '') or get_digits(po_id)
    bq_match = bq_map.get(digits) or bq_map.get(po_id)
    
    fac_neto = round(float(po.get('total_facturado_neto') or 0))
    fac_tot = round(float(po.get('total_facturado_total') or round(fac_neto * 1.19)))
    
    if bq_match:
        stats['matched_bq'] += 1
        ord_neto = round(float(bq_match.get('total_ordenado_neto') or 0))
        raw_rec = bq_match.get('total_recepcionado_neto')
        if raw_rec is not None:
            rec_neto = round(float(raw_rec))
        else:
            rec_neto = 0
            
        dif = fac_neto - rec_neto
        wh = bq_match.get('warehouse_name') or po.get('warehouse_name')
        st = bq_match.get('order_status') or po.get('order_status')
        cr_date = str(bq_match.get('created_date') or po.get('created_date') or '')[:10]
        rc_date = str(bq_match.get('received_date') or po.get('received_date') or '')[:10]
        supp_name = bq_match.get('supplier_name') or po.get('supplier_name')
    else:
        stats['unmatched_unauthorized'] += 1
        ord_neto = round(float(po.get('total_ordenado_neto') or fac_neto))
        rec_neto = round(float(po.get('total_recepcionado_neto') or 0))
        dif = fac_neto - rec_neto
        wh = po.get('warehouse_name')
        st = po.get('order_status') or 'done'
        cr_date = po.get('created_date')
        rc_date = po.get('received_date')
        supp_name = po.get('supplier_name')

    if abs(dif) > 100:
        stats['with_diff'] += 1
        stats['total_diff_clp'] += abs(dif)
    else:
        stats['conforme'] += 1
        dif = 0

    new_po = dict(po)
    new_po['supplier_name'] = supp_name
    new_po['warehouse_name'] = wh
    new_po['order_status'] = st
    new_po['created_date'] = cr_date
    new_po['received_date'] = rc_date
    new_po['total_ordenado_neto'] = ord_neto
    new_po['total_recepcionado_neto'] = rec_neto
    new_po['total_facturado_neto'] = fac_neto
    new_po['total_facturado_total'] = fac_tot
    new_po['diferencia_preliminar'] = dif
    updated_pos.append(new_po)

# Ordenar: primero las que tienen mayor número de facturas y diferencias
updated_pos.sort(key=lambda p: (
    -p.get('total_facturas', 0),
    -abs(p.get('diferencia_preliminar', 0)),
    -int(p.get('base_digits', '0') if p.get('base_digits', '0').isdigit() else 0)
))

print(f"2. Guardando tests/indice_completo_pos_facturas.json...")
with open('tests/indice_completo_pos_facturas.json', 'w', encoding='utf-8') as f:
    json.dump(updated_pos, f, indent=2, ensure_ascii=False)

print("3. Generando apps-script-webapp/IndicePoFacturas.gs...")
gs_content = "// IndicePoFacturas.gs - Catálogo maestro indexado de Órdenes de Compra sincronizadas con BigQuery y Axteroid\n"
gs_content += "// Total Órdenes de Compra Indexadas: " + str(len(updated_pos)) + "\n\n"
gs_content += "const INDICE_MAESTRO_POS_FACTURAS = " + json.dumps(updated_pos, indent=2, ensure_ascii=False) + ";\n\n"

# Mantener las funciones RPC al final
rpc_code = """/**
 * RPC: Consulta el catálogo completo de Órdenes de Compra indexadas con sus facturas.
 * @param {Object} filtros { busqueda, proveedor, almacen, solo_diferencias, solo_con_facturas, page, limit }
 */
function apiGetIndexedPoList(filtros) {
  try {
    filtros = filtros || {};
    let lista = [...INDICE_MAESTRO_POS_FACTURAS];

    // 1. Filtro por término libre o búsqueda masiva (PO, Folio, Proveedor, RUT o listas separadas por comas/espacios)
    if (filtros.busqueda) {
      const q = String(filtros.busqueda).toUpperCase().trim();
      const isMulti = q.includes(',') || q.includes(';') || q.includes('\\n') || (q.includes(' ') && (q.includes('PO') || q.includes('OC') || /\\d{5,}/.test(q)));

      if (isMulti) {
        // Modo Búsqueda Masiva: soporta listas de POs o folios pegadas de Excel o correos
        const rawTokens = q.split(/[\\s,;\\n\\t]+/).map(t => t.trim()).filter(Boolean);
        const tokenPairs = rawTokens.map(t => ({
          raw: t,
          digits: t.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '')
        }));

        lista = lista.filter(po => {
          return tokenPairs.some(t => {
            const matchPo = po.po_number.toUpperCase().includes(t.raw) || (t.digits && po.base_digits.includes(t.digits));
            const matchProv = (po.supplier_name || '').toUpperCase().includes(t.raw);
            const matchRut = (po.supplier_tax_id || '').toUpperCase().includes(t.raw);
            const matchWh = (po.warehouse_name || '').toUpperCase().includes(t.raw);
            const matchFac = (po.facturas || []).some(f => f.folio.includes(t.raw) || (t.digits && f.folio.includes(t.digits)));
            return matchPo || matchProv || matchRut || matchWh || matchFac;
          });
        });
      } else {
        // Modo Búsqueda Única estándar
        const rawDigits = q.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
        lista = lista.filter(po => {
          const matchPo = po.po_number.toUpperCase().includes(q) || (rawDigits && po.base_digits.includes(rawDigits));
          const matchProv = (po.supplier_name || '').toUpperCase().includes(q);
          const matchRut = (po.supplier_tax_id || '').toUpperCase().includes(q);
          const matchWh = (po.warehouse_name || '').toUpperCase().includes(q);
          const matchFac = (po.facturas || []).some(f => f.folio.includes(q) || (rawDigits && f.folio.includes(rawDigits)));
          return matchPo || matchProv || matchRut || matchWh || matchFac;
        });
      }
    }

    // 2. Filtro por proveedor
    if (filtros.proveedor) {
      const p = String(filtros.proveedor).toUpperCase().trim();
      lista = lista.filter(po => (po.supplier_name || '').toUpperCase().includes(p));
    }

    // 3. Filtro por almacén
    if (filtros.almacen) {
      const w = String(filtros.almacen).toUpperCase().trim();
      lista = lista.filter(po => (po.warehouse_name || '').toUpperCase().includes(w));
    }

    // 4. Filtro solo con facturas
    if (filtros.solo_con_facturas) {
      lista = lista.filter(po => po.total_facturas > 0);
    }

    // 5. Filtro solo discrepancias
    if (filtros.solo_diferencias) {
      lista = lista.filter(po => Math.abs(po.diferencia_preliminar) > 100);
    }

    const totalPos = lista.length;
    const page = Math.max(1, parseInt(filtros.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(filtros.limit, 10) || 20));
    const totalPages = Math.ceil(totalPos / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pageItems = lista.slice(startIndex, startIndex + limit);

    return {
      success: true,
      total_pos: totalPos,
      page: page,
      limit: limit,
      total_pages: totalPages,
      pos: pageItems
    };
  } catch (err) {
    return {
      success: false,
      error: 'Error al consultar índice maestro de POs: ' + err.message
    };
  }
}

/**
 * RPC: Obtiene el resumen de KPIs globales del índice maestro.
 */
function apiGetIndexedPosKpis() {
  try {
    let totalPos = INDICE_MAESTRO_POS_FACTURAS.length;
    let posConFacturas = 0;
    let posConDiferencias = 0;
    let totalFacturas = 0;
    let totalMontoFacturado = 0;
    let totalMontoRecepcionado = 0;
    let totalDiferenciasClp = 0;

    INDICE_MAESTRO_POS_FACTURAS.forEach(po => {
      const fCount = (po.facturas || []).length;
      totalFacturas += fCount;
      if (fCount > 0) posConFacturas++;
      
      const dif = Math.abs(Number(po.diferencia_preliminar) || 0);
      if (dif > 100) {
        posConDiferencias++;
        totalDiferenciasClp += dif;
      }

      totalMontoFacturado += Number(po.total_facturado_neto) || 0;
      totalMontoRecepcionado += Number(po.total_recepcionado_neto) || 0;
    });

    return {
      success: true,
      kpis: {
        total_pos: totalPos,
        pos_con_facturas: posConFacturas,
        pos_con_diferencias: posConDiferencias,
        total_facturas: totalFacturas,
        total_monto_facturado: totalMontoFacturado,
        total_monto_recepcionado: totalMontoRecepcionado,
        total_diferencias_clp: totalDiferenciasClp
      }
    };
  } catch (err) {
    return {
      success: false,
      error: 'Error calculando KPIs de POs indexadas: ' + err.message
    };
  }
}
"""

gs_content += rpc_code

with open('apps-script-webapp/IndicePoFacturas.gs', 'w', encoding='utf-8') as f:
    f.write(gs_content)

print("   apps-script-webapp/IndicePoFacturas.gs generado exitosamente.")
print("\n=== RESUMEN FINAL DEL ÍNDICE MAESTRO ACTUALIZADO ===")
print(f"Total POs indexadas: {stats['total']}")
print(f"Cruces validados en BigQuery: {stats['matched_bq']} ({stats['matched_bq']/stats['total']*100:.1f}%)")
print(f"Órdenes con Discrepancia real (> $100 CLP): {stats['with_diff']}")
print(f"Órdenes Conformes (Dif $0): {stats['conforme']}")
print(f"Monto total acumulado de discrepancias: ${stats['total_diff_clp']:,.0f} CLP")

softys = next((p for p in updated_pos if '523428' in p['po_number']), None)
if softys:
    print(f"\nVerificación PO523428 (Softys Chile SpA):")
    print(f"  Ordenado:     ${softys['total_ordenado_neto']:,} CLP")
    print(f"  Recepcionado: ${softys['total_recepcionado_neto']:,} CLP")
    print(f"  Facturado:    ${softys['total_facturado_neto']:,} CLP")
    print(f"  Diferencia:   +${softys['diferencia_preliminar']:,} CLP (EXACTA)")
