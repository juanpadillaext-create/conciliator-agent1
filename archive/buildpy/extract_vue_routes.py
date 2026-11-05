import urllib.request, ssl, re, json

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Extract Vue router paths: path:"...", name:"..."
route_matches = re.findall(r'path\s*:\s*["\']([^"\']+)["\'](?:\s*,\s*name\s*:\s*["\']([^"\']+)["\'])?', js)
print("Discovered Vue Router paths:")
for p, name in route_matches:
    print(f"  Path: {p:30} Name: {name}")

# Also look for API calls with suppliers or documents or orders
print("\nLook for API patterns:")
api_calls = set(re.findall(r'(\/(?:documents|suppliers|customers|orders|receptions|metrics|reports|branches|users|products)[a-zA-Z0-9_/]*)', js))
for call in sorted(api_calls):
    print("  ", call)
