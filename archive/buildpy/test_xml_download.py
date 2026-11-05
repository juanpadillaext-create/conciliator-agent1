import urllib.request
import ssl
import json
import zipfile
import io

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"
doc_id = "do_AAABoO16ZhdBKDO5"

ctx = ssl.create_default_context()

url = f"{base_url}/rec-docs/download?xml=true"
headers = {
    "User-Agent": "Axteroid-Client/1.0",
    "Authorization": f"Bearer {token}",
    "x-ax-workspace": acc_id,
    "Content-Type": "application/json"
}
payload = json.dumps({"document_ids": [doc_id]}).encode('utf-8')

req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        content_type = resp.headers.get('Content-Type')
        data = resp.read()
        print(f"[SUCCESS] Content-Type: {content_type}, Size: {len(data)} bytes")
        
        # Check if it's a zip file
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                print("Files in ZIP:", zf.namelist())
                first_file = zf.namelist()[0]
                xml_content = zf.read(first_file).decode('ISO-8859-1', errors='ignore')
                print(f"\n--- Preview of {first_file} ---")
                print(xml_content[:1500])
        except zipfile.BadZipFile:
            print("Not a zip, raw content preview:")
            print(data[:500])
except urllib.error.HTTPError as e:
    print(f"[HTTP {e.code}] {e.read().decode('utf-8', errors='ignore')}")
except Exception as e:
    print(f"[ERROR] {e}")
