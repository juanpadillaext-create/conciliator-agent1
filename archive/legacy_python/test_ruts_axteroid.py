import urllib.request
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"

ruts_test = {
    "Evercrisp": "96509490-3",
    "Distribucion y Excelencia": "76045520-2",
    "El Toco": "78030690-4",
    "Proa": "76081498-9",
    "P&G": "89345000-8",
    "Carnes Nuble": "96518070-2",
    "Colun": "81094100-6",
    "Santa Elena": "84472400-4",
    "CCU": "99554560-8",
    "CIAL": "80186300-0",
    "JJ Alimentos": "77183217-2",
    "Exofrut": "78231878-0",
    "ICB (Cafe do Brasil)": "93178000-K",
    "PF": "91004000-6",
    "Bambus": "78185379-8"
}

for name, rut in ruts_test.items():
    url = f"https://services.axteroid.com/rec-docs?tax_id={rut}&page_size=1"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-ax-workspace": ws, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            cnt = data.get("count", 0)
            res = data.get("results", [])
            sname = res[0].get("supplier_name") if res else "N/A"
            print(f"{name:25} | RUT: {rut:12} | Facturas: {cnt:4} | Nombre: {sname}")
    except Exception as e:
        print(f"{name}: Error {e}")
