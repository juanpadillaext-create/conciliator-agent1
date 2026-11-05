const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function searchAxteroid(params, ws = 'acc_yZvUK1Aw6y5TAVLD3Y') {
  return new Promise((resolve, reject) => {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `https://services.axteroid.com/rec-docs?${qs}`;
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': ws,
        'Accept': 'application/json',
        'User-Agent': 'Axteroid-GAS-WebApp/1.0'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const queries = [
    { order_reference: '526132' },
    { order_reference: 'PO526132' },
    { search: '526132' },
    { q: '526132' }
  ];

  for (const q of queries) {
    console.log('Testing query:', JSON.stringify(q));
    const res = await searchAxteroid(q);
    if (res && res.results && res.results.length > 0) {
      console.log(`Found ${res.results.length} results:`);
      res.results.forEach(d => {
        console.log(`Folio: ${d.serial || d.number} | Emisor: ${d.supplier_name || d.tax_id} | Total: ${d.amount_total} | Neto: ${d.amount_net} | IVA: ${d.amount_tax}`);
        console.log('References:', JSON.stringify(d.references));
      });
      return;
    } else {
      console.log('Count:', res.count || (res.results ? res.results.length : 0));
    }
  }
}

run();
