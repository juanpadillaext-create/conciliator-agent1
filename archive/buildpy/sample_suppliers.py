import urllib.request
import urllib.parse
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"
ctx = ssl.create_default_context()

def api_get(endpoint, params=None):
    url = f"{base_url}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "x-ax-workspace": ws
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return 0, str(e)

status, res = api_get("/rec-docs", {"page_size": 40})
print("=== REC-DOCS (ÚLTIMOS 40) ===")
if isinstance(res, dict):
    suppliers = set()
    for r in res.get('results', []):
        suppliers.add((r.get('tax_id'), r.get('supplier_name')))
    for t, s in sorted(suppliers):
        print(f"  RUT: {t} | Proveedor: {s}")

status, res = api_get("/rec-docs/woemail", {"page_size": 40})
print("\n=== WOEMAIL (ÚLTIMOS 40) ===")
if isinstance(res, dict):
    suppliers = set()
    for r in res.get('results', []):
        suppliers.add((r.get('tax_id'), r.get('supplier_name')))
    for t, s in sorted(suppliers):
        print(f"  RUT: {t} | Proveedor: {s}")
