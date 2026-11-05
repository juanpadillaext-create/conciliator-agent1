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
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

status, res_rec = api_get("/rec-docs", {"tax_id": "96591040-9", "page_size": 100})
print(f"REC-DOCS de CAROZZI (RUT 96591040-9): Total Count = {res_rec.get('count')}")
for r in res_rec.get('results', [])[:10]:
    print(f"  Folio: {r.get('serial')}, Tipo: {r.get('type')}, Total: ${r.get('amount_total')}, Ref: {r.get('order_reference')}, Fecha: {r.get('date') or r.get('issued_date')}")

status, res_wo = api_get("/rec-docs/woemail", {"tax_id": "96591040-9", "page_size": 100})
print(f"\nWOEMAIL de CAROZZI (RUT 96591040-9): Total Count = {res_wo.get('count')}")
for r in res_wo.get('results', [])[:10]:
    print(f"  Folio: {r.get('serial')}, Tipo: {r.get('type')}, Total: ${r.get('amount_total')}, Ref: {r.get('order_reference')}, Fecha: {r.get('date') or r.get('issued_date')}")
