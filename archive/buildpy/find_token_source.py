import urllib.request, ssl, re

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

keys = ['expire_date', 'max_interval', 'audience', 'Developers', 'webhooks', 'api_key', 'token']

for k in ['expire_date', 'max_interval', 'audience']:
    idx = js.find(k)
    print(f"Key '{k}' in index.js: {idx}")
    if idx != -1:
        print(js[max(0, idx - 100): min(len(js), idx + 200)])

# Also search other chunks
chunks = [
    'Developers', 'Settings', 'Account', 'AccountMain', 'AccountBasic', 'Webhooks'
]
# Let's see all chunk names
all_chunks = re.findall(r'["\']\./([a-zA-Z0-9_-]+\.js)["\']', js)
for c in all_chunks:
    if any(k.lower() in c.lower() for k in ['develop', 'webhook', 'token', 'setting', 'api', 'account']):
        print("Relevant chunk:", c)
