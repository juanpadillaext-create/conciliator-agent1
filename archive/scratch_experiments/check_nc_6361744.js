const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function getDocBySerial(serial) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs?serial=${serial}`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}`, 'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y', 'Accept': 'application/json' }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
  });
}

function getXml(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs/${id}`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}`, 'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y', 'Accept': 'application/xml' }
    }, res => {
      let b = '';
      res.setEncoding('latin1');
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    });
  });
}

async function run() {
  const ncRes = await getDocBySerial('6361744');
  const xml = await getXml(ncRes.results[0].id);
  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  console.log('Detalles NC 6361744:');
  matches.forEach(m => {
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = (m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1];
    const prc = (m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1];
    const monto = (m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1];
    console.log(`  ${name} | Qty: ${qty} | Prc: ${prc} | Monto: ${monto}`);
  });
}

run();
