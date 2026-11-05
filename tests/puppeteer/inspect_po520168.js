const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const WS = 'acc_yZvUK1Aw6y5TAVLD3Y';

function fetchDoc(id) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'services.axteroid.com',
      path: '/rec-docs/' + id,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + MASTER_TOKEN,
        'x-ax-workspace': WS,
        'Accept': 'application/xml'
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log('1. Consultando BQ...');
  const sql = `SELECT p.sku_id, p.product_name, p.quantity_ordered, p.quantity_delivered, p.item_values_lc.unit_cost_lc as cost_unit_lc, p.item_values_lc.amt_ordered_lc as amt_ordered_lc, p.item_values_lc.amt_delivered_lc as amt_delivered_lc FROM peya-data-origins-pro.cl_dmarts.purchase_orders po, UNNEST(po.products_purchased) p WHERE po.country_code = 'cl' AND po.created_localtime_at >= '2026-09-01' AND po.po_order_id = 'PO520168'`;
  
  const bqRaw = execSync(`bq query --project_id=peya-chile --use_legacy_sql=false --label datacloud:antigravity --format=json "${sql}"`, { encoding: 'utf8' });
  const poItems = JSON.parse(bqRaw);

  const bqOrdTot = poItems.reduce((s, x) => s + Number(x.amt_ordered_lc), 0);
  const bqRecTot = poItems.reduce((s, x) => s + Number(x.amt_delivered_lc), 0);
  console.log('Total items BQ:', poItems.length, 'Total Ord BQ:', bqOrdTot, 'Total Rec BQ:', bqRecTot);

  const invoiceIds = [
    { serial: 105214259, id: 'do_AAABoNcB-Pq_ZKOk' },
    { serial: 105214260, id: 'do_AAABoNcB-UlUqh9u' },
    { serial: 105214261, id: 'do_AAABoNcB-XdrxEe2' },
    { serial: 105214262, id: 'do_AAABoNcB-aQth6lQ' },
    { serial: 105214263, id: 'do_AAABoNcB-dh6WzFR' },
    { serial: 105214264, id: 'do_AAABoNcB-gC7OH5i' } // Anulada por NC 17233113
  ];

  const allInvLines = [];
  let totalFacturadoNeto = 0;

  for (let inv of invoiceIds) {
    const xml = await fetchDoc(inv.id);
    const detMatches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
    detMatches.forEach(det => {
      const nom = (det.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1] || '';
      const cpr = (det.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1] || '';
      const qty = Number((det.match(/<QtyItem>(.*?)<\/QtyItem>/) || [])[1] || 0);
      const prc = Number((det.match(/<PrcItem>(.*?)<\/PrcItem>/) || [])[1] || 0);
      const mto = Number((det.match(/<MontoItem>(.*?)<\/MontoItem>/) || [])[1] || 0);
      totalFacturadoNeto += mto;
      allInvLines.push({
        folio: inv.serial,
        codigo: cpr,
        nombre: nom,
        cantidad: qty,
        precio: prc,
        monto: mto
      });
    });
  }

  console.log('Total lineas facturadas (6 facturas):', allInvLines.length);
  console.log('Monto neto total sumando items de las 6 facturas:', totalFacturadoNeto);
  const facturadoSinAnulada = totalFacturadoNeto - 2767;
  console.log('Monto neto de facturas sin 105214264 (anulada):', facturadoSinAnulada);
  console.log('Diferencia Facturado Neto (sin anulada) vs Recepcionado BQ:');
  console.log('Facturado:', facturadoSinAnulada, 'Recepcionado:', bqRecTot, 'Diff:', facturadoSinAnulada - bqRecTot);
  console.log('Diferencia Facturado Neto (sin anulada) vs Ordenado BQ:');
  console.log('Facturado:', facturadoSinAnulada, 'Ordenado:', bqOrdTot, 'Diff:', facturadoSinAnulada - bqOrdTot);

  // Guardar datos en archivo JSON para análisis detallado
  fs.writeFileSync('po520168_bq_items.json', JSON.stringify(poItems, null, 2));
  fs.writeFileSync('po520168_inv_items.json', JSON.stringify(allInvLines, null, 2));
  console.log('Archivos guardados para análisis.');
}

run().catch(console.error);
