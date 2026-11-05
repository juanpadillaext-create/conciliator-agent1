import urllib.request
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"  # PedidosYa / Delivery Hero

ctx = ssl.create_default_context()
url = f"{base_url}/documents?limit=5"
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
        print(f"Total count: {data.get('count')}")
        results = data.get('results', [])
        print(f"Results returned: {len(results)}")
        if results:
            print("\nFirst document structure:")
            print(json.dumps(results[0], indent=2, ensure_ascii=False))
            
            print("\nKeys in document:")
            print(list(results[0].keys()))
            
            # Print types of documents in the 5 results
            doc_types = [f"Serial: {r.get('serial')}, DocType: {r.get('document_type') or r.get('type')}, Total: {r.get('amount_total')}, Date: {r.get('date') or r.get('time')}" for r in results]
            print("\nSummary of 5 docs:")
            for d in doc_types:
                print(" ", d)
except Exception as e:
    print("Error:", e)
