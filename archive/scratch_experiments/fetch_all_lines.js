const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

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

function parseLinesFromXml(xml) {
  const lines = [];
  const detalleRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
  let match;
  while ((match = detalleRegex.exec(xml)) !== null) {
    const chunk = match[1];
    const nroLin = (chunk.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
    const name = (chunk.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1] || '';
    const qty = parseFloat((chunk.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || '0');
    const prc = parseFloat((chunk.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || '0');
    const monto = parseFloat((chunk.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || '0');
    const vlrCodigo = (chunk.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1] || '';
    lines.push({ nroLin, name, qty, prc, monto, code: vlrCodigo });
  }
  return lines;
}

async function run() {
  const facturas = [
    { folio: 97913615, id: 'do_AAABoUOS4xFKId9c' },
    { folio: 97913614, id: 'do_AAABoUOS1NZp1I3c' },
    { folio: 97913616, id: 'do_AAABoUOSyEfeqf1d' },
    { folio: 97913613, id: 'do_AAABoUOSvAoxQvQC' }
  ];

  const allLines = [];
  for (const f of facturas) {
    console.log(`Fetching XML for Folio ${f.folio} (${f.id})...`);
    const xml = await fetchXml(f.id);
    const lines = parseLinesFromXml(xml);
    console.log(`  Lines parsed: ${lines.length}`);
    lines.forEach(l => {
      allLines.push({ ...l, folio: f.folio });
    });
  }

  fs.writeFileSync('scratch/po526132_invoice_lines.json', JSON.stringify(allLines, null, 2));
  console.log(`Total invoice lines saved: ${allLines.length}`);
}

run();
