const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function search(params) {
  return new Promise((resolve, reject) => {
    const qs = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    https.get('https://services.axteroid.com/rec-docs?' + qs, {
      headers: {
        'Authorization': 'Bearer ' + MASTER_TOKEN,
        'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
        'Accept': 'application/json'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- BUSCANDO PO524064 EN AXTEROID ---');
  for (const ref of ['po524064', 'PO524064', '524064', '0000524064']) {
    const r = await search({ order_reference: ref });
    console.log(`Ref "${ref}" -> count:`, r.count || (r.results && r.results.length) || 0);
    if (r.results && r.results.length > 0) {
      r.results.forEach(d => console.log('  Doc:', d.serial, d.type, d.amount_net, d.amount_total, d.supplier_name, d.date));
    }
  }

  console.log('\n--- DOCUMENTOS DE DESA (88725800-4) ---');
  const rSupp = await search({ supplier_tax_id: '88725800-4', page_size: 50 });
  console.log('Total documentos de Desa:', rSupp.count);
  if (rSupp.results) {
    rSupp.results.forEach(d => {
      console.log(`Folio: ${d.serial} | Tipo: ${d.type} | Fecha: ${d.date} | Neto: ${d.amount_net} | Total: ${d.amount_total} | Ref: ${d.order_reference} | Refs: ${JSON.stringify(d.references)}`);
    });
  }
}

run();
