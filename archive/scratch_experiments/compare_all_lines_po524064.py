import xml.etree.ElementTree as ET
import json

def parse_xml(filename):
    tree = ET.parse(filename)
    root = tree.getroot()
    # Find all Detalle elements (regardless of namespace)
    detalles = []
    for elem in root.iter():
        if elem.tag.endswith('Detalle'):
            nro = elem.find('{*}NroLinDet')
            cdg = elem.find('{*}VlrCodigo')
            nmb = elem.find('{*}NmbItem')
            qty = elem.find('{*}QtyItem')
            prc = elem.find('{*}PrcItem')
            mnt = elem.find('{*}MontoItem')
            detalles.append({
                'nro': nro.text if nro is not None else '',
                'cod': cdg.text if cdg is not None else '',
                'name': nmb.text if nmb is not None else '',
                'qty': float(qty.text) if qty is not None else 0.0,
                'prc': float(prc.text) if prc is not None else 0.0,
                'monto': float(mnt.text) if mnt is not None else 0.0
            })
    return detalles

f1_items = parse_xml('scratch/doc_10207759.xml')
f2_items = parse_xml('scratch/doc_10207760.xml')
nc_items = parse_xml('scratch/doc_6363032.xml')

with open('scratch/po524064_items.json', 'r') as f:
    bq_items = json.load(f)

print("=== FACTURA 10207759 (12 líneas) ===")
for it in f1_items:
    print(f"Lin {it['nro']}: {it['cod']:<10} | {it['name']:<30} | Qty: {it['qty']:>4} | Prc: {it['prc']:>8.2f} | Monto: {it['monto']:>8.2f}")

print("\n=== FACTURA 10207760 (3 líneas) ===")
for it in f2_items:
    print(f"Lin {it['nro']}: {it['cod']:<10} | {it['name']:<30} | Qty: {it['qty']:>4} | Prc: {it['prc']:>8.2f} | Monto: {it['monto']:>8.2f}")

print("\n=== NOTA DE CRÉDITO 6363032 ===")
for it in nc_items:
    print(f"Lin {it['nro']}: {it['cod']:<10} | {it['name']:<30} | Qty: {it['qty']:>4} | Prc: {it['prc']:>8.2f} | Monto: {it['monto']:>8.2f}")

print("\n=== BIGQUERY ITEMS (16 items) ===")
for b in bq_items:
    print(f"SKU: {b['sku_id']:<10} | {b['product_name']:<35} | Ord: {float(b['quantity_ordered']):>4.0f} | Del: {float(b['quantity_delivered']):>4.0f} | Cost: {float(b['unit_cost']):>8.2f} | AmtDel: {float(b['amt_delivered']):>8.2f}")

