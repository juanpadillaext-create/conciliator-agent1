import urllib.request
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
ws = "acc_yZvUK1Aw6y5TAVLD3Y"

ruts = {
    "Carozzi": "96591040-9",
    "Andina": "91144000-8",
    "Nestlé": "96557910-9",
    "Agrosuper": "79984240-8",
    "Ideal": "82623500-4",
    "Bredenmaster": "96606310-6",
    "Embrio Chile": "99540130-4"
}

for name, rut in ruts.items():
    url = f"https://services.axteroid.com/rec-docs?type=CL33&tax_id={rut}&date__gte=2026-09-01&date__lte=2026-09-30"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-ax-workspace": ws, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"{name:15} ({rut}): {data.get('count', 0)} facturas")
    except Exception as e:
        print(f"{name}: Error {e}")
