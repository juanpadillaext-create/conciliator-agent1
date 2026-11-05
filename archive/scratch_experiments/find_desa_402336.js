const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function searchAxteroid(params) {
  return new Promise((resolve, reject) => {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    https.get(`https://services.axteroid.com/rec-docs?${qs}`, {
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
        'Accept': 'application/json'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}

async function run() {
  // Let's search with page_size: 100 for dates 2026-09-23 and 2026-09-24
  for (const page of [1, 2, 3, 4, 5]) {
    const res = await searchAxteroid({ date__gte: '2026-09-23', date__lte: '2026-09-25', page: page, page_size: 100 });
    if (!res.results || res.results.length === 0) break;
    res.results.forEach(d => {
      const net = parseFloat(d.amount_net) || 0;
      const ref = (d.order_reference || '') + ' ' + JSON.stringify(d.references || '');
      const supp = (d.supplier_name || '').toLowerCase();
      if (Math.abs(net - 402336) < 10000 || Math.abs(net - 233384) < 10000 || supp.includes('desa') || ref.includes('519695')) {
        console.log(`[MATCH] Folio: ${d.serial} | Type: ${d.type} | Supp: ${d.supplier_name} | Net: ${d.amount_net} | Tot: ${d.amount_total} | Ref: ${d.order_reference}`);
        console.log('  Refs:', JSON.stringify(d.references));
      }
    });
  }
}

run();
