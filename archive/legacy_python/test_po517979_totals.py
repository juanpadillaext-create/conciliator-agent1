import urllib.request, urllib.parse, ssl, json
import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\juan.padilla.ext\Downloads\Diferencias Carozzi PO517979.xlsx', data_only=True)
ws_det = wb['Detalle Facturas']

total_facturas_neto = 0
facturas_neto_por_doc = {}
for r in range(2, ws_det.max_row + 1):
    doc = str(ws_det.cell(r, 1).value).strip()
    neto = float(ws_det.cell(r, 7).value or 0)
    total_facturas_neto += neto
    facturas_neto_por_doc[doc] = facturas_neto_por_doc.get(doc, 0) + neto

print(f"Total Neto Facturado en las 8 facturas de PO517979: ${round(total_facturas_neto):,}")
for doc, neto in sorted(facturas_neto_por_doc.items()):
    print(f"  Factura {doc}: ${round(neto):,}")

ws_car = wb['Carozzi']
total_oc_rec = 0
for r in range(6, 88): # Rows that have Dmarts SKUs
    val = ws_car.cell(r, 10).value
    if val:
        total_oc_rec += float(val)
print(f"\nTotal Costo OC Recepcionado (según filas con SKU Dmarts): ${round(total_oc_rec):,}")

total_fila_carozzi_fac = 0
for r in range(6, ws_car.max_row + 1):
    val = ws_car.cell(r, 12).value
    if val:
        total_fila_carozzi_fac += float(val)
print(f"Total Facturado según columna L de hoja Carozzi: ${round(total_fila_carozzi_fac):,}")
