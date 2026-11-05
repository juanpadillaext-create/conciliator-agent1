import urllib.request
import ssl
import re

ctx = ssl.create_default_context()

for chunk_name in ['PurchaseList-DC1vsJKS.js', 'Main-CE4zTkc6.js', 'Main-B1RZLuIN.js']:
    url = f'https://ax.axteroid.com/assets/{chunk_name}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    js = urllib.request.urlopen(req, context=ctx).read().decode('utf-8')
    print(f"\n=== CHUNK: {chunk_name} ===")
    matches = re.finditer(r'["\'`]([^"\'`]*(?:download|export|\.xml|\.pdf|rec-docs)[^"\'`]*)["\'`]', js, re.IGNORECASE)
    seen = set()
    for m in matches:
        val = m.group(1).strip()
        if val not in seen and len(val) < 120:
            seen.add(val)
            print("  -", val)

    # Also search for dispatch
    dispatches = re.finditer(r'dispatch\s*\(\s*["\']([^"\']+)["\']\s*,\s*({[^}]+})', js)
    for d in dispatches:
        print("  DISPATCH:", d.group(1), d.group(2))
