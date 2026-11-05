import subprocess
import json

sql = """
SELECT DISTINCT 
  supplier_name, 
  supplier_id
FROM peya-data-origins-pro.cl_dmarts.purchase_orders
WHERE country_code = 'cl'
  AND (
    LOWER(supplier_name) LIKE '%evercrisp%'
    OR LOWER(supplier_name) LIKE '%excelencia%'
    OR LOWER(supplier_name) LIKE '%toco%'
    OR LOWER(supplier_name) LIKE '%proa%'
    OR LOWER(supplier_name) LIKE '%procter%'
    OR LOWER(supplier_name) LIKE '%cabros%'
  );
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=50 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    for d in data:
        print(f"PO: {d.get('supplier_name')} | ID: {d.get('supplier_id')}")
