import urllib.request, urllib.parse, ssl, json
import csv

token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE'
base_url = 'https://services.axteroid.com'
ws = 'acc_yZvUK1Aw6y5TAVLD3Y' # Delivery Hero Stores Chile SpA (Sociedad 6202 CL, RUT 77125361-K)
ctx = ssl.create_default_context()
headers = {'User-Agent': 'Mozilla/5.0', 'Authorization': f'Bearer {token}', 'x-ax-workspace': ws}

print("Consultando facturas de Carozzi (RUT 96591040-9) en Axteroid para Sociedad 6202 CL...")

all_invoices = []
page = 1
while True:
    params = {
        'tax_id': '96591040-9',
        'type': 'CL33',
        'date__gte': '2026-09-01',
        'date__lte': '2026-09-30',
        'page': page
    }
    url = f'{base_url}/rec-docs?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=headers)
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=12)
        data = json.loads(resp.read().decode('utf-8'))
        results = data.get('results', [])
        if not results:
            break
        all_invoices.extend(results)
        print(f"  Página {page}: {len(results)} facturas (Acumulado: {len(all_invoices)} / Total en Axteroid: {data.get('count')})")
        page += 1
        if page > 20: # Límite de seguridad
            break
    except Exception as e:
        print(f"Error en página {page}: {e}")
        break

print(f"\nTotal facturas descargadas de Carozzi en Septiembre 2026 (Sociedad 6202): {len(all_invoices)}")

# Filtrar las 44 facturas de CD Central (CH_36_CD_Chile) o agrupar por PO
cd36_docs = []
other_docs = []

for inv in all_invoices:
    po_ref = inv.get('order_reference')
    # Buscar en referencias si no está en el campo directo
    if not po_ref and inv.get('references'):
        for r in inv.get('references', []):
            if r.get('number') and ('51' in str(r.get('number')) or '52' in str(r.get('number'))):
                po_ref = str(r.get('number'))
                break
    
    inv_data = {
        'id': inv.get('id'),
        'serial': inv.get('serial') or inv.get('number'),
        'date': (inv.get('date') or inv.get('issued_date') or '')[:10],
        'supplier': inv.get('supplier_name'),
        'tax_id': inv.get('tax_id'),
        'amount_total': float(inv.get('amount_total') or 0),
        'amount_net': float(inv.get('amount_net') or 0),
        'order_reference': po_ref or 'SIN_REF',
        'status': inv.get('status'),
        'rec_status': inv.get('rec_status')
    }

    # CD36 POs conocidas de Carozzi: 519039, 517508, 517979, 521257, 520020, 519840, 518529
    if any(p in str(po_ref) for p in ['519039', '517508', '517979', '521257', '520020', '519840', '518529']):
        cd36_docs.append(inv_data)
    else:
        other_docs.append(inv_data)

print(f"\nFacturas de CD36 (Centro de Distribución Chile): {len(cd36_docs)}")
print(f"Otras Facturas de locales periféricos: {len(other_docs)}")

# Guardar las 44 facturas de CD36
with open('carozzi_44_facturas_cd36.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f, delimiter=';')
    writer.writerow(['FOLIO', 'FECHA EMISION', 'PROVEEDOR', 'RUT', 'MONTO NETO (CLP)', 'MONTO TOTAL (CLP)', 'ORDEN DE COMPRA', 'ESTADO', 'ESTADO RECEPCION', 'ID AXTEROID'])
    for d in cd36_docs:
        writer.writerow([d['serial'], d['date'], d['supplier'], d['tax_id'], round(d['amount_net']), round(d['amount_total']), d['order_reference'], d['status'], d['rec_status'], d['id']])

print("Guardado exitoso en 'carozzi_44_facturas_cd36.csv'!")
