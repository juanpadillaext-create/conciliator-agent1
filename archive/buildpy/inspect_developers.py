import urllib.request, ssl

ctx = ssl.create_default_context()
url = "https://ax.axteroid.com/assets/Developers-DGpw-O0u.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

print("Length of Developers chunk:", len(content))
print("Content preview:")
print(content[:2000])

# Search for token or api or url
for k in ['token', 'api', 'key', 'webhook', 'expire']:
    idx = content.find(k)
    if idx != -1:
        print(f"\n--- Snippet for '{k}' ---")
        print(content[max(0, idx - 80): min(len(content), idx + 200)])
