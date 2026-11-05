import urllib.request
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"

terms = ["agrosuper", "ideal", "bredenmaster", "embrio", "embonor"]

for term in terms:
    url = f"https://services.axteroid.com/rec-docs?search={term}&page_size=5"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-ax-workspace": ws, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read().decode())
            cnt = data.get("count", 0)
            print(f"=== Termino '{term}': {cnt} facturas encontradas ===")
            seen_ruts = set()
            for doc in data.get("results", []):
                rut = doc.get("tax_id")
                supp = doc.get("supplier_name")
                if rut not in seen_ruts:
                    print(f"   -> Proveedor: {supp} | RUT: {rut}")
                    seen_ruts.add(rut)
    except Exception as e:
        print(f"Error {term}: {e}")
