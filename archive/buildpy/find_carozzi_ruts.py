import urllib.request
import urllib.parse
import ssl
import json
import time

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
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return 0, str(e)

ruts = ["96504000-5", "96.504.000-5", "965040005", "96504000"]

print("Probando ruts de Carozzi...")
for r in ruts:
    for ep in ["/rec-docs", "/rec-docs/woemail"]:
        for p in ["tax_id", "supplier_tax_id", "search"]:
            status, res = api_get(ep, {p: r, "page_size": 5})
            if isinstance(res, dict) and res.get('count', 0) > 0:
                print(f"MATCH: {ep}?{p}={r} -> count: {res.get('count')}")
                for doc in res.get('results', []):
                    print("  ", doc.get('serial'), doc.get('supplier_name'), doc.get('amount_total'), doc.get('order_reference'))
