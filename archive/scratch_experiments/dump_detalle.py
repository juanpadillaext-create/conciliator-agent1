import xml.etree.ElementTree as ET

def dump_detalle(filename):
    tree = ET.parse(filename)
    root = tree.getroot()
    for elem in root.iter():
        if elem.tag.endswith('Detalle'):
            print("--- Detalle ---")
            for child in elem:
                tag = child.tag.split('}')[-1]
                print(f"  {tag}: {child.text}")

print("=== DOC 10207759 ===")
dump_detalle('scratch/doc_10207759.xml')
