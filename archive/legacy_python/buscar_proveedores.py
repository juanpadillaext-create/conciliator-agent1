import subprocess
import json

sql = """
SELECT DISTINCT s.supplier_name, s.supplier_tax_id
FROM peya-data-origins-pro.cl_dmarts.products_suppliers ps, UNNEST(ps.suppliers) as s
WHERE ps.country_code = 'cl'
  AND (
    LOWER(s.supplier_name) LIKE '%agrosuper%'
    OR LOWER(s.supplier_name) LIKE '%ideal%'
    OR LOWER(s.supplier_name) LIKE '%bredenmaster%'
    OR LOWER(s.supplier_name) LIKE '%embrio%'
    OR LOWER(s.supplier_name) LIKE '%andina%'
  )
LIMIT 40;
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=40 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    for d in data:
        print(f"{d.get('supplier_name')} | RUT: {d.get('supplier_tax_id')}")
else:
    print("Error o no json:", res.stderr, res.stdout)
