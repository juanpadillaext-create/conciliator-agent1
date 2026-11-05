import subprocess
import json

names = ["evercrisp", "excelencia", "toco", "proa", "procter", "gamble", "nuble", "ñuble", "cabros", "ariztia"]

sql = f"""
SELECT DISTINCT 
  s.supplier_name, 
  s.supplier_tax_id
FROM peya-data-origins-pro.cl_dmarts.products_suppliers ps, UNNEST(ps.suppliers) as s
WHERE ps.country_code = 'cl'
  AND (
    {' OR '.join([f"LOWER(s.supplier_name) LIKE '%{n}%'" for n in names])}
  );
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=50 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    for d in data:
        print(f"{d.get('supplier_name')} | RUT: {d.get('supplier_tax_id')}")
