const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function fetchAxteroid(endpoint, ws, accept = 'application/json') {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://services.axteroid.com${endpoint}`);
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': ws,
        'Accept': accept,
        'User-Agent': 'Node-Axteroid-Test/1.0'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: accept.includes('json') ? JSON.parse(data) : data });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const ws = 'acc_yZvUK1Aw6y5TAVLD3Y';
  const docIds = ['do_AAABoNmiZ3502o7z', 'do_AAABoNaUQFtYai3h'];

  for (const id of docIds) {
    console.log(`\n=================== DOC ${id} ===================`);
    const docRes = await fetchAxteroid(`/rec-docs/${id}`, ws);
    console.log('Doc Details:', JSON.stringify(docRes.data, null, 2));

    const xmlRes = await fetchAxteroid(`/documents/${id}/xml`, ws, 'application/xml');
    console.log(`XML length: ${xmlRes.data?.length || 0}`);
    if (typeof xmlRes.data === 'string') {
      require('fs').writeFileSync(`tests/doc_${id}.xml`, xmlRes.data);
      console.log(`Saved XML to tests/doc_${id}.xml`);
    }
  }
}

run();
