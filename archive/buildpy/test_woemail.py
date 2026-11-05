import urllib.request
import urllib.parse
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
workspaces = [
    ("acc_yZvUK1Aw6y5TAVLD3Y", "Delivery Hero Chile (77125361-K)"),
    ("acc_8RFAuJ10jcKJfDkGd5", "PedidosYa (76211425-9)")
]
ctx = ssl.create_default_context()

def api_get(endpoint, params=None, ws=None):
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

for ws, name in workspaces:
    print(f"\n==========================================")
    print(f"Probando {name} ({ws})")
    print(f"==========================================")
    status, res = api_get("/rec-docs/woemail", {"page_size": 10}, ws=ws)
    if isinstance(res, dict):
        cnt = res.get('count', 0)
        print(f"Total woemail count: {cnt}")
        for r in res.get('results', [])[:5]:
            print("  Item:", {k: r.get(k) for k in ['id', 'serial', 'type', 'supplier_name', 'tax_id', 'amount_total', 'date', 'order_reference'] if k in r})
    else:
        print(f"Error {status}: {str(res)[:200]}")
