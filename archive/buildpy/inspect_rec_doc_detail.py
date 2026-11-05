import urllib.request
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"  # PedidosYa / Delivery Hero Stores

ctx = ssl.create_default_context()
url = f"{base_url}/rec-docs"
headers = {
    "User-Agent": "Axteroid-Client/1.0",
    "Authorization": f"Bearer {token}",
    "x-ax-workspace": acc_id,
    "Accept": "application/json"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    results = data.get('results', [])
    if results:
        doc = results[0]
        print("=== REC-DOC FULL DETAILS ===")
        print(json.dumps(doc, indent=2, ensure_ascii=False))
        
        # Check details of first 5 docs
        print("\n=== FIRST 5 REC-DOCS ===")
        for d in results[:5]:
            print(f"ID: {d.get('id')} | Tipo: {d.get('type')} | Folio/Serial: {d.get('serial')} | Proveedor: {d.get('supplier_name')} ({d.get('tax_id')}) | Total: ${d.get('amount_total')} | OC Ref: {d.get('order_reference')} | Status: {d.get('status')} | ActionBook: {d.get('action_book')}")
