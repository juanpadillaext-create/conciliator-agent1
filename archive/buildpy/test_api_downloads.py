import urllib.request
import ssl

token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE'
base_url = 'https://services.axteroid.com'
ws_id = 'acc_yZvUK1Aw6y5TAVLD3Y'
ctx = ssl.create_default_context()
doc_id = 'do_AAABoDhD3daH4zVe'

trials = [
    (f"/rec-docs/{doc_id}", "application/pdf"),
    (f"/rec-docs/{doc_id}", "application/xml"),
    (f"/rec-docs/{doc_id}", "application/json"),
    ("/rec-emails/em_AAABoDhD3PbdDIek/attachments", "*/*"),
    ("/rec-emails/em_AAABoDhD3PbdDIek/attachments/1", "*/*"),
]

for path, accept in trials:
    url = f"{base_url}{path}"
    headers = {
        'User-Agent': 'Axteroid-Client/1.0',
        'Authorization': f'Bearer {token}',
        'x-ax-workspace': ws_id,
        'Accept': accept
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            content = resp.read()
            print(f"SUCCESS {path} (Accept: {accept}) -> Status {resp.status}, Content-Type: {resp.headers.get('Content-Type')}, Size: {len(content)} bytes")
            if 'pdf' in accept:
                print("  PDF Magic Bytes:", content[:10])
            elif 'xml' in accept:
                print("  XML preview:", content[:100])
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} for {path} (Accept: {accept}): {e.read().decode('utf-8', errors='ignore')[:150]}")
    except Exception as e:
        print(f"ERR {path}: {e}")
