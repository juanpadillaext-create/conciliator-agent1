import urllib.request
import ssl
import os

token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE'
base_url = 'https://services.axteroid.com'
ws_id = 'acc_yZvUK1Aw6y5TAVLD3Y'
ctx = ssl.create_default_context()
headers = {
    'User-Agent': 'Axteroid-Client/1.0',
    'Authorization': f'Bearer {token}',
    'x-ax-workspace': ws_id,
    'Accept': '*/*'
}

invoices = [
    {
        "folio": "97187814",
        "email_id": "em_AAABoDhD3PbdDIek",
        "index": 1,
        "filename": "EnvDTE-Cod.31372676_91144000_77125361.xml"
    },
    {
        "folio": "97192772",
        "email_id": "em_AAABoDoA05I_vs_X",
        "index": 1,
        "filename": "EnvDTE-Cod.31378992_91144000_77125361.xml"
    }
]

os.makedirs("facturas_xml", exist_ok=True)

for inv in invoices:
    url = f"{base_url}/rec-emails/{inv['email_id']}/attachments/{inv['index']}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            content = resp.read()
            out_path = os.path.join("facturas_xml", f"Factura_{inv['folio']}_{inv['filename']}")
            with open(out_path, "wb") as f:
                f.write(content)
            print(f"[DESCARGA EXITOSA] Factura {inv['folio']}:")
            print(f"  Tamaño: {len(content)} bytes")
            print(f"  Guardado en: {out_path}")
            
            # Print first 500 chars of XML
            text_preview = content.decode('ISO-8859-1', errors='ignore')
            print("  Preview XML (primeras líneas):")
            for line in text_preview.splitlines()[:10]:
                print("   ", line)
            print("-" * 60)
    except Exception as e:
        print(f"[ERROR] Factura {inv['folio']}: {e}")
