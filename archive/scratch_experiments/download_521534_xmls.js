const https = require('https');
const fs = require('fs');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const workspace = 'acc_yZvUK1Aw6y5TAVLD3Y';

const invs = JSON.parse(fs.readFileSync('po521534_invoices.json', 'utf8')).filter(i => i.type === 'CL33');

function fetchXml(docId) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'services.axteroid.com',
      path: `/rec-docs/${docId}`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-ax-workspace': workspace,
        'Accept': 'application/xml'
      }
    };
    https.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

// Simple regex XML item parser
function parseItemsFromXml(xml) {
  const items = [];
  const detalleRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
  let match;
  while ((match = detalleRegex.exec(xml)) !== null) {
    const block = match[1];
    const nroLinMatch = block.match(/<NroLinDet>(\d+)<\/NroLinDet>/);
    const nmbItemMatch = block.match(/<NmbItem>([\s\S]*?)<\/NmbItem>/);
    const dscItemMatch = block.match(/<DscItem>([\s\S]*?)<\/DscItem>/);
    const qtyMatch = block.match(/<QtyItem>([\d.]+)<\/QtyItem>/);
    const prcMatch = block.match(/<PrcItem>([\d.]+)<\/PrcItem>/);
    const mntMatch = block.match(/<MontoItem>([\d.]+)<\/MontoItem>/);
    const cdgMatch = block.match(/<VlrCodigo>([\s\S]*?)<\/VlrCodigo>/);

    items.push({
      line: nroLinMatch ? parseInt(nroLinMatch[1]) : items.length + 1,
      codigo: cdgMatch ? cdgMatch[1].trim() : '',
      nombre: nmbItemMatch ? nmbItemMatch[1].trim() : (dscItemMatch ? dscItemMatch[1].trim() : ''),
      cantidad: qtyMatch ? parseFloat(qtyMatch[1]) : 0,
      precio: prcMatch ? parseFloat(prcMatch[1]) : 0,
      total_neto: mntMatch ? parseFloat(mntMatch[1]) : 0
    });
  }
  return items;
}

async function run() {
  console.log('Downloading XMLs for', invs.length, 'facturas...');
  const detailedInvoices = [];
  for (const inv of invs) {
    try {
      const xml = await fetchXml(inv.id);
      const items = parseItemsFromXml(xml);
      console.log(`Factura Folio: ${inv.serial} | Items: ${items.length} | Net: ${inv.amount_net}`);
      detailedInvoices.push({
        ...inv,
        items
      });
    } catch (e) {
      console.error(`Error on folio ${inv.serial}:`, e.message);
    }
  }

  fs.writeFileSync('po521534_facturas_con_items.json', JSON.stringify(detailedInvoices, null, 2));
  console.log('Saved po521534_facturas_con_items.json');
}

run().catch(console.error);
