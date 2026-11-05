import subprocess
import json

query_pos = """
SELECT 
  po_order_id,
  supplier_name,
  quantity_ordered,
  quantity_delivered,
  COALESCE(quantity_ordered - quantity_delivered, 0) as diff_qty,
  order_values_lc.amt_ordered_lc,
  order_values_lc.amt_delivered_lc,
  ROUND(COALESCE(order_values_lc.amt_ordered_lc - order_values_lc.amt_delivered_lc, 0), 0) as descalce_monto_clp,
  created_localtime_at,
  warehouse_id
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders`
WHERE created_localtime_at >= '2026-08-01'
  AND country_code = 'cl'
  AND warehouse_id = 'cc5d044f-9995-47cc-a1fe-975a04117178'
  AND LOWER(supplier_name) LIKE '%carozzi%'
ORDER BY created_localtime_at DESC;
"""

with open("query_pos.sql", "w", encoding="utf-8") as f:
    f.write(query_pos)

cmd = 'Get-Content query_pos.sql -Raw | bq query --use_legacy_sql=false --format=json --max_rows=1000 --label datacloud:antigravity'
res = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True, check=True)

pos = json.loads(res.stdout)
print(f"Total POs Carozzi en BigQuery: {len(pos)}")

with open("data/carozzi_pos_bq.json", "w", encoding="utf-8") as f:
    json.dump(pos, f, ensure_ascii=False, indent=2)

print("Guardado en data/carozzi_pos_bq.json")
