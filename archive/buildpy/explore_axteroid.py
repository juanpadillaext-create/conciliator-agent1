import urllib.request
import urllib.parse
import ssl
import json
import os
import sys

USER = os.environ.get("AX_USER", "adolfo.chacon@pedidosya.com")
PASS = os.environ.get("AX_PASS", "")

if not PASS and len(sys.argv) > 1:
    PASS = sys.argv[1]

ctx = ssl.create_default_context()

def authenticate():
    url = 'https://services.axteroid.com/login/realms/axt/protocol/openid-connect/token'
    data = urllib.parse.urlencode({
        'username': USER,
        'password': PASS,
        'grant_type': 'password',
        'scope': 'openid',
        'client_id': 'webapp'
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        return res['access_token']

def api_get(token, path, workspace=None):
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    }
    if workspace:
        headers['x-ax-workspace'] = workspace
    
    url = f'https://services.axteroid.com{path}'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return 0, str(e)

if __name__ == '__main__':
    print(f"Authenticating as {USER}...")
    token = authenticate()
    print("Authentication successful!")
    
    status, uinfo = api_get(token, '/login/realms/axt/protocol/openid-connect/userinfo')
    print(f"\nUserinfo (status {status}):")
    print(json.dumps(uinfo, indent=2, ensure_ascii=False))

    status, ws = api_get(token, '/workspaces')
    print(f"\nWorkspaces (status {status}):")
    print(json.dumps(ws, indent=2, ensure_ascii=False))
