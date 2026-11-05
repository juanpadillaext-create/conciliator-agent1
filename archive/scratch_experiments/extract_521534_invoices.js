const https = require('https');
const fs = require('fs');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const workspace = 'acc_yZvUK1Aw6y5TAVLD3Y';

function fetchAxteroid(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'services.axteroid.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-ax-workspace': workspace,
        'Accept': 'application/json'
      }
    };
    https.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const res = await fetchAxteroid('/rec-docs?order_reference=0000521534&page_size=100');
  console.log('Total documents:', res.count);
  const summary = res.results.map(r => ({
    id: r.id,
    serial: String(r.serial),
    type: r.type,
    supplier_name: r.supplier_name,
    supplier_tax_id: r.tax_id,
    amount_net: Number(r.amount_net),
    amount_total: Number(r.amount_total),
    date: r.date,
    order_reference: r.order_reference,
    status: r.status,
    rec_status: r.rec_status
  }));
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync('po521534_invoices.json', JSON.stringify(summary, null, 2));
}

main().catch(console.error);
