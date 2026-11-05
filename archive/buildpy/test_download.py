import urllib.request
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"
doc_id = "do_AAABoO16ZhdBKDO5"

ctx = ssl.create_default_context()

# Test downloading XML or PDF for the document
for xml_flag in [True, False]:
    url = f"{base_url}/rec-docs/download?ids={doc_id}&xml={'true' if xml_flag else 'false'}"
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "x-ax-workspace": acc_id
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            content_type = resp.headers.get('Content-Type')
            data = resp.read()
            print(f"[DOWNLOAD SUCCESS] xml={xml_flag} -> Content-Type: {content_type}, Size: {len(data)}")
            if xml_flag:
                # Save first 500 chars
                print("XML Preview:\n", data.decode('utf-8', errors='ignore')[:600])
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] xml={xml_flag} -> {e.read().decode('utf-8', errors='ignore')[:200]}")
    except Exception as e:
        print(f"[ERROR] {e}")
