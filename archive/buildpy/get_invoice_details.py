import urllib.request
import ssl
import json
import zipfile
import io

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
ws_id = "acc_yZvUK1Aw6y5TAVLD3Y"
ctx = ssl.create_default_context()

doc_ids = {
    "97187814": "do_AAABoDhD3daH4zVe",
    "97192772": "do_AAABoDoA1Js-o6iE"
}

headers = {
    "User-Agent": "Axteroid-Client/1.0",
    "Authorization": f"Bearer {token}",
    "x-ax-workspace": ws_id,
    "Accept": "application/json"
}

# 1. Fetch details of both documents
full_docs = {}
for folio, doc_id in doc_ids.items():
    # Check rec-docs with id filter
    req = urllib.request.Request(f"{base_url}/rec-docs?serial={folio}", headers=headers)
    with urllib.request.urlopen(req, context=ctx) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        full_docs[folio] = data['results'][0]

print("=== DETALLES DE LAS FACTURAS ===")
for folio, d in full_docs.items():
    print(f"\n--- Factura Folio: {folio} (ID: {d.get('id')}) ---")
    print(f"Tipo Documento: {d.get('type')}")
    print(f"Proveedor: {d.get('supplier_name')} (RUT: {d.get('tax_id')})")
    print(f"Receptor: {d.get('customer_name')} (RUT: {d.get('customer_tax_id')})")
    print(f"Fecha Emisión: {d.get('date') or d.get('issued_date')}")
    print(f"Fecha Recepción SII: {d.get('sii_receipt_date') or d.get('reception_date') or d.get('created_at')}")
    print(f"Monto Neto: ${int(float(d.get('amount_net'))):,}" if d.get('amount_net') is not None else "Neto: N/A")
    print(f"Monto IVA: ${int(float(d.get('amount_vat'))):,}" if d.get('amount_vat') is not None else "IVA: N/A")
    print(f"Monto Total: ${int(float(d.get('amount_total'))):,}" if d.get('amount_total') is not None else "Total: N/A")
    print(f"Orden de Compra (Ref): {d.get('order_reference')}")
    print(f"Estado / Status: {d.get('status')}")
    print(f"Estado SII / Acuse: {d.get('action_book') or d.get('sii_status')}")
    print(f"Sucursal / Branch: {d.get('branch_name') or d.get('branch')}")
    print(f"Clasificación / Category: {d.get('category_name') or d.get('category')}")
    print(f"Campos adicionales: {[k for k in d.keys() if d[k] not in [None, '']]}")

# 2. Descargar XML de ambas facturas
print("\n=== DESCARGANDO ARCHIVOS XML ===")
url_dl = f"{base_url}/rec-docs/download?xml=true"
payload = json.dumps({"document_ids": list(doc_ids.values())}).encode('utf-8')
headers_dl = headers.copy()
headers_dl["Content-Type"] = "application/json"

req_dl = urllib.request.Request(url_dl, data=payload, headers=headers_dl, method="POST")
with urllib.request.urlopen(req_dl, context=ctx) as resp:
    zip_bytes = resp.read()
    print(f"Descarga completada: {len(zip_bytes)} bytes recibidos.")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        print("Archivos contenidos en el paquete ZIP:")
        for name in zf.namelist():
            print(f" - {name} ({zf.getinfo(name).file_size} bytes)")
            zf.extract(name, "facturas_descargadas")
            print(f"   => Guardado en ./facturas_descargadas/{name}")

# 3. Consultar las otras 2 referencias asociadas a la PO
print("\n=== DOCUMENTOS ASOCIADOS A LA MISMA PO (PO510187) ===")
req_po = urllib.request.Request(f"{base_url}/rec-docs?order_reference=PO510187", headers=headers)
with urllib.request.urlopen(req_po, context=ctx) as resp:
    data_po = json.loads(resp.read().decode('utf-8'))
    for r in data_po.get('results', []):
        total_val = int(float(r.get('amount_total', 0))) if r.get('amount_total') is not None else 0
        print(f"Folio: {r.get('serial'):<10} | Tipo: {r.get('type'):<6} | Proveedor: {r.get('supplier_name'):<30} | Total: ${total_val:>10,} | ID: {r.get('id')}")
