import json
import os

with open("data/dashboard_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

os.makedirs("dashboard", exist_ok=True)
with open("dashboard/data.js", "w", encoding="utf-8") as f:
    f.write("window.DASHBOARD_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")

print("Generado dashboard/data.js exitosamente.")
