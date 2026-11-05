with open('extract_routes.py', 'r') as f:
    pass

import urllib.request, ssl, re

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Let's search for all string literals that have /
# especially anything like /documents, /invoices, /dte, /metrics, /orders, /conciliacion, /reconciliation
keywords = ['document', 'invoice', 'dte', 'metric', 'order', 'purchase', 'match', 'concil', 'recep', 'report', 'workspaces']
for kw in keywords:
    matches = set(re.findall(rf'["\'](/[^"\']*{kw}[^"\']*)["\']', js, re.IGNORECASE))
    print(f"Keyword '{kw}' matches ({len(matches)}):")
    for m in list(matches)[:10]:
        print("  ", m)
