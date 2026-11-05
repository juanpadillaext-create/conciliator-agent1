import xml.etree.ElementTree as ET
import glob
import os

files = glob.glob("facturas_xml/*.xml")
ns = {'sii': 'http://www.sii.cl/SiiDte'}

for fpath in files:
    tree = ET.parse(fpath)
    root = tree.getroot()
    print("\n" + "="*80)
    print(f"ARCHIVO: {os.path.basename(fpath)}")
    print("="*80)
    
    # DTE Document
    dte = root.find('.//sii:DTE', ns)
    if dte is None:
        dte = root.find('.//DTE')
    
    encabezado = dte.find('.//sii:Encabezado', ns)
    id_doc = encabezado.find('sii:IdDoc', ns)
    emisor = encabezado.find('sii:Emisor', ns)
    receptor = encabezado.find('sii:Receptor', ns)
    totales = encabezado.find('sii:Totales', ns)
    
    print(f"Folio: {id_doc.findtext('sii:Folio', '', ns)}")
    print(f"Tipo DTE: {id_doc.findtext('sii:TipoDTE', '', ns)}")
    print(f"Fecha Emisión: {id_doc.findtext('sii:FchEmis', '', ns)}")
    print(f"Emisor: {emisor.findtext('sii:RznSoc', '', ns)} (RUT: {emisor.findtext('sii:RUTEmisor', '', ns)})")
    print(f"Giro Emisor: {emisor.findtext('sii:GiroEmis', '', ns)}")
    print(f"Receptor: {receptor.findtext('sii:RznSocRecep', '', ns)} (RUT: {receptor.findtext('sii:RUTRecep', '', ns)})")
    print(f"Dirección Receptor: {receptor.findtext('sii:DirRecep', '', ns)}, {receptor.findtext('sii:CmnaRecep', '', ns)}")
    
    print("\nTotales:")
    print(f"  Monto Neto:     ${int(totales.findtext('sii:MntNeto', '0', ns)):>12,}")
    print(f"  Tasa IVA:       {totales.findtext('sii:TasaIVA', '0', ns)}%")
    print(f"  IVA:            ${int(totales.findtext('sii:IVA', '0', ns)):>12,}")
    
    for impto in totales.findall('sii:ImptoReten', ns):
        tipo_imp = impto.findtext('sii:TipoImp', '', ns)
        tasa = impto.findtext('sii:TasaImp', '', ns)
        monto = impto.findtext('sii:MontoImp', '0', ns)
        print(f"  Impuesto Ret ({tipo_imp} @ {tasa}%): ${int(monto):>12,}")
        
    print(f"  Monto Total:    ${int(totales.findtext('sii:MntTotal', '0', ns)):>12,}")
    
    # Referencias
    print("\nReferencias:")
    for ref in dte.findall('.//sii:Referencia', ns):
        tpo_doc_ref = ref.findtext('sii:TpoDocRef', '', ns)
        fol_ref = ref.findtext('sii:FolioRef', '', ns)
        fch_ref = ref.findtext('sii:FchRef', '', ns)
        razon_ref = ref.findtext('sii:RazonRef', '', ns)
        print(f"  - Ref Tpo: {tpo_doc_ref} | Folio/Nro: {fol_ref} | Fecha: {fch_ref} | Razón: {razon_ref}")
        
    # Detalle de Líneas
    print("\nDetalle de Ítems / Productos:")
    print(f"  {'#':<3} | {'Nombre':<35} | {'Cant':>6} | {'Unidad':<6} | {'Precio Unit':>12} | {'Monto Total':>12}")
    print("  " + "-" * 85)
    for det in dte.findall('.//sii:Detalle', ns):
        nro = det.findtext('sii:NroLinDet', '', ns)
        nombre = det.findtext('sii:NmbItem', '', ns)
        cant = det.findtext('sii:QtyItem', '0', ns)
        unmd = det.findtext('sii:UnmdItem', '', ns)
        prc = det.findtext('sii:PrcItem', '0', ns)
        mnt = det.findtext('sii:MontoItem', '0', ns)
        print(f"  {nro:<3} | {nombre[:35]:<35} | {float(cant):>6.1f} | {unmd:<6} | ${float(prc):>11,.0f} | ${int(mnt):>11,}")
