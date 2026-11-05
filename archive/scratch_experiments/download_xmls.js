const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const workspace = 'acc_yZvUK1Aw6y5TAVLD3Y';

function fetchXml(docId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'services.axteroid.com',
      path: `/rec-docs/${docId}/xml`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-ax-workspace': workspace,
        'Accept': 'application/xml, text/xml'
      }
    };
    https.get(options, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function run() {
  const xml1 = await fetchXml('do_AAABoO3pE68cnwlF'); // 56500972 (1.968.789)
  const xml2 = await fetchXml('do_AAABoO3N9aiEZzoM'); // 56500937 (40.440)
  require('fs').writeFileSync('doc_56500972.xml', xml1, 'utf8');
  require('fs').writeFileSync('doc_56500937.xml', xml2, 'utf8');
  console.log('Saved XMLs: doc_56500972.xml (' + xml1.length + ' bytes), doc_56500937.xml (' + xml2.length + ' bytes)');
}

run().catch(console.error);
