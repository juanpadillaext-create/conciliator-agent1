import urllib.request, ssl, re

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

def find_store_action(name):
    print(f"\n=================== {name} ===================")
    matches = [m.start() for m in re.finditer(re.escape(name), js)]
    for idx in matches:
        print("--- CONTEXT ---")
        print(js[max(0, idx - 100): min(len(js), idx + 250)])

find_store_action('purchases/LIST')
find_store_action('reconciliations/LIST')
