SELECT 
  po.po_order_id,
  po.warehouse.warehouse_name,
  po.supplier_id,
  po.supplier_name,
  p.sku_id,
  p.product_name,
  p.quantity_ordered,
  p.quantity_delivered,
  p.item_values_lc.unit_cost_lc as cost_unit_lc,
  p.item_values_lc.amt_ordered_lc as amt_ordered_lc,
  p.item_values_lc.amt_delivered_lc as amt_delivered_lc,
  ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(p.product.barcodes)), ', ') as barcodes_str
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.created_localtime_at >= '2024-01-01'
  AND po.country_code = 'cl'
  AND (po.po_order_id = 'PO524726' OR po.po_order_id = '524726')
ORDER BY p.sku_id;
