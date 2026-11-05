import urllib.request
import ssl
import json
import os

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_ids = ["acc_8RFAuJ10jcKJfDkGd5", "acc_yZvUK1Aw6y5TAVLD3Y"]

ctx = ssl.create_default_context()

def test_endpoint(path, acc_id=None, method="GET", payload=None):
    url = f"{base_url}{path}"
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    if acc_id:
        headers["x-ax-workspace"] = acc_id

    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
            body = resp.read().decode('utf-8')
            print(f"[SUCCESS] {method} {path} (acc: {acc_id}) -> HTTP {resp.status}")
            try:
                parsed = json.loads(body)
                print("  Response JSON preview:", str(parsed)[:300])
            except:
                print("  Response preview:", body[:200])
            return True, body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        print(f"[HTTP {e.code}] {method} {path} (acc: {acc_id}) -> {err_body[:200]}")
        return False, err_body
    except Exception as e:
        print(f"[ERROR] {method} {path} -> {e}")
        return False, str(e)

print("--- 1. Testing /workspaces without workspace header ---")
test_endpoint("/workspaces")

for acc in acc_ids:
    print(f"\n--- 2. Testing with workspace {acc} ---")
    test_endpoint("/workspaces", acc_id=acc)
    test_endpoint("/userinfo", acc_id=acc)
    test_endpoint("/auth/user/", acc_id=acc)
    test_endpoint("/metrics", acc_id=acc)
    test_endpoint("/metrics/gen", acc_id=acc)
    test_endpoint("/documents", acc_id=acc)
    test_endpoint("/dtes", acc_id=acc)
