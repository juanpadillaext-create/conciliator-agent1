import urllib.request
import ssl
import re
import json

ctx = ssl.create_default_context()
req_js = urllib.request.Request('https://ax.axteroid.com/assets/index-C90rDwss.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req_js, context=ctx, timeout=15) as resp:
    js_content = resp_js = resp.read().decode('utf-8', errors='ignore')

print("JS Length:", len(js_content))

# Look for services.axteroid.com endpoints or path strings
endpoints = set(re.findall(r'["\'](/api/v\d+/[^"\']+)["\']', js_content))
print("API endpoints with /api/v...:", endpoints)

general_endpoints = set(re.findall(r'["\'](/v\d+/[^"\']+)["\']', js_content))
print("API endpoints with /v...:", list(general_endpoints)[:20])

# Look for auth headers or interceptors
headers_found = set(re.findall(r'["\']([a-zA-Z0-9_-]*Authorization[a-zA-Z0-9_-]*)["\']', js_content, re.IGNORECASE))
print("Auth headers:", headers_found)

# Look for acc_id usage or workspace header
acc_contexts = re.findall(r'.{0,50}acc_id.{0,50}', js_content)
print("acc_id snippets:", acc_contexts[:5])

# Look for Bearer or Token
bearer_snippets = re.findall(r'.{0,40}Bearer.{0,40}', js_content)
print("Bearer snippets:", bearer_snippets[:5])
