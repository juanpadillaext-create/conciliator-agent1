const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const workspaces = ['acc_yZvUK1Aw6y5TAVLD3Y', 'acc_8RFAuJ10jcKJfDkGd5'];

function fetchAxteroid(path, ws) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'services.axteroid.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-ax-workspace': ws,
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
  const po = '521534';
  const candidates = ['0000521534', '521534', 'PO521534', 'PO0000521534', 'OC521534'];
  
  for (const ws of workspaces) {
    console.log(`\n================ Testing workspace: ${ws} ================`);
    
    for (const c of candidates) {
      const res = await fetchAxteroid(`/rec-docs?order_reference=${encodeURIComponent(c)}&page_size=100`, ws);
      console.log(`[rec-docs] order_reference=${c}: count=${res.count || (res.results ? res.results.length : 0)}`);
      if (res.results && res.results.length > 0) {
        res.results.forEach(d => console.log(`   FOUND: Folio: ${d.serial} | Type: ${d.type} | Supp: ${d.supplier_name} (${d.supplier_tax_id}) | Net: ${d.amount_net} | Tot: ${d.amount_total} | Ref: ${d.order_reference} | Date: ${d.date}`));
      }
    }

    // Try search query/term or q
    for (const endpoint of [`/rec-docs?q=${po}`, `/rec-docs?search=${po}`, `/rec-docs?term=${po}`, `/rec-docs/woemail?term=${po}`, `/rec-docs/woemail?order_reference=0000521534`]) {
      const res = await fetchAxteroid(endpoint, ws);
      console.log(`[${endpoint}]: count=${res.count || (res.results ? res.results.length : 0)}`);
      if (res.results && res.results.length > 0) {
        res.results.forEach(d => console.log(`   FOUND: Folio: ${d.serial} | Type: ${d.type} | Supp: ${d.supplier_name} (${d.supplier_tax_id}) | Net: ${d.amount_net} | Tot: ${d.amount_total} | Ref: ${d.order_reference} | Date: ${d.date}`));
      }
    }
  }
}

run().catch(console.error);
