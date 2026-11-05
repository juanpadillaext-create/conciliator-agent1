---
name: axteroid-matching-webapp
description: >-
  Operational runbook, domain rules, and development guidelines for the Axteroid Dmarts Agente Conciliador WebApp
  (Google Apps Script, BigQuery cl_dmarts, Axteroid DTE API, SAP Sociedad 6202 JEV accounting, and Clasp deployment).
  Use this skill whenever modifying, debugging, testing, or deploying the reconciliation webapp, its accounting entries,
  or discrepancy matching algorithms.
---

# Axteroid Dmarts Agente Conciliador WebApp

## 1. Overview & System Purpose
The **Axteroid Dmarts Conciliator** is an enterprise single-page application (SPA) built on Google Apps Script (GAS). It automates the **Agente Conciliador** for Dmarts Chile (Sociedad SAP 6202 / CD 36 Chile) across **all suppliers and Category Managers** by reconciling:
1. **Electronic Invoices (DTE Chile)** fetched from Axteroid API (`services.axteroid.com`).
2. **Physical Goods Receipts & Purchase Orders** queried from BigQuery (`peya-data-origins-pro.cl_dmarts.purchase_orders`).
3. **Credit Note (NC) Claims & SAP Journal Entry Vouchers (JEV)** generated with balanced double-entry accounting.

### 1.1 Category Managers Matrix & Supplier Coverage
The platform supports all commercial categories and Category Managers at PedidosYa Chile:
- **Constanza Urra**: Snacks, Bakery, Breakfast, Eggs (*Nestlé, Ideal / Bimbo, Evercrisp / PepsiCo, El Toco, Proa, ICB*).
- **Javiera Rogers**: Beverages, Beers, Liquids (*Embonor, Andina, CCU, Dysa, Tresmontes*).
- **Daniela Reyes**: Biscuits, Pasta, Confectionery (*Empresas Carozzi, Costa, Ambrosoli, Vivo*).
- **Maria Paz Devés**: Meat, Fresh, Cold Cuts, Dairy, Frozen (*Agrosuper, CIAL, Colun, Santa Elena, Embrio, PF, Ariztía, Watt's, Minuto Verde*).
- **Daniela Catilao**: Bakery, Fruits & Vegetables, Weighable Goods (*Bredenmaster, JJ & Alimentos, Exofrut, Bambus, Punto Azul, Produce*).
- **Nicolas Lopez**: Hygiene, Home Cleaning, Personal Care (*Softys / CMPC, Promerco*).
- **Joaquin Mardones**: Non-Food, Personal Care (*Procter & Gamble / P&G*).
- **Francisco Alvarez**: Specialty Meats & Frozen (*Los Cabros Asociados*).

### 1.2 Vendor-Specific Reconciliation Needs
Reconciliation logic dynamically adapts to the supplier's operational nature:
1. **Whitelist / Blind Receipt (No Aforado)**: Unloaded without immediate dock-level item count. Requires retroactive SKU-by-SKU analytics to detect physical shortages and issue Credit Note (NC) claims.
2. **Weighable & Fresh Goods (Pesables / Mermas)**: Dynamic weight variances between invoice KG and received KG; applies commercial tolerance thresholds before claiming discrepancies.
3. **Withheld / 100% Inspected (Aforado / Con Retención)**: Physical dock verification matched against financial retention ledgers (`Spreadsheet Aforos`).
4. **Packaging Factors (UOM Conversion)**: Handles case/box vs. individual unit discrepancies between vendor DTE and SAP purchase order lines.
5. **PPV vs. Physical Shortage Separation**: Segregates unit price inflation (`DIFERENCIA_PRECIO`) from missing physical goods (`DIFERENCIA_FISICA`).

---

## 2. Project Layout & Architecture

```text
apps-script-webapp/
├── appsscript.json          # GAS manifest: BigQuery v2 advanced service & OAuth scopes
├── Codigo.gs                # Controller, doGet() and google.script.run RPC endpoints
├── AutonomousAgents.gs      # Autonomous Agents 1, 2 & 3 (DteIngestion, Reconciliation, SapJev)
├── AxteroidAPI.gs           # Axteroid DTE REST client (workspace acc_yZvUK1Aw6y5TAVLD3Y)
├── BigQueryAPI.gs           # BigQuery connector (dynamic queries for cl_dmarts.purchase_orders)
├── CruceEngine.gs           # Discrepancy calculation engine (shortage, price variance, unauthorized)
├── JournalEntryVoucher.gs   # Balanced SAP Sociedad 6202 JEV generator (Debit == Credit)
├── JevTypeSafeAPI.gs        # TypeSafe AI triage for root-cause classification
├── SheetsAPI.gs             # Two-way sync with Google Sheets (Casos Tribu & Aforos)
├── XmlParser.gs             # Chilean SII DTE XML parser
├── Index.html               # Semantic HTML markup (3-Step Wizard + JEV Modals)
├── Estilos.html             # Responsive Dark Mode CSS tokens & components
└── JavaScript.html          # Client controller, state machine, event handlers & export logic
```

---

## 3. The 2-Step Wizard Workflow

> Los antiguos pasos 2 y 3 se fusionaron: el Paso 2 muestra la orden de compra y, debajo, las diferencias SKU x SKU (se calculan solas al elegir la factura). Lo descrito abajo como Paso 2 y Paso 3 ahora ocurre dentro del Paso 2.

1. **Paso 1: Selección de Facturas y Órdenes de Compra**
   - Renders active catalog of invoices with real-time filters (Supplier, Warehouse, Date range, PO Status).
   - Allows selecting an individual invoice OR triggering a consolidated PO reconciliation (*"⚡ EJECUTAR CRUCE CONSOLIDADO DE ESTA OC"*).
   - Automatically hydrates invoice lines from Axteroid XML, and PO lines from BigQuery or `AuditoriaData.gs`.

2. **Paso 2: Inspección y Validación de Líneas**
   - Displays side-by-side header data: Invoice Net/Tax vs PO Ordered/Delivered amounts.
   - Shows itemized breakdown of invoiced SKUs vs PO lines before discrepancy execution.

3. **Paso 3: Diferencias, Reclamo NC y Póliza SAP JEV**
   - Executes 1-to-1 SKU cross-matching.
   - Generates summary KPIs: Total Facturado, Total Recepcionado, **Monto a Reclamar (NC)**.
   - Diagnoses each SKU:
     - `DIFERENCIA_FISICA`: Shortage (Delivered < Invoiced). Generates NC claim.
     - `DIFERENCIA_PRECIO`: Price variance (Invoiced unit price > PO agreed unit cost).
     - `SKU_NO_ORDENADO`: SKU present on invoice but absent from PO. Full amount claimed.
     - `RECEPCION_CONFORME`: 100% matched within tolerance.
   - Offers 1-click generation of:
     - **Nota de Crédito (CSV / Excel)** formatted for supplier claims.
     - **Póliza Contable SAP JEV (CSV)** balanced for Sociedad 6202.

For in-depth mathematical formulas and tolerance thresholds, see:
[Reconciliation Rules Reference](./references/reconciliation_rules.md)

---

## 4. SAP Sociedad 6202 Accounting Specifications

Every discrepancy generates a balanced double-entry voucher (`SUM(Debe) == SUM(Haber)`) under SAP Sociedad 6202:

| Account | Account Name | Nature | Condition |
| :--- | :--- | :--- | :--- |
| **`11070000`** | Provisión EM/RF (Goods Receipt) | **Debe** | Invoiced portion backed by physical receipt |
| **`11090200`** | Reclamos a Proveedores (Faltantes) | **Debe** | Physical shortage (Delivered < Invoiced) |
| **`51020100`** | Variación Precio Compra (PPV) | **Debe/Haber** | Price variance between invoice and PO |
| **`11080101`** | IVA Crédito Fiscal (19%) | **Debe** | 19% tax on total invoiced net |
| **`21040000`** | Cuentas por Pagar Proveedores (AP) | **Haber** | Total invoice amount payable to vendor |

For complete accounting validation and account plan details, see:
[SAP Sociedad 6202 Accounting Reference](./references/accounting_sap_6202.md)

---

## 5. Planilla Oficial de Conciliación Finanzas Google Sheets

La aplicación implementa el generador nativo de planillas de cálculo idéntico al formato oficial de Cuentas por Pagar / Finanzas D-Marts PedidosYa Chile (`SheetsAPI.gs` y `Codigo.gs`).

### 5.1 Función Principal y Endpoint RPC
- **Función en `SheetsAPI.gs`**: `crearPlanillaConciliacionOficialGoogleSheets(payload)`
- **Endpoint RPC en `Codigo.gs`**: `apiCrearPlanillaConciliacionOficialGoogleSheets(payload)` (con alias `apiGenerarSpreadsheetFinanzas`)
- **Parámetros**:
  ```json
  {
    "proveedor": "Empresas Carozzi S.A.",
    "po_number": "PO517979",
    "tienda": "CH_36_CD_Chile",
    "items": [...],
    "detalle_facturas": [...]
  }
  ```
- **Retorno**:
  `{ success: true, spreadsheet_id, url, name, total_items, total_diferencias, monto_diferencias }`

### 5.2 Estructura y Reglas de la Planilla Generada

1. **Pestaña 1: Conciliación SKU x SKU (Nombre Proveedor, ej: `Carozzi`)**
   - **Tarjeta de Control Financiero (A1:E3, fondo `#FEF5F4`, borde `#E06666`)**:
     - `A1:B1`: Orden de Compra (ej. `PO517979`).
     - `D1:E1`: Monto por diferencia de unidades: `=SUMPRODUCT(($H$6:$H$N)*($N$6:$N$N))`
     - `A2:B2`: Monto Aforado: `=-$E$3`
     - `D2:E2`: Monto por diferencia de costo: `=SUMPRODUCT(($M$6:$M$N)*($K$6:$K$N))-SUMPRODUCT(($H$6:$H$N)*($K$6:$K$N))`
     - `A3:B3`: Diferencia sin identificar: `=$B$2+$E$3`
     - `D3:E3`: Monto total diferencias: `=$E$1+$E$2`
   - **Banners de Acción (Fila 4, fondo `#FFF2CC`, texto `#7F6000`)**:
     - `K4:M4`: `COMPLETAR CON LOS PRODUCTOS FACTURADOS`
     - `N4:P4`: `REVISAR LAS DIFERENCIAS`
   - **Encabezados Oficiales (Fila 5, fondo `#C00000`, texto blanco bold)**:
     - `A`: Órdenes de Compra | `B`: Tienda | `C`: SKU | `D`: EAN | `E`: Nombre de Producto
     - `F`: Tipo Producto | `G`: Unidades Recepcionadas | `H`: Costo Unitario OC
     - `I`: Impuesto Interno | `J`: Costo Total OC (`=G{r}*H{r}`)
     - `K`: Unidades Facturadas | `L`: Costo Total Facturado (SIN IVA)
     - `M`: Costo Unitario Facturado (`=IF(OR(K{r}="",K{r}=0,L{r}=""),0,IFERROR(L{r}/K{r},0))`)
     - `N`: Diferencia de Unidades (`=IF(OR(K{r}="",K{r}=0,L{r}=""),0,K{r}-G{r})`)
     - `O`: Diferencia de Costo (`=ROUND(IF(OR(K{r}="",K{r}=0,L{r}=""),0,M{r}-H{r}),2)`)
     - `P`: Diferencias Finales (`=IF(AND(N{r}>0,O{r}>0),"Diferencia de Costo y Unidad",IF(N${r}>0,"Diferencia de Unidades",IF(O${r}>0,"Diferencia de Costo",IF(AND(N${r}=0,O${r}=0),"Calce Conforme",""))))`)
     - `Q`: Comentarios diagnósticos explicativos
   - **Formato Condicional**:
     - Celdas en columna `P` con "Diferencia" se colorean en rojo suave (`#FCE8E6` / `#C5221F`).
     - Celdas con "Calce Conforme" se colorean en verde suave (`#E6F4EA` / `#137333`).
   - **Filas Inmovilizadas**: Filas 1 a 5 fijas (`setFrozenRows(5)`).

2. **Pestaña 2: `Detalle Facturas` (Fondo cabecera `#4F81BD`, texto blanco)**
   - Desglosa todas las facturas involucradas (en cruces individuales o consolidados multifactura):
     - `A`: Nº Factura | `B`: Código Producto | `C`: Descripción | `D`: Unid. Vta
     - `E`: Cantidad | `F`: Precio Unitario | `G`: Valor Neto
   - Fila de cabecera inmovilizada (`setFrozenRows(1)`).

---

## 6. Development & Deployment Procedures

### Pre-deployment Syntax Check
Before pushing to Google Apps Script, always validate syntax across all `.gs` files:
```bash
node -e "['AuditoriaData.gs','AxteroidAPI.gs','BigQueryAPI.gs','Codigo.gs','CruceEngine.gs','JevTypeSafeAPI.gs','JournalEntryVoucher.gs','SheetsAPI.gs','XmlParser.gs'].forEach(f => { require('fs').readFileSync('apps-script-webapp/' + f, 'utf8'); console.log('OK:', f); })"
```

### Automated Clasp Deployment
Execute automated verification and deployment using the helper script:
```bash
node .agents/skills/axteroid-matching-webapp/scripts/validate_and_deploy.js
```
Or directly with npm scripts:
```bash
npm run push     # Pushes files to Google Apps Script script ID
npm run deploy   # Creates a new production deployment version
```

### Script and WebApp Identifiers
- **GAS Script ID:** `1YUTJvT5rVfYqHUHZYfHDH1AyH56aW2K762K3eqAV8Cyint1Ae6ZxKiHo`
- **Axteroid Default Workspace:** `acc_yZvUK1Aw6y5TAVLD3Y`
- **Default SAP Company Code:** `6202` (Sociedad Chile)
- **Default SAP Cost Center:** `CD_36_CD_Chile`

