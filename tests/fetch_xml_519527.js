const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function fetchAxteroidXml(docId, ws = 'acc_yZvUK1Aw6y5TAVLD3Y') {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://services.axteroid.com/rec-docs/${docId}`);
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': ws,
        'Accept': 'application/xml',
        'User-Agent': 'Node-Axteroid-Test/1.0'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, text: data });
      });
    }).on('error', reject);
  });
}

async function run() {
  const docId = 'do_AAABoNmiZ3502o7z'; // Folio 56458220
  const res = await fetchAxteroidXml(docId);
  console.log('Status:', res.status, 'Length:', res.text.length);
  fs.writeFileSync('tests/factura_56458220.xml', res.text);
  console.log('Saved to tests/factura_56458220.xml');
}

run();
