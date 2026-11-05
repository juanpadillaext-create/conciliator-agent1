const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const workspace = 'acc_yZvUK1Aw6y5TAVLD3Y';

function callAxteroidApi(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    let urlPath = endpoint;
    if (options.params) {
      const q = [];
      for (const k in options.params) {
        if (options.params[k] !== null && options.params[k] !== undefined && options.params[k] !== '') {
          q.push(encodeURIComponent(k) + '=' + encodeURIComponent(options.params[k]));
        }
      }
      if (q.length > 0) urlPath += (urlPath.includes('?') ? '&' : '?') + q.join('&');
    }

    const opts = {
      hostname: 'services.axteroid.com',
      path: urlPath,
      method: options.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-ax-workspace': workspace,
        'Accept': 'application/json'
      }
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseMontoClean(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (!str) return 0;
  return parseFloat(str) || 0;
}

function formatAxteroidDocResults(data, page) {
  return {
    count: data.count || 0,
    page: page || data.page || 1,
    results: (data.results || []).map(doc => {
      const tot = parseMontoClean(doc.amount_total);
      const net = parseMontoClean(doc.amount_net);
      const tax = parseMontoClean(doc.amount_tax);
      const finalNet = net > 0 ? net : (tot > 0 ? Math.round(tot / 1.19) : 0);
      const finalTot = tot > 0 ? tot : Math.round(finalNet * 1.19);
      return {
        id: doc.id,
        serial: doc.serial || doc.number,
        type: doc.type,
        supplier_name: doc.supplier_name,
        supplier_tax_id: doc.tax_id || doc.supplier_tax_id,
        amount_total: finalTot,
        amount_net: finalNet,
        amount_tax: tax,
        date: doc.date || doc.issued_date,
        status: doc.status,
        rec_status: doc.rec_status,
        order_reference: doc.order_reference
      };
    })
  };
}

async function searchAxteroidDocsByPo(poNumber, ws) {
  const rawNum = poNumber.toString().trim().replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
  const candidates = [];
  if (rawNum && /^\d+$/.test(rawNum)) {
    candidates.push(rawNum.padStart(10, '0'));
    candidates.push('PO' + rawNum);
    candidates.push(rawNum);
  }
  const cleanOrig = poNumber.toString().trim();
  if (!candidates.includes(cleanOrig)) {
    candidates.push(cleanOrig);
  }

  let allResults = [];
  const seenIds = new Set();

  for (let i = 0; i < candidates.length; i++) {
    const refCandidate = candidates[i];
    console.log('Querying candidate:', refCandidate);
    try {
      const res = await callAxteroidApi('/rec-docs', {
        params: { order_reference: refCandidate, page_size: 100 },
        workspace: ws
      });
      console.log('Candidate', refCandidate, 'returned count:', res.count, 'results len:', res.results ? res.results.length : 0);
      if (res && res.results && res.results.length > 0) {
        res.results.forEach(doc => {
          if (doc.type && doc.type !== 'CL33') return;
          const id = String(doc.id || doc.serial);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allResults.push(doc);
          }
        });
      }
    } catch (e) {
      console.log('Error querying candidate:', e.message);
    }
    if (allResults.length > 0) break;
  }

  return formatAxteroidDocResults({ count: allResults.length, results: allResults }, 1);
}

async function run() {
  const axRes = await searchAxteroidDocsByPo('521534', workspace);
  console.log('Formatted results count:', axRes.count);
  console.log('Invoices:');
  axRes.results.forEach(r => console.log(r.serial, r.supplier_name, r.amount_net, r.amount_total, r.order_reference));
}

run().catch(console.error);
