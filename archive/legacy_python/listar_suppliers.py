import subprocess
import json

sql = """
SELECT DISTINCT 
  supplier_name, 
  supplier_id
FROM peya-data-origins-pro.cl_dmarts.purchase_orders
WHERE created_localtime_at >= '2026-06-01'
  AND country_code = 'cl'
ORDER BY supplier_name ASC;
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=200 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    for d in data:
        name = d.get('supplier_name', '')
        if any(k in name.lower() for k in ['ideal', 'embrio', 'embonor', 'bimbo', 'bread', 'agro', 'andina']):
            print(f"PO: {name} (ID: {d.get('supplier_id')})")
