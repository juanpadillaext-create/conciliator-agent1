const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchXml(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs/${id}`, {
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
        'Accept': 'application/xml',
        'User-Agent': 'Axteroid-GAS-WebApp/1.0'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

async function run() {
  const docs = [
    { folio: '10207759', id: 'do_AAABoR8NHdtRW8H1' },
    { folio: '10207760', id: 'do_AAABoR8M8nu064Rv' },
    { folio: '6363032',  id: 'do_AAABoTgESzwpdwmM' }
  ];

  for (const d of docs) {
    await sleep(400);
    const xml = await fetchXml(d.id);
    fs.writeFileSync(`scratch/doc_${d.folio}.xml`, xml);
    console.log(`Saved doc_${d.folio}.xml (${xml.length} bytes)`);
  }
}

run();
