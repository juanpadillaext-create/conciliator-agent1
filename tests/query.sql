SELECT 
  po.po_order_id,
  po.warehouse.warehouse_name,
  po.supplier_name,
  po.supplier_id,
  po.order_status,
  po.created_localtime_at,
  po.received_localtime_at,
  p.sku_id,
  p.product_name,
  p.quantity_ordered,
  p.quantity_delivered,
  p.item_values_lc.unit_cost_lc as cost_unit_lc,
  p.item_values_lc.amt_ordered_lc as amt_ordered_lc,
  p.item_values_lc.amt_delivered_lc as amt_delivered_lc
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.country_code = 'cl'
  AND po.created_localtime_at >= '2024-01-01'
  AND (po.po_order_id LIKE '%519527%' OR po.po_order_id = '519527' OR po.po_order_id = 'PO519527')
LIMIT 100;
