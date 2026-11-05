import os
import urllib.request
import urllib.parse
import ssl
import json

token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
base_url = "https://services.axteroid.com"
acc_id = "acc_yZvUK1Aw6y5TAVLD3Y"

ctx = ssl.create_default_context()
headers = {
    "User-Agent": "Axteroid-Client/1.0",
    "Authorization": f"Bearer {token}",
    "x-ax-workspace": acc_id,
    "Accept": "application/json"
}

output_dir = r"c:\Users\juan.padilla.ext\Desktop\Axteroid\descargas_andina"
os.makedirs(output_dir, exist_ok=True)

# Search by serials and by PO
queries = [
    {"serial": "97187814"},
    {"serial": "97192772"},
    {"number": "97187814"},
    {"number": "97192772"},
    {"tax_id": "91144000-8"},
    {"order_reference": "PO510187"},
    {"order_reference": "510187"}
]

found_docs = {}

for q in queries:
    qs = urllib.parse.urlencode(q)
    url = f"{base_url}/rec-docs?{qs}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('results', [])
            print(f"Query {q} -> count: {data.get('count', 0)}, returned: {len(results)}")
            for r in results:
                s = str(r.get('serial') or r.get('number'))
                found_docs[r['id']] = r
                if s in ["97187814", "97192772"] or "510187" in str(r.get('order_reference')):
                    print(f"  MATCH: ID={r['id']}, Serial={s}, Supplier={r.get('supplier_name')}, Total={r.get('amount_total')}, PO={r.get('order_reference')}")
    except Exception as e:
        print(f"Query {q} -> Error: {e}")

print(f"\nTotal unique documents found: {len(found_docs)}")

# Now download XML and PDF for matching docs
for doc_id, doc in found_docs.items():
    serial = str(doc.get('serial') or doc.get('number'))
    supplier = doc.get('supplier_name', 'Andina')
    total = doc.get('amount_total')
    po = doc.get('order_reference')
    
    print(f"\nProcessing {serial} (ID: {doc_id}) | PO: {po} | Total: ${total}")
    
    # Download XML
    xml_url = f"{base_url}/rec-docs/{doc_id}?format=xml"
    req_xml = urllib.request.Request(xml_url, headers=headers)
    try:
        with urllib.request.urlopen(req_xml, context=ctx, timeout=10) as resp:
            xml_data = resp.read()
            xml_path = os.path.join(output_dir, f"Factura_{serial}.xml")
            with open(xml_path, "wb") as f:
                f.write(xml_data)
            print(f"  -> XML saved: {xml_path} ({len(xml_data)} bytes)")
    except Exception as e:
        print(f"  -> Error XML: {e}")

    # Download PDF
    pdf_url = f"{base_url}/rec-docs/{doc_id}?format=pdf"
    req_pdf = urllib.request.Request(pdf_url, headers=headers)
    try:
        with urllib.request.urlopen(req_pdf, context=ctx, timeout=10) as resp:
            pdf_data = resp.read()
            pdf_path = os.path.join(output_dir, f"Factura_{serial}.pdf")
            with open(pdf_path, "wb") as f:
                f.write(pdf_data)
            print(f"  -> PDF saved: {pdf_path} ({len(pdf_data)} bytes)")
    except Exception as e:
        print(f"  -> Error PDF: {e}")
