import urllib.request
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"

names_to_check = [
    "santa elena", "toco", "evercrisp", "excelencia", "proa", "procter", "gamble",
    "jj", "cafe do brasil", "bambus", "colun", "cooperativa", "cabros", "cial", "consorcio",
    "ariztia", "fernandez"
]

# Consultamos los últimos 500 documentos en Axteroid para mapear los proveedores reales
url = "https://services.axteroid.com/rec-docs?page_size=200"
req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-ax-workspace": ws, "Accept": "application/json"})
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode())
    docs = data.get("results", [])
    
suppliers_map = {}
for d in docs:
    rut = d.get("tax_id")
    nom = d.get("supplier_name", "")
    suppliers_map[rut] = nom

print(f"Total proveedores únicos en muestra de 200 docs de Axteroid: {len(suppliers_map)}")
for rut, nom in sorted(suppliers_map.items(), key=lambda x: str(x[1])):
    print(f"{nom:45} | RUT: {rut}")
