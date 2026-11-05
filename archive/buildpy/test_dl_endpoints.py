import urllib.request
import ssl
import json

token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE'
base_url = 'https://services.axteroid.com'
ws_id = 'acc_yZvUK1Aw6y5TAVLD3Y'
ctx = ssl.create_default_context()

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        print(f"  [REDIRECT] {code} to {newurl}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)

opener = urllib.request.build_opener(NoRedirectHandler)

for url_cand in [
    f'{base_url}/rec-docs/download/',
    f'{base_url}/rec-docs/download',
    f'{base_url}/documents/download/',
    f'{base_url}/documents/download'
]:
    payload = json.dumps({'document_ids': ['do_AAABoDhD3daH4zVe']}).encode('utf-8')
    headers = {
        'User-Agent': 'Axteroid-Client/1.0',
        'Authorization': f'Bearer {token}',
        'x-ax-workspace': ws_id,
        'Content-Type': 'application/json'
    }
    req = urllib.request.Request(url_cand + '?xml=true', data=payload, headers=headers, method='POST')
    try:
        with opener.open(req, timeout=10) as resp:
            data = resp.read()
            print(f'SUCCESS {url_cand}: Status {resp.status}, Size: {len(data)}')
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code} for {url_cand}: {e.read().decode("utf-8", errors="ignore")[:150]}')
    except Exception as e:
        print(f'ERROR for {url_cand}: {e}')
