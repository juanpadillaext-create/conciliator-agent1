import urllib.request
import ssl
import json
import os

token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE'
base_url = 'https://services.axteroid.com'
ws_id = 'acc_yZvUK1Aw6y5TAVLD3Y'
ctx = ssl.create_default_context()
headers = {
    'User-Agent': 'Axteroid-Client/1.0',
    'Authorization': f'Bearer {token}',
    'x-ax-workspace': ws_id,
    'Accept': 'application/json'
}

email_ids = {
    "97187814": "em_AAABoDhD3PbdDIek",
    "97192772": "em_AAABoDoA05I_vs_X"
}

os.makedirs("facturas_xml", exist_ok=True)

for folio, eid in email_ids.items():
    url = f"{base_url}/rec-emails/{eid}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"\n=== CORREO / ADJUNTO PARA FACTURA {folio} ({eid}) ===")
            print("Keys:", list(data.keys()))
            for k in ['subject', 'from', 'to', 'date', 'files', 'attachments']:
                if k in data:
                    print(f"  {k}: {data[k]}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} for {eid}: {e.read().decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"ERR: {e}")
