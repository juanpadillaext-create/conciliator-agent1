import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
url = "https://ax.axteroid.com/assets/PurchaseList-DC1vsJKS.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Find all query params assigned to query object
params = set(re.findall(r'query\s*:\s*\{([^}]+)\}', js))
print("Query blocks:", params)

# Search for serial or supplier query keys
keys = set(re.findall(r'["\']([a-zA-Z0-9_]+)[\'"]\s*:', js))
filtered = [k for k in keys if any(x in k.lower() for x in ['serial', 'number', 'tax', 'supp', 'folio', 'search', 'query', 'date', 'order'])]
print("Relevant keys:", filtered)
