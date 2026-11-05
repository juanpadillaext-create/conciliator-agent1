import urllib.request
import urllib.parse
import ssl
import json
import time

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
ws_id = "acc_yZvUK1Aw6y5TAVLD3Y"
ctx = ssl.create_default_context()

def api_get(endpoint, params=None):
    url = f"{base_url}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "x-ax-workspace": ws_id
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return 0, str(e)

print("=== 1. Buscando en /rec-docs con search='Carozzi' ===")
status, res = api_get("/rec-docs", {"search": "Carozzi", "page_size": 10})
if isinstance(res, dict):
    print(f"rec-docs -> Status: {status}, Total count: {res.get('count')}")
    for r in res.get('results', [])[:5]:
        print(f"  Folio: {r.get('serial')}, ID: {r.get('id')}, Proveedor: {r.get('supplier_name')} ({r.get('tax_id')}), Total: ${r.get('amount_total')}, Ref: {r.get('order_reference')}, Fecha: {r.get('date') or r.get('issued_date')}")

print("\n=== 2. Buscando en /rec-docs/woemail con search='Carozzi' ===")
status, res = api_get("/rec-docs/woemail", {"search": "Carozzi", "page_size": 10})
if isinstance(res, dict):
    print(f"woemail -> Status: {status}, Total count: {res.get('count')}")
    for r in res.get('results', [])[:5]:
        print(f"  Folio: {r.get('serial')}, ID: {r.get('id')}, Proveedor: {r.get('supplier_name')} ({r.get('tax_id')}), Total: ${r.get('amount_total')}, Ref: {r.get('order_reference')}, Fecha: {r.get('date') or r.get('issued_date')}")
else:
    print(f"woemail -> Status: {status}, Response: {res[:200]}")
