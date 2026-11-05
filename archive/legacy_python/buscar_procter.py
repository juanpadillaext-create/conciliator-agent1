import urllib.request
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"

suppliers_found = {}
for p in range(30, 60):
    url = f"https://services.axteroid.com/rec-docs?page={p}&page_size=100"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-ax-workspace": ws, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            for d in data.get("results", []):
                suppliers_found[d.get("tax_id")] = d.get("supplier_name", "")
    except Exception as e:
        break

for rut, name in suppliers_found.items():
    if "procter" in name.lower() or "gamble" in name.lower():
        print(f"ENCONTRADO: {name} -> RUT: {rut}")
