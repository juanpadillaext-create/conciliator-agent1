import urllib.request
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"

# Muestrear facturas para listar proveedores
url = "https://services.axteroid.com/rec-docs?date__gte=2026-09-01&page_size=100"
req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-ax-workspace": ws, "Accept": "application/json"})
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode())
    sups = {}
    for doc in data.get("results", []):
        sups[doc.get("tax_id")] = doc.get("supplier_name")
    for rut, name in sorted(sups.items(), key=lambda x: str(x[1])):
        print(f"RUT: {rut} | {name}")
