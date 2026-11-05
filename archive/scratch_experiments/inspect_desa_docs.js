const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function getDocBySerial(serial) {
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
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}

async function run() {
  const invRes = await getDocBySerial('10198005');
  console.log('Factura 10198005:');
  const inv = invRes.results[0];
  console.log(`  Folio: ${inv.serial} | Type: ${inv.type} | Net: ${inv.amount_net} | Tot: ${inv.amount_total} | Ref: ${inv.order_reference}`);
  console.log('  Refs:', JSON.stringify(inv.references));

  const ncRes = await getDocBySerial('6361744');
  console.log('NC 6361744:');
  const nc = ncRes.results[0];
  console.log(`  Folio: ${nc.serial} | Type: ${nc.type} | Net: ${nc.amount_net} | Tot: ${nc.amount_total} | Ref: ${nc.order_reference}`);
  console.log('  Refs:', JSON.stringify(nc.references));

  const factNeto = parseFloat(inv.amount_net);
  const ncNeto = parseFloat(nc.amount_net);
  const neteado = factNeto - ncNeto;
  const recNeto = 168952.02;

  console.log('\n--- CALCULOS EXACTOS ---');
  console.log('Factura 10198005 Neto:', factNeto);
  console.log('NC 6361744 Neto:', ncNeto);
  console.log('Facturado Neto sin NC:', factNeto);
  console.log('Facturado Neto con NC (Factura - NC):', neteado);
  console.log('Recepcionado Bodega Viña:', recNeto);
  console.log('Diferencia (Factura Neto - Recepcionado):', factNeto - recNeto);
  console.log('Diferencia con NC (Neteado - Recepcionado):', neteado - recNeto);

  console.log('\nComparación con los valores de la consulta:');
  console.log('Webapp da: 235631 (que es Total Ordenado BQ $404.583 - Recepcionado $168.952 = 235631.40)');
  console.log('Usuario tiene: 233384');
  console.log('Factura 10198005 Neto - Recepcionado:', factNeto - recNeto);
}

run();
