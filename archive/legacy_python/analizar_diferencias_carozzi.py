import openpyxl

wb = openpyxl.load_workbook(r'C:\Users\juan.padilla.ext\Downloads\Diferencias Carozzi PO517979.xlsx', data_only=True)
ws = wb['Carozzi']

print('--- CELDA RESUMEN B1:E4 ---')
print('B1 (OC):', ws['B1'].value)
print('B2 (Monto Aforado):', ws['B2'].value)
print('B3 (Dif sin identificar):', ws['B3'].value)
print('E1 (Monto dif unidades):', ws['E1'].value)
print('E2 (Monto dif costo):', ws['E2'].value)
print('E3 (Monto total diferencias):', ws['E3'].value)

dif_unidades = []
dif_costo = []
dif_ambas = []
factura_set = set()

for r in range(6, ws.max_row + 1):
    sku = ws.cell(r, 3).value
    nombre = ws.cell(r, 5).value
    cant_rec = ws.cell(r, 7).value
    costo_oc = ws.cell(r, 8).value
    total_oc = ws.cell(r, 10).value
    cant_fac = ws.cell(r, 11).value
    total_fac = ws.cell(r, 12).value
    costo_fac = ws.cell(r, 13).value
    dif_u = ws.cell(r, 14).value
    dif_c = ws.cell(r, 15).value
    tipo_dif = ws.cell(r, 16).value
    comentario = ws.cell(r, 17).value
    
    if comentario and 'Factura' in str(comentario):
        factura_set.add(str(comentario).strip())

    if tipo_dif:
        item_info = {
            'row': r, 'sku': sku, 'nombre': nombre,
            'cant_rec': cant_rec, 'costo_oc': costo_oc, 'total_oc': total_oc,
            'cant_fac': cant_fac, 'total_fac': total_fac, 'costo_fac': costo_fac,
            'dif_u': dif_u, 'dif_c': dif_c, 'tipo_dif': tipo_dif, 'factura': comentario
        }
        if tipo_dif == 'Diferencia de Unidades':
            dif_unidades.append(item_info)
        elif tipo_dif == 'Diferencia de Costo':
            dif_costo.append(item_info)
        else:
            dif_ambas.append(item_info)

print('\nTotal SKUs evaluados en OC:', ws.max_row - 5)
print('Total Facturas referenciadas en comentarios:', len(factura_set))
print('Facturas referenciadas:', sorted(list(factura_set)))
print('Items con Diferencia de Unidades:', len(dif_unidades))
print('Items con Diferencia de Costo:', len(dif_costo))
print('Items con Otras Diferencias:', len(dif_ambas))

print('\n--- DETALLE DE DIFERENCIAS DE UNIDADES ---')
for it in dif_unidades:
    print(f"Row {it['row']}: SKU {it['sku']} | {it['nombre']} | Rec: {it['cant_rec']} vs Fac: {it['cant_fac']} (Dif U: {it['dif_u']}) | Total OC: {it['total_oc']} vs Total Fac: {it['total_fac']} | Factura: {it['factura']}")

print('\n--- DETALLE DE DIFERENCIAS DE COSTO ---')
for it in dif_costo:
    print(f"Row {it['row']}: SKU {it['sku']} | {it['nombre']} | Costo OC: {it['costo_oc']} vs Costo Fac: {it['costo_fac']} (Dif: {it['dif_c']}) | Total OC: {it['total_oc']} vs Total Fac: {it['total_fac']} | Factura: {it['factura']}")
