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
  console.log('Querying Axteroid for 521015...');
  const res1 = await fetchAxteroid('/rec-docs?order_reference=PO521015');
  console.log('Results with order_reference=PO521015:', res1.count || (res1.results ? res1.results.length : 0));
  if (res1.results && res1.results.length > 0) {
    res1.results.forEach(r => console.log('Doc:', r.serial, r.supplier_name, r.amount_net, r.amount_total, r.order_reference, r.date));
  }

  const res2 = await fetchAxteroid('/rec-docs?order_reference=0000521015');
  console.log('Results with order_reference=0000521015:', res2.count || (res2.results ? res2.results.length : 0));
  if (res2.results && res2.results.length > 0) {
    res2.results.forEach(r => console.log('Doc:', r.serial, r.supplier_name, r.amount_net, r.amount_total, r.order_reference, r.date));
  }

  const res3 = await fetchAxteroid('/rec-docs?order_reference=521015');
  console.log('Results with order_reference=521015:', res3.count || (res3.results ? res3.results.length : 0));
  if (res3.results && res3.results.length > 0) {
    res3.results.forEach(r => console.log('Doc:', r.serial, r.supplier_name, r.amount_net, r.amount_total, r.order_reference, r.date));
  }

  // Also search woemail
  const res4 = await fetchAxteroid('/rec-docs/woemail?term=521015');
  console.log('Results in woemail term=521015:', res4.count || (res4.results ? res4.results.length : 0));
  if (res4.results && res4.results.length > 0) {
    res4.results.forEach(r => console.log('Doc woemail:', r.serial, r.supplier_name, r.amount_net, r.amount_total, r.order_reference, r.date));
  }

  // Check Ideal / Bimbo RUT (96591040 is Carozzi, what is Ideal / Bimbo RUT?)
  // Let's check supplier_id = 50 in BigQuery
}

run().catch(console.error);
