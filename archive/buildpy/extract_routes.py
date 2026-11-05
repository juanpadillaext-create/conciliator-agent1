import re

with open('inspect_api.py', 'r') as f:
    pass

with open('bundle_dump.txt', 'w', encoding='utf-8') as out:
    pass

import urllib.request, ssl
ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Search for interceptor and axios calls
idx = js.find('x-ax-workspace')
print("Surrounding code for x-ax-workspace:")
print(js[max(0, idx - 200): min(len(js), idx + 200)])

# Find all url paths passed to get/post/put/delete or strings starting with /
# Common patterns: vt.get("/..."), this.$axios.get("/...")
paths = set(re.findall(r'(?:get|post|put|delete|patch)\s*\(\s*[`\'"](/[^`\'"?\s]+)[`\'"]', js))
print("\nDiscovered HTTP method paths (count: %d):" % len(paths))
for p in sorted(paths):
    print("  ", p)

# Also let's search for strings that look like endpoints
generic_paths = set(re.findall(r'[`\'"](/[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_{}:-]+)+)[`\'"]', js))
print("\nDiscovered generic paths (sample 30):")
for p in sorted(list(generic_paths))[:30]:
    print("  ", p)
