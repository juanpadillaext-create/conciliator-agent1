import zipfile
import xml.etree.ElementTree as ET
import os

filepath = r"C:\Users\juan.padilla.ext\Downloads\Diferencias Nestle PO524726 (9).xlsx"

print(f"Inspeccionando archivo: {filepath}")
print(f"Tamano del archivo: {os.path.getsize(filepath):,} bytes\n")

with zipfile.ZipFile(filepath, 'r') as z:
    namelist = z.namelist()
    print("Contenido ZIP del Workbook:")
    for n in namelist:
        if 'sheet' in n or 'sharedStrings' in n or 'workbook' in n:
            print(f" - {n}")

    # 1. Shared Strings
    shared_strings = []
    if 'xl/sharedStrings.xml' in namelist:
        ss_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in ss_tree.findall('.//s:si', ns):
            t = si.find('.//s:t', ns)
            shared_strings.append(t.text if t is not None and t.text else '')

    print(f"\nTotal Shared Strings encontrados: {len(shared_strings)}")

    # 2. Workbook.xml (para ver nombres de hojas)
    wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
    ns_wb = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sheets = []
    for s in wb_tree.findall('.//s:sheet', ns_wb):
        sheets.append((s.get('name'), s.get('sheetId'), s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')))
    print("\nHojas en el Workbook:")
    for name, s_id, r_id in sheets:
        print(f" - Nombre: '{name}', SheetID: {s_id}, RelID: {r_id}")

    # 3. Sheet 1 (Conciliacion PO)
    ws1_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    ns_ws = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

    rows = ws1_tree.findall('.//s:row', ns_ws)
    print(f"\nTotal Filas en Hoja 1: {len(rows)}")

    def get_cell_val(cell):
        t = cell.get('t')
        v = cell.find('s:v', ns_ws)
        f = cell.find('s:f', ns_ws)
        formula = f.text if f is not None else None
        val = v.text if v is not None else None
        if t == 's' and val is not None and val.isdigit():
            idx = int(val)
            if idx < len(shared_strings):
                val = shared_strings[idx]
        return val, formula

    # Inspeccionar Filas 1 a 6
    print("\n--- PRIMERAS 7 FILAS (ENCABEZADOS Y BLOQUE SUPERIOR) ---")
    for row in rows[:7]:
        r_num = row.get('r')
        cells = row.findall('s:c', ns_ws)
        cell_dict = {}
        for c in cells:
            r = c.get('r')
            v, f = get_cell_val(c)
            cell_dict[r] = (v, f)
        print(f"\nFila {r_num} ({len(cells)} celdas):")
        for ref, (v, f) in sorted(cell_dict.items()):
            form_str = f" [FÓRMULA: ={f}]" if f else ""
            print(f"   {ref}: {v}{form_str}")

    # Inspeccionar Filas de Datos (Fila 6 en adelante)
    print(f"\n--- RESUMEN DE FILAS DE DATOS (Fila 6 a {len(rows)}) ---")
    data_rows = rows[5:]
    print(f"Total líneas de datos: {len(data_rows)}")

    sum_col_r = 0.0
    sum_col_s = 0.0
    sum_col_t = 0.0

    sample_lines = []
    col_headers = {}

    # Leer encabezados de Fila 5
    for c in rows[4].findall('s:c', ns_ws):
        r = c.get('r')
        col_letter = ''.join([ch for ch in r if ch.isalpha()])
        v, _ = get_cell_val(c)
        col_headers[col_letter] = v

    print("\nColumnas identificadas en Fila 5:")
    for col, h in sorted(col_headers.items()):
        print(f"   Col {col}: {h}")

    for idx, row in enumerate(data_rows):
        r_num = row.get('r')
        cells = row.findall('s:c', ns_ws)
        row_map = {}
        for c in cells:
            r = c.get('r')
            col_letter = ''.join([ch for ch in r if ch.isalpha()])
            v, f = get_cell_val(c)
            row_map[col_letter] = (v, f)

        # Col R, S, T
        v_r, f_r = row_map.get('R', (0, None))
        v_s, f_s = row_map.get('S', (0, None))
        v_t, f_t = row_map.get('T', (0, None))

        try:
            val_r = float(v_r) if v_r is not None else 0.0
        except:
            val_r = 0.0
        try:
            val_s = float(v_s) if v_s is not None else 0.0
        except:
            val_s = 0.0
        try:
            val_t = float(v_t) if v_t is not None else 0.0
        except:
            val_t = 0.0

        sum_col_r += val_r
        sum_col_s += val_s
        sum_col_t += val_t

        if idx < 5 or val_t > 500000:
            sample_lines.append({
                'row': r_num,
                'po': row_map.get('A', ('', ''))[0],
                'sku': row_map.get('C', ('', ''))[0],
                'desc': row_map.get('E', ('', ''))[0],
                'q_rec': row_map.get('G', (0, ''))[0],
                'costo_oc': row_map.get('H', (0, ''))[0],
                'q_fac': row_map.get('K', (0, ''))[0],
                'dif_q': row_map.get('N', (0, ''))[0],
                'dif_p': row_map.get('O', (0, ''))[0],
                'dif_final': row_map.get('P', ('', ''))[0],
                'dif_ml_q': val_r,
                'dif_ml_p': val_s,
                'total_dif_ml': val_t,
                'form_r': f_r,
                'form_s': f_s,
                'form_t': f_t
            })

    print("\n--- TOTALES CALCULADOS EN DATOS DEL ARCHIVO ---")
    print(f"SUMA Columna R (Dif. ML Cantidad):   ${sum_col_r:,.0f} CLP")
    print(f"SUMA Columna S (Dif. ML Precio):     ${sum_col_s:,.0f} CLP")
    print(f"SUMA Columna T (Total Dif. ML):      ${sum_col_t:,.0f} CLP")

    print("\n--- MUESTRA DE LÍNEAS DE DATOS EN EL ARCHIVO ---")
    for s in sample_lines[:8]:
        print(f"Fila {s['row']}: SKU {s['sku']} - {str(s['desc'])[:35]}")
        print(f"   Rec: {s['q_rec']} | Costo OC: ${s['costo_oc']} | Fac: {s['q_fac']} | DifQ: {s['dif_q']}")
        print(f"   Col R (Dif ML Cant): ${s['dif_ml_q']:,.0f} [={s['form_r']}]")
        print(f"   Col S (Dif ML Prc):  ${s['dif_ml_p']:,.0f} [={s['form_s']}]")
        print(f"   Col T (Total Recl):  ${s['total_dif_ml']:,.0f} [={s['form_t']}]")
        print(f"   Estado Final: {s['dif_final']}\n")

    # 4. Sheet 2 (Detalle Facturas)
    if 'xl/worksheets/sheet2.xml' in namelist:
        ws2_tree = ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
        rows2 = ws2_tree.findall('.//s:row', ns_ws)
        print(f"--- HOJA 2: DETALLE FACTURAS ---")
        print(f"Total filas en Hoja 2: {len(rows2)}")
        if len(rows2) > 0:
            h2 = []
            for c in rows2[0].findall('s:c', ns_ws):
                v, _ = get_cell_val(c)
                h2.append(v)
            print(f"Encabezados Hoja 2: {h2}")
            print(f"Total líneas de detalle facturas: {len(rows2)-1}")
