import urllib.request, ssl, re

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

matches = [m.start() for m in re.finditer(r'lr\s*=\s*', js)]
for idx in matches[:5]:
    print("--- lr = ---")
    print(js[max(0, idx - 50): min(len(js), idx + 200)])
