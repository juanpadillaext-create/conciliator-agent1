import urllib.request
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"  # PedidosYa / Delivery Hero Stores

ctx = ssl.create_default_context()

for path in ["/rec-docs", "/rec_docs", "/received-documents"]:
    url = f"{base_url}{path}"
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
            print(f"[SUCCESS] {path} -> {type(data)}")
            if isinstance(data, dict):
                print(f"  Count: {data.get('count')}")
                results = data.get('results', [])
                print(f"  Results length: {len(results)}")
                if results:
                    print("  Sample item keys:", list(results[0].keys()))
                    print("  Sample item preview:\n", json.dumps(results[0], indent=2, ensure_ascii=False)[:600])
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {path} -> {e.read().decode('utf-8', errors='ignore')[:150]}")
    except Exception as e:
        print(f"[ERROR] {path} -> {e}")
