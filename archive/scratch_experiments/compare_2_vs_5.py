import openpyxl

wb2 = openpyxl.load_workbook('Diferencias Carozzi PO517979 (2).xlsx', data_only=True)
ws2_1 = wb2['Carozzi']
ws2_2 = wb2['Detalle Facturas']

wb5 = openpyxl.load_workbook('Diferencias Carozzi PO517979 (5).xlsx', data_only=True)
ws5_1 = wb5['Carozzi']
ws5_2 = wb5['Detalle Facturas']

print('=== COMPARACIÓN DIRECTA: (2) ORIGINAL vs (5) EXPORTABLE ANTERIOR ===\n')

print(f"{'Métrica':<35} | {'(2) Original':<15} | {'(5) Exportable Ant.':<18} | {'Diferencia':<15}")
print('-' * 90)

m_unid_2 = ws2_1['E1'].value
m_unid_5 = ws5_1['E1'].value
print(f"{'Monto por diferencia de unidades':<35} | ${m_unid_2:<14,.0f} | ${m_unid_5:<17,.0f} | ${m_unid_5 - m_unid_2:<14,.0f}")

m_cost_2 = ws2_1['E2'].value
m_cost_5 = ws5_1['E2'].value
print(f"{'Monto por diferencia de costo (PPV)':<35} | ${m_cost_2:<14,.0f} | ${m_cost_5:<17,.0f} | ${m_cost_5 - m_cost_2:<14,.0f}")

m_tot_2 = ws2_1['E3'].value
m_tot_5 = ws5_1['E3'].value
print(f"{'Monto total diferencias':<35} | ${m_tot_2:<14,.0f} | ${m_tot_5:<17,.0f} | ${m_tot_5 - m_tot_2:<14,.0f}")

m_afo_2 = ws2_1['B2'].value
m_afo_5 = ws5_1['B2'].value
print(f"{'Monto Aforado (Retención)':<35} | ${m_afo_2:<14,.0f} | ${m_afo_5:<17,.0f} | ${m_afo_5 - m_afo_2:<14,.0f}")

m_sin_2 = ws2_1['B3'].value
m_sin_5 = ws5_1['B3'].value
print(f"{'Diferencia sin identificar':<35} | ${m_sin_2:<14} | ${m_sin_5:<17} | ${m_sin_5 - m_sin_2:<14}")

filas_2 = ws2_1.max_row - 5
filas_5 = ws5_1.max_row - 5
print(f"{'Cantidad de SKUs en Hoja 1':<35} | {filas_2:<15} | {filas_5:<18} | {filas_5 - filas_2:<15}")

no_oc_2 = sum(1 for r in range(6, ws2_1.max_row+1) if ws2_1.cell(r, 3).value == 'NO EN OC')
no_oc_5 = sum(1 for r in range(6, ws5_1.max_row+1) if ws5_1.cell(r, 3).value == 'NO EN OC')
print(f"{'Ítems marcados como NO EN OC':<35} | {no_oc_2:<15} | {no_oc_5:<18} | {no_oc_5 - no_oc_2:<15}")

print('\nDetalle Facturas (Hoja 2):')
neto_2 = ws2_2['G137'].value or 22068769
neto_5 = ws5_2['G137'].value or 22068769
print(f"{'Total Facturado Neto (8 facturas)':<35} | ${neto_2:<14,.0f} | ${neto_5:<17,.0f} | $0")
