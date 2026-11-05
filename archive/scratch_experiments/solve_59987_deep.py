import json
import itertools

with open('scratch/po524064_items.json', 'r') as f:
    bq_items = json.load(f)

# Let's inspect all items in BQ
print("=== BQ ITEMS ===")
total_ord = 0
total_del = 0
for i, item in enumerate(bq_items):
    ord_val = float(item['amt_ordered'])
    del_val = float(item['amt_delivered'])
    total_ord += ord_val
    total_del += del_val
    diff = ord_val - del_val
    if diff != 0:
        print(f"Diff Item {i}: {item['product_name']} | Sku: {item['sku_id']} | Ord: {ord_val} | Del: {del_val} | Diff: {diff}")

print(f"Total Ord: {total_ord:.2f}, Total Del: {total_del:.2f}, Diff: {total_ord - total_del:.2f}")

# Target
TARGET = 59987
print(f"\nLooking for TARGET = {TARGET}")

# What if TARGET is a combination of BQ item amounts or differences?
# Let's collect all possible numbers:
nums = {
    'bq_ord': 526094,
    'bq_del': 495202,
    'bq_diff': 30892,
    'peroni_missing': 28608,
    'mrbig_missing': 2284,
    'f1_neto': 477667,
    'f1_total': 660358,
    'f1_lines': 406987,
    'f1_recargo': 70680,
    'f2_neto': 59830,
    'f2_total': 80659,
    'f2_lines': 46150,
    'f2_recargo': 13680,
    'nc_neto': 2067,
    'nc_total': 2591,
    'nc_lines': 1307,
    'nc_recargo': 760,
    'tot_fac_bruto_neto': 537497,
    'tot_fac_neteado_neto': 535430,
    'tot_lines': 453137,
    'tot_recargo': 84360,
    'tot_fac_bruto_tot': 741017,
    'tot_fac_neteado_tot': 738426,
}

# Check all subsets of nums with + and -
items_list = list(nums.items())
for r in range(1, 5):
    for combo in itertools.combinations(items_list, r):
        for signs in itertools.product([1, -1], repeat=r):
            val = sum(s * item[1] for s, item in zip(signs, combo))
            if abs(val - TARGET) <= 10:
                expr = " ".join(f"{'+' if s > 0 else '-'} {item[0]}({item[1]})" for s, item in zip(signs, combo))
                print(f"MATCH: {expr} = {val} (diff: {val - TARGET})")

