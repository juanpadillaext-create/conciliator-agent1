import urllib.request
import urllib.parse
import ssl
import json
import os
import subprocess

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"
ctx = ssl.create_default_context()

def api_get(endpoint, params=None):
    url = f"{base_url}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "User-Agent": "Axteroid-Client/1.0",
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "x-ax-workspace": ws
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return 0, str(e)

print("1. Obteniendo facturas de Carozzi desde Axteroid (rec-docs)...")
all_carozzi_docs = []
# Get first 100 rec-docs
status, res = api_get("/rec-docs", {"tax_id": "96591040-9", "page_size": 100})
if isinstance(res, dict):
    all_carozzi_docs.extend(res.get('results', []))
    print(f"Rec-docs obtenidos: {len(all_carozzi_docs)}")

# Get first 100 woemail
print("2. Obteniendo facturas de Carozzi desde Axteroid (woemail)...")
status, res_wo = api_get("/rec-docs/woemail", {"tax_id": "96591040-9", "page_size": 100})
if isinstance(res_wo, dict):
    wo_docs = res_wo.get('results', [])
    for d in wo_docs:
        d['is_woemail'] = True
    all_carozzi_docs.extend(wo_docs)
    print(f"Woemail obtenidos: {len(wo_docs)}")

os.makedirs("data", exist_ok=True)
with open("data/carozzi_axteroid_raw.json", "w", encoding="utf-8") as f:
    json.dump(all_carozzi_docs, f, ensure_ascii=False, indent=2)

print(f"Total documentos Carozzi guardados: {len(all_carozzi_docs)}")
