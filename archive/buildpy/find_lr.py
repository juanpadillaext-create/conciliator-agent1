import urllib.request, ssl, re

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

idx = js.find('lr.download')
print("Surrounding lr:")
print(js[max(0, idx - 800): min(len(js), idx + 200)])
