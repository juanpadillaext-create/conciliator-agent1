import urllib.request
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"  # PedidosYa / Delivery Hero Stores

ctx = ssl.create_default_context()

endpoints_to_test = [
    "/purchases",
    "/purchases/pending-receive",
    "/reconciliations",
    "/sire",
    "/metrics/rec",
    "/branches",
    "/customers",
    "/suppliers/categories",
    "/pos",
    "/summaries"
]

for ep in endpoints_to_test:
    url = f"{base_url}{ep}"
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "x-ax-workspace": acc_id,
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
            body = resp.read().decode('utf-8')
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    print(f"[SUCCESS {resp.status}] {ep} -> count: {data.get('count', len(data.get('results', [])))}, keys: {list(data.keys())[:5]}")
                elif isinstance(data, list):
                    print(f"[SUCCESS {resp.status}] {ep} -> list of length {len(data)}")
            except Exception:
                print(f"[SUCCESS {resp.status}] {ep} -> raw body length {len(body)}")
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {ep} -> {e.read().decode('utf-8', errors='ignore')[:120]}")
    except Exception as e:
        print(f"[ERROR] {ep} -> {e}")
