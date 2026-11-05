import xml.etree.ElementTree as ET

tree = ET.parse('scratch/doc_10207759.xml')
root = tree.getroot()
total_monto = 0
total_rec = 0
total_dsc = 0
for elem in root.iter():
    if elem.tag.endswith('Detalle'):
        m = float(elem.find('{*}MontoItem').text or 0)
        r = float(elem.find('{*}RecargoMonto').text or 0) if elem.find('{*}RecargoMonto') is not None else 0
        d = float(elem.find('{*}DescuentoMonto').text or 0) if elem.find('{*}DescuentoMonto') is not None else 0
        total_monto += m
        total_rec += r
        total_dsc += d

print(f"Total MontoItem: {total_monto}")
print(f"Total RecargoMonto: {total_rec}")
print(f"Monto + Recargo: {total_monto + total_rec}")
