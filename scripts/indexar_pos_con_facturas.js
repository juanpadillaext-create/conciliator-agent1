/**
 * scripts/indexar_pos_con_facturas.js
 * Extractor e Indexador Masivo de Órdenes de Compra vinculadas a sus Facturas Respectivas.
 * Cruza BigQuery (peya-data-origins-pro.cl_dmarts.purchase_orders) con Axteroid REST API (/rec-docs).
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MASTER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE4MTI4MDE2MDAsImlhdCI6MTc4MTI5NjY2OSwianRpIjoiTnZNOXI2TnlrSGlaOEtlN0VlY1VYZyIsInVzZXJfaWQiOjMzLCJjb20uYXh0ZXJvaWQuaXNfc3RhZmYiOmZhbHNlLCJjb20uYXh0ZXJvaWQud29ya3NwYWNlcyI6eyJhY2NfOFJGQXVKMTBqY0tKZkRrR2Q1IjoiNzYyMTE0MjUtOSIsImFjY195WnZVSzFBdzZ5NVRBVkxEM1kiOiI3NzEyNTM2MS1LIn0sImNvbS5heHRlcm9pZC5hbGxvd2VkX2ludGVydmFsIjoyMDB9.Bc7F7Iw-LJzOFq_9lEgwwo_yn3QuMiUuxTl281UxobE';
const WS = 'acc_yZvUK1Aw6y5TAVLD3Y';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizarBaseDigits(str) {
  if (!str) return '';
  const clean = String(str).trim().toUpperCase();
  const m = clean.match(/(?:PO|OC|0+)?([3-58]\d{5})/);
  if (m) return m[1];
  return clean.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
}

function fetchAxteroidPage(page) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'services.axteroid.com',
      path: '/rec-docs?page_size=100&page=' + page,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + MASTER_TOKEN,
        'x-ax-workspace': WS,
        'Accept': 'application/json'
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('================================================================');
  console.log('🚀 INICIANDO INDEXACIÓN UNIVERSAL DE POs CON SUS FACTURAS');
  console.log('================================================================\n');

  // 1. Cargar Órdenes de Compra de BigQuery
  console.log('📊 1. Cargando Órdenes de Compra desde tests/bq_all_pos.json...');
  let bqPos = [];
  try {
    const raw = fs.readFileSync('tests/bq_all_pos.json', 'utf8').replace(/^\uFEFF/, '');
    bqPos = JSON.parse(raw);
    console.log(`✅ ${bqPos.length} Órdenes de Compra cargadas desde BigQuery.\n`);
  } catch (e) {
    console.error('❌ Error leyendo tests/bq_all_pos.json:', e.message);
  }

  // Mapa de POs de BigQuery indexadas por baseDigits
  const bqMap = new Map();
  bqPos.forEach(po => {
    const base = normalizarBaseDigits(po.po_order_id);
    if (base) {
      bqMap.set(base, {
        po_number: po.po_order_id.startsWith('PO') ? po.po_order_id : 'PO' + base,
        base_digits: base,
        supplier_name: po.supplier_name,
        supplier_id: po.supplier_id,
        warehouse_name: po.warehouse_name || 'CH_36_CD_Chile',
        order_status: po.order_status,
        created_date: po.created_date,
        received_date: po.received_date,
        items_count: Number(po.items_count || 0),
        total_ordenado_neto: Number(po.total_ordenado_neto || 0),
        total_recepcionado_neto: Number(po.total_recepcionado_neto || 0),
        facturas: []
      });
    }
  });

  // 2. Descargar documentos recibidos desde Axteroid
  console.log('📄 2. Descargando documentos desde Axteroid REST API (/rec-docs)...');
  const axInvoicesMap = new Map(); // baseDigits -> [invoices]
  const MAX_PAGES = 30; // 3000 documentos recibidos
  let totalDocsRecuperados = 0;

  for (let p = 1; p <= MAX_PAGES; p++) {
    process.stdout.write(`   Descargando página ${p}/${MAX_PAGES}... `);
    const res = await fetchAxteroidPage(p);
    if (!res || !res.results || res.results.length === 0) {
      console.log('Fin de datos.');
      break;
    }
    totalDocsRecuperados += res.results.length;
    console.log(`OK (${res.results.length} docs)`);

    res.results.forEach(d => {
      let refStr = d.order_reference;
      if (!refStr && d.references && d.references.length > 0) {
        for (let r of d.references) {
          if (r.number || r.serial) {
            refStr = r.number || r.serial;
            break;
          }
        }
      }

      if (!refStr) return;
      const baseDigits = normalizarBaseDigits(refStr);
      if (!baseDigits || baseDigits.length < 5) return;

      if (!axInvoicesMap.has(baseDigits)) {
        axInvoicesMap.set(baseDigits, []);
      }

      // Evitar duplicados por id o serial
      const list = axInvoicesMap.get(baseDigits);
      if (!list.some(x => String(x.serial) === String(d.serial))) {
        list.push({
          folio: String(d.serial),
          type: d.type || 'CL33',
          supplier_name: d.supplier_name,
          supplier_tax_id: d.supplier_tax_id || d.tax_id || '-',
          date: (d.date || '').slice(0, 10),
          monto_neto: Number(d.amount_net || 0),
          monto_total: Number(d.amount_total || 0),
          id: d.id,
          order_reference: refStr
        });
      }
    });

    await sleep(210); // Respetar rate-limit de Axteroid (~200ms)
  }

  console.log(`\n✅ Se procesaron ${totalDocsRecuperados} documentos de Axteroid.`);
  console.log(`   Se identificaron ${axInvoicesMap.size} órdenes de compra distintas con facturas.\n`);

  // 3. Cruzar POs con sus Facturas Respectivas
  console.log('🔗 3. Vinculando Órdenes de Compra con sus Facturas Respectivas...');
  const indexResult = [];
  const processedBqBases = new Set();

  // A. Primero, procesar todas las POs de BigQuery que tienen facturas en Axteroid
  bqMap.forEach((poInfo, baseDigits) => {
    processedBqBases.add(baseDigits);
    const facturas = axInvoicesMap.get(baseDigits) || [];

    const sortedFacs = [...facturas].sort((a, b) => parseInt(a.folio) - parseInt(b.folio));
    const totalFacturadoNeto = sortedFacs.reduce((s, f) => s + f.monto_neto, 0);
    const totalFacturadoTotal = sortedFacs.reduce((s, f) => s + f.monto_total, 0);

    const recNeto = poInfo.total_recepcionado_neto > 0 ? poInfo.total_recepcionado_neto : poInfo.total_ordenado_neto;
    const difPreliminar = totalFacturadoNeto > 0 ? (totalFacturadoNeto - recNeto) : 0;

    indexResult.push({
      po_number: poInfo.po_number,
      base_digits: baseDigits,
      supplier_name: poInfo.supplier_name,
      supplier_tax_id: sortedFacs[0] ? sortedFacs[0].supplier_tax_id : '-',
      warehouse_name: poInfo.warehouse_name,
      order_status: poInfo.order_status,
      created_date: poInfo.created_date,
      received_date: poInfo.received_date,
      total_ordenado_neto: poInfo.total_ordenado_neto,
      total_recepcionado_neto: poInfo.total_recepcionado_neto,
      total_facturado_neto: totalFacturadoNeto,
      total_facturado_total: totalFacturadoTotal,
      diferencia_preliminar: difPreliminar,
      total_facturas: sortedFacs.length,
      facturas: sortedFacs
    });
  });

  // B. Luego, agregar las POs de Axteroid que tenían facturas pero no estaban en el lote BQ
  axInvoicesMap.forEach((facturas, baseDigits) => {
    if (processedBqBases.has(baseDigits)) return;

    const first = facturas[0];
    const sortedFacs = [...facturas].sort((a, b) => parseInt(a.folio) - parseInt(b.folio));
    const totalFacturadoNeto = sortedFacs.reduce((s, f) => s + f.monto_neto, 0);
    const totalFacturadoTotal = sortedFacs.reduce((s, f) => s + f.monto_total, 0);

    indexResult.push({
      po_number: 'PO' + baseDigits,
      base_digits: baseDigits,
      supplier_name: first.supplier_name,
      supplier_tax_id: first.supplier_tax_id,
      warehouse_name: 'CH_36_CD_Chile (Sociedad 6202)',
      order_status: 'done',
      created_date: first.date,
      received_date: first.date,
      total_ordenado_neto: totalFacturadoNeto,
      total_recepcionado_neto: totalFacturadoNeto,
      total_facturado_neto: totalFacturadoNeto,
      total_facturado_total: totalFacturadoTotal,
      diferencia_preliminar: 0,
      total_facturas: sortedFacs.length,
      facturas: sortedFacs
    });
  });

  // Ordenar el índice por número de facturas (descendente) y por PO
  indexResult.sort((a, b) => {
    if (b.total_facturas !== a.total_facturas) return b.total_facturas - a.total_facturas;
    return parseInt(b.base_digits) - parseInt(a.base_digits);
  });

  console.log(`🎉 Total Órdenes de Compra INDEXADAS: ${indexResult.length}`);
  const conFacturas = indexResult.filter(p => p.total_facturas > 0);
  console.log(`   Órdenes de Compra con Facturas Vinculadas: ${conFacturas.length}`);
  console.log(`\nTop 10 POs con mayor volumen de facturas vinculadas:`);
  conFacturas.slice(0, 10).forEach((po, i) => {
    console.log(`   ${i + 1}. ${po.po_number} | ${po.total_facturas} Facturas | ${po.supplier_name} | Almacén: ${po.warehouse_name} | Facturado: $${po.total_facturado_neto.toLocaleString('es-CL')}`);
  });

  // Guardar archivo maestro JSON para inspección
  fs.writeFileSync('tests/indice_completo_pos_facturas.json', JSON.stringify(indexResult, null, 2), 'utf8');
  console.log('\n💾 Guardado tests/indice_completo_pos_facturas.json');

  // 4. Generar el archivo GAS IndicePoFacturas.gs
  // Para evitar que el archivo .gs sea excesivamente pesado en GAS,
  // guardamos todas las POs que tienen facturas + las top de BQ
  const posParaGs = indexResult.filter(p => p.total_facturas > 0 || p.total_ordenado_neto > 500000);
  console.log(`📝 Exportando ${posParaGs.length} POs clave a apps-script-webapp/IndicePoFacturas.gs...`);

  const gsContent = `/**
 * IndicePoFacturas.gs
 * Módulo de Índice Universal de Órdenes de Compra y sus Facturas Respectivas.
 * Delivery Hero Stores Chile SpA (Sociedad SAP 6202) / Dmarts Chile.
 * Generado automáticamente cruzando BigQuery y Axteroid REST API.
 */

const INDICE_MAESTRO_POS_FACTURAS = ${JSON.stringify(posParaGs, null, 2)};

/**
 * RPC: Consulta el catálogo completo de Órdenes de Compra indexadas con sus facturas.
 * @param {Object} filtros { busqueda, proveedor, almacen, solo_diferencias, solo_con_facturas, page, limit }
 */
function apiGetIndexedPoList(filtros) {
  try {
    filtros = filtros || {};
    let lista = [...INDICE_MAESTRO_POS_FACTURAS];

    // 1. Filtro por término libre (PO, Folio, Proveedor, RUT)
    if (filtros.busqueda) {
      const q = String(filtros.busqueda).toUpperCase().trim();
      const rawDigits = q.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');
      lista = lista.filter(po => {
        const matchPo = po.po_number.toUpperCase().includes(q) || (rawDigits && po.base_digits.includes(rawDigits));
        const matchProv = (po.supplier_name || '').toUpperCase().includes(q);
        const matchRut = (po.supplier_tax_id || '').toUpperCase().includes(q);
        const matchWh = (po.warehouse_name || '').toUpperCase().includes(q);
        const matchFac = (po.facturas || []).some(f => f.folio.includes(q) || (rawDigits && f.folio.includes(rawDigits)));
        return matchPo || matchProv || matchRut || matchWh || matchFac;
      });
    }

    // 2. Filtro por proveedor
    if (filtros.proveedor) {
      const p = String(filtros.proveedor).toUpperCase().trim();
      lista = lista.filter(po => (po.supplier_name || '').toUpperCase().includes(p));
    }

    // 3. Filtro por almacén
    if (filtros.almacen) {
      const w = String(filtros.almacen).toUpperCase().trim();
      lista = lista.filter(po => (po.warehouse_name || '').toUpperCase().includes(w));
    }

    // 4. Filtro solo con facturas
    if (filtros.solo_con_facturas) {
      lista = lista.filter(po => po.total_facturas > 0);
    }

    // 5. Filtro solo discrepancias
    if (filtros.solo_diferencias) {
      lista = lista.filter(po => Math.abs(po.diferencia_preliminar) > 100);
    }

    const page = parseInt(filtros.page) || 1;
    const limit = parseInt(filtros.limit) || 25;
    const totalCount = lista.length;
    const startIndex = (page - 1) * limit;
    const paginated = lista.slice(startIndex, startIndex + limit);

    return {
      success: true,
      total_pos: totalCount,
      page: page,
      limit: limit,
      total_pages: Math.ceil(totalCount / limit),
      pos: paginated
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * RPC: Obtiene una Orden de Compra indexada con todas sus facturas por número o folio.
 */
function apiGetIndexedPoDetail(poNumber) {
  try {
    if (!poNumber) return { success: false, error: 'Número de PO requerido.' };
    const raw = String(poNumber).toUpperCase().trim();
    const digits = raw.replace(/^PO/i, '').replace(/^OC/i, '').replace(/^0+/, '');

    const found = INDICE_MAESTRO_POS_FACTURAS.find(p => 
      p.po_number.toUpperCase() === raw || 
      p.base_digits === digits ||
      (p.facturas || []).some(f => f.folio === raw || f.folio === digits)
    );

    if (found) {
      return { success: true, po: found };
    }

    return { success: false, error: 'Orden de Compra no encontrada en el índice.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
`;

  fs.writeFileSync('apps-script-webapp/IndicePoFacturas.gs', gsContent, 'utf8');
  console.log('💾 Guardado apps-script-webapp/IndicePoFacturas.gs con éxito.');
}

run().catch(console.error);
