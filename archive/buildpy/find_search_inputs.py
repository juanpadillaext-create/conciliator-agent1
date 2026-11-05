import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
url = "https://ax.axteroid.com/assets/PurchaseList-DC1vsJKS.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

for phrase in ['proveedor', 'serie', 'Correlativo']:
    matches = [m.start() for m in re.finditer(phrase, js, re.IGNORECASE)]
    for idx in matches[:2]:
        print(f"--- MATCH {phrase} ---")
        print(js[max(0, idx - 100): min(len(js), idx + 200)])
