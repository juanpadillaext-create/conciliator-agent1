import urllib.request
import ssl
import re
import json

ctx = ssl.create_default_context()
req = urllib.request.Request('https://ax.axteroid.com/', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    scripts = re.findall(r'src=["\']([^"\']+\.js[^"\']*)["\']', html)
    print("Found scripts:", scripts)

    # Let's inspect the main JS files to see baseURL or API domain
    for s in scripts:
        if not s.startswith('http'):
            s_url = 'https://ax.axteroid.com' + ('/' if not s.startswith('/') else '') + s
        else:
            s_url = s
        print("Checking script:", s_url)
        try:
            req_js = urllib.request.Request(s_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req_js, context=ctx, timeout=10) as resp_js:
                js_content = resp_js.read().decode('utf-8', errors='ignore')
                # Search for api domains, urls, endpoints
                matches = set(re.findall(r'https?://[a-zA-Z0-9.-]+\.axteroid\.com[a-zA-Z0-9_/-]*', js_content))
                print(f"  Matches in {s}:", matches)
                # Search for headers or baseURL
                base_urls = set(re.findall(r'baseURL\s*:\s*["\']([^"\']+)["\']', js_content))
                if base_urls:
                    print(f"  Base URLs in {s}:", base_urls)
                # Search for acc_id or endpoints
                api_paths = set(re.findall(r'["\'](/api/[^"\']+)["\']', js_content))
                if api_paths:
                    print(f"  Sample API paths in {s}:", list(api_paths)[:10])
        except Exception as e:
            print("  Error reading script:", e)

except Exception as e:
    print("Error:", e)
