const fs = require('fs');

function parseXmlLines(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'latin1');
  const folio = (xml.match(/<Folio>(\d+)<\/Folio>/) || [])[1];
  const tipoDte = (xml.match(/<TipoDTE>(\d+)<\/TipoDTE>/) || [])[1];
  const mntNeto = parseFloat((xml.match(/<MntNeto>([\d.]+)<\/MntNeto>/) || [])[1] || 0);
  const mntTotal = parseFloat((xml.match(/<MntTotal>([\d.]+)<\/MntTotal>/) || [])[1] || 0);

  const matches = xml.match(/<Detalle>[\s\S]*?<\/Detalle>/g) || [];
  const lines = matches.map(m => {
    const nro = (m.match(/<NroLinDet>(\d+)<\/NroLinDet>/) || [])[1];
    const cod = (m.match(/<VlrCodigo>(.*?)<\/VlrCodigo>/) || [])[1];
    const name = (m.match(/<NmbItem>(.*?)<\/NmbItem>/) || [])[1];
    const qty = parseFloat((m.match(/<QtyItem>([\d.]+)<\/QtyItem>/) || [])[1] || 0);
    const prc = parseFloat((m.match(/<PrcItem>([\d.]+)<\/PrcItem>/) || [])[1] || 0);
    const monto = parseFloat((m.match(/<MontoItem>([\d.]+)<\/MontoItem>/) || [])[1] || 0);
    return { folio, tipoDte, nro, cod, name, qty, prc, monto };
  });

  return { folio, tipoDte, mntNeto, mntTotal, lines };
}

const f1 = parseXmlLines('scratch/doc_10207759.xml');
const f2 = parseXmlLines('scratch/doc_10207760.xml');
const nc = parseXmlLines('scratch/doc_6363032.xml');
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));

console.log('--- RECONCILIACIÓN COMPLETA PO 524064 ---');

// Facturas combinadas
const invLines = [...f1.lines, ...f2.lines];

// Mapeo entre líneas de factura y BQ
const cruce = [];
invLines.forEach(inv => {
  let bestBq = null;
  let bestScore = 0;

  bqItems.forEach(bq => {
    let score = 0;
    const words = inv.name.toLowerCase().split(/\s+/);
    words.forEach(w => {
      if (w.length > 2 && bq.product_name.toLowerCase().includes(w)) score++;
    });
    if (score > bestScore) {
      bestScore = score;
      bestBq = bq;
    }
  });

  cruce.push({
    folio: inv.folio,
    cod_fac: inv.cod,
    nmb_fac: inv.name,
    q_fac: inv.qty,
    p_fac: inv.prc,
    m_fac: inv.monto,
    sku_bq: bestBq ? bestBq.sku_id : 'NO_MATCH',
    nmb_bq: bestBq ? bestBq.product_name : '',
    q_ord: bestBq ? parseFloat(bestBq.quantity_ordered) : 0,
    q_rec: bestBq ? parseFloat(bestBq.quantity_delivered) : 0,
    c_bq: bestBq ? parseFloat(bestBq.unit_cost) : 0,
    tot_rec_bq: bestBq ? parseFloat(bestBq.amt_delivered) : 0
  });
});

console.table(cruce.map(c => ({
  fac: c.folio,
  cod: c.cod_fac,
  nmb: c.nmb_fac.substring(0, 25),
  qFac: c.q_fac,
  pFac: c.p_fac,
  mFac: c.m_fac,
  sku: c.sku_bq,
  qOrd: c.q_ord,
  qRec: c.q_rec,
  cBQ: c.c_bq
})));

// Check BQ items not in invoices
const matchedSkus = new Set(cruce.map(c => c.sku_bq));
const missingInFac = bqItems.filter(b => !matchedSkus.has(b.sku_id));
console.log('\n--- ÍTEMS EN BQ NO FACTURADOS ---');
console.table(missingInFac.map(b => ({
  sku: b.sku_id,
  name: b.product_name,
  qOrd: b.quantity_ordered,
  qDel: b.quantity_delivered,
  cost: b.unit_cost,
  amtOrd: b.amt_ordered,
  amtDel: b.amt_delivered
})));
