import urllib.request
import ssl
import re
import json

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Match chunks import in routes
# Pattern: path: "...", ... component: () => import("./ChunkName.js")
pattern = re.compile(r'path:\s*["\']([^"\']+)["\'].*?import\(["\']\./([a-zA-Z0-9_-]+\.js)["\']\)', re.DOTALL)

matches = pattern.findall(js)
print(f"Total mapped routes to chunks: {len(matches)}")
routes = {}
for path, chunk in matches:
    routes[path] = chunk
    print(f"{path:45} -> {chunk}")

with open("mapped_routes.json", "w", encoding="utf-8") as f:
    json.dump(routes, f, indent=2)
