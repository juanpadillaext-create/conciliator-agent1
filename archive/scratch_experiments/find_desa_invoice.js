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
  // Let's search docs with date between 2026-09-20 and 2026-09-30 that mention 519695 in references
  // Or search with supplier name / tax id
  // Let's get recent 100 docs around 2026-09-23 to 2026-09-28
  const res = await searchAxteroid({ date__gte: '2026-09-22', date__lte: '2026-09-26', page_size: 100 });
  console.log('Docs found:', res.count || (res.results ? res.results.length : 0));
  const matches = (res.results || []).filter(d => {
    const s = JSON.stringify(d);
    return s.includes('519695') || s.toLowerCase().includes('desa');
  });
  console.log('Matching 519695 or Desa:', matches.length);
  matches.forEach(d => {
    console.log(`Folio: ${d.serial} | Type: ${d.type} | Supp: ${d.supplier_name} | Net: ${d.amount_net} | Total: ${d.amount_total} | Ref: ${d.order_reference}`);
    console.log('Refs:', JSON.stringify(d.references));
  });
}

run();
