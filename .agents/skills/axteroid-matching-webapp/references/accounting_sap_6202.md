# SAP Sociedad 6202 Accounting Specifications (JEV)

This document formalizes the accounting policy and double-entry rules implemented in `JournalEntryVoucher.gs` for Dmarts Chile (Sociedad SAP `6202`).

---

## 1. Core Accounting Parameters

- **Company Code (Sociedad):** `6202` (PedidosYa / Dmarts Chile)
- **Currency:** `CLP` (Pesos Chilenos)
- **Default Cost Center (Centro de Costos):** `CD_36_CD_Chile`
- **Document Type:** `KR` (Vendor Invoice) / `KG` (Vendor Credit Memo)
- **Standard Tax Rate:** `19%` (IVA Crédito Fiscal Chile)

---

## 2. General Ledger Accounts (Plan de Cuentas)

| Account Number | Account Description | Normal Balance | Classification |
| :--- | :--- | :--- | :--- |
| **`11070000`** | Provisión Facturas por Recibir (EM/RF) | Débito | Activo Circulante / Pasivo Transitorio |
| **`11090200`** | Reclamos a Proveedores por Faltantes | Débito | Activo Exigible (Reclamo Comercial) |
| **`51020100`** | Variación en Precio de Compra (PPV) | Débito / Crédito | Pérdidas y Ganancias (Cost of Sales Variance) |
| **`11080101`** | IVA Crédito Fiscal 19% | Débito | Activo Tributario |
| **`21040000`** | Proveedores Nacionales (Cuentas por Pagar) | Crédito | Pasivo Corriente |

---

## 3. Double-Entry Mechanics

Every invoice reconciliation must generate a balanced journal voucher where:
$$\sum \text{Debe} = \sum \text{Haber}$$

### Scenario A: Invoice with Physical Shortage ($Q_{del} < Q_{inv}$)
- **Débito:** Cuenta `11070000` (EM/RF) $\rightarrow Q_{del} \times Cost_{po}$
- **Débito:** Cuenta `11090200` (Reclamo Faltante) $\rightarrow (Q_{inv} - Q_{del}) \times Cost_{po}$
- **Débito:** Cuenta `11080101` (IVA 19%) $\rightarrow \text{Neto Facturado} \times 0.19$
- **Crédito:** Cuenta `21040000` (Proveedores AP) $\rightarrow \text{Total Bruto Facturado con IVA}$

### Scenario B: Invoice with Price Variance ($P_{inv} > Cost_{po}$)
- **Débito:** Cuenta `11070000` (EM/RF) $\rightarrow Q_{del} \times Cost_{po}$
- **Débito:** Cuenta `51020100` (PPV Desfavorable) $\rightarrow (P_{inv} - Cost_{po}) \times Q_{del}$
- **Débito:** Cuenta `11080101` (IVA 19%) $\rightarrow \text{Neto Facturado} \times 0.19$
- **Crédito:** Cuenta `21040000` (Proveedores AP) $\rightarrow \text{Total Bruto Facturado con IVA}$

### Scenario C: Conforming Invoice (100% Calce)
- **Débito:** Cuenta `11070000` (EM/RF) $\rightarrow \text{Neto Facturado}$
- **Débito:** Cuenta `11080101` (IVA 19%) $\rightarrow \text{Neto Facturado} \times 0.19$
- **Crédito:** Cuenta `21040000` (Proveedores AP) $\rightarrow \text{Total Bruto Facturado con IVA}$

---

## 4. Export Formats

The web app allows exporting the JEV voucher in two formats:
1. **SAP BAPI / FB60 Upload Table**: Tabular breakdown containing Posting Date, Company Code, Account, Debit/Credit Indicator, Amount in CLP, Tax Code (`C1`), and Cost Center.
2. **Standard Financial Summary**: Executive overview for accounting and finance auditing.
