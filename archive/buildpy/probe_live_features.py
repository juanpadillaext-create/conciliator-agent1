import urllib.request
import urllib.parse
import ssl
import json
import os
import sys

USER = os.environ.get("AX_USER", "adolfo.chacon@pedidosya.com")
PASS = os.environ.get("AX_PASS", "")

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

def test_endpoint(token, path, params=None, workspace="acc_yZvUK1Aw6y5TAVLD3Y"):
    url = f"https://services.axteroid.com{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "Authorization": f"Bearer {token}",
        "x-ax-workspace": workspace,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return resp.status, data
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='ignore')
        return e.code, err[:200]
    except Exception as e:
        return 0, str(e)

if __name__ == '__main__':
    token = authenticate()
    endpoints = [
        ("Documentos Emitidos (/documents)", "/documents", {}),
        ("Documentos Recibidos (/rec-docs)", "/rec-docs", {}),
        ("Compras (/purchases)", "/purchases", {}),
        ("Compras Pendientes (/purchases/pending-receive)", "/purchases/pending-receive", {}),
        ("Conciliaciones (/reconciliations)", "/reconciliations", {}),
        ("SIRE (/sire)", "/sire", {}),
        ("Reportes (/reports)", "/reports", {}),
        ("Métricas Emitidos (/metrics/gen)", "/metrics/gen", {}),
        ("Métricas Recibidos (/metrics/rec)", "/metrics/rec", {}),
        ("Sucursales (/branches)", "/branches", {}),
        ("Proveedores (/suppliers)", "/suppliers", {}),
        ("Categorías Proveedores (/suppliers/categories)", "/suppliers/categories", {}),
        ("Clientes (/customers)", "/customers", {}),
        ("Puntos de Venta (/pos)", "/pos", {}),
        ("Resúmenes Boleta (/summaries)", "/summaries", {}),
        ("Lotes (/batches)", "/batches", {}),
        ("Organización (/account)", "/account", {}),
    ]

    print(f"{'Módulo':<40} | {'Status':<6} | {'Info':<50}")
    print("-" * 105)
    for name, ep, params in endpoints:
        status, res = test_endpoint(token, ep, params)
        info = ""
        if isinstance(res, dict):
            count = res.get('count')
            if count is not None:
                info = f"count={count}, keys={list(res.keys())[:4]}"
            elif 'results' in res:
                info = f"results len={len(res['results'])}, keys={list(res.keys())[:4]}"
            else:
                info = f"keys={list(res.keys())[:5]}"
        elif isinstance(res, list):
            info = f"list len={len(res)}"
        else:
            info = str(res)[:50]
        print(f"{name:<40} | {status:<6} | {info:<50}")
