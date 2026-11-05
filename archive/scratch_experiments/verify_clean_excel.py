import json

with open(r'c:\Users\juan.padilla.ext\Desktop\Axteroid\scratch\nestle_final_audit.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

tot = data['totales']
print("Totales de Auditoria Verificados:")
print(f" - Facturado Neto (5 Facturas):     ${tot['facturadoNeto']:,} CLP")
print(f" - Recepcionado Valido (Bodega):    ${tot['recepcionadoValido']:,} CLP")
print(f" - Reclamo Total NC (Dif ML):       ${tot['totalReclamar']:,} CLP")
