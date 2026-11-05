const fs = require('fs');

function normalizarTextoBase(t) {
  if (!t) return '';
  return t.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d+)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d+)/g, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerPesoVolumen(t) {
  if (!t) return null;
  const s = normalizarTextoBase(t);
  
  // Peso en gramos / kg
  const mKg = s.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/);
  if (mKg) return { tipo: 'peso', valor: Math.round(parseFloat(mKg[1]) * 1000) };

  const mGr = s.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|grs|gramos?)/);
  if (mGr) return { tipo: 'peso', valor: Math.round(parseFloat(mGr[1])) };

  // Volumen en cc / ml / l
  const mLt = s.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|lts|litros?)/);
  if (mLt) return { tipo: 'volumen', valor: Math.round(parseFloat(mLt[1]) * 1000) };

  const mCc = s.match(/(\d+(?:\.\d+)?)\s*(?:cc|ml)/);
  if (mCc) return { tipo: 'volumen', valor: Math.round(parseFloat(mCc[1])) };

  return null;
}

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'en', 'con', 'sin', 'un', 'una', 'x', 'para',
  'por', 'bolsa', 'bol', 'flow', 'bar', 'pack', 'uni', 'unidades', 'piezas', 'p',
  'id', 'ch', 'adp', 'fuc', 'mla', 'nur', 'me', 'd', 's', 'a', 'g', 'gr', 'ml', 'cc'
]);

function tokenizar(t) {
  const norm = normalizarTextoBase(t);
  return norm.split(' ').filter(tok => tok.length >= 2 && !STOPWORDS.has(tok));
}

function scoreNLP(t1, t2) {
  const p1 = extraerPesoVolumen(t1);
  const p2 = extraerPesoVolumen(t2);

  // Si ambos especifican peso/volumen y difieren significativamente, penalizar
  if (p1 && p2 && p1.tipo === p2.tipo) {
    if (Math.abs(p1.valor - p2.valor) > 20) return 0;
  }

  const tok1 = new Set(tokenizar(t1));
  const tok2 = new Set(tokenizar(t2));

  let inter = 0;
  tok1.forEach(k => {
    if (tok2.has(k)) inter++;
  });

  const union = tok1.size + tok2.size - inter;
  if (union === 0) return 0;

  let base = inter / union;

  // Bonus si coinciden peso/volumen
  if (p1 && p2 && p1.tipo === p2.tipo && Math.abs(p1.valor - p2.valor) <= 20) {
    base += 0.25;
  }

  return base;
}

// Test on the 27 lines
const xml = fs.readFileSync('tests/factura_56458220.xml', 'utf8');
const invItems = [];
const detRegex = /<Detalle>([\s\S]*?)<\/Detalle>/g;
let m;
while ((m = detRegex.exec(xml)) !== null) {
  const b = m[1];
  const cdg = (b.match(/<VlrCodigo>([\s\S]*?)<\/VlrCodigo>/) || [])[1] || '';
  const nmb = (b.match(/<NmbItem>([\s\S]*?)<\/NmbItem>/) || [])[1] || '';
  const qty = parseFloat((b.match(/<QtyItem>([\s\S]*?)<\/QtyItem>/) || [])[1] || '0');
  const prc = parseFloat((b.match(/<PrcItem>([\s\S]*?)<\/PrcItem>/) || [])[1] || '0');
  const mnt = parseFloat((b.match(/<(?:MontoItem|MntItem)>([\s\S]*?)<\/(?:MontoItem|MntItem)>/) || [])[1] || '0');
  invItems.push({ cdg: cdg.trim(), nmb: nmb.trim(), qty, prc, mnt });
}

let bqRaw = fs.readFileSync('tests/query_po_bq.json');
let bqStr = bqRaw.toString('utf8');
if (bqStr.charCodeAt(0) === 0xFEFF || bqStr.startsWith('\u0000') || bqRaw[0] === 0xFF && bqRaw[1] === 0xFE) {
  bqStr = bqRaw.toString('utf16le').replace(/^\uFEFF/, '');
}
const poItems = JSON.parse(bqStr.trim());

let matchedNlpCount = 0;
const usedIndices = new Set();

invItems.forEach((inv, idx) => {
  let bestScore = 0;
  let bestPo = null;
  let bestIdx = -1;

  for (let i = 0; i < poItems.length; i++) {
    if (usedIndices.has(i)) continue;
    const po = poItems[i];
    
    // Barcode embedded check
    const barcodes = (po.barcodes_str || '').split(',').map(b => b.trim());
    const isBarcodeEmbedded = barcodes.some(b => b.includes(inv.cdg));

    let s = scoreNLP(inv.nmb, po.product_name);
    if (isBarcodeEmbedded && inv.cdg.length >= 4) {
      s = Math.max(s, 0.95);
    }

    // Candidate with exact same quantity delivered bonus
    if (parseInt(po.quantity_delivered || '0', 10) === inv.qty && s > 0.20) {
      s += 0.15;
    }

    if (s > bestScore) {
      bestScore = s;
      bestPo = po;
      bestIdx = i;
    }
  }

  if (bestScore >= 0.35 && bestIdx !== -1) {
    usedIndices.add(bestIdx);
    matchedNlpCount++;
    console.log(`[OK ${Math.round(bestScore*100)}%] "${inv.nmb}" -> "${bestPo.product_name}"`);
  } else {
    console.log(`[FAIL ${Math.round(bestScore*100)}%] "${inv.nmb}"`);
  }
});

console.log(`\nPure NLP/Enhanced Matched: ${matchedNlpCount} / ${invItems.length}`);
