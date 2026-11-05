# Axteroid Dmarts Conciliator - Google Apps Script Web App

Web App empresarial desarrollada en **Google Apps Script (GAS)** para la auditoría, cruce SKU x SKU y detección de descalces entre facturas electrónicas de **Axteroid** (`services.axteroid.com`) y recepciones en almacenes Dmarts desde **BigQuery** (`cl_dmarts.purchase_orders`).

Diseñada como la plataforma corporativa de **3-Way Matching** para **todas las empresas proveedoras** de PedidosYa Dmarts Chile (Sociedad SAP 6202) y para el ecosistema completo de **Category Managers**, adaptándose a las reglas y necesidades específicas de conciliación de cada proveedor (listas blancas, recepción ciega, pesables, tolerancias de aforo y conversiones UOM).

---

## 🚀 Arquitectura y Archivos del Proyecto

```text
apps-script-webapp/
├── appsscript.json          # Manifiesto GAS con dependencias (BigQuery v2) y OAuth Scopes
├── Codigo.gs                # Controlador HTTP (doGet) y endpoints RPC (google.script.run)
├── AxteroidAPI.gs           # Conexión REST a Axteroid (/rec-docs, descarga XML y PDF)
├── BigQueryAPI.gs           # Consultas a peya-data-origins-pro.cl_dmarts.purchase_orders
├── XmlParser.gs             # Parser del DTE chileno (SII) con extracción de detalle y referencias
├── CruceEngine.gs           # Motor de cruce 1 a 1 SKU x SKU, diagnóstico y acción correctiva
├── JournalEntryVoucher.gs   # Generador de pólizas JEV (Journal Entry Voucher) balanceadas para SAP
├── JevTypeSafeAPI.gs        # Motor de IA TypeSafe Jev (System-1 Decision) para matching y triage
├── SheetsAPI.gs             # Sincronización con Google Spreadsheets (Casos Tribu y Aforos Chile)
├── Index.html               # Vista principal de la aplicación (Dark Mode Analítico)
├── Estilos.html             # Hoja de estilos CSS Dark Mode de alta legibilidad
├── JavaScript.html          # Lógica cliente (eventos, llamadas asíncronas, exportación CSV/JEV)
└── README.md                # Esta guía de despliegue y uso
```

---

## 🛠️ Despliegue Automatizado con Clasp (Configurado y Activo)

El proyecto ya cuenta con **Google Clasp (`@google/clasp`)** vinculado al script de Google Apps Script:
* **Script ID:** `1YUTJvT5rVfYqHUHZYfHDH1AyH56aW2K762K3eqAV8Cyint1Ae6ZxKiHo`
* **URL Editor GAS:** [Abrir Editor en script.google.com](https://script.google.com/d/1YUTJvT5rVfYqHUHZYfHDH1AyH56aW2K762K3eqAV8Cyint1Ae6ZxKiHo/edit)
* **URL WebApp (Producción v17 - Dashboard TOP Multi-Empresa 32 Proveedores):** [Abrir WebApp Publicada v17](https://script.google.com/macros/s/AKfycbxprHp34AbecXXBO_mpHPBnRgmSFKgxg5TizzUYhmVXzzvaUXuqgphFTded3Mq-mLoYgw/exec)
* **URL Modo Desarrollo (Test en vivo @HEAD):** [Abrir Modo Dev (@HEAD)](https://script.google.com/macros/s/AKfycbzmxJQJLzaEQ5vIwqtz8Y8BQHJM0g8mJ52zTe6hVE77/dev)
* **Spreadsheet Maestro de Casos:** [Abrir Spreadsheet en Google Drive](https://docs.google.com/spreadsheets/d/1duL91e3BFgAIeUXjhWhZsEcVgha_ZZZ38xbN0W2ibjo/edit?gid=0#gid=0)

### Comandos Rápidos de Despliegue (desde la raíz del proyecto):

```bash
# 1. Subir cambios locales directamente a Google Apps Script:
npm run push

# 2. Publicar una nueva versión de la Web App:
npm run deploy

# 3. Ver estado de archivos sincronizados:
npm run status

# 4. Abrir el editor de Google Apps Script en el navegador:
npm run open

# 5. Abrir la Web App en el navegador:
npm run open:web
```

---

## 🛠️ Instrucciones de Despliegue Manual (Alternativo)

1. Ingresa a [script.google.com](https://script.google.com) con tu cuenta de Delivery Hero / PedidosYa.
2. Haz clic en **+ Nuevo proyecto**. Nómbralo: `Axteroid Dmarts Conciliator`.
3. **Configurar el Manifiesto (`appsscript.json`)**:
   - En el menú lateral izquierdo, haz clic en ⚙️ **Configuración del proyecto**.
   - Marca la casilla **Mostrar el archivo de manifiesto "appsscript.json" en el editor**.
   - Vuelve al editor (<>), abre `appsscript.json` y reemplaza su contenido con el archivo `appsscript.json` de esta carpeta.
4. **Habilitar el Servicio Avanzado de BigQuery**:
   - En el editor, haz clic en el botón `+` al lado de **Servicios**.
   - Selecciona **BigQuery API**, versión `v2`, identificador `BigQuery`. Haz clic en **Añadir**.
5. **Crear y Copiar los Archivos de Código**:
   - En el editor, crea los archivos de script (`.gs`) y archivos HTML (`.html`) con los mismos nombres:
     - `Codigo.gs`
     - `AxteroidAPI.gs`
     - `BigQueryAPI.gs`
     - `XmlParser.gs`
     - `CruceEngine.gs`
     - `Index.html`
     - `Estilos.html`
     - `JavaScript.html`
   - Pega el código correspondiente en cada uno.
6. **Desplegar como Aplicación Web**:
   - Haz clic en **Implementar** > **Nueva implementación**.
   - Haz clic en el ícono de engranaje ⚙️ y elige **Aplicación web**.
   - **Descripción**: `v1.0 Cruce SKU Carozzi`.
   - **Ejecutar como**: `Usuario que accede a la aplicación web` (o `Yo`).
   - **Quién tiene acceso**: `Cualquier usuario de tu organización` (Delivery Hero / PedidosYa).
   - Haz clic en **Implementar** y copia la URL generada.

---

### Opción 2: Despliegue con Google Clasp CLI

Si tienes instalado `@google/clasp`:

```bash
cd apps-script-webapp
clasp login
clasp create --title "Axteroid Dmarts Conciliator" --type webapp
clasp push
clasp deploy --description "v1.0 Cruce SKU Carozzi"
```

---

## 🔍 Funcionalidades de la Aplicación y Cobertura Multi-Proveedor

### 1. Búsqueda y Filtrado Global en Axteroid & BigQuery:
- Cobertura para el **catálogo completo de proveedores de PedidosYa Chile** (+200 proveedores activos en BigQuery y Axteroid).
- Filtros rápidos por Folio DTE, RUT emisor, Orden de Compra (PO), Almacén / Tienda (CD 36 y dark stores), y rango de fechas.
- Detección automática del **Category Manager asignado** y de la condición de aforo en la tabla oficial de Finanzas.

### 2. Matriz de Category Managers Soportados:
La aplicación organiza y atiende los requerimientos específicos de cada área comercial:
* **Constanza Urra**: Snacks, Panadería, Desayuno, Huevos (*Nestlé, Ideal / Bimbo, Evercrisp / PepsiCo, Avícola El Toco, Proa, ICB / Marco Polo*).
* **Javiera Rogers**: Bebidas, Cervezas, Abarrotes Líquidos (*Coca-Cola Embonor, Embotelladora Andina, Comercial CCU, Dysa, Tresmontes Lucchetti*).
* **Daniela Reyes**: Galletas, Pastas, Golosinas, Repostería (*Empresas Carozzi, Costa, Ambrosoli, Vivo*).
* **Maria Paz Devés**: Carnes, Frescos, Cecinas, Lácteos y Congelados (*Agrosuper / Super Pollo, CIAL / San Jorge, Colun, Comercial Santa Elena, Embrio, PF, Ariztía, Watt's, Minuto Verde*).
* **Daniela Catilao**: Panadería fresca, Frutas y Verduras, Pesables (*Bredenmaster, JJ & Alimentos, Exofrut, Bambus, Punto Azul, Frutas/Verduras a granel*).
* **Nicolas Lopez**: Higiene, Limpieza, Aseo y Cuidado Personal (*Softys / CMPC / Elite, Promerco*).
* **Joaquin Mardones**: Non-Food, Cuidado Personal y Hogar (*Procter & Gamble / P&G, Gillette, Pampers, Ariel*).
* **Francisco Alvarez**: Carnes Especiales y Congelados Selectos (*Los Cabros Asociados*).

### 3. Necesidades Específicas de Conciliación por Proveedor:
Cada empresa proveedora posee particularidades operativas que el motor de conciliación resuelve de forma diferenciada:
1. **Proveedores No Aforados / Lista Blanca (Whitelist)**:
   - *Comportamiento*: Al ingresar a bodega tienen recepción ágil ("ciega") sin aforo exhaustivo inmediato en andén.
   - *Conciliación requerida*: Cruce posterior analítico detallado SKU x SKU entre el DTE facturado y lo registrado efectivamente por los sistemas de bodega en BigQuery para detectar faltantes no detectados en la descarga y emitir el reclamo de **Nota de Crédito (NC)**.
2. **Proveedores de Pesables y Frescos (Carnes, Frutas, Verduras, Fiambrería)**:
   - *Comportamiento*: Las órdenes se emiten por unidades o kilos teóricos, pero la entrega real varía según el pesaje exacto del lote o corte.
   - *Conciliación requerida*: Admisión de mermas y tolerancias porcentuales configuradas en la matriz de aforos comercial; discriminación entre faltante físico real y tolerancia técnica de peso.
3. **Proveedores Aforados / Con Retención Preventiva**:
   - *Comportamiento*: Proveedores con historial de descalce que requieren aforo físico 100% bulto por bulto antes del pago.
   - *Conciliación requerida*: Cotejo con los montos retenidos preventivamente en la tabla oficial de Finanzas (`Spreadsheet Aforos`) para liberar o ajustar la retención.
4. **Factores de Conversión de Empaque (UOM - Unit of Measure)**:
   - *Comportamiento*: Proveedores que facturan en cajas, bultos o displays, mientras que la orden de compra y el inventario en BigQuery registran unidades sueltas (o viceversa).
   - *Conciliación requerida*: Normalización automática de factores UOM para evitar falsos descalces de 1 caja = 12 unidades.
5. **Variaciones de Costo Unitario (PPV - Purchase Price Variance)**:
   - *Comportamiento*: Cobros a precios de lista superiores al costo unitario pactado en la Orden de Compra de SAP.
   - *Conciliación requerida*: Desglose estricto entre **Diferencia Física** (falta de mercadería) y **Diferencia de Precio** (sobrecosto facturado).

### 4. Entregables y Exportaciones para Category Managers y Finanzas:
- **Planilla Oficial de Conciliación Finanzas (Google Sheets / Excel)**: Genera automáticamente la planilla con la tarjeta de control financiero (SUMPRODUCT de faltantes y costos), pestaña de cruce SKU x SKU y pestaña de detalle de facturas.
- **Póliza Contable SAP JEV (Journal Entry Voucher)**: Asiento contable balanceado de doble partida para la Sociedad 6202 (Cuentas `11070000`, `11090200`, `51020100`, `11080101`, `21040000`).
- **Resumen Ejecutivo de Reclamo (CSV / Notificación)**: Detalle formateado listo para enviar a la contraparte comercial de cada proveedor.
