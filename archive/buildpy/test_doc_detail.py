import urllib.request
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"
doc_id = "do_AAABoO16ZhdBKDO5"

ctx = ssl.create_default_context()

test_urls = [
    f"/rec-docs/{doc_id}",
    f"/documents/{doc_id}",
    f"/rec-docs/{doc_id}/items",
    f"/documents/{doc_id}/items",
    f"/rec-docs/{doc_id}/xml",
    f"/documents/{doc_id}/xml"
]

for path in test_urls:
    url = f"{base_url}{path}"
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "x-ax-workspace": acc_id,
        "Accept": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
            content_type = resp.headers.get('Content-Type', '')
            body = resp.read()
            print(f"[SUCCESS {resp.status}] {path} -> {content_type} (length: {len(body)})")
            if 'json' in content_type:
                data = json.loads(body.decode('utf-8'))
                if 'items' in data:
                    print(f"  Items in JSON: {len(data['items'])}")
                    if data['items']:
                        print("  Sample item:", data['items'][0])
                else:
                    print("  JSON keys:", list(data.keys())[:10])
            elif 'xml' in content_type or path.endswith('/xml'):
                print("  XML preview:", body.decode('utf-8', errors='ignore')[:300])
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {path}")
    except Exception as e:
        print(f"[ERROR] {path} -> {e}")
