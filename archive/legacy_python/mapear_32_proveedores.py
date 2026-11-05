import subprocess
import json

names = [
    "nestle", "embonor", "andina", "carozzi", "agrosuper", "ideal", "breden", "embrio",
    "softys", "santa elena", "promerco", "evercrisp", "excelencia", "el toco", "proa",
    "alimentos y frutos", "procter", "jj", "tresmontes", "exportadora", "watt", "brasil",
    "ñuble", "nuble", "bambus", "punto azul", "ariztia", "fernandez", "cooperativa", "colun",
    "cabros", "ccu", "consorcio", "cial"
]

sql = f"""
SELECT DISTINCT 
  s.supplier_name, 
  s.supplier_tax_id
FROM peya-data-origins-pro.cl_dmarts.products_suppliers ps, UNNEST(ps.suppliers) as s
WHERE ps.country_code = 'cl'
  AND (
    {' OR '.join([f"LOWER(s.supplier_name) LIKE '%{n}%'" for n in names])}
  )
ORDER BY s.supplier_name ASC;
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=200 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    data = json.loads(stdout[idx:])
    print(f"Total coincidencias encontradas en BigQuery: {len(data)}")
    for d in data:
        print(f"{d.get('supplier_name')} | RUT: {d.get('supplier_tax_id')}")
else:
    print("Error:", res.stderr)
