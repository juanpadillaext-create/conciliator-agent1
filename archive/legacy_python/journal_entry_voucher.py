"""
journal_entry_voucher.py
=============================================================================
Módulo de Contabilidad / ERP para generación de Journal Entry Vouchers (JEV).
Diseñado específicamente para Sociedad 6202 (Delivery Hero Dmarts Chile SpA).
Genera asientos de diario contable balanceados (Debe == Haber) para la conciliación
de Facturas DTE, Órdenes de Compra (PO) y Recepciones de Bodega (GR/IR).
=============================================================================
"""

import os
import json
import csv
import datetime
from typing import Dict, Any, List, Optional

# Plan de Cuentas Contable Estándar SAP / ERP Retail
JEV_CUENTAS = {
    "PROVEEDORES_NACIONALES": {
        "codigo": "21040000",
        "nombre": "Proveedores Nacionales Comerciales",
        "tipo": "PASIVO"
    },
    "COMPENSACION_EM_RF": {
        "codigo": "11070000",
        "nombre": "Compensación EM/RF Mercadería Bodega",
        "tipo": "ACTIVO_TRANSITORIO"
    },
    "DESVIACION_PRECIO_COMPRA": {
        "codigo": "51020100",
        "nombre": "Desviación en Precio de Compra (PPV)",
        "tipo": "RESULTADO_GASTO"
    },
    "RECLAMO_FALTANTE_RECEPCION": {
        "codigo": "11090200",
        "nombre": "Reclamo Pendiente NC - Faltante Bodega",
        "tipo": "ACTIVO_EXIGIBLE"
    },
    "RECLAMO_ITEM_NO_ORDENADO": {
        "codigo": "11090300",
        "nombre": "Reclamo Pendiente NC - SKU No en OC",
        "tipo": "ACTIVO_EXIGIBLE"
    },
    "RETENCION_AFORO_COMERCIAL": {
        "codigo": "21090100",
        "nombre": "Retenciones por Aforo Comercial Proveedor",
        "tipo": "PASIVO_RETENCION"
    },
    "IVA_CREDITO_FISCAL": {
        "codigo": "11080101",
        "nombre": "IVA Crédito Fiscal Operacional (19%)",
        "tipo": "ACTIVO_IMPUESTO"
    }
}

class JournalEntryVoucherGenerator:
    """Generador de asientos contables Journal Entry Voucher (JEV) para SAP."""

    def __init__(self, company_code: str = "6202", cost_center: str = "CD_36_CD_Chile", tax_rate: float = 0.19):
        self.company_code = company_code
        self.company_name = "Delivery Hero Dmarts Chile SpA"
        self.cost_center = cost_center
        self.tax_rate = tax_rate

    def generate(self, recon_data: Dict[str, Any], include_tax: bool = True, aplicar_aforo: bool = True) -> Dict[str, Any]:
        """
        Genera el Journal Entry Voucher (JEV) con estricta cuadratura contable (Debe == Haber).
        """
        res = recon_data.get("resumen", recon_data)
        
        folio = str(res.get("folio_factura") or res.get("folio") or "0000")
        po_num = str(res.get("po_referencia") or res.get("po_number") or res.get("po") or "-")
        prov_nombre = res.get("proveedor_nombre") or res.get("proveedor") or "Proveedor"
        prov_rut = res.get("proveedor_rut") or res.get("rut") or ""
        almacen = res.get("almacen") or self.cost_center

        facturado_neto = round(float(res.get("total_facturado_neto", 0)))
        recepcionado_neto = round(float(res.get("total_recepcionado_neto", 0)))
        descalce_precio = round(float(res.get("total_descalce_precio", 0)))
        faltante_recepcion = round(float(res.get("total_faltante_recepcion", 0)))
        no_en_oc = round(float(res.get("total_no_en_oc", 0)))
        monto_reclamar_total = round(float(res.get("total_monto_a_reclamar") or res.get("total_monto_reclamar", 0)))

        # Retención de aforo si aplica
        monto_retencion_aforo = 0
        aforo_info = res.get("aforo_info")
        if aplicar_aforo and aforo_info and aforo_info.get("monto_retenido_aforo"):
            monto_retencion_aforo = round(float(aforo_info["monto_retenido_aforo"]))

        today_str = datetime.date.today().isoformat()
        voucher_id = f"JEV-{self.company_code}-{today_str.replace('-', '')}-{folio}"

        lines = []
        item_counter = 1

        # -------------------------------------------------------------
        # DÉBITOS (APLICACIÓN DEL GASTO / ACTIVO / RECLAMOS)
        # -------------------------------------------------------------

        # 1. Compensación EM/RF (GR/IR)
        if recepcionado_neto > 0:
            lines.append({
                "item": item_counter,
                "dc_indicator": "D",
                "account": JEV_CUENTAS["COMPENSACION_EM_RF"]["codigo"],
                "account_name": JEV_CUENTAS["COMPENSACION_EM_RF"]["nombre"],
                "debit": recepcionado_neto,
                "credit": 0,
                "cost_center": self.cost_center,
                "assignment": f"PO:{po_num}",
                "item_text": f"Recepción Mercadería Conforme Folio {folio}"
            })
            item_counter += 1

        # 2. Desviación en Precio de Compra (PPV)
        if descalce_precio > 0:
            lines.append({
                "item": item_counter,
                "dc_indicator": "D",
                "account": JEV_CUENTAS["DESVIACION_PRECIO_COMPRA"]["codigo"],
                "account_name": JEV_CUENTAS["DESVIACION_PRECIO_COMPRA"]["nombre"],
                "debit": descalce_precio,
                "credit": 0,
                "cost_center": self.cost_center,
                "assignment": f"PO:{po_num}",
                "item_text": f"Sobreprecio Factura vs OC {po_num}"
            })
            item_counter += 1

        # 3. Reclamo Faltante Físico de Recepción
        if faltante_recepcion > 0:
            lines.append({
                "item": item_counter,
                "dc_indicator": "D",
                "account": JEV_CUENTAS["RECLAMO_FALTANTE_RECEPCION"]["codigo"],
                "account_name": JEV_CUENTAS["RECLAMO_FALTANTE_RECEPCION"]["nombre"],
                "debit": faltante_recepcion,
                "credit": 0,
                "cost_center": self.cost_center,
                "assignment": f"FOL:{folio}",
                "item_text": f"Reclamo NC Faltante Físico Bodega {almacen}"
            })
            item_counter += 1

        # 4. Reclamo Ítems No Ordenados en OC
        if no_en_oc > 0:
            lines.append({
                "item": item_counter,
                "dc_indicator": "D",
                "account": JEV_CUENTAS["RECLAMO_ITEM_NO_ORDENADO"]["codigo"],
                "account_name": JEV_CUENTAS["RECLAMO_ITEM_NO_ORDENADO"]["nombre"],
                "debit": no_en_oc,
                "credit": 0,
                "cost_center": self.cost_center,
                "assignment": f"FOL:{folio}",
                "item_text": f"Reclamo NC SKU No contemplados en OC {po_num}"
            })
            item_counter += 1

        # Remanente de reclamo si no hubo desglose detallado
        suma_desgloses = descalce_precio + faltante_recepcion + no_en_oc
        remanente = monto_reclamar_total - suma_desgloses
        if remanente > 0:
            lines.append({
                "item": item_counter,
                "dc_indicator": "D",
                "account": JEV_CUENTAS["RECLAMO_FALTANTE_RECEPCION"]["codigo"],
                "account_name": JEV_CUENTAS["RECLAMO_FALTANTE_RECEPCION"]["nombre"],
                "debit": remanente,
                "credit": 0,
                "cost_center": self.cost_center,
                "assignment": f"FOL:{folio}",
                "item_text": "Ajuste Diferencia Reclamo NC"
            })
            item_counter += 1

        # 5. IVA Crédito Fiscal (19%)
        monto_iva = 0
        if include_tax:
            monto_iva = round(facturado_neto * self.tax_rate)
            lines.append({
                "item": item_counter,
                "dc_indicator": "D",
                "account": JEV_CUENTAS["IVA_CREDITO_FISCAL"]["codigo"],
                "account_name": JEV_CUENTAS["IVA_CREDITO_FISCAL"]["nombre"],
                "debit": monto_iva,
                "credit": 0,
                "cost_center": "",
                "assignment": f"DTE:{folio}",
                "item_text": f"IVA Crédito Fiscal (19%) DTE Folio {folio}"
            })
            item_counter += 1

        # -------------------------------------------------------------
        # CRÉDITOS (OBLIGACIÓN CON EL PROVEEDOR / PASIVOS)
        # -------------------------------------------------------------
        total_bruto = (facturado_neto + monto_iva) if include_tax else facturado_neto

        if monto_retencion_aforo > 0:
            saldo_liquido = max(0, total_bruto - monto_retencion_aforo)
            lines.append({
                "item": item_counter,
                "dc_indicator": "C",
                "account": JEV_CUENTAS["PROVEEDORES_NACIONALES"]["codigo"],
                "account_name": JEV_CUENTAS["PROVEEDORES_NACIONALES"]["nombre"],
                "debit": 0,
                "credit": saldo_liquido,
                "cost_center": "",
                "assignment": f"RUT:{prov_rut}",
                "item_text": f"Factura {folio} Liq. Pago - {prov_nombre}"
            })
            item_counter += 1

            lines.append({
                "item": item_counter,
                "dc_indicator": "C",
                "account": JEV_CUENTAS["RETENCION_AFORO_COMERCIAL"]["codigo"],
                "account_name": JEV_CUENTAS["RETENCION_AFORO_COMERCIAL"]["nombre"],
                "debit": 0,
                "credit": monto_retencion_aforo,
                "cost_center": self.cost_center,
                "assignment": f"AFORO:{prov_rut}",
                "item_text": "Retención Preventiva Aforo Comercial 6202"
            })
            item_counter += 1
        else:
            lines.append({
                "item": item_counter,
                "dc_indicator": "C",
                "account": JEV_CUENTAS["PROVEEDORES_NACIONALES"]["codigo"],
                "account_name": JEV_CUENTAS["PROVEEDORES_NACIONALES"]["nombre"],
                "debit": 0,
                "credit": total_bruto,
                "cost_center": "",
                "assignment": f"RUT:{prov_rut}",
                "item_text": f"Factura {folio} - {prov_nombre}"
            })
            item_counter += 1

        # Cuadratura contable
        tot_debe = sum(l["debit"] for l in lines)
        tot_haber = sum(l["credit"] for l in lines)
        diferencia = abs(tot_debe - tot_haber)

        if diferencia <= 2 and diferencia != 0 and lines:
            lines[0]["debit"] += (tot_haber - tot_debe)
            tot_debe = tot_haber

        is_balanced = (tot_debe == tot_haber)

        return {
            "success": True,
            "header": {
                "voucher_id": voucher_id,
                "company_code": self.company_code,
                "company_name": self.company_name,
                "document_date": str(res.get("fecha_emision") or today_str)[:10],
                "posting_date": today_str,
                "currency": "CLP",
                "doc_type": "KR",
                "reference": f"FOL:{folio} PO:{po_num}",
                "header_text": f"Conciliacion Dmarts Folio {folio} - {prov_nombre}"[:50],
                "source_system": "AXTEROID_DMARTS_CONCILIATOR"
            },
            "totals": {
                "total_debits": tot_debe,
                "total_credits": tot_haber,
                "difference": abs(tot_debe - tot_haber),
                "is_balanced": is_balanced,
                "currency": "CLP"
            },
            "lines": lines,
            "audit_summary": {
                "facturado_neto": facturado_neto,
                "recepcionado_neto": recepcionado_neto,
                "monto_a_reclamar": monto_reclamar_total,
                "monto_iva": monto_iva,
                "total_bruto": total_bruto,
                "proveedor_rut": prov_rut,
                "proveedor_nombre": prov_nombre,
                "po_number": po_num,
                "folio_factura": folio
            }
        }

    def export_csv(self, jev: Dict[str, Any], filepath: str) -> str:
        """Exporta el JEV a archivo CSV para carga masiva en SAP."""
        h = jev["header"]
        rows = [
            ["# JOURNAL ENTRY VOUCHER (JEV) - SOCIEDAD 6202 (DELIVERY HERO CHILE)"],
            [f"Voucher_ID:;{h['voucher_id']};Sociedad:;{h['company_code']};Moneda:;{h['currency']}"],
            [f"Fecha_Contabilizacion:;{h['posting_date']};Clase_Doc:;{h['doc_type']}"],
            [f"Referencia:;{h['reference']};Texto_Cabecera:;{h['header_text']}"],
            [f"Total_Debitos:;$ {jev['totals']['total_debits']};Total_Creditos:;$ {jev['totals']['total_credits']};Cuadrado:;{'SI' if jev['totals']['is_balanced'] else 'NO'}"],
            [""],
            ["Item;Indicador_DC;Cuenta_Mayor;Nombre_Cuenta;Debe_CLP;Haber_CLP;Centro_Costo;Asignacion;Texto_Posicion"]
        ]

        for l in jev["lines"]:
            rows.append([
                f"{l['item']};{l['dc_indicator']};\"{l['account']}\";\"{l['account_name']}\";{l['debit']};{l['credit']};\"{l['cost_center']}\";\"{l['assignment']}\";\"{l['item_text']}\""
            ])

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            for r in rows:
                f.write(r[0] + "\r\n")

        return os.path.abspath(filepath)


if __name__ == "__main__":
    import sys
    if sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    # Test demostrativo
    demo_recon = {
        "folio_factura": "284719",
        "fecha_emision": "2024-03-15",
        "proveedor_nombre": "Empresas Carozzi S.A.",
        "proveedor_rut": "96591040-9",
        "po_referencia": "PO517979",
        "almacen": "CD_36_CD_Chile",
        "total_facturado_neto": 2685740,
        "total_recepcionado_neto": 2356100,
        "total_descalce_precio": 128400,
        "total_faltante_recepcion": 201240,
        "total_no_en_oc": 0,
        "total_monto_a_reclamar": 329640
    }

    generator = JournalEntryVoucherGenerator()
    jev = generator.generate(demo_recon)

    print("=" * 75)
    print("[JEV] JOURNAL ENTRY VOUCHER - SOCIEDAD 6202 SAP")
    print("=" * 75)
    print(f" Voucher ID : {jev['header']['voucher_id']}")
    print(f" Referencia : {jev['header']['reference']}")
    print(f" Total Debe : ${jev['totals']['total_debits']:,} CLP")
    print(f" Total Haber: ${jev['totals']['total_credits']:,} CLP")
    print(f" Estado     : {'BALANCEADO' if jev['totals']['is_balanced'] else 'DESCUADRADO'}")
    print("-" * 75)
    print(f"{'POS':<4} {'D/C':<4} {'CUENTA':<10} {'DEBE (CLP)':<14} {'HABER (CLP)':<14} {'TEXTO'}")
    print("-" * 75)
    for line in jev["lines"]:
        d_str = f"${line['debit']:,}" if line['debit'] > 0 else "-"
        c_str = f"${line['credit']:,}" if line['credit'] > 0 else "-"
        print(f"{line['item']:<4} {line['dc_indicator']:<4} {line['account']:<10} {d_str:<14} {c_str:<14} {line['item_text']}")
    print("=" * 75)
