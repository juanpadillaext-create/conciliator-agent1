const https = require('https');
const fs = require('fs');

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
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve({ error: b }); }
      });
    }).on('error', reject);
  });
}

async function run() {
  const candidates = ['PO519695', '0000519695', '519695'];
  for (const c of candidates) {
    const res = await searchAxteroid({ order_reference: c, page_size: 100 });
    console.log(`Query order_reference=${c}: count=${res.count || (res.results ? res.results.length : 0)}`);
    if (res.results && res.results.length > 0) {
      fs.writeFileSync('scratch/po519695_axteroid.json', JSON.stringify(res.results, null, 2));
      res.results.forEach(d => {
        console.log(`  Type: ${d.type} | Folio: ${d.serial || d.number} | Supplier: ${d.supplier_name} | Net: ${d.amount_net} | Total: ${d.amount_total}`);
      });
      return;
    }
  }
}

run();
