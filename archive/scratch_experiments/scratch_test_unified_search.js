const { testSearchAxteroidDocs, callAxteroidApi } = require('./scratch_test_search_backend.js');

async function testCases() {
  console.log('=== TEST 1: PO 521534 ===');
  const r1 = await testSearchAxteroidDocs({ order_reference: '0000521534', raw_number: '521534' });
  console.log('PO 521534 Count:', r1.results ? r1.results.length : 0);

  console.log('=== TEST 2: Direct Folio 105275609 ===');
  const r2 = await testSearchAxteroidDocs({ serial: '105275609' });
  console.log('Folio 105275609 Count:', r2.results ? r2.results.length : 0);
  if (r2.results && r2.results[0]) {
    console.log('  Found folio:', r2.results[0].serial, 'PO Ref:', r2.results[0].order_reference);
  }

  console.log('=== TEST 3: Supplier RUT 93281000-K (Embonor) ===');
  const r3 = await testSearchAxteroidDocs({ tax_id: '93281000-K' });
  console.log('Embonor Count:', r3.results ? r3.results.length : 0);
  if (r3.results && r3.results[0]) {
    console.log('  Found invoice:', r3.results[0].serial, 'Supplier:', r3.results[0].supplier_name);
  }

  console.log('=== TEST 4: Carozzi PO 517979 ===');
  const r4 = await testSearchAxteroidDocs({ order_reference: '0000517979', raw_number: '517979' });
  console.log('Carozzi PO 517979 Count:', r4.results ? r4.results.length : 0);
  if (r4.results && r4.results[0]) {
    console.log('  Found invoice:', r4.results[0].serial, 'PO Ref:', r4.results[0].order_reference);
  }
}

testCases().catch(console.error);
