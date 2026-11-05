# Agente Conciliador & Discrepancy Rules Reference

This document formalizes the matching logic implemented in `CruceEngine.gs` and `JavaScript.html` for reconciling electronic invoices against purchase orders and warehouse receipts.

---

## 1. Matching Dimensions

For each item present on the supplier invoice:
- **Quantity Invoiced (`Q_inv`)**
- **Unit Price Invoiced (`P_inv`)**
- **Net Invoiced (`Amt_inv = Q_inv * P_inv`)**

Matched against the corresponding line in the Purchase Order / Warehouse Receipt:
- **Quantity Ordered (`Q_ord`)**
- **Quantity Delivered / Received (`Q_del`)**
- **Unit Cost PO (`Cost_po`)**
- **Amount Delivered (`Amt_del = Q_del * Cost_po`)**

---

## 2. Discrepancy Diagnoses & Formulas

### 2.1 DIFERENCIA_FISICA (Shortage / Faltante Físico)
- **Condition:** `Q_del < Q_inv` (e.g. Invoiced 100 units, but warehouse only received 80 units).
- **Physical Shortage Quantity:**
  $$\Delta Q = Q_{inv} - Q_{del}$$
- **Claim Amount (Valorizado a Costo PO):**
  $$Monto\_NC_{fisica} = \Delta Q \times Cost_{po}$$
- **Corrective Action:** Solicitud de Nota de Crédito (NC) por mercadería faltante al proveedor.

---

### 2.2 DIFERENCIA_PRECIO (Price Variance / PPV)
- **Condition:** `|P_{inv} - Cost_{po}| > Tolerance` (Default tolerance: `$1.0 CLP`).
- **Price Difference Unit:**
  $$\Delta P = P_{inv} - Cost_{po}$$
- **Total Price Variance on Received Goods:**
  $$Monto\_NC_{precio} = \max(0, \Delta P) \times Q_{del}$$
- **Corrective Action:**
  - If $P_{inv} > Cost_{po}$: Solicitud de Nota de Crédito (NC) por sobreprecio facturado.
  - If $P_{inv} < Cost_{po}$: Ajuste contable favorable (Ahorro PPV).

---

### 2.3 SKU_NO_ORDENADO (Unauthorized / Uncataloged SKU)
- **Condition:** SKU exists on the invoice but does not match any SKU, EAN, or supplier barcode in the Purchase Order.
- **Claim Amount:**
  $$Monto\_NC_{no\_ordenado} = Q_{inv} \times P_{inv}$$
- **Corrective Action:** Rechazo comercial total del ítem; solicitud de NC por el 100% de la línea.

---

### 2.4 RECEPCION_CONFORME (100% Matched)
- **Condition:** `Q_del >= Q_{inv}` AND `|P_{inv} - Cost_{po}| <= Tolerance`.
- **Claim Amount:** `$0 CLP`.
- **Verdict:** Conforme para pago comercial directo.

---

## 3. Total Claimable Amount (Monto a Reclamar NC)

The grand total to claim on the Credit Note is:
$$Total\_NC = \sum Monto\_NC_{fisica} + \sum Monto\_NC_{precio} + \sum Monto\_NC_{no\_ordenado}$$

Tolerance thresholds can be customized in the system settings (`cfgThreshold`), with a default threshold of **`$500 CLP`** at the invoice header level.

---

## 4. Mapping to Official Google Sheets Template (`crearPlanillaConciliacionOficialGoogleSheets`)

In the official Google Sheets output, these discrepancies map directly into spreadsheet columns and formulas:

| Column | Header | Field Source | Formula / Value |
| :--- | :--- | :--- | :--- |
| **Col G** | Unidades Recepcionadas | $Q_{del}$ | Numeric integer |
| **Col H** | Costo Unitario OC | $Cost_{po}$ | Currency `$#,##0.00` |
| **Col J** | Costo Total OC | $Amt_{del}$ | `=G{r}*H{r}` |
| **Col K** | Unidades Facturadas | $Q_{inv}$ | Numeric integer |
| **Col L** | Costo Total Facturado (SIN IVA) | $Amt_{inv}$ | Currency `$#,##0` |
| **Col M** | Costo Unitario Facturado | $P_{inv}$ | `=IF(OR(K{r}="",K{r}=0,L{r}=""),0,IFERROR(L{r}/K{r},0))` |
| **Col N** | Diferencia de Unidades | $\Delta Q$ | `=IF(OR(K{r}="",K{r}=0,L{r}=""),0,K{r}-G{r})` |
| **Col O** | Diferencia de Costo | $\Delta P$ | `=ROUND(IF(OR(K{r}="",K{r}=0,L{r}=""),0,M{r}-H{r}),2)` |
| **Col P** | Diferencias Finales | Classification | `=IF(AND(N{r}>0,O{r}>0),"Diferencia de Costo y Unidad",IF(N{r}>0,"Diferencia de Unidades",IF(O{r}>0,"Diferencia de Costo",IF(AND(N{r}=0,O{r}=0),"Calce Conforme",""))))` |
| **Col Q** | Comentarios | Action / NC Claim | Diagnosis text with claimed NC amount |

### Summary Formulas (A1:E3 Control Card)
- **Cell E1 (Monto por diferencia de unidades)**: `=SUMPRODUCT(($H$6:$H$N)*($N$6:$N$N))`
- **Cell E2 (Monto por diferencia de costo)**: `=SUMPRODUCT(($M$6:$M$N)*($K$6:$K$N))-SUMPRODUCT(($H$6:$H$N)*($K$6:$K$N))`
- **Cell E3 (Monto total diferencias)**: `=$E$1+$E$2`
- **Cell B2 (Monto Aforado)**: `=-$E$3`
- **Cell B3 (Diferencia sin identificar)**: `=$B$2+$E$3`

