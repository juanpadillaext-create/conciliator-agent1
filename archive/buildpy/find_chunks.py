import urllib.request, ssl, re

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Search for chunk names
chunks = set(re.findall(r'["\']\./([a-zA-Z0-9_-]+\.js)["\']', js))
print("Found chunks in bundle:", len(chunks))
for c in sorted(chunks):
    if any(k in c.lower() for k in ['reconcil', 'purchas', 'doc', 'cuadratura', 'order', 'report', 'metric']):
        print("  ", c)
