import json
import xml.etree.ElementTree as ET

tree1 = ET.parse('scratch/doc_10207759.xml')
tree2 = ET.parse('scratch/doc_10207760.xml')
tree_nc = ET.parse('scratch/doc_6363032.xml')

with open('scratch/po524064_items.json', 'r') as f:
    bq = json.load(f)

# Let's extract all item values:
items_data = []

def parse_items(t, prefix):
    res = []
    for elem in t.getroot().iter():
        if elem.tag.endswith('Detalle'):
            nmb = elem.find('{*}NmbItem').text
            qty = float(elem.find('{*}QtyItem').text)
            prc = float(elem.find('{*}PrcItem').text)
            mnt = float(elem.find('{*}MontoItem').text)
            rec = float(elem.find('{*}RecargoMonto').text) if elem.find('{*}RecargoMonto') is not None else 0.0
            dsc = float(elem.find('{*}DescuentoMonto').text) if elem.find('{*}DescuentoMonto') is not None else 0.0
            res.append({
                'name': f"{prefix}:{nmb[:20]}",
                'qty': qty,
                'prc': prc,
                'mnt': mnt,
                'rec': rec,
                'dsc': dsc,
                'neto': mnt + rec,
                'bruto': qty * prc
            })
    return res

f1_items = parse_items(tree1, 'F1')
f2_items = parse_items(tree2, 'F2')
nc_items = parse_items(tree_nc, 'NC')

bq_data = []
for b in bq:
    bq_data.append({
        'name': f"BQ:{b['sku_id']}:{b['product_name'][:20]}",
        'q_ord': float(b['quantity_ordered']),
        'q_del': float(b['quantity_delivered']),
        'cost': float(b['unit_cost']),
        'amt_ord': float(b['amt_ordered']),
        'amt_del': float(b['amt_delivered']),
        'diff': float(b['amt_ordered']) - float(b['amt_delivered'])
    })

TARGET = 59987

# Let's check subsets of differences between invoiced and delivered/ordered
# What if someone calculated:
# Sum of (some lines) = 59987?
# Let's test all subsets of item values (up to 4 items)
all_values = []
for it in f1_items + f2_items + nc_items:
    all_values.append((f"{it['name']}:mnt", it['mnt']))
    all_values.append((f"{it['name']}:neto", it['neto']))
    all_values.append((f"{it['name']}:bruto", it['bruto']))
    all_values.append((f"{it['name']}:dsc", it['dsc']))
    all_values.append((f"{it['name']}:rec", it['rec']))

for b in bq_data:
    all_values.append((f"{b['name']}:amt_ord", b['amt_ord']))
    all_values.append((f"{b['name']}:amt_del", b['amt_del']))
    all_values.append((f"{b['name']}:diff", b['diff']))

print(f"Total values: {len(all_values)}")

# Check combinations of 2 and 3
for i in range(len(all_values)):
    for j in range(i+1, len(all_values)):
        v1, n1 = all_values[i][1], all_values[i][0]
        v2, n2 = all_values[j][1], all_values[j][0]
        if abs(v1 + v2 - TARGET) < 1.0:
            print(f"MATCH 2: {n1} + {n2} = {v1 + v2}")
        if abs(v1 - v2 - TARGET) < 1.0:
            print(f"MATCH 2: {n1} - {n2} = {v1 - v2}")
        if abs(v2 - v1 - TARGET) < 1.0:
            print(f"MATCH 2: {n2} - {n1} = {v2 - v1}")

for i in range(len(all_values)):
    for j in range(i+1, len(all_values)):
        for k in range(j+1, len(all_values)):
            v1, n1 = all_values[i][1], all_values[i][0]
            v2, n2 = all_values[j][1], all_values[j][0]
            v3, n3 = all_values[k][1], all_values[k][0]
            if abs(v1 + v2 + v3 - TARGET) < 1.0:
                print(f"MATCH 3: {n1} + {n2} + {n3} = {v1 + v2 + v3}")
            if abs(v1 + v2 - v3 - TARGET) < 1.0:
                print(f"MATCH 3: {n1} + {n2} - {n3} = {v1 + v2 - v3}")
            if abs(v1 - v2 - v3 - TARGET) < 1.0:
                print(f"MATCH 3: {n1} - {n2} - {n3} = {v1 - v2 - v3}")
