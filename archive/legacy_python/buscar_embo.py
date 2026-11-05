import subprocess
import json

sql = """
SELECT DISTINCT supplier_name, supplier_id
FROM peya-data-origins-pro.cl_dmarts.purchase_orders
WHERE country_code = 'cl'
  AND (LOWER(supplier_name) LIKE '%embr%' OR LOWER(supplier_name) LIKE '%embo%');
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=100 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    for d in data:
        print(f"PO Match: {d.get('supplier_name')} | ID: {d.get('supplier_id')}")
