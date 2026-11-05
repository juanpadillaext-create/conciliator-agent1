import openpyxl
import csv

wb = openpyxl.load_workbook(r'C:\Users\juan.padilla.ext\Downloads\Diferencias Carozzi PO517979.xlsx', data_only=True)
ws_car = wb['Carozzi']

filas_cruce = []
total_facturado = 0
total_recepcionado = 0
total_faltante_monto = 0
total_sobreprecio_monto = 0

for r in range(6, ws_car.max_row + 1):
    po = ws_car.cell(r, 1).value
    tienda = ws_car.cell(r, 2).value
    sku = ws_car.cell(r, 3).value
    nombre = ws_car.cell(r, 5).value
    tipo_prod = ws_car.cell(r, 6).value
    rec_unids = float(ws_car.cell(r, 7).value or 0)
    costo_oc = float(ws_car.cell(r, 8).value or 0)
    costo_total_oc = float(ws_car.cell(r, 10).value or 0)
    fac_unids = float(ws_car.cell(r, 11).value or 0)
    fac_neto = float(ws_car.cell(r, 12).value or 0)
    costo_fac = float(ws_car.cell(r, 13).value or 0)
    dif_unids = float(ws_car.cell(r, 14).value or 0)
    dif_costo = float(ws_car.cell(r, 15).value or 0)
    tipo_dif = ws_car.cell(r, 16).value
    factura = str(ws_car.cell(r, 17).value or '').strip()

    total_facturado += fac_neto
    total_recepcionado += costo_total_oc

    # Clasificar diagnóstico y acción correctiva
    severidad = 'OK'
    diagnostico = 'Calce Conforme 100%'
    accion_correctiva = 'Conforme para pago.'
    monto_reclamar = 0

    if rec_unids == 0 and fac_unids > 0:
        severidad = 'CRÍTICA'
        diagnostico = f'FALTANTE TOTAL: Producto facturado ({fac_unids} unids) pero NO entregado en bodega (0 recepcionado).'
        monto_reclamar = fac_neto
        total_faltante_monto += fac_neto
        accion_correctiva = f'Solicitar Nota de Crédito por Faltante Total de ${round(fac_neto):,} CLP a Carozzi.'
    elif dif_unids > 0.1: # Facturado más de lo recepcionado
        severidad = 'CRÍTICA'
        monto_faltante = round(dif_unids * costo_oc)
        diagnostico = f'FALTANTE PARCIAL: Facturadas {fac_unids} unids vs {rec_unids} recepcionadas. Faltan {dif_unids:.0f} unids.'
        monto_reclamar = monto_faltante
        total_faltante_monto += monto_faltante
        accion_correctiva = f'Solicitar Nota de Crédito por Faltante de ${monto_faltante:,} CLP ({dif_unids:.0f} unids).'
    elif abs(dif_costo) > 1 and rec_unids > 0:
        severidad = 'MODERADA'
        dif_p = costo_fac - costo_oc
        monto_dif_precio = round(dif_p * rec_unids)
        diagnostico = f'DIFERENCIA DE COSTO: Costo facturado (${costo_fac:,.2f}) difiere del costo pactado OC (${costo_oc:,.2f}).'
        monto_reclamar = monto_dif_precio
        total_sobreprecio_monto += monto_dif_precio
        accion_correctiva = f'Solicitar Nota de Crédito por Diferencia de Precio de ${monto_dif_precio:,} CLP.'
    elif abs(dif_costo) <= 1 and abs(dif_unids) <= 0.1:
        diagnostico = 'Calce Conforme: Cantidad y costo coinciden.'
        accion_correctiva = 'Aprobado para pago.'

    filas_cruce.append({
        'po': po,
        'tienda': tienda,
        'sku': sku,
        'nombre': nombre,
        'categoria': tipo_prod,
        'cant_recepcionada': rec_unids,
        'costo_unit_oc': costo_oc,
        'costo_total_oc': costo_total_oc,
        'cant_facturada': fac_unids,
        'costo_unit_fac': round(costo_fac, 2),
        'monto_facturado_neto': fac_neto,
        'diferencia_unidades': dif_unids,
        'diferencia_costo_unit': round(dif_costo, 2),
        'monto_a_reclamar_nc': monto_reclamar,
        'severidad': severidad,
        'diagnostico_causa': diagnostico,
        'accion_correctiva': accion_correctiva,
        'factura_referencia': factura
    })

# Exportar a CSV enriquecido
out_csv = 'Informe_Cruce_SKU_Carozzi_PO517979_DanielaReyes.csv'
with open(out_csv, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f, delimiter=';')
    writer.writerow(['INFORME DE AUDITORÍA Y CRUCE SKU X SKU - DMARTS CHILE'])
    writer.writerow(['Proveedor:', 'Empresas Carozzi S.A.', 'RUT:', '96591040-9'])
    writer.writerow(['Orden de Compra:', 'PO517979', 'Local/CD:', 'CH_36_CD_Chile'])
    writer.writerow(['Total Facturado Neto (8 Facturas):', f'${round(total_facturado):,} CLP'])
    writer.writerow(['Total Recepcionado Físico:', f'${round(total_recepcionado):,} CLP'])
    writer.writerow(['MONTO TOTAL A RECLAMAR EN NOTAS DE CRÉDITO:', f'${round(total_faltante_monto + total_sobreprecio_monto):,} CLP'])
    writer.writerow([])
    writer.writerow([
        'Orden de Compra', 'Local', 'SKU / Código', 'Nombre Producto', 'Categoría',
        'Cant. Recepcionada', 'Costo Unit. OC', 'Total Recepcionado (CLP)',
        'Cant. Facturada', 'Costo Unit. Factura', 'Total Facturado (CLP)',
        'Dif. Unidades (Faltante)', 'Dif. Costo Unitario', 'Monto a Reclamar en NC (CLP)',
        'Severidad', 'Diagnóstico de la Causa Raíz', 'Acción Correctiva Sugerida', 'Factura Carozzi'
    ])
    for r in filas_cruce:
        writer.writerow([
            r['po'], r['tienda'], r['sku'], r['nombre'], r['categoria'],
            r['cant_recepcionada'], r['costo_unit_oc'], r['costo_total_oc'],
            r['cant_facturada'], r['costo_unit_fac'], r['monto_facturado_neto'],
            r['diferencia_unidades'], r['diferencia_costo_unit'], r['monto_a_reclamar_nc'],
            r['severidad'], r['diagnostico_causa'], r['accion_correctiva'], r['factura_referencia']
        ])

print(f"Informe generado con éxito en '{out_csv}'!")
print(f"Total Facturado: ${round(total_facturado):,}")
print(f"Total Recepcionado: ${round(total_recepcionado):,}")
print(f"Total a Reclamar NC: ${round(total_faltante_monto + total_sobreprecio_monto):,}")
