import urllib.request
import urllib.parse
import ssl
import json
import os
import sys

# Configuration
TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE"
BASE_URL = "https://services.axteroid.com"
DEFAULT_WORKSPACE = "acc_yZvUK1Aw6y5TAVLD3Y"  # Delivery Hero Stores Chile SpA (77125361-K)

ctx = ssl.create_default_context()

class AxteroidClient:
    def __init__(self, token=TOKEN, workspace=DEFAULT_WORKSPACE):
        self.token = token
        self.workspace = workspace
        self.base_url = BASE_URL

    def _request(self, endpoint, method="GET", params=None, accept="application/json"):
        url = f"{self.base_url}{endpoint}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        headers = {
            "User-Agent": "Axteroid-Client/1.0",
            "Authorization": f"Bearer {self.token}",
            "x-ax-workspace": self.workspace,
            "Accept": accept
        }
        req = urllib.request.Request(url, headers=headers, method=method)
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
            if "application/json" in content_type:
                return json.loads(data.decode("utf-8"))
            return data

    def search_received_docs(self, serial=None, order_reference=None, tax_id=None):
        """Busca documentos recibidos por folio, orden de compra o RUT de proveedor."""
        params = {}
        if serial:
            params["serial"] = serial
        if order_reference:
            params["order_reference"] = order_reference
        if tax_id:
            params["tax_id"] = tax_id
        res = self._request("/rec-docs", params=params, accept="application/json")
        return res.get("results", [])

    def download_xml(self, doc_id, save_path):
        """Descarga el XML (DTE oficial firmado) vía API usando Content Negotiation."""
        data = self._request(f"/rec-docs/{doc_id}", accept="application/xml")
        with open(save_path, "wb") as f:
            f.write(data)
        return len(data)

    def download_pdf(self, doc_id, save_path):
        """Descarga el PDF oficial vía API usando Content Negotiation."""
        data = self._request(f"/rec-docs/{doc_id}", accept="application/pdf")
        with open(save_path, "wb") as f:
            f.write(data)
        return len(data)

def main():
    folios = ["97187814", "97192772"]
    out_dir = "descargas_api"
    os.makedirs(out_dir, exist_ok=True)
    
    client = AxteroidClient()
    print("==================================================================")
    print("   DESCARGA DIRECTA DE FACTURAS VÍA API REST (AXTEROID)")
    print("==================================================================")
    
    for folio in folios:
        print(f"\n[+] Buscando Folio {folio} en API...")
        results = client.search_received_docs(serial=folio)
        if not results:
            print(f"[-] No se encontró el folio {folio}.")
            continue
        
        doc = results[0]
        doc_id = doc["id"]
        proveedor = doc.get("supplier_name", "Desconocido")
        rut = doc.get("tax_id", "")
        total = doc.get("amount_total", 0)
        po = doc.get("order_reference", "")
        
        print(f"    Documento ID:   {doc_id}")
        print(f"    Proveedor:      {proveedor} ({rut})")
        print(f"    Monto Total:    ${int(float(total)):,}")
        print(f"    Orden Compra:   {po}")
        
        # 1. Descarga XML oficial
        xml_path = os.path.join(out_dir, f"Factura_{folio}.xml")
        xml_size = client.download_xml(doc_id, xml_path)
        print(f"    [API OK] XML DTE descargado -> {xml_path} ({xml_size:,} bytes)")
        
        # 2. Descarga PDF oficial
        pdf_path = os.path.join(out_dir, f"Factura_{folio}.pdf")
        pdf_size = client.download_pdf(doc_id, pdf_path)
        print(f"    [API OK] PDF descargado     -> {pdf_path} ({pdf_size:,} bytes)")

    print("\n[✔] Proceso de descarga vía API completado con éxito.")
    print(f"    Archivos guardados en la carpeta: {os.path.abspath(out_dir)}")

if __name__ == "__main__":
    main()
