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

// Exactly the logic in AxteroidAPI.gs: searchAxteroidDocs
async function testSearchAxteroidDocs(filters) {
  const params = {
    page: filters.page || 1
  };

  if (filters.serial) {
    params.serial = filters.serial.toString().trim();
    if (filters.type) params.type = filters.type;
  } else {
    params.type = filters.type || 'CL33';
  }

  if (filters.tax_id) params.tax_id = filters.tax_id.toString().trim();
  if (filters.date__gte) params.date__gte = filters.date__gte;
  if (filters.date__lte) params.date__lte = filters.date__lte;
  if (filters.order_reference) params.order_reference = filters.order_reference.toString().trim();

  console.log('Initial call params:', params);
  let data = await callAxteroidApi('/rec-docs', { params });
  console.log('Initial results count:', data.count || (data.results ? data.results.length : 0));

  if (data.results && data.results.length > 0) return data;

  const rawNum = (filters.raw_number || filters.serial || (filters.order_reference || '').replace(/^PO/i, '') || '').toString().trim();
  console.log('rawNum is:', rawNum);

  // Fallback 1
  if (params.serial && params.type) {
    const p1 = Object.assign({}, params);
    delete p1.type;
    console.log('Fallback 1 params:', p1);
    const d1 = await callAxteroidApi('/rec-docs', { params: p1 });
    console.log('Fallback 1 count:', d1.count || (d1.results ? d1.results.length : 0));
    if (d1.results && d1.results.length > 0) return d1;
  }

  // Fallback 2:
  if (rawNum && /^\d+$/.test(rawNum) && rawNum.length <= 10) {
    const paddedPo = rawNum.padStart(10, '0');
    const p2 = Object.assign({}, params);
    delete p2.serial;
    delete p2.type;
    p2.order_reference = paddedPo;
    console.log('Fallback 2 params:', p2);
    const d2 = await callAxteroidApi('/rec-docs', { params: p2 });
    console.log('Fallback 2 count:', d2.count || (d2.results ? d2.results.length : 0));
    if (d2.results && d2.results.length > 0) return d2;
  }

  return data;
}

async function main() {
  console.log('--- Testing when user inputs 521534 in Step 1 ---');
  const filtersInput = {
    serial: '521534',
    raw_number: '521534',
    order_reference: 'PO521534',
    date__gte: '',
    date__lte: '',
    tax_id: ''
  };
  const res = await testSearchAxteroidDocs(filtersInput);
  console.log('Final result count:', res.count || (res.results ? res.results.length : 0));
  if (res.results) {
    res.results.forEach(d => console.log('Doc:', d.serial, d.supplier_name, d.order_reference, 'TYPE:', d.type));
  }
}

module.exports = { testSearchAxteroidDocs, callAxteroidApi };
