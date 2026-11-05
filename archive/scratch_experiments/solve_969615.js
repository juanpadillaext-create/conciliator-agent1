const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchXml(id) {
  return new Promise((resolve, reject) => {
    const doReq = () => {
      https.get(`https://services.axteroid.com/rec-docs/${id}`, {
        headers: {
          'Authorization': `Bearer ${MASTER_TOKEN}`,
          'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
          'Accept': 'application/xml',
          'User-Agent': 'Axteroid-GAS-WebApp/1.0'
        }
      }, res => {
        let b = '';
        res.setEncoding('latin1');
        res.on('data', c => b += c);
        res.on('end', async () => {
          if (res.statusCode === 429) {
            console.log(`Rate limited on ${id}, waiting 500ms...`);
            await sleep(500);
            return doReq();
          }
          resolve(b);
        });
      }).on('error', reject);
    };
    doReq();
  });
}

function parseDteDetails(xml, folio) {
  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  return matches.map((m, idx) => {
    const nroLin = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1] || String(idx + 1);
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1] || '';
    const code = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1] || '';
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || '0');
    const uom = (m.match(/<UnmdItem>(.*?)<\/UnmdItem>/) || [])[1] || 'UN';
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || '0');
    const dscMonto = parseFloat((m.match(/<DescuentoMonto>([\d.]+)<\/DescuentoMonto>/) || [])[1] || '0');
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || '0');
    const codImpAdic = (m.match(/<CodImpAdic>(.*?)<\/CodImpAdic>/) || [])[1] || '';
    return {
      folio,
      nroLin,
      name,
      code,
      qty,
      uom,
      prc,
      dscMonto,
      monto,
      codImpAdic
    };
  });
}

async function run() {
  const facturas = [
    { folio: 97913615, id: 'do_AAABoUOS4xFKId9c' },
    { folio: 97913614, id: 'do_AAABoUOS1NZp1I3c' },
    { folio: 97913616, id: 'do_AAABoUOSyEfeqf1d' },
    { folio: 97913613, id: 'do_AAABoUOSvAoxQvQC' }
  ];

  let allInvoiceLines = [];
  for (const f of facturas) {
    await sleep(300);
    const xml = await fetchXml(f.id);
    const lines = parseDteDetails(xml, f.folio);
    console.log(`Folio ${f.folio}: parsed ${lines.length} lines, len: ${xml.length}`);
    allInvoiceLines = allInvoiceLines.concat(lines);
  }

  console.log(`Total invoice lines: ${allInvoiceLines.length}`);
  const totMonto = allInvoiceLines.reduce((s, l) => s + l.monto, 0);
  console.log('Total MontoItem sum:', totMonto);

  fs.writeFileSync('scratch/all_invoice_lines_parsed.json', JSON.stringify(allInvoiceLines, null, 2));

  // Load BQ PO items
  let raw = fs.readFileSync('scratch/po526132_items.json');
  let text = '';
  if (raw[0] === 0xff && raw[1] === 0xfe) text = raw.toString('utf16le');
  else text = raw.toString('utf8').replace(/^\uFEFF/, '');
  text = text.replace(/^\uFEFF/, '').trim();
  const bqItems = JSON.parse(text);

  console.log(`Total BQ items: ${bqItems.length}`);

  // Now let's test matching!
  // In the webapp, how does CruceEngine match items?
  // Let's inspect CruceEngine matching logic or calculate differences
}

run();
