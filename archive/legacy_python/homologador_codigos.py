"""
homologador_codigos.py
=============================================================================
Herramienta CLI interactiva para la homologacion de codigos en DMarts Chile:
- Codigo de Factura Proveedor (XML DTE Axteroid / <VlrCodigo>)
- Codigo de Barras EAN-13 (Lectora de pistola / barcodes)
- SKU de PedidosYa (Catalogo maestro / sku_id)
- Ubicacion fisica de Bodega (Pasillo, Rack, Estante)
=============================================================================
"""

import sys
import json
import subprocess
import argparse
import csv
import os

PROVEEDORES_RAPIDOS = {
    "1": ("Empresas Carozzi S.A.", "96591040-9"),
    "2": ("Embotelladora Andina S.A.", "91144000-8"),
    "3": ("Coca-Cola Embonor S.A.", "93281000-K"),
    "4": ("Comercial CCU S.A.", "99554560-8"),
    "5": ("Agrosuper Comercializadora Ltda.", "79984240-8"),
    "6": ("Consorcio Industrial CIAL", "80186300-0"),
    "7": ("Nestlé Chile S.A.", "96557910-9"),
    "8": ("Ideal S.A. (Grupo Bimbo)", "82623500-4"),
    "9": ("Cooperativa Colun", "81094100-6"),
    "10": ("Comercial Santa Elena S.A.", "84472400-4"),
    "11": ("Bredenmaster S.A.", "96606310-6"),
    "12": ("Embrio Chile S.A.", "99540130-4"),
    "13": ("Softys Chile SpA", "96529310-8"),
    "14": ("Ariztía Comercial Ltda.", "83614800-2"),
    "15": ("Todos los Proveedores", "")
}

def consultar_homologacion(termino=None, rut_proveedor=None, limit=25):
    """Ejecuta la consulta en BigQuery sobre las tablas maestras de Dmarts."""
    where_clauses = ["ps.country_code = 'cl'", "s.supplier_sku IS NOT NULL"]
    
    if rut_proveedor:
        clean_rut = rut_proveedor.strip().replace("'", "\\'")
        where_clauses.append(f"s.supplier_tax_id = '{clean_rut}'")
        
    if termino:
        term_clean = termino.strip().replace("'", "\\'")
        if term_clean.isdigit():
            where_clauses.append(f"""(
                s.supplier_sku = '{term_clean}'
                OR ps.sku = '{term_clean}'
                OR EXISTS(SELECT 1 FROM UNNEST(cat.barcodes) b WHERE b.barcode = '{term_clean}' OR b.barcode LIKE '%{term_clean}%')
            )""")
        else:
            where_clauses.append(f"""(
                LOWER(ps.sku) = LOWER('{term_clean}')
                OR LOWER(s.supplier_sku) = LOWER('{term_clean}')
                OR LOWER(ps.name) LIKE LOWER('%{term_clean}%')
            )""")

    sql = f"""
    SELECT 
      ps.sku as sku_pedidosya,
      ANY_VALUE(ps.name) as producto,
      s.supplier_name as proveedor,
      s.supplier_tax_id as rut_proveedor,
      s.supplier_sku as codigo_factura,
      ANY_VALUE(ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(cat.barcodes)), ', ')) as ean
    FROM `peya-data-origins-pro.cl_dmarts.products_suppliers` ps
    JOIN `peya-data-origins-pro.cl_dmarts.qc_catalog_products` cat 
      ON ps.sku = cat.sku AND cat.country_code = 'cl',
    UNNEST(ps.suppliers) as s
    WHERE {' AND '.join(where_clauses)}
    GROUP BY ps.sku, s.supplier_name, s.supplier_tax_id, s.supplier_sku
    ORDER BY s.supplier_name ASC, producto ASC
    LIMIT {limit};
    """

    cmd = f"bq query --use_legacy_sql=false --format=json --max_rows={limit} --label datacloud:antigravity"
    res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
    if res.returncode != 0:
        print(f"\n[!] Error en BigQuery ({res.returncode}):\n{res.stdout}\n{res.stderr}")
        return []
    
    stdout = res.stdout.strip()
    idx_json = stdout.find('[')
    if idx_json != -1:
        stdout = stdout[idx_json:]
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return []

def imprimir_resultados(resultados):
    """Muestra los resultados de forma clara y formateada en consola."""
    if not resultados:
        print("\n  [x] No se encontraron coincidencias para la búsqueda.\n")
        return

    print(f"\n  Resultados encontrados: {len(resultados)}")
    print("  " + "=" * 70)
    for idx, r in enumerate(resultados, 1):
        print(f"  [{idx:02d}] {r['producto']}")
        print(f"       * SKU PedidosYa   : {r['sku_pedidosya']}")
        print(f"       * Cód. Factura    : {r['codigo_factura']} (Proveedor: {r['proveedor']})")
        print(f"       * Códigos EAN     : {r['ean'] or 'Sin EAN registrado'}")
        print("  " + "-" * 70)
    print()

def exportar_csv(resultados, filename):
    """Guarda los resultados en un archivo CSV formateado para Excel con UTF-8 BOM."""
    if not filename.endswith(".csv"):
        filename += ".csv"
        
    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow([
            "SKU PedidosYa",
            "Descripcion Producto",
            "Cod. Factura Proveedor",
            "EAN Barcodes",
            "Proveedor",
            "RUT Proveedor"
        ])
        for r in resultados:
            writer.writerow([
                r.get("sku_pedidosya", ""),
                r.get("producto", ""),
                r.get("codigo_factura", ""),
                r.get("ean", ""),
                r.get("proveedor", ""),
                r.get("rut_proveedor", "")
            ])
    print(f"\n  [OK] Archivo generado exitosamente: {os.path.abspath(filename)}\n")

def modo_interactivo():
    """Bucle de menú interactivo en consola."""
    rut_actual = ""
    nombre_prov_actual = "Todos"

    while True:
        print("\n" + "=" * 72)
        print("   🔍 HOMOLOGADOR DE CÓDIGOS DMARTS CHILE (SOCIEDAD SAP 6202)")
        print(f"  Filtro proveedor actual: [{nombre_prov_actual}]")
        print("  1. Buscar Código o Nombre (EAN, Factura XML, SKU PeYa o Descripción)")
        print("  2. Cambiar Proveedor (Carozzi, Andina, CCU, Watts, Todos)")
        print("  3. Exportar Catálogo Maestro del Proveedor a CSV (Excel)")
        print("  4. Homologar archivo CSV por lote (Lista de códigos)")
        print("  5. Desambiguar con TypeSafe AI Jev (System-1 Fuzzy Match & UOM)")
        print("  6. Generar Asiento Contable JEV para SAP (Journal Entry Voucher)")
        print("  0. Salir")
        print("=" * 72)
        
        opc = input("  Selecciona una opción [0-6]: ").strip()
        
        if opc == "0":
            print("\n  ¡Hasta luego!\n")
            break

        elif opc == "1":
            termino = input("\n  -> Ingresa EAN, Cód. Factura, SKU o Nombre: ").strip()
            if termino:
                print("  Consultando en BigQuery...")
                res = consultar_homologacion(termino, rut_actual, limit=30)
                imprimir_resultados(res)
                if res:
                    guardar = input("  ¿Deseas exportar estos resultados a CSV? (s/n): ").strip().lower()
                    if guardar in ("s", "si", "y", "yes"):
                        nombre_arch = input("  Nombre del archivo (ej: resultado.csv): ").strip() or "resultado.csv"
                        exportar_csv(res, nombre_arch)

        elif opc == "2":
            print("\n  Proveedores preconfigurados:")
            for k, (nom, r) in PROVEEDORES_RAPIDOS.items():
                print(f"    {k}. {nom} {f'({r})' if r else ''}")
            sel = input("  Elige proveedor [1-5]: ").strip()
            if sel in PROVEEDORES_RAPIDOS:
                nom, r = PROVEEDORES_RAPIDOS[sel]
                nombre_prov_actual = nom
                rut_actual = r
                print(f"  [OK] Filtro fijado a: {nom}")

        elif opc == "3":
            lim = input("  ¿Cuántos registros deseas exportar? (Enter para 1000): ").strip()
            limite = int(lim) if lim.isdigit() else 1000
            print(f"  Extrayendo hasta {limite} registros de BigQuery para {nombre_prov_actual}...")
            res = consultar_homologacion(termino=None, rut_proveedor=rut_actual, limit=limite)
            if res:
                sufijo = nombre_prov_actual.replace(" ", "_").replace(".", "").replace("/", "_")
                def_name = f"Maestro_Homologacion_{sufijo}.csv"
                nombre_arch = input(f"  Nombre archivo [{def_name}]: ").strip() or def_name
                exportar_csv(res, nombre_arch)
            else:
                print("  [!] No se obtuvieron datos para exportar.")

        elif opc == "4":
            path_in = input("\n  -> Ruta del archivo CSV con códigos a homologar: ").strip()
            if os.path.exists(path_in):
                codigos = []
                with open(path_in, "r", encoding="utf-8-sig") as f:
                    for line in f:
                        c = line.strip().split(";")[0].split(",")[0].strip()
                        if c and c.lower() not in ("codigo", "sku", "ean", "barcode"):
                            codigos.append(c)
                print(f"  Se encontraron {len(codigos)} códigos a consultar.")
                
                res_acumulados = []
                for i, c in enumerate(codigos, 1):
                    print(f"  [{i}/{len(codigos)}] Consultando '{c}'...", end="\r")
                    r = consultar_homologacion(c, rut_actual, limit=2)
                    if r:
                        res_acumulados.extend(r)
                print()
                imprimir_resultados(res_acumulados)
                if res_acumulados:
                    out_name = input("  Guardar reporte en CSV [homologacion_lote.csv]: ").strip() or "homologacion_lote.csv"
                    exportar_csv(res_acumulados, out_name)
            else:
                print("  [!] Archivo no encontrado.")

        elif opc == "5":
            desc_fac = input("\n  -> Descripción o código en la Factura: ").strip()
            prc_str = input("  -> Precio unitario facturado (opcional): ").strip()
            prc_fac = float(prc_str) if prc_str.replace(".", "", 1).isdigit() else 0
            if desc_fac:
                print("  1. Extrayendo candidatos de BigQuery...")
                candidatos_raw = consultar_homologacion(desc_fac.split()[0] if desc_fac.split() else desc_fac, rut_actual, limit=15)
                if not candidatos_raw:
                    candidatos_raw = consultar_homologacion(None, rut_actual, limit=30)
                
                candidatos = []
                for c in candidatos_raw:
                    candidatos.append({
                        "sku_id": c.get("sku_pedidosya"),
                        "product_name": c.get("producto"),
                        "cost_unit": prc_fac or 1000,
                        "supplier_sku": c.get("codigo_factura"),
                        "barcodes": [b.strip() for b in (c.get("ean") or "").split(",") if b.strip()]
                    })
                
                from jev_typesafe import TypeSafeJevClient
                client = TypeSafeJevClient()
                inv_item = {"codigo": desc_fac, "descripcion": desc_fac, "precio_facturado": prc_fac}
                print("  2. Ejecutando System-1 Decision con TypeSafe AI Jev...")
                decision = client.match_sku(inv_item, candidatos)
                print("\n  " + "=" * 65)
                print("  ⚡ DICTAMEN TYPESAFE AI JEV (System-1 Decision):")
                print("  " + "=" * 65)
                print(f"  * SKU Homologado : {decision.get('matched_sku_id') or 'NO ENCONTRADO'}")
                print(f"  * Nivel Confianza: {int(decision.get('confidence', 0)*100)}%")
                print(f"  * Veredicto      : {decision.get('verdict')}")
                print(f"  * Factor UOM Pack: x{decision.get('uom_multiplier', 1)}")
                print(f"  * Fundamento     : {decision.get('reasoning')}")
                print("  " + "=" * 65 + "\n")

        elif opc == "6":
            from journal_entry_voucher import JournalEntryVoucherGenerator
            folio = input("\n  -> Folio de la Factura: ").strip() or "284719"
            po = input("  -> Orden de Compra asociada: ").strip() or "PO517979"
            m_fac = float(input("  -> Monto Facturado Neto: ").strip() or "2685740")
            m_rec = float(input("  -> Monto Recepcionado Bodega: ").strip() or "2356100")
            m_ppv = float(input("  -> Descalce por Sobreprecio (PPV): ").strip() or "128400")
            m_falt = float(input("  -> Descalce por Faltante Físico: ").strip() or "201240")
            
            generator = JournalEntryVoucherGenerator()
            jev = generator.generate({
                "folio_factura": folio,
                "po_referencia": po,
                "proveedor_nombre": nombre_prov_actual,
                "proveedor_rut": rut_actual or "96591040-9",
                "total_facturado_neto": m_fac,
                "total_recepcionado_neto": m_rec,
                "total_descalce_precio": m_ppv,
                "total_faltante_recepcion": m_falt,
                "total_monto_a_reclamar": m_ppv + m_falt
            })
            
            print("\n  " + "=" * 65)
            print("  📑 JOURNAL ENTRY VOUCHER GENERADO (SAP 6202):")
            print("  " + "=" * 65)
            print(f"  Voucher ID : {jev['header']['voucher_id']}")
            print(f"  Total Debe : ${jev['totals']['total_debits']:,} CLP")
            print(f"  Total Haber: ${jev['totals']['total_credits']:,} CLP")
            print(f"  Cuadratura : {'✅ BALANCEADO' if jev['totals']['is_balanced'] else '❌ DESCUADRADO'}")
            print("  " + "-" * 65)
            for l in jev["lines"]:
                d_val = f"${l['debit']:,}" if l['debit'] > 0 else "-"
                c_val = f"${l['credit']:,}" if l['credit'] > 0 else "-"
                print(f"  {l['item']} {l['dc_indicator']} {l['account']:<10} D:{d_val:<12} H:{c_val:<12} {l['item_text']}")
            print("  " + "=" * 65 + "\n")
            
            exp_csv = input("  ¿Exportar JEV a CSV para SAP? (s/n): ").strip().lower()
            if exp_csv in ("s", "si", "y", "yes"):
                csv_path = f"JEV_6202_Fac_{folio}.csv"
                generator.export_csv(jev, csv_path)
                print(f"  [OK] Guardado en: {os.path.abspath(csv_path)}")

def main():
    parser = argparse.ArgumentParser(description="Homologador de codigos EAN, Factura XML y SKU PedidosYa")
    parser.add_argument("termino", nargs="?", default="", help="Codigo EAN, Codigo Factura, SKU PeYa o texto a buscar")
    parser.add_argument("--rut", help="Filtrar por RUT del proveedor (ej: 96591040-9 para Carozzi, 91144000-8 para Andina)")
    parser.add_argument("--export", help="Nombre del archivo CSV para exportar los resultados")
    parser.add_argument("--limit", type=int, default=25, help="Limite de resultados")
    parser.add_argument("--use-jev", action="store_true", help="Usar TypeSafe AI Jev para resolver ambiguedades de SKU")
    parser.add_argument("-i", "--interactive", action="store_true", help="Abrir consola interactiva")
    args = parser.parse_args()

    # Si no se pasan argumentos o se solicita interactivo, abrir menú
    if (len(sys.argv) == 1) or args.interactive:
        modo_interactivo()
        return

    print("\n=======================================================")
    print(" HOMOLOGACION DE CODIGOS - SOCIEDAD 6202 DMARTS CHILE")
    print("=======================================================\n")
    if args.termino:
        print(f"Buscando por término: '{args.termino}'")
    if args.rut:
        print(f"Filtro RUT: {args.rut}")
        
    resultados = consultar_homologacion(args.termino, args.rut, args.limit)
    imprimir_resultados(resultados)

    if args.use_jev and args.termino and resultados:
        from jev_typesafe import TypeSafeJevClient
        client = TypeSafeJevClient()
        cands = [{
            "sku_id": r.get("sku_pedidosya"),
            "product_name": r.get("producto"),
            "supplier_sku": r.get("codigo_factura"),
            "barcodes": (r.get("ean") or "").split(",")
        } for r in resultados]
        dec = client.match_sku({"descripcion": args.termino, "codigo": args.termino}, cands)
        print("\n⚡ TypeSafe AI Jev Decisión:")
        print(f"   * SKU Asignado: {dec.get('matched_sku_id')}")
        print(f"   * Confianza   : {int(dec.get('confidence', 0)*100)}%")
        print(f"   * Razón       : {dec.get('reasoning')}\n")

    if args.export and resultados:
        exportar_csv(resultados, args.export)

if __name__ == "__main__":
    main()
