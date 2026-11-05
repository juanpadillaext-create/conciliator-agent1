const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function getDocXml(serial) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs?serial=${serial}`, {
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
        'Accept': 'application/json'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const json = JSON.parse(b);
        const id = json.results[0].id;
        setTimeout(() => {
          https.get(`https://services.axteroid.com/rec-docs/${id}`, {
            headers: {
              'Authorization': `Bearer ${MASTER_TOKEN}`,
              'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
              'Accept': 'application/xml'
            }
          }, res2 => {
            let b2 = '';
            res2.setEncoding('latin1');
            res2.on('data', c2 => b2 += c2);
            res2.on('end', () => resolve(b2));
          }).on('error', reject);
        }, 300);
      });
    }).on('error', reject);
  });
}

async function run() {
  for (const s of ['25243763', '25243760']) {
    const xml = await getDocXml(s);
    const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
    console.log(`NC ${s} details (${matches.length} lines):`);
    matches.forEach(m => {
      const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
      const qty = (m.match(/<QtyItem>(.*?)<\/QtyItem>/) || [])[1];
      const monto = (m.match(/<MontoItem>(.*?)<\/MontoItem>/) || [])[1];
      console.log(`  ${name} | Qty: ${qty} | Monto: ${monto}`);
    });
  }
}

run();
