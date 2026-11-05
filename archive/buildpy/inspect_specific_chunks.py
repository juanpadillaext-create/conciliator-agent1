import urllib.request, ssl, re, json

ctx = ssl.create_default_context()

def inspect_chunk(chunk_name):
    url = f"https://ax.axteroid.com/assets/{chunk_name}"
    print(f"\n=================== {chunk_name} ===================")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
            print(f"Length: {len(content)}")
            # Find all endpoints/urls called
            endpoints = set(re.findall(r'["\'](/[^"\'\s?]+)["\']', content))
            relevant = [e for e in endpoints if not e.endswith('.png') and not e.endswith('.svg') and len(e) > 2]
            print("Endpoints/Paths in chunk:")
            for ep in sorted(relevant):
                print("  ", ep)
            
            # Find methods: axios.get, post, etc.
            calls = re.findall(r'\.(?:get|post|put|delete)\s*\(\s*[`\'"]([^`\'"]+)[`\'"]', content)
            print("Direct HTTP calls:", calls)
            
            # Search for parameter names or query strings
            params = set(re.findall(r'[?&]([a-zA-Z0-9_-]+)=', content))
            print("Query params in chunk:", params)
            
            # Search for Spanish labels or UI strings
            labels = set(re.findall(r'["\']([A-ZÁÉÍÓÚ][a-záéíóú\s]{3,30})["\']', content))
            print("Sample labels in UI:", list(labels)[:15])
    except Exception as e:
        print("Error fetching chunk:", e)

inspect_chunk("ReconciliationsListCreate-CQUnOBhA.js")
inspect_chunk("PurchaseList-DC1vsJKS.js")
inspect_chunk("DocumentsList-AJVx3Gkt.js")
