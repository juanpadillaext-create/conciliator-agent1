const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function searchDocs(ref) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs?order_reference=${encodeURIComponent(ref)}`, {
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
  const res = await searchDocs('PO526132');
  console.log(`Found ${res.results.length} docs:`);
  res.results.forEach((d, idx) => {
    console.log(`\n--- Doc #${idx+1} ---`);
    console.log(`Folio: ${d.serial || d.number} | Type: ${d.type} | Date: ${d.date}`);
    console.log(`Neto: ${d.amount_net} | IVA: ${d.amount_tax} | Total: ${d.amount_total}`);
    console.log('Taxes:', JSON.stringify(d.taxes));
    console.log('References:', JSON.stringify(d.references));
  });
}

run();
