import subprocess
import json

sql = """
SELECT DISTINCT 
  supplier_name, 
  supplier_id
FROM peya-data-origins-pro.cl_dmarts.purchase_orders
WHERE created_localtime_at >= '2026-06-01'
  AND country_code = 'cl'
  AND (
    LOWER(supplier_name) LIKE '%agrosuper%'
    OR LOWER(supplier_name) LIKE '%ideal%'
    OR LOWER(supplier_name) LIKE '%bredenmaster%'
    OR LOWER(supplier_name) LIKE '%embrio%'
    OR LOWER(supplier_name) LIKE '%andina%'
  )
LIMIT 30;
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=30 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    for d in data:
        print(f"PO Supplier: {d.get('supplier_name')} | ID: {d.get('supplier_id')}")
else:
    print("Error:", res.stderr)
