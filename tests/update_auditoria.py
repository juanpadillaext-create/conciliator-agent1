with open('apps-script-webapp/AuditoriaData.gs', 'r', encoding='utf-8') as f:
    content = f.read()

with open('tests/softys_audit_data.js', 'r', encoding='utf-8') as f:
    softys_data = f.read()

target = "if (clean === '502855') {"
replacement = """if (clean === '523428') {
    return {
      po_found: true,
      po_order_id: 'PO523428',
      warehouse_name: SOFTYS_PO523428_AUDIT_DATA.warehouse_name,
      supplier_name: SOFTYS_PO523428_AUDIT_DATA.supplier_name,
      supplier_tax_id: SOFTYS_PO523428_AUDIT_DATA.supplier_tax_id,
      order_status: SOFTYS_PO523428_AUDIT_DATA.order_status,
      total_ordenado_neto: SOFTYS_PO523428_AUDIT_DATA.total_ordenado_neto,
      total_recepcionado_neto: SOFTYS_PO523428_AUDIT_DATA.total_recepcionado_neto,
      amt_ordered_lc: SOFTYS_PO523428_AUDIT_DATA.total_ordenado_neto,
      amt_delivered_lc: SOFTYS_PO523428_AUDIT_DATA.total_recepcionado_neto,
      descalce_monto_clp: SOFTYS_PO523428_AUDIT_DATA.total_monto_reclamar_nc,
      quantity_ordered: SOFTYS_PO523428_AUDIT_DATA.quantity_ordered,
      quantity_delivered: SOFTYS_PO523428_AUDIT_DATA.quantity_delivered,
      condicion_aforo: SOFTYS_PO523428_AUDIT_DATA.condicion_aforo,
      category_manager: SOFTYS_PO523428_AUDIT_DATA.category_manager,
      facturas_count: SOFTYS_PO523428_AUDIT_DATA.total_facturas,
      items: SOFTYS_PO523428_AUDIT_DATA.all_po_items
    };
  }

  if (clean === '502855') {"""

if target in content:
    content = content.replace(target, replacement, 1)
    content = content + '\n\n' + softys_data
    with open('apps-script-webapp/AuditoriaData.gs', 'w', encoding='utf-8') as f:
        f.write(content)
    print('AuditoriaData.gs updated successfully!')
else:
    print('Target not found!')
