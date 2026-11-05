import xml.etree.ElementTree as ET
import json

def get_items_from_xml(filename):
    tree = ET.parse(filename)
    root = tree.getroot()
    lines = []
    for elem in root.iter():
        if elem.tag.endswith('Detalle'):
            nro = elem.find('{*}NroLinDet').text
            cdg = elem.find('{*}CdgItem/{*}VlrCodigo')
            if cdg is None:
                cdg = elem.find('{*}VlrCodigo')
            nmb = elem.find('{*}NmbItem').text
            qty = float(elem.find('{*}QtyItem').text)
            prc = float(elem.find('{*}PrcItem').text)
            mnt = float(elem.find('{*}MontoItem').text)
            rec = float(elem.find('{*}RecargoMonto').text) if elem.find('{*}RecargoMonto') is not None else 0.0
            dsc = float(elem.find('{*}DescuentoMonto').text) if elem.find('{*}DescuentoMonto') is not None else 0.0
            lines.append({
                'nro': nro,
                'cod': cdg.text if cdg is not None else '',
                'name': nmb,
                'qty': qty,
                'prc': prc,
                'monto': mnt,
                'recargo': rec,
                'descuento': dsc,
                'neto_linea': mnt + rec
            })
    return lines

f1 = get_items_from_xml('scratch/doc_10207759.xml')
f2 = get_items_from_xml('scratch/doc_10207760.xml')
nc = get_items_from_xml('scratch/doc_6363032.xml')

with open('scratch/po524064_items.json', 'r') as f:
    bq = json.load(f)

# Explicit 1-to-1 mapping
mapping = [
    # F1
    (f1[0], '18425484'),  # Aperol
    (f1[1], '4UFLI4'),    # Mr. Big
    (f1[2], 'D16CDL'),    # Bear Beer
    (f1[3], '18425486'),  # Secreto Peruano
    (f1[4], '18629034'),  # Riccadonna Asti
    (f1[5], '18629032'),  # Riccadonna Moscato
    (f1[6], 'C1GS91'),    # Undurraga Zero
    (f1[7], '4WUCZI'),    # Undurraga Rosato
    (f1[8], '2MKLXV'),    # El Jimador
    (f1[9], '7Q0462'),    # Undurraga Aliwen Chardo
    (f1[10], '43706078'), # Undurraga Baron Lacroix
    (f1[11], '43705944'), # Undurraga Brut
    # F2
    (f2[0], 'T0DA5R'),    # Undurraga Brut Lata
    (f2[1], '43706073'),  # Undurraga Aliwen Carmener
    (f2[2], '43705957'),  # Oveja Negra
]

bq_by_sku = {b['sku_id']: b for b in bq}

print(f"{'Item':<35} | {'Q_Fac':>5} | {'Q_Del':>5} | {'MntItem':>8} | {'Recargo':>7} | {'NetoFac':>8} | {'DelivBQ':>9} | {'DiffNeto':>9}")
print("-" * 105)

tot_mnt_item = 0
tot_recargo = 0
tot_neto_fac = 0
tot_deliv_bq = 0
tot_diff_neto = 0

for inv_it, sku in mapping:
    b = bq_by_sku[sku]
    deliv_bq = float(b['amt_delivered'])
    neto_fac = inv_it['neto_linea']
    diff = neto_fac - deliv_bq
    
    tot_mnt_item += inv_it['monto']
    tot_recargo += inv_it['recargo']
    tot_neto_fac += neto_fac
    tot_deliv_bq += deliv_bq
    tot_diff_neto += diff

    print(f"{inv_it['name'][:35]:<35} | {inv_it['qty']:>5.0f} | {float(b['quantity_delivered']):>5.0f} | {inv_it['monto']:>8.0f} | {inv_it['recargo']:>7.0f} | {neto_fac:>8.0f} | {deliv_bq:>9.0f} | {diff:>9.0f}")

print("-" * 105)
print(f"{'TOTAL FACTURADO (15 ITEMS)':<35} | {'':>5} | {'':>5} | {tot_mnt_item:>8.0f} | {tot_recargo:>7.0f} | {tot_neto_fac:>8.0f} | {tot_deliv_bq:>9.0f} | {tot_diff_neto:>9.0f}")

# And Peroni not invoiced
peroni = bq_by_sku['JQN63D']
print(f"\nNO FACTURADO:")
print(f"{peroni['product_name']:<35} | Ord: {peroni['quantity_ordered']} | Del: {peroni['quantity_delivered']} | AmtOrd: {peroni['amt_ordered']} | AmtDel: {peroni['amt_delivered']}")

# And NC
print(f"\nNOTA DE CRÉDITO 6363032:")
print(f"{nc[0]['name']:<35} | Qty: {nc[0]['qty']} | Monto: {nc[0]['monto']} | Recargo: {nc[0]['recargo']} | Neto: {nc[0]['neto_linea']}")

print(f"\nTOTAL CONSOLIDADO NETEADO (Facturas - NC):")
print(f"Facturas Neto: {tot_neto_fac}")
print(f"NC Neto:       {nc[0]['neto_linea']}")
print(f"Neteado:       {tot_neto_fac - nc[0]['neto_linea']}")
print(f"Recepcionado:  {tot_deliv_bq}")
print(f"Diferencia:    {tot_neto_fac - nc[0]['neto_linea'] - tot_deliv_bq}")
