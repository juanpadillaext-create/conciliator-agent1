import urllib.request
import urllib.parse
import ssl
import json
import time

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
workspaces = [
    ("acc_yZvUK1Aw6y5TAVLD3Y", "Delivery Hero / PedidosYa (77125361-K)"),
    ("acc_8RFAuJ10jcKJfDkGd5", "PedidosYa (76211425-9)")
]

ctx = ssl.create_default_context()

def api_get(endpoint, params=None, ws=None):
    url = f"{base_url}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }
    if ws:
        headers["x-ax-workspace"] = ws
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return 0, str(e)

folios = ["97187814", "97192772"]
rut_proveedor = "91144000-8"
po = "PO510187"

print("=== 1. Buscando en /rec-docs con diferentes filtros ===")
for ws_id, ws_name in workspaces:
    print(f"\n--- Workspace: {ws_name} ({ws_id}) ---")
    for folio in folios:
        for param_key in ["serial", "search", "serial__in"]:
            time.sleep(0.15)
            status, res = api_get("/rec-docs", {param_key: folio}, ws=ws_id)
            if isinstance(res, dict):
                cnt = res.get('count', 0)
                results = res.get('results', [])
                print(f"[{ws_id[:10]}] /rec-docs?{param_key}={folio} -> Status {status}, Count: {cnt}, Results: {len(results)}")
                for r in results:
                    print(f"   => ENCONTRADA: ID={r.get('id')}, Serial={r.get('serial')}, Tipo={r.get('type')}, Proveedor={r.get('supplier_name')} ({r.get('tax_id')}), Total=${r.get('amount_total')}, Ref={r.get('order_reference')}, Fecha={r.get('date') or r.get('issued_date')}")
            else:
                print(f"[{ws_id[:10]}] /rec-docs?{param_key}={folio} -> Status {status}: {str(res)[:100]}")

print("\n=== 2. Buscando por RUT de proveedor (91144000-8) ===")
for ws_id, ws_name in workspaces:
    for rut_param in ["tax_id", "supplier_tax_id", "search"]:
        time.sleep(0.15)
        status, res = api_get("/rec-docs", {rut_param: rut_proveedor}, ws=ws_id)
        if isinstance(res, dict) and res.get('count', 0) > 0:
            print(f"[{ws_id[:10]}] /rec-docs?{rut_param}={rut_proveedor} -> Count: {res.get('count')}")
            for r in res.get('results', [])[:5]:
                print(f"   => Folio: {r.get('serial')}, ID: {r.get('id')}, Total: {r.get('amount_total')}, Proveedor: {r.get('supplier_name')}")

print("\n=== 3. Buscando por PO (PO510187) ===")
for ws_id, ws_name in workspaces:
    for po_param in ["order_reference", "search", "po"]:
        time.sleep(0.15)
        status, res = api_get("/rec-docs", {po_param: po}, ws=ws_id)
        if isinstance(res, dict) and res.get('count', 0) > 0:
            print(f"[{ws_id[:10]}] /rec-docs?{po_param}={po} -> Count: {res.get('count')}")
            for r in res.get('results', []):
                print(f"   => Folio: {r.get('serial')}, ID: {r.get('id')}, Ref: {r.get('order_reference')}")
