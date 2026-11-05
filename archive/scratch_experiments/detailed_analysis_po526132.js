const https = require('https');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';

function fetchDoc(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs/${id}`, {
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

function searchDocs(ref) {
  return new Promise((resolve, reject) => {
    https.get(`https://services.axteroid.com/rec-docs?order_reference=${encodeURIComponent(ref)}`, {
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

async function analyze() {
  const docsRes = await searchDocs('PO526132');
  console.log('Docs found:', docsRes.results.length);
  
  let facturas = [];
  let ncs = [];

  for (const d of docsRes.results) {
    const full = await fetchDoc(d.id);
    const docData = {
      id: full.id,
      serial: full.serial || full.number,
      type: full.type,
      name: full.supplier_name,
      tax_id: full.tax_id,
      net: parseFloat(full.amount_net) || 0,
      tax: parseFloat(full.amount_tax) || 0,
      total: parseFloat(full.amount_total) || 0,
      ila: (parseFloat(full.amount_total) || 0) - (parseFloat(full.amount_net) || 0) - (parseFloat(full.amount_tax) || 0),
      items_count: (full.items || []).length,
      items: full.items || []
    };
    if (full.type === 'CL61' || full.type === 'NC' || String(full.serial).startsWith('252')) {
      ncs.push(docData);
    } else {
      facturas.push(docData);
    }
  }

  console.log('\n=== FACTURAS (DTE 33) ===');
  let totFactNet = 0;
  let totFactTax = 0;
  let totFactTotal = 0;
  let totFactIla = 0;
  facturas.forEach(f => {
    console.log(`Folio: ${f.serial} | Neto: ${f.net} | IVA: ${f.tax} | ILA: ${f.ila} | Total: ${f.total} | Items: ${f.items_count}`);
    totFactNet += f.net;
    totFactTax += f.tax;
    totFactTotal += f.total;
    totFactIla += f.ila;
  });
  console.log(`TOTAL FACTURAS -> Neto: ${totFactNet} | IVA: ${totFactTax} | ILA: ${totFactIla} | Total: ${totFactTotal}`);

  console.log('\n=== NOTAS DE CREDITO (DTE 61) ===');
  let totNcNet = 0;
  let totNcTax = 0;
  let totNcTotal = 0;
  let totNcIla = 0;
  ncs.forEach(nc => {
    console.log(`Folio: ${nc.serial} | Neto: ${nc.net} | IVA: ${nc.tax} | ILA: ${nc.ila} | Total: ${nc.total} | Items: ${nc.items_count}`);
    totNcNet += nc.net;
    totNcTax += nc.tax;
    totNcTotal += nc.total;
    totNcIla += nc.ila;
  });
  console.log(`TOTAL NCs -> Neto: ${totNcNet} | IVA: ${totNcTax} | ILA: ${totNcIla} | Total: ${totNcTotal}`);

  console.log('\n=== FACTURAS MENOS NOTAS DE CREDITO ===');
  console.log(`Neto Neto: ${totFactNet - totNcNet}`);
  console.log(`Total Total: ${totFactTotal - totNcTotal}`);

  console.log('\n=== RECEPCION BIGQUERY ===');
  const bqDeliveredNet = 1827284.58;
  const bqOrderedNet = 2553590.93;
  console.log(`Recepcionado Neto (Bodega Calama): ${bqDeliveredNet}`);
  console.log(`Ordenado Neto (PO): ${bqOrderedNet}`);

  console.log('\n=== COMPARACIONES DE DIFERENCIA ===');
  console.log(`1) Total Facturado Neto (${totFactNet}) - Recepcionado Neto (${bqDeliveredNet}) = ${(totFactNet - bqDeliveredNet).toFixed(2)}`);
  console.log(`2) Con IVA 19%: ${((totFactNet - bqDeliveredNet) * 1.19).toFixed(2)}`);
  console.log(`3) (Facturado Neto - NCs Neto) (${totFactNet - totNcNet}) - Recepcionado Neto (${bqDeliveredNet}) = ${((totFactNet - totNcNet) - bqDeliveredNet).toFixed(2)}`);
  console.log(`4) Facturado Bruto (${totFactTotal}) - Recepcionado Neto (${bqDeliveredNet}) = ${(totFactTotal - bqDeliveredNet).toFixed(2)}`);
}

analyze();
