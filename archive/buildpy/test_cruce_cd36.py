import urllib.request
import urllib.parse
import ssl
import json
import time

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
ws_id = "acc_yZvUK1Aw6y5TAVLD3Y" # Delivery Hero Chile
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

test_pos = ["PO521499", "PO520184", "PO520020", "PO519789", "PO519772", "PO519459", "PO510187"]

print("=== Probando búsqueda de Facturas en Axteroid para POs de CH_36_CD_Chile ===")
for po in test_pos:
    time.sleep(0.2)
    # Search by order_reference
    status, res = api_get("/rec-docs", {"order_reference": po})
    if isinstance(res, dict) and res.get('count', 0) > 0:
        print(f"\n[FOUND] PO {po}: {res.get('count')} facturas encontradas")
        for r in res.get('results', []):
            print(f"  -> Folio: {r.get('serial')}, ID: {r.get('id')}, Proveedor: {r.get('supplier_name')}, Total: ${r.get('amount_total')}, Fecha: {r.get('date') or r.get('issued_date')}")
    else:
        # Try search param
        status, res = api_get("/rec-docs", {"search": po})
        if isinstance(res, dict) and res.get('count', 0) > 0:
            print(f"\n[FOUND by search] PO {po}: {res.get('count')} facturas encontradas")
            for r in res.get('results', []):
                print(f"  -> Folio: {r.get('serial')}, ID: {r.get('id')}, Proveedor: {r.get('supplier_name')}, Total: ${r.get('amount_total')}, Ref: {r.get('order_reference')}")
        else:
            print(f"[NOT FOUND] PO {po} (0 facturas en Axteroid con esa referencia directa)")
