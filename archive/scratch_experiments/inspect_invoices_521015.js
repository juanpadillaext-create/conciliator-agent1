const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const workspace = 'acc_yZvUK1Aw6y5TAVLD3Y';

function fetchAxteroid(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'services.axteroid.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-ax-workspace': workspace,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const res = await fetchAxteroid('/rec-docs?order_reference=521015');
  console.log('Total docs:', res.results.length);
  for (const doc of res.results) {
    console.log(`\n=== Doc ID: ${doc.id} | Serial: ${doc.serial} | Total Net: ${doc.amount_net} ===`);
    console.log(`Supplier: ${doc.supplier_name} (${doc.supplier_tax_id})`);
    console.log(`Order reference: ${doc.order_reference}`);
    console.log(`References:`, JSON.stringify(doc.references));
  }
}

run().catch(console.error);
