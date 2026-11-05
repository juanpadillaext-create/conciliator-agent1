import openpyxl

orig_wb = openpyxl.load_workbook('Diferencias Carozzi PO517979 (2).xlsx', data_only=False)
print('Original sheets:', orig_wb.sheetnames)
ws_orig = orig_wb['Carozzi']

print('Original KPI Card:')
print('  A1:', ws_orig['A1'].value, '| B1:', ws_orig['B1'].value)
print('  D1:', ws_orig['D1'].value, '| E1 formula:', ws_orig['E1'].value)
print('  A2:', ws_orig['A2'].value, '| B2:', ws_orig['B2'].value)
print('  D2:', ws_orig['D2'].value, '| E2 formula:', ws_orig['E2'].value)
print('  A3:', ws_orig['A3'].value, '| B3 formula:', ws_orig['B3'].value)
print('  D3:', ws_orig['D3'].value, '| E3 formula:', ws_orig['E3'].value)
print('  K1:', ws_orig['K1'].value)
print('  K4:', ws_orig['K4'].value)
print('  N4:', ws_orig['N4'].value)
print('  Merges:', sorted([str(m) for m in ws_orig.merged_cells.ranges]))

orig_data_wb = openpyxl.load_workbook('Diferencias Carozzi PO517979 (2).xlsx', data_only=True)
ws_data = orig_data_wb['Carozzi']
print('\nOriginal Evaluated KPI Values:')
print('  E1 (Dif Unidades):', ws_data['E1'].value)
print('  E2 (Dif Costo):', ws_data['E2'].value)
print('  E3 (Total Diferencias):', ws_data['E3'].value)
print('  B2 (Monto Aforado):', ws_data['B2'].value)
print('  B3 (Dif sin identificar):', ws_data['B3'].value)
