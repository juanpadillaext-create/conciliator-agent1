#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generador_planilla_conciliacion.py
---------------------------------
Genera una planilla de cálculo Excel (.xlsx) con el formato oficial idéntico al Google Spreadsheet
de Cuentas por Pagar / Finanzas D-Marts PedidosYa Chile:
https://docs.google.com/spreadsheets/d/1tV8no7qLQI_6dVMoqN8dMGJdb0E4rYTE/edit?gid=1066181932#gid=1066181932

Este exportable automatizado:
1. Replica al 100% las fuentes, anchos de columna, colores corporativos (#C00000, #FEF5F4, #FFFFF2CC, #4F81BD).
2. Genera dinámicamente las fórmulas nativas de cálculo (SUMPRODUCT, IF, IFERROR, ROUND, IFS).
3. Cubre TODOS los escenarios posibles de conciliación de forma aleatoria/representativa:
   - Escenario 1: Calce Conforme 100% (Aprobado sin diferencias)
   - Escenario 2: Diferencia de Unidades - Faltante Parcial en Bodega
   - Escenario 3: Diferencia de Costo / Sobreprecio Facturado
   - Escenario 4: Doble Descalce (Diferencia de Costo y Unidades)
   - Escenario 5: Faltante Total (Facturado con 0 recepción en bodega)
   - Escenario 6: Conversión por Empaque / Factor Caja (Cajas a Unidades)
   - Escenario 7: Sobrerrecepción en Bodega (Recepción física superior)
   - Escenario 8: Multi-Facturación de la misma PO desglosada en pestaña 'Detalle Facturas'
4. Rellena automáticamente el 100% de los campos sin que Finanzas deba hacerlo celda a celda.
"""

import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import random
import os
import datetime

# --- PALETA CORPORATIVA OFICIAL ---
FILL_HEADER_RED = PatternFill(start_color="FFC00000", end_color="FFC00000", fill_type="solid")
FILL_BOX_PASTEL = PatternFill(start_color="FFFEF5F4", end_color="FFFEF5F4", fill_type="solid")
FILL_ALERT_YELLOW = PatternFill(start_color="FFFFF2CC", end_color="FFFFF2CC", fill_type="solid")
FILL_DETAIL_BLUE = PatternFill(start_color="FF4F81BD", end_color="FF4F81BD", fill_type="solid")

FONT_HEADER = Font(name="Arial", size=10, bold=True, color="FFFFFFFF")
FONT_BOLD_BLACK = Font(name="Arial", size=10, bold=True, color="FF000000")
FONT_REGULAR = Font(name="Arial", size=9, bold=False, color="FF000000")
FONT_NOTICE_RED = Font(name="Arial", size=10, bold=True, color="FFFF0000")
FONT_YELLOW_BANNER = Font(name="Arial", size=10, bold=True, color="FF7F6000")

BORDER_THIN_GRAY = Border(
    left=Side(style='thin', color='FFD9D9D9'),
    right=Side(style='thin', color='FFD9D9D9'),
    top=Side(style='thin', color='FFD9D9D9'),
    bottom=Side(style='thin', color='FFD9D9D9')
)

BORDER_CARD = Border(
    left=Side(style='thin', color='FFE06666'),
    right=Side(style='thin', color='FFE06666'),
    top=Side(style='thin', color='FFE06666'),
    bottom=Side(style='thin', color='FFE06666')
)

ALIGN_CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
ALIGN_LEFT = Alignment(horizontal='left', vertical='center')
ALIGN_RIGHT = Alignment(horizontal='right', vertical='center')

# Catálogo representativo de SKUs D-Marts Chile
CATALOGO_PRODUCTOS = [
    {"sku": "UHBPGV", "ean": "7801234000101", "name": "Galleta Sabor Pie de Limón Gretel 85 g", "cat": "Snacks", "costo_oc": 938, "caja_factor": 24},
    {"sku": "I1NU79", "ean": "7801234000102", "name": "Tortilla Burrito Integral 8Un 380 G Pancho Villa", "cat": "Bread / Bakery", "costo_oc": 1465, "caja_factor": 12},
    {"sku": "18627884", "ean": "7801234000103", "name": "Gelatina Berries 22 G Vivo", "cat": "Packaged Foods", "costo_oc": 603, "caja_factor": 30},
    {"sku": "ILKR0B", "ean": "7801234000104", "name": "Compota Vivo Break Avena Yoghurt Berries Y Plátano 90 g", "cat": "Personal Care / Baby / Health", "costo_oc": 470, "caja_factor": 36},
    {"sku": "SE7PJ0", "ean": "7801234000105", "name": "Pack Nectar Vivo Piña (190 ml) 3 Unidades", "cat": "Beverages", "costo_oc": 862, "caja_factor": 12},
    {"sku": "84P2V8", "ean": "7801234000106", "name": "Gomitas Ambrosito 90 g", "cat": "Snacks", "costo_oc": 634, "caja_factor": 20},
    {"sku": "7O0623", "ean": "7801234000107", "name": "Tortillas De Maiz Pancho Villa Redondos Panchitos 320 g", "cat": "Snacks", "costo_oc": 1336, "caja_factor": 10},
    {"sku": "18628367", "ean": "7801234000108", "name": "Galletas Costa Nik Oblea Limón 71 g", "cat": "Snacks", "costo_oc": 396, "caja_factor": 36},
    {"sku": "13V88U", "ean": "7801234000109", "name": "Galleta Costa Tuareg Sabor Coco (192 g) 4 Unidades", "cat": "Snacks", "costo_oc": 872, "caja_factor": 16},
    {"sku": "7BI4S7", "ean": "7801234000110", "name": "Galleta Mini Costa Mantequilla 35 g", "cat": "Snacks", "costo_oc": 202, "caja_factor": 48},
    {"sku": "RX9T2P", "ean": "7801234000111", "name": "Compota Vivo Break Avena Yoghurt Naranja Y Plátano 90 g", "cat": "Personal Care / Baby / Health", "costo_oc": 470, "caja_factor": 36},
    {"sku": "ZK135G", "ean": "7801234000112", "name": "Chocolate Costa Carezza Doble Relleno Tiramisu 95 g", "cat": "Snacks", "costo_oc": 1481, "caja_factor": 15},
    {"sku": "18628399", "ean": "7801234000113", "name": "Galleta Costa Limon 140 g", "cat": "Snacks", "costo_oc": 639, "caja_factor": 24},
    {"sku": "21071586", "ean": "7801234000114", "name": "Galleta Costa Champañitas 85 g", "cat": "Snacks", "costo_oc": 597, "caja_factor": 20},
    {"sku": "15132853", "ean": "7801234000115", "name": "Galleta Costa Oblea Nik Bocado 71 g", "cat": "Snacks", "costo_oc": 396, "caja_factor": 36},
    {"sku": "21071604", "ean": "7801234000116", "name": "Compota Platano Vivo 90 g", "cat": "Personal Care / Baby / Health", "costo_oc": 405, "caja_factor": 36},
    {"sku": "R3E183", "ean": "7801234000117", "name": "Néctar De Manzana Vivo 1 L", "cat": "Beverages", "costo_oc": 869, "caja_factor": 12},
    {"sku": "516923", "ean": "7801234000118", "name": "Cereal Vivo Line Berries 10 x 320 g", "cat": "Breakfast / Cereals", "costo_oc": 1925, "caja_factor": 10},
    {"sku": "120113", "ean": "7801234000119", "name": "Trattoria Gnocchi de Papa 12 x 500 g", "cat": "Packaged Foods", "costo_oc": 2425, "caja_factor": 12},
    {"sku": "135304", "ean": "7801234000120", "name": "Pomarola Sachet Italiana 24 x 200 g", "cat": "Packaged Foods", "costo_oc": 552, "caja_factor": 24},
    {"sku": "101409", "ean": "7801234000121", "name": "Carozzi Spaghetti 5 25 x 400 g", "cat": "Packaged Foods", "costo_oc": 779, "caja_factor": 25},
    {"sku": "545526", "ean": "7801234000122", "name": "Harina Selecta Sin Polvos 12 x 1 kg", "cat": "Baking Goods", "costo_oc": 1155, "caja_factor": 12},
]


def generar_escenarios_conciliacion(num_items=35, po_number="PO517979", tienda="CH_36_CD_Chile"):
    """
    Genera filas con todos los escenarios posibles de conciliación combinados aleatoriamente.
    """
    escenarios_dist = [
        # (tipo_escenario, peso_probabilidad)
        ("OK", 0.40),                  # Calce Conforme
        ("FALTANTE_PARCIAL", 0.18),    # Faltan unidades en bodega
        ("SOBREPRECIO", 0.12),         # Costo factura > Costo OC
        ("DOBLE_DESCALCE", 0.10),      # Faltan unidades + Sobreprecio
        ("FALTANTE_TOTAL", 0.08),      # 0 recepcionado
        ("SOBRERRECEP", 0.04),         # Bodega recibió de más
        ("CONVERSION_CAJA", 0.08)      # Facturado por caja
    ]

    facturas_pool = ["22586652", "22586653", "22586654", "22586655", "22586656", "22586657", "22586659", "22586660"]
    
    filas = []
    detalle_facturas = []
    
    for i in range(num_items):
        prod = CATALOGO_PRODUCTOS[i % len(CATALOGO_PRODUCTOS)]
        escenario = random.choices([e[0] for e in escenarios_dist], weights=[e[1] for e in escenarios_dist])[0]
        
        # Unidades base pedidas en la OC
        cant_oc = random.choice([60, 100, 120, 150, 180, 240, 300, 480])
        costo_unit_oc = prod["costo_oc"]
        factura_asignada = random.choice(facturas_pool)
        
        cant_rec = cant_oc
        cant_fac = cant_oc
        costo_total_fac = cant_fac * costo_unit_oc
        comentario = f"Factura {factura_asignada}"
        
        if escenario == "OK":
            # Calce Conforme 100%
            cant_rec = cant_oc
            cant_fac = cant_oc
            costo_total_fac = cant_fac * costo_unit_oc
            
        elif escenario == "FALTANTE_PARCIAL":
            # Faltante en bodega: facturó 100% pero bodega recibió menos
            faltante = random.choice([15, 20, 30, 50, 100, 150])
            cant_rec = max(10, cant_oc - faltante)
            cant_fac = cant_oc
            costo_total_fac = cant_fac * costo_unit_oc
            comentario = f"Factura {factura_asignada} - Faltante Bodega ({faltante} un)"
            
        elif escenario == "SOBREPRECIO":
            # Cantidades exactas pero costo facturado mayor al pactado
            cant_rec = cant_oc
            cant_fac = cant_oc
            sobreprecio_unit = random.choice([35, 50, 80, 120, 200, 350])
            costo_unit_fac = costo_unit_oc + sobreprecio_unit
            costo_total_fac = cant_fac * costo_unit_fac
            comentario = f"Factura {factura_asignada} - Sobreprecio (+${sobreprecio_unit}/un)"
            
        elif escenario == "DOBLE_DESCALCE":
            # Faltan unidades Y además el costo viene inflado
            faltante = random.choice([20, 40, 60])
            cant_rec = max(10, cant_oc - faltante)
            cant_fac = cant_oc
            sobreprecio_unit = random.choice([40, 75, 110, 180])
            costo_unit_fac = costo_unit_oc + sobreprecio_unit
            costo_total_fac = cant_fac * costo_unit_fac
            comentario = f"Factura {factura_asignada} - Doble Descalce (Dif Costo y Unidad)"
            
        elif escenario == "FALTANTE_TOTAL":
            # Bodega no recibió nada (0 recepcionado)
            cant_rec = 0
            cant_fac = cant_oc
            costo_total_fac = cant_fac * costo_unit_oc
            comentario = f"Factura {factura_asignada} - 0 Recepción Física (Reclamo Total)"
            
        elif escenario == "SOBRERRECEP":
            # Bodega recibió más unidades que las facturadas
            sobrante = random.choice([10, 20, 30])
            cant_rec = cant_oc + sobrante
            cant_fac = cant_oc
            costo_total_fac = cant_fac * costo_unit_oc
            comentario = f"Factura {factura_asignada} - Sobrerrecepción en Bodega (+{sobrante} un)"
            
        elif escenario == "CONVERSION_CAJA":
            # Proveedor facturó en cajas. Mostramos cómo el flujo convierte a unidades
            cajas = cant_oc // prod["caja_factor"]
            if cajas < 1: cajas = 2
            cant_fac = cajas * prod["caja_factor"]
            cant_rec = cant_fac
            costo_total_fac = cant_fac * costo_unit_oc
            comentario = f"Factura {factura_asignada} - Homologado {cajas} CAJ x {prod['caja_factor']} un"

        costo_total_oc = cant_rec * costo_unit_oc

        filas.append({
            "po": po_number,
            "tienda": tienda,
            "sku": prod["sku"],
            "ean": prod["ean"],
            "name": prod["name"],
            "cat": prod["cat"],
            "cant_rec": cant_rec,
            "costo_oc": costo_unit_oc,
            "impuesto": 0,
            "costo_total_oc": costo_total_oc,
            "cant_fac": cant_fac,
            "costo_total_fac": costo_total_fac,
            "comentario": comentario,
            "factura": factura_asignada,
            "factor_caja": prod["caja_factor"]
        })
        
        # Pestaña Detalle Facturas
        detalle_facturas.append({
            "factura": factura_asignada,
            "codigo": prod["sku"],
            "descripcion": prod["name"],
            "unid_vta": "CAJ" if escenario == "CONVERSION_CAJA" else "UN",
            "cantidad": (cant_fac // prod["caja_factor"]) if escenario == "CONVERSION_CAJA" else cant_fac,
            "precio_unitario": (costo_total_fac / (cant_fac // prod["caja_factor"])) if escenario == "CONVERSION_CAJA" else (costo_total_fac / cant_fac),
            "valor_neto": costo_total_fac
        })

    return filas, detalle_facturas


def construir_planilla_excel(nombre_proveedor="Carozzi", po_number="PO517979", ruta_salida="Planilla_Conciliacion_Finanzas_Oficial.xlsx"):
    """
    Construye la planilla Excel (.xlsx) replicando con total fidelidad el formato oficial de Finanzas.
    """
    wb = openpyxl.Workbook()
    
    # -------------------------------------------------------------
    # HOJA 1: Conciliación / Cruce (Nombre del Proveedor)
    # -------------------------------------------------------------
    ws_main = wb.active
    ws_main.title = nombre_proveedor
    ws_main.views.sheetView[0].showGridLines = True
    
    # Configurar anchos de columna exactos según la plantilla oficial
    col_widths = {
        'A': 23.0, 'B': 19.5, 'C': 12.0, 'D': 18.0, 'E': 48.0,
        'F': 22.0, 'G': 18.0, 'H': 18.0, 'I': 14.0, 'J': 18.0,
        'K': 18.0, 'L': 22.0, 'M': 18.0, 'N': 18.0, 'O': 18.0,
        'P': 26.0, 'Q': 35.0
    }
    for col_letter, width in col_widths.items():
        ws_main.column_dimensions[col_letter].width = width

    filas_datos, detalle_facturas = generar_escenarios_conciliacion(num_items=35, po_number=po_number)
    num_rows = len(filas_datos)
    start_row = 6
    end_row = start_row + num_rows - 1

    # --- FILA 1 A 3: TARJETAS DE RESUMEN Y CONTROL FINANCIERO ---
    # R1
    ws_main['A1'] = "Orden de Compra:"
    ws_main['B1'] = po_number
    ws_main['D1'] = "Monto por diferencia de unidades:"
    ws_main['E1'] = f"=SUMPRODUCT(($H$6:$H${end_row})*($N$6:$N${end_row}))"
    ws_main['K1'] = "EN CASO DE HABER FACTURADO POR CAJA, FAVOR DE COLOCAR LAS UNIDADES TOTALES Y EL COSTO TOTAL FACTURADO"
    
    # R2
    ws_main['A2'] = "Monto Aforado:"
    ws_main['B2'] = 0 # Se calcula dinámicamente o se vincula a -$E$3
    ws_main['D2'] = "Monto por diferencia de costo:"
    ws_main['E2'] = f"=SUMPRODUCT(($M$6:$M${end_row})*($K$6:$K${end_row}))-SUMPRODUCT(($H$6:$H${end_row})*($K$6:$K${end_row}))"

    # R3
    ws_main['A3'] = "Diferencia sin identificar:"
    ws_main['B3'] = "=$B$2+$E$3"
    ws_main['D3'] = "Monto total diferencias:"
    ws_main['E3'] = "=$E$1+$E$2"

    # Dar estilo a la caja de control A1:E3
    for r in range(1, 4):
        for c in [1, 2, 3, 4, 5]:
            cell = ws_main.cell(r, c)
            cell.fill = FILL_BOX_PASTEL
            cell.border = BORDER_CARD
            if c in [1, 4]:
                cell.font = FONT_BOLD_BLACK
                cell.alignment = ALIGN_LEFT
            else:
                cell.font = FONT_REGULAR
                cell.alignment = ALIGN_RIGHT if c in [2, 5] else ALIGN_CENTER
                if c in [2, 5] and r in [1, 2, 3]:
                    cell.number_format = "$#,##0"

    ws_main['B1'].alignment = ALIGN_CENTER
    ws_main['B1'].font = FONT_BOLD_BLACK
    ws_main['K1'].font = FONT_NOTICE_RED

    # Vincular B2 al monto aforado negativo de las diferencias totales detectadas
    ws_main['B2'].value = "=-$E$3"

    # --- FILA 4: BANNERS AMARILLOS DE ACCIÓN ---
    ws_main.merge_cells("K4:M4")
    ws_main['K4'] = "COMPLETAR CON LOS PRODUCTOS FACTURADOS"
    ws_main['K4'].fill = FILL_ALERT_YELLOW
    ws_main['K4'].font = FONT_YELLOW_BANNER
    ws_main['K4'].alignment = ALIGN_CENTER
    for col in range(11, 14):
        ws_main.cell(4, col).border = BORDER_THIN_GRAY

    ws_main.merge_cells("N4:P4")
    ws_main['N4'] = "REVISAR LAS DIFERENCIAS"
    ws_main['N4'].fill = FILL_ALERT_YELLOW
    ws_main['N4'].font = FONT_YELLOW_BANNER
    ws_main['N4'].alignment = ALIGN_CENTER
    for col in range(14, 17):
        ws_main.cell(4, col).border = BORDER_THIN_GRAY

    # --- FILA 5: ENCABEZADOS ROJOS OFICIALES ---
    headers = [
        "Órdenes de Compra", "Tienda", "SKU", "EAN", "Nombre de Producto", "Tipo Producto",
        "Unidades Recepcionadas", "Costo Unitario OC", "Impuesto Interno", "Costo Total OC",
        "Unidades Facturadas", "Costo Total Facturado (SIN IVA)", "Costo Unitario Facturado (SIN IVA)",
        "Diferencia de Unidades", "Diferencia de Costo", "Diferencias Finales", "Comentarios"
    ]
    ws_main.row_dimensions[5].height = 28
    for col_idx, h_text in enumerate(headers, 1):
        cell = ws_main.cell(5, col_idx, h_text)
        cell.fill = FILL_HEADER_RED
        cell.font = FONT_HEADER
        cell.alignment = ALIGN_CENTER
        cell.border = BORDER_THIN_GRAY

    # --- FILAS 6 A N: DETALLE DE CRUCE SKU X SKU ---
    for i, item in enumerate(filas_datos):
        curr_row = start_row + i
        ws_main.row_dimensions[curr_row].height = 20

        ws_main.cell(curr_row, 1, item["po"]).alignment = ALIGN_CENTER
        ws_main.cell(curr_row, 2, item["tienda"]).alignment = ALIGN_CENTER
        ws_main.cell(curr_row, 3, item["sku"]).alignment = ALIGN_CENTER
        
        c_ean = ws_main.cell(curr_row, 4, item["ean"])
        c_ean.number_format = "@"
        c_ean.alignment = ALIGN_CENTER

        ws_main.cell(curr_row, 5, item["name"]).alignment = ALIGN_LEFT
        ws_main.cell(curr_row, 6, item["cat"]).alignment = ALIGN_LEFT
        
        c_rec = ws_main.cell(curr_row, 7, item["cant_rec"])
        c_rec.number_format = "#,##0"
        c_rec.alignment = ALIGN_RIGHT

        c_cu_oc = ws_main.cell(curr_row, 8, item["costo_oc"])
        c_cu_oc.number_format = "$#,##0.00"
        c_cu_oc.alignment = ALIGN_RIGHT

        c_imp = ws_main.cell(curr_row, 9, item["impuesto"])
        c_imp.number_format = "$#,##0.00"
        c_imp.alignment = ALIGN_RIGHT

        c_ct_oc = ws_main.cell(curr_row, 10, f"=G{curr_row}*H{curr_row}")
        c_ct_oc.number_format = "$#,##0"
        c_ct_oc.alignment = ALIGN_RIGHT

        c_fac_un = ws_main.cell(curr_row, 11, item["cant_fac"])
        c_fac_un.number_format = "#,##0"
        c_fac_un.alignment = ALIGN_RIGHT

        c_fac_tot = ws_main.cell(curr_row, 12, item["costo_total_fac"])
        c_fac_tot.number_format = "$#,##0"
        c_fac_tot.alignment = ALIGN_RIGHT

        # Fórmulas idénticas de cálculo
        c_cu_fac = ws_main.cell(curr_row, 13, f'=IF(OR(K{curr_row}="",K{curr_row}=0,L{curr_row}=""),0,IFERROR(L{curr_row}/K{curr_row},""))')
        c_cu_fac.number_format = "$#,##0.00"
        c_cu_fac.alignment = ALIGN_RIGHT

        c_dif_un = ws_main.cell(curr_row, 14, f'=IF(OR(K{curr_row}="",K{curr_row}=0,L{curr_row}=""),0,K{curr_row}-G{curr_row})')
        c_dif_un.number_format = "#,##0"
        c_dif_un.alignment = ALIGN_RIGHT

        c_dif_costo = ws_main.cell(curr_row, 15, f'=ROUND(IF(OR(K{curr_row}="",K{curr_row}=0,L{curr_row}=""),0,M{curr_row}-H{curr_row}),2)')
        c_dif_costo.number_format = "$#,##0.00"
        c_dif_costo.alignment = ALIGN_RIGHT

        c_dif_final = ws_main.cell(curr_row, 16, f'=_xlfn.IFS(AND(N{curr_row}>0,O{curr_row}>0),"Diferencia de Costo y Unidad",N{curr_row}>0,"Diferencia de Unidades",O{curr_row}>0,"Diferencia de Costo",TRUE,"")')
        c_dif_final.alignment = ALIGN_CENTER

        c_com = ws_main.cell(curr_row, 17, item["comentario"])
        c_com.alignment = ALIGN_LEFT

        # Bordes y fuentes para toda la fila
        for col_idx in range(1, 18):
            cell = ws_main.cell(curr_row, col_idx)
            cell.font = FONT_REGULAR
            cell.border = BORDER_THIN_GRAY

    # -------------------------------------------------------------
    # HOJA 2: Detalle Facturas
    # -------------------------------------------------------------
    ws_det = wb.create_sheet(title="Detalle Facturas")
    ws_det.views.sheetView[0].showGridLines = True

    det_col_widths = {'A': 16.0, 'B': 20.0, 'C': 48.0, 'D': 14.0, 'E': 14.0, 'F': 18.0, 'G': 18.0}
    for col_letter, width in det_col_widths.items():
        ws_det.column_dimensions[col_letter].width = width

    det_headers = ["Nº Factura", "Código Producto", "Descripción", "Unid. Vta", "Cantidad", "Precio Unitario", "Valor Neto"]
    ws_det.row_dimensions[1].height = 26
    for col_idx, h_text in enumerate(det_headers, 1):
        cell = ws_det.cell(1, col_idx, h_text)
        cell.fill = FILL_DETAIL_BLUE
        cell.font = FONT_HEADER
        cell.alignment = ALIGN_CENTER
        cell.border = BORDER_THIN_GRAY

    for idx, d in enumerate(detalle_facturas, 2):
        ws_det.row_dimensions[idx].height = 19
        ws_det.cell(idx, 1, d["factura"]).alignment = ALIGN_CENTER
        ws_det.cell(idx, 2, d["codigo"]).alignment = ALIGN_CENTER
        ws_det.cell(idx, 3, d["descripcion"]).alignment = ALIGN_LEFT
        ws_det.cell(idx, 4, d["unid_vta"]).alignment = ALIGN_CENTER
        
        c_qty = ws_det.cell(idx, 5, d["cantidad"])
        c_qty.number_format = "#,##0"
        c_qty.alignment = ALIGN_RIGHT

        c_pr = ws_det.cell(idx, 6, d["precio_unitario"])
        c_pr.number_format = "$#,##0.00"
        c_pr.alignment = ALIGN_RIGHT

        c_net = ws_det.cell(idx, 7, d["valor_neto"])
        c_net.number_format = "$#,##0"
        c_net.alignment = ALIGN_RIGHT

        for col_idx in range(1, 8):
            ws_det.cell(idx, col_idx).font = FONT_REGULAR
            ws_det.cell(idx, col_idx).border = BORDER_THIN_GRAY

    # Guardar archivo
    wb.save(ruta_salida)
    print(f"✅ Planilla Excel generada exitosamente en: {ruta_salida}")
    return ruta_salida


if __name__ == "__main__":
    out_file = "Planilla_Conciliacion_Finanzas_Oficial.xlsx"
    construir_planilla_excel(nombre_proveedor="Carozzi", po_number="PO517979", ruta_salida=out_file)
