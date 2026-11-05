import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\juan.padilla.ext\Downloads\Diferencias Carozzi PO517979.xlsx', data_only=True)
ws_car = wb['Carozzi']

rows_with_zero_rec = []
rows_with_dif_units = []
rows_perfect_match = []

for r in range(6, ws_car.max_row + 1):
    sku = str(ws_car.cell(r, 3).value or '').strip()
    nombre = str(ws_car.cell(r, 5).value or '').strip()
    rec = float(ws_car.cell(r, 7).value or 0)
    cost_oc = float(ws_car.cell(r, 8).value or 0)
    fac_units = float(ws_car.cell(r, 11).value or 0)
    fac_neto = float(ws_car.cell(r, 12).value or 0)
    dif_u = float(ws_car.cell(r, 14).value or 0)
    tipo_dif = ws_car.cell(r, 16).value
    factura = str(ws_car.cell(r, 17).value or '').strip()

    if rec == 0:
        rows_with_zero_rec.append({
            'row': r, 'sku': sku, 'nombre': nombre, 'fac_units': fac_units,
            'fac_neto': fac_neto, 'factura': factura
        })
    elif abs(dif_u) > 0.01:
        rows_with_dif_units.append({
            'row': r, 'sku': sku, 'nombre': nombre, 'rec': rec, 'fac_units': fac_units,
            'dif_u': dif_u, 'cost_oc': cost_oc, 'fac_neto': fac_neto, 'factura': factura
        })
    else:
        rows_perfect_match.append({
            'row': r, 'sku': sku, 'nombre': nombre, 'rec': rec, 'fac_neto': fac_neto
        })

print(f"Total líneas en hoja Carozzi: {ws_car.max_row - 5}")
print(f"Líneas con Calce Perfecto: {len(rows_perfect_match)}")
print(f"Líneas con Recepción = 0 (Totalmente no recepcionadas): {len(rows_with_zero_rec)}")
print(f"Líneas con Recepción Parcial (Faltante parcial): {len(rows_with_dif_units)}")

suma_cero_rec = sum(x['fac_neto'] for x in rows_with_zero_rec)
print(f"\nMonto Facturado en productos con Recepción CERO (No entregados): ${round(suma_cero_rec):,}")

print("\n--- PRODUCTOS FACTURADOS CON RECEPCIÓN CERO (MUESTRA 10) ---")
for x in rows_with_zero_rec[:10]:
    print(f"  Row {x['row']}: {x['sku']} | {x['nombre'][:35]} | Facturado: {x['fac_units']} unids = ${round(x['fac_neto']):,} | {x['factura']}")

print("\n--- PRODUCTOS CON FALTANTE PARCIAL ---")
for x in rows_with_dif_units:
    print(f"  Row {x['row']}: {x['sku']} | {x['nombre'][:30]} | Rec: {x['rec']} vs Fac: {x['fac_units']} (Faltan {x['dif_u']}) | {x['factura']}")
