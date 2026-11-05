import json
import re

with open("data/carozzi_axteroid_raw.json", "r", encoding="utf-8") as f:
    axteroid_docs = json.load(f)

with open("data/carozzi_pos_bq.json", "r", encoding="utf-8") as f:
    bq_pos = json.load(f)

# Normalize PO map
pos_by_id = {}
for po in bq_pos:
    p_id = po.get('po_order_id')
    num_only = re.sub(r'^[A-Za-z]+', '', p_id)
    pos_by_id[p_id] = po
    pos_by_id[num_only] = po
    pos_by_id[f"0000{num_only}"] = po
    pos_by_id[f"000{num_only}"] = po

print(f"Indexados {len(bq_pos)} POs de BigQuery")

# Process Axteroid invoices
invoices_processed = []
matched_count = 0
unmatched_count = 0

for doc in axteroid_docs:
    ref = doc.get('order_reference') or ""
    ref_clean = ref.strip()
    norm_ref = re.sub(r'^[A-Za-z]+', '', ref_clean).lstrip('0')
    
    # Try to find matching PO
    matched_po = pos_by_id.get(ref_clean) or pos_by_id.get(norm_ref) or pos_by_id.get(f"PO{norm_ref}")
    
    amount_total = float(doc.get('amount_total') or 0)
    is_woemail = doc.get('is_woemail', False)
    
    inv_data = {
        "id": doc.get('id'),
        "serial": doc.get('serial'),
        "type": doc.get('type') or 'CL33',
        "supplier_name": doc.get('supplier_name') or 'EMPRESAS CAROZZI S.A.',
        "tax_id": doc.get('tax_id') or '96591040-9',
        "amount_total": amount_total,
        "date": doc.get('date') or doc.get('issued_date') or '2026-09-28',
        "order_reference": ref_clean if ref_clean else 'SIN REFERENCIA',
        "origin_channel": "Pendiente de Recibir (woemail)" if is_woemail else "Recibido en Casilla (rec-docs)",
        "has_xml_pdf": not is_woemail,
        "status_aforo": "NO AFORADO POR SOLICITUD DE COMERCIAL",
        "category_manager": "Daniela Reyes",
        "tienda": "CH_36_CD_Chile",
        "matched": bool(matched_po)
    }
    
    if matched_po:
        matched_count += 1
        qty_ordered = int(matched_po.get('quantity_ordered') or 0)
        qty_delivered = int(matched_po.get('quantity_delivered') or 0) if matched_po.get('quantity_delivered') is not None else 0
        amt_ordered = float(matched_po.get('amt_ordered_lc') or 0)
        amt_delivered = float(matched_po.get('amt_delivered_lc') or 0) if matched_po.get('amt_delivered_lc') is not None else 0
        diff_qty = int(matched_po.get('diff_qty') or 0)
        
        inv_data["po_details"] = {
            "po_order_id": matched_po.get('po_order_id'),
            "qty_ordered": qty_ordered,
            "qty_delivered": qty_delivered,
            "diff_qty": diff_qty,
            "amt_ordered": amt_ordered,
            "amt_delivered": amt_delivered,
            "descalce_monto": amt_ordered - amt_delivered
        }
        
        # Reconciliation status logic
        if qty_delivered == 0 and qty_ordered > 0:
            inv_data["cruce_status"] = "PENDIENTE_RECEPCION"
            inv_data["cruce_label"] = "Bodega no ha recepcionado"
            inv_data["action"] = "Esperar recepción de bodega antes de autorizar pago"
            inv_data["status_badge"] = "warning"
        elif diff_qty > 0 or (amount_total > amt_delivered and amt_delivered > 0):
            inv_data["cruce_status"] = "SOBREFACTURADO_DESCALCE"
            inv_data["cruce_label"] = "Sobrefacturación / Faltante Físico"
            inv_data["action"] = "PAGO RETENIDO: Exigir Nota de Crédito por unidades faltantes"
            inv_data["status_badge"] = "danger"
            inv_data["monto_a_reclamar"] = max(0, amount_total - amt_delivered)
        else:
            inv_data["cruce_status"] = "CONCILIADO_OK"
            inv_data["cruce_label"] = "Conciliado Conforme"
            inv_data["action"] = "Aprobado para Pago"
            inv_data["status_badge"] = "success"
    else:
        unmatched_count += 1
        if not ref_clean or ref_clean == 'SIN REFERENCIA':
            inv_data["cruce_status"] = "SIN_ORDEN_COMPRA"
            inv_data["cruce_label"] = "Factura sin OC Referenciada"
            inv_data["action"] = "RECHAZO COMERCIAL INMEDIATO (Norma Contable)"
            inv_data["status_badge"] = "danger"
        else:
            inv_data["cruce_status"] = "OC_NO_ENCONTRADA_CD36"
            inv_data["cruce_label"] = f"OC {ref_clean} no pertenece a CD 36 o no existe"
            inv_data["action"] = "Verificar si corresponde a otra tienda o solicitar OC correcta"
            inv_data["status_badge"] = "secondary"

    invoices_processed.append(inv_data)

print(f"Facturas procesadas: {len(invoices_processed)} | Con PO: {matched_count} | Sin PO directa: {unmatched_count}")

# Looker Studio proveedores consolidado
looker_providers = [
    {
        "id": "carozzi",
        "name": "EMPRESAS CAROZZI SA",
        "rut": "96591040-9",
        "category_manager": "Daniela Reyes",
        "share_pct": 30.62,
        "monto_ml": 9844893,
        "q_facturas": 44,
        "active": True
    },
    {
        "id": "nestle",
        "name": "Nestle Chile SA",
        "rut": "96557910-9",
        "category_manager": "Constanza Urra",
        "share_pct": 56.38,
        "monto_ml": 18128692,
        "q_facturas": 17,
        "active": False
    },
    {
        "id": "andina",
        "name": "EMBOTELLADORA ANDINA S.A",
        "rut": "91144000-8",
        "category_manager": "Javiera Rogers",
        "share_pct": 3.51,
        "monto_ml": 1130040,
        "q_facturas": 2,
        "active": False
    },
    {
        "id": "softys",
        "name": "Softys Chile SpA",
        "rut": "76169670-K",
        "category_manager": "Nicolas Lopez",
        "share_pct": 3.35,
        "monto_ml": 1077833,
        "q_facturas": 8,
        "active": False
    },
    {
        "id": "promerco",
        "name": "PROMERCO S.A",
        "rut": "96681470-5",
        "category_manager": "Nicolas Lopez",
        "share_pct": 2.75,
        "monto_ml": 885297,
        "q_facturas": 2,
        "active": False
    },
    {
        "id": "evercrisp",
        "name": "Evercrisp Snack Productos De C",
        "rut": "96720910-4",
        "category_manager": "Constanza Urra",
        "share_pct": 2.63,
        "monto_ml": 845230,
        "q_facturas": 7,
        "active": False
    },
    {
        "id": "pg",
        "name": "PROCTER & GAMBLE CHILE LTDA.",
        "rut": "88502900-0",
        "category_manager": "Joaquin Mardones",
        "share_pct": 0.76,
        "monto_ml": 245103,
        "q_facturas": 4,
        "active": False
    }
]

output_payload = {
    "dashboard_metadata": {
        "title": "Dashboard Operativo de Conciliación y Cruce de Facturas",
        "subtitle": "Cuentas por Pagar vs. Recepción Bodega CH_36_CD_Chile & Axteroid API",
        "tienda_central": "CH_36_CD_Chile (cc5d044f-9995-47cc-a1fe-975a04117178)",
        "condicion_general": "NO AFORADO POR SOLICITUD DE COMERCIAL",
        "monto_total_ml": 32157089,
        "q_total_facturas": 84,
        "updated_at": "2026-09-29T21:28:00-03:00"
    },
    "providers": looker_providers,
    "invoices": invoices_processed,
    "pos": bq_pos
}

with open("data/dashboard_data.json", "w", encoding="utf-8") as f:
    json.dump(output_payload, f, ensure_ascii=False, indent=2)

print("Datos consolidados guardados con éxito en data/dashboard_data.json")
