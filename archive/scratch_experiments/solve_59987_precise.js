const fs = require('fs');

const numbers = {
  bq_ord: 526093.56,
  bq_ord_round: 526094,
  bq_rec: 495201.56,
  bq_rec_round: 495202,
  bq_descalce: 30892,
  peroni_missing: 28608,
  mrbig_missing: 2284,
  
  f1_neto: 477667,
  f1_tot: 660358,
  f1_lines: 406987,
  f1_recargo: 70680,

  f2_neto: 59830,
  f2_tot: 80659,
  f2_lines: 46150,
  f2_recargo: 13680,

  nc_neto: 2067,
  nc_tot: 2591,
  nc_lines: 1307,
  nc_recargo: 760,

  tot_fac_bruto_neto: 537497,
  tot_fac_bruto_tot: 741017,
  tot_fac_neteado_neto: 535430,
  tot_fac_neteado_tot: 738426,

  lines_sum: 453137,
  recargos_sum: 84360,

  // Differences
  dif_bruto_rec: 42295,
  dif_neto_rec: 40228,
  dif_f1_rec: 37588,
  dif_f2_rec: 4707
};

const TARGET = 59987;
console.log('Searching for TARGET:', TARGET);

const entries = Object.entries(numbers);

// 1. Two terms (+, -)
for (let i = 0; i < entries.length; i++) {
  for (let j = 0; j < entries.length; j++) {
    const [k1, v1] = entries[i];
    const [k2, v2] = entries[j];
    if (Math.abs(v1 - v2 - TARGET) < 2) console.log(`MATCH 2: ${k1} (${v1}) - ${k2} (${v2}) = ${v1 - v2}`);
    if (Math.abs(v1 + v2 - TARGET) < 2) console.log(`MATCH 2: ${k1} (${v1}) + ${k2} (${v2}) = ${v1 + v2}`);
  }
}

// 2. Three terms
for (let i = 0; i < entries.length; i++) {
  for (let j = 0; j < entries.length; j++) {
    for (let k = 0; k < entries.length; k++) {
      const [k1, v1] = entries[i];
      const [k2, v2] = entries[j];
      const [k3, v3] = entries[k];
      if (Math.abs(v1 + v2 - v3 - TARGET) < 2) console.log(`MATCH 3: ${k1} + ${k2} - ${k3} = ${v1 + v2 - v3}`);
      if (Math.abs(v1 - v2 - v3 - TARGET) < 2) console.log(`MATCH 3: ${k1} - ${k2} - ${k3} = ${v1 - v2 - v3}`);
    }
  }
}

// 3. What if TARGET is with IVA? 59987 / 1.19 = 50409.24
console.log('59987 / 1.19 =', TARGET / 1.19);
console.log('59987 * 1.19 =', TARGET * 1.19);

// 4. What about items?
const bqItems = JSON.parse(fs.readFileSync('scratch/po524064_items.json', 'utf8'));
bqItems.forEach(b => {
  const ord = parseFloat(b.amt_ordered);
  const del = parseFloat(b.amt_delivered);
  const diff = ord - del;
  if (Math.abs(ord - TARGET) < 50) console.log('BQ item ord close:', b.product_name, ord);
  if (Math.abs(del - TARGET) < 50) console.log('BQ item del close:', b.product_name, del);
  // pairs with TARGET
  for (let [k, v] of entries) {
    if (Math.abs(v - ord - TARGET) < 2) console.log(`MATCH BQ: ${k} (${v}) - ord(${b.product_name}: ${ord}) = ${v - ord}`);
    if (Math.abs(v - del - TARGET) < 2) console.log(`MATCH BQ: ${k} (${v}) - del(${b.product_name}: ${del}) = ${v - del}`);
    if (Math.abs(v + ord - TARGET) < 2) console.log(`MATCH BQ: ${k} (${v}) + ord(${b.product_name}: ${ord}) = ${v + ord}`);
    if (Math.abs(v + del - TARGET) < 2) console.log(`MATCH BQ: ${k} (${v}) + del(${b.product_name}: ${del}) = ${v + del}`);
    if (Math.abs(v - diff - TARGET) < 2) console.log(`MATCH BQ diff: ${k} (${v}) - diff(${b.product_name}: ${diff}) = ${v - diff}`);
    if (Math.abs(v + diff - TARGET) < 2) console.log(`MATCH BQ diff: ${k} (${v}) + diff(${b.product_name}: ${diff}) = ${v + diff}`);
  }
});
