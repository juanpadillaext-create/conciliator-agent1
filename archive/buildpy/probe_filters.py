import urllib.request
import urllib.parse
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"  # PedidosYa / Delivery Hero Stores

ctx = ssl.create_default_context()

def query_docs(params):
    qs = urllib.parse.urlencode(params)
    url = f"{base_url}/documents?{qs}"
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "x-ax-workspace": acc_id,
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            cnt = data.get('count', 0)
            res = data.get('results', [])
            types = set(r.get('type') for r in res)
            print(f"Query {params} -> count: {cnt}, returned: {len(res)}, types: {types}")
            if res:
                r0 = res[0]
                print(f"   Sample: ID={r0.get('id')}, Type={r0.get('type')}, Serial={r0.get('serial')}, Supplier={r0.get('supplier_name')}, Customer={r0.get('customer_name')}, Total={r0.get('amount_total')}")
            return data
    except urllib.error.HTTPError as e:
        print(f"Query {params} -> HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')[:150]}")
    except Exception as e:
        print(f"Query {params} -> Error: {e}")

print("--- Testing Document Types ---")
query_docs({"type": "CL33"})  # Factura electronica
query_docs({"type": "CL61"})  # Nota de credito
query_docs({"type": "CL52"})  # Guia de despacho

print("\n--- Testing Direction or Reception ---")
query_docs({"direction": "in"})
query_docs({"direction": "inbound"})
query_docs({"direction": "received"})
query_docs({"source": "REC"})

print("\n--- Testing Other Endpoints ---")
other_endpoints = [
    "/received_documents",
    "/inbound_documents",
    "/received-documents",
    "/receptions",
    "/purchase_orders",
    "/orders",
    "/conciliations",
    "/matchings",
    "/matches",
    "/discrepancies",
    "/suppliers",
    "/branches"
]

for ep in other_endpoints:
    url = f"{base_url}{ep}"
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "x-ax-workspace": acc_id,
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"[FOUND] {ep} -> {type(data)}: count={data.get('count') if isinstance(data, dict) else len(data)}")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"[{e.code}] {ep} -> {e.read().decode('utf-8', errors='ignore')[:100]}")
    except Exception:
        pass
