import json
import xml.etree.ElementTree as ET

tree1 = ET.parse('scratch/doc_10207759.xml')
tree2 = ET.parse('scratch/doc_10207760.xml')
tree_nc = ET.parse('scratch/doc_6363032.xml')

with open('scratch/po524064_items.json', 'r') as f:
    bq = json.load(f)

# Find any number equal to 157, or difference equal to 157
all_nums = []
for t, name in [(tree1, 'F1'), (tree2, 'F2'), (tree_nc, 'NC')]:
    for elem in t.getroot().iter():
        if elem.text:
            try:
                val = float(elem.text.strip())
                all_nums.append((f"{name}:{elem.tag.split('}')[-1]}", val))
            except:
                pass

for b in bq:
    for k, v in b.items():
        try:
            val = float(v)
            all_nums.append((f"BQ:{b['sku_id']}:{k}", val))
        except:
            pass

print(f"Total numbers found: {len(all_nums)}")
for name, val in all_nums:
    if abs(val - 157) < 0.01:
        print(f"Exact 157: {name} = {val}")

for i in range(len(all_nums)):
    for j in range(len(all_nums)):
        n1, v1 = all_nums[i]
        n2, v2 = all_nums[j]
        if abs(v1 - v2 - 157) < 0.01:
            print(f"Diff 157: {n1}({v1}) - {n2}({v2}) = 157")
