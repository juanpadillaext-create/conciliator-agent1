const fs = require('fs');

const facs = JSON.parse(fs.readFileSync('po521534_facturas_con_items.json', 'utf8'));
const bqItems = JSON.parse(fs.readFileSync('po521534_bq_items.json', 'utf8'));

const facMap = {};
facs.forEach(f => {
  facMap[f.serial] = {
    items: f.items.map(it => ({
      linea: it.line,
      codigo: it.codigo,
      ean: it.codigo,
      descripcion: it.nombre,
      cantidad_facturada: it.cantidad,
      unidad_medida: 'UN',
      precio_facturado: it.precio,
      monto_facturado: it.total_neto
    })),
    po_items: []
  };
});

const auditObj = {
  po_order_id: 'PO521534',
  warehouse_name: 'CH_8_Vina del Mar',
  supplier_name: 'Coca-Cola Embonor S.A. (Bebestibles)',
  supplier_tax_id: '93281000-K',
  category_manager: 'Javiera Rogers',
  condicion_aforo: 'NO AFORADO POR SOLICITUD DE COMERCIAL',
  order_status: 'RECEPCION_CERRADA',
  total_ordenado_neto: 2433481,
  total_recepcionado_neto: 1827308,
  total_facturado_neto: 2387107,
  total_facturado_con_iva: 2840657,
  total_monto_reclamar_nc: 559799,
  total_facturas: 10,
  facturas: facMap,
  all_po_items: bqItems.map(it => ({
    sku_id: it.sku_id,
    supplier_sku: it.sku_id,
    barcodes: (it.barcodes_str || '').split(',').map(s => s.trim()).filter(Boolean),
    product_name: it.product_name,
    quantity_ordered: parseInt(it.quantity_ordered) || 0,
    quantity_delivered: parseInt(it.quantity_delivered) || 0,
    cost_unit_lc: parseFloat(it.cost_unit_lc) || 0,
    amt_ordered_lc: parseFloat(it.amt_ordered_lc) || 0,
    amt_delivered_lc: parseFloat(it.amt_delivered_lc) || 0,
    diff_qty: (parseInt(it.quantity_ordered) || 0) - (parseInt(it.quantity_delivered) || 0),
    diff_ordered_delivered: (parseFloat(it.amt_ordered_lc) || 0) - (parseFloat(it.amt_delivered_lc) || 0)
  }))
};

fs.writeFileSync('po521534_audit_block.json', JSON.stringify(auditObj));
console.log('Generated po521534_audit_block.json successfully!');
