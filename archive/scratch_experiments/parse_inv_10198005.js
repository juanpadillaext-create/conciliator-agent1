const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function getXml(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs/${id}`, {
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
        'Accept': 'application/xml'
      }
    }, res => {
      let b = '';
      res.setEncoding('latin1');
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

async function run() {
  const invRes = JSON.parse(await new Promise(r => {
    https.get(`https://services.axteroid.com/rec-docs?serial=10198005`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}`, 'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y', 'Accept': 'application/json' }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => r(b));
    });
  }));
  const docId = invRes.results[0].id;
  const xml = await getXml(docId);
  fs.writeFileSync('scratch/factura_10198005.xml', xml);
  console.log('XML downloaded, length:', xml.length);

  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  console.log(`Detalles en Factura 10198005 (${matches.length} líneas):`);
  let sumDetalle = 0;
  matches.forEach(m => {
    const nro = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = (m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1];
    const prc = (m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1];
    const monto = (m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1];
    sumDetalle += parseFloat(monto);
    console.log(`  L${nro} | ${name} | Qty: ${qty} | Prc: ${prc} | Monto: ${monto}`);
  });
  console.log('Suma MontoItem Factura:', sumDetalle);
}

run();
