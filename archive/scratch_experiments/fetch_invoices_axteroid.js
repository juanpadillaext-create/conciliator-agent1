const https = require('https');
const fs = require('fs');

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const WORKSPACE = 'acc_yZvUK1Aw6y5TAVLD3Y';
const BASE_HOST = 'services.axteroid.com';

const folios = ['40605509', '40605508', '40605507', '40605506', '40605505'];

function requestJson(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'x-ax-workspace': WORKSPACE,
        'Accept': 'application/json',
        'User-Agent': 'Axteroid-Node-Analysis/1.0'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function requestText(path, accept = 'application/xml') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'x-ax-workspace': WORKSPACE,
        'Accept': accept,
        'User-Agent': 'Axteroid-Node-Analysis/1.0'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Buscando facturas en Axteroid...');
  const invoices = [];

  for (const f of folios) {
    console.log(`Buscando folio ${f}...`);
    await sleep(250);
    const searchRes = await requestJson(`/rec-docs?serial=${f}`);
    const results = searchRes.results || [];
    const doc = results.find(d => String(d.serial || d.number) === f) || results[0];
    if (!doc) {
      console.warn(`No se encontró documento para folio ${f}`);
      continue;
    }
    console.log(`  Encontrado Doc ID: ${doc.id}, Serial: ${doc.serial}, Total: ${doc.amount_total}, Proveedor: ${doc.supplier_name}`);

    // Obtener detalle XML o líneas
    await sleep(250);
    let xmlContent = null;
    try {
      xmlContent = await requestText(`/rec-docs/${doc.id}`, 'application/xml');
      console.log(`  XML descargado (${xmlContent.length} bytes)`);
    } catch (e) {
      console.warn(`  No se pudo descargar XML para ${doc.id}: ${e.message}`);
    }

    invoices.push({
      id: doc.id,
      serial: doc.serial,
      date: doc.date || doc.issued_date,
      supplier_name: doc.supplier_name,
      supplier_tax_id: doc.tax_id || doc.supplier_tax_id,
      amount_total: doc.amount_total,
      amount_net: doc.amount_net,
      amount_tax: doc.amount_tax,
      order_reference: doc.order_reference,
      xml: xmlContent
    });
  }

  fs.writeFileSync('c:/Users/juan.padilla.ext/Desktop/Axteroid/scratch/invoices_nestle.json', JSON.stringify(invoices, null, 2), 'utf8');
  console.log(`\nGuardadas ${invoices.length} facturas en scratch/invoices_nestle.json`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
