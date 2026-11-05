import urllib.request, ssl, re

ctx = ssl.create_default_context()
url = "https://ax.axteroid.com/assets/PurchaseList-DC1vsJKS.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

# Search for download or xml or pdf or detail
matches = re.findall(r'.{0,50}(?:download|xml|pdf|items|detail).{0,50}', content, re.IGNORECASE)
print(f"Found {len(matches)} matches in PurchaseList:")
for m in matches[:10]:
    print("  ", m.strip())
