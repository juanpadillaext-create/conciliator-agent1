import urllib.request, ssl, re

ctx = ssl.create_default_context()

def inspect_code(chunk_name):
    url = f"https://ax.axteroid.com/assets/{chunk_name}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        content = resp.read().decode('utf-8', errors='ignore')
    
    print(f"\n--- {chunk_name} ---")
    # Search for dispatch or commit or api
    dispatches = set(re.findall(r'dispatch\s*\(\s*["\']([^"\']+)["\']', content))
    print("Dispatches:", dispatches)
    # Search for any string with / or api
    urls = set(re.findall(r'[`\'"](/[a-zA-Z0-9_\-\.\/]+)[`\'"]', content))
    print("URLs:", [u for u in urls if not u.endswith('.png')])

inspect_code("ReconciliationsListCreate-CQUnOBhA.js")
inspect_code("PurchaseList-DC1vsJKS.js")
