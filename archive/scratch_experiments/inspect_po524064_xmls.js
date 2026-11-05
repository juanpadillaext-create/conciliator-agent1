const https = require('https');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function fetchDoc(serial) {
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
      res.on('end', () => resolve(JSON.parse(b).results[0]));
    }).on('error', reject);
  });
}

function fetchXml(docId) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs/${docId}/xml`, {
      headers: {
        'Authorization': `Bearer ${MASTER_TOKEN}`,
        'x-ax-workspace': 'acc_yZvUK1Aw6y5TAVLD3Y',
        'Accept': 'application/xml'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

function parseDetalle(xml) {
  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  return matches.map(m => {
    const nro = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
    const cod = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1]);
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1]);
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1]);
    return { nro, cod, name, qty, prc, monto };
  });
}

async function run() {
  const folios = ['10207759', '10207760', '6363032'];
  for (const f of folios) {
    const doc = await fetchDoc(f);
    console.log(`\n================= DOCUMENTO FOLIO ${f} (${doc.type}) =================`);
    console.log(`ID: ${doc.id} | Fecha: ${doc.date} | Neto: ${doc.amount_net} | Total: ${doc.amount_total}`);
    console.log(`Emisor: ${doc.supplier_name} (${doc.supplier_tax_id})`);
    console.log(`Receptor: ${doc.customer_name} (${doc.customer_tax_id})`);
    console.log(`Ref: ${doc.order_reference} | References:`, JSON.stringify(doc.references));

    const xml = await fetchXml(doc.id);
    fs.writeFileSync(`scratch/doc_${f}.xml`, xml);

    const dsc = xml.match(/<DscRcgGlobal>[\s\S]*?<\/DscRcgGlobal>/g);
    if (dsc) console.log('Descuentos/Recargos Globales:', dsc);

    const impto = xml.match(/<ImptoReten>[\s\S]*?<\/ImptoReten>/g);
    if (impto) console.log('Impuestos Reten/ILA:', impto.map(i => i.replace(/\s+/g, ' ')));

    const items = parseDetalle(xml);
    console.table(items);
  }
}

run();
