import urllib.request
import ssl

token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE'
base_url = 'https://services.axteroid.com'
ws_id = 'acc_yZvUK1Aw6y5TAVLD3Y'
ctx = ssl.create_default_context()
doc_id = 'do_AAABoDhD3daH4zVe'

paths = [
    f"/rec-docs/{doc_id}/download/",
    f"/rec-docs/{doc_id}/download/?xml=true",
    f"/rec-docs/{doc_id}/download/?xml=false",
    f"/rec-docs/{doc_id}/download",
    f"/rec-docs/{doc_id}/download?xml=true",
    f"/rec-docs/{doc_id}/xml/",
    f"/rec-docs/{doc_id}/pdf/",
]

for p in paths:
    for m in ['GET', 'POST']:
        url = f"{base_url}{p}"
        headers = {
            'User-Agent': 'Axteroid-Client/1.0',
            'Authorization': f'Bearer {token}',
            'x-ax-workspace': ws_id,
            'Accept': '*/*'
        }
        req = urllib.request.Request(url, headers=headers, method=m)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
                data = resp.read()
                print(f"SUCCESS {m} {p} -> Status {resp.status}, Content-Type: {resp.headers.get('Content-Type')}, Size: {len(data)}")
                if len(data) > 0 and 'xml' in resp.headers.get('Content-Type', '').lower():
                    print("  XML content preview:", data[:200].decode('latin-1', errors='ignore'))
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', errors='ignore')[:100]
            print(f"HTTP {e.code} {m} {p} -> {msg}")
        except Exception as e:
            print(f"ERR {m} {p} -> {e}")
