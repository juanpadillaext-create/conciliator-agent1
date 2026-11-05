import urllib.request, ssl, re

ctx = ssl.create_default_context()
url = "https://ax.axteroid.com/assets/PurchaseList-DC1vsJKS.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

idx = content.find('createExportPdf')
print(content[idx: idx + 800])
