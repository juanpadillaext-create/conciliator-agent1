const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function searchAxteroid(params) {
  return new Promise((resolve, reject) => {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    https.get(`https://services.axteroid.com/rec-docs?${qs}`, {
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

async function test() {
  const res = await searchAxteroid({ order_reference: 'PO526132', page_size: 100 });
  const ALLOWED_DOC_TYPES = ['CL33', 'CL34', 'CL61', 'NC'];
  const filtered = (res.results || []).filter(doc => ALLOWED_DOC_TYPES.includes(doc.type));
  
  console.log('Total documents with NCs allowed:', filtered.length);
  let totFactNet = 0;
  let totNcNet = 0;
  
  filtered.forEach(d => {
    const isNc = d.type === 'CL61' || d.type === 'NC';
    const net = parseFloat(d.amount_net) || 0;
    const tot = parseFloat(d.amount_total) || 0;
    if (isNc) {
      totNcNet += net;
      console.log(`[NC] Folio: ${d.serial || d.number} | Neto: ${net} | Total: ${tot}`);
    } else {
      totFactNet += net;
      console.log(`[Factura] Folio: ${d.serial || d.number} | Neto: ${net} | Total: ${tot}`);
    }
  });

  const netNeto = totFactNet - totNcNet;
  const deliveredNet = 1827284.58;
  const diffNetaConNc = netNeto - deliveredNet;

  console.log('\n--- Totales con Deducción de Notas de Crédito ---');
  console.log('Total Facturas Neto:', totFactNet);
  console.log('Total NCs Neto:', totNcNet);
  console.log('Total Facturado Neto Neteado (Facturas - NCs):', netNeto);
  console.log('Total Recepcionado Bodega:', deliveredNet);
  console.log('DIFERENCIA REAL NETA CON NOTAS DE CRÉDITO DEDUCIDAS:', diffNetaConNc.toFixed(2));
}

test();
