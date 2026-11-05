SELECT 
  p.sku_id as sku_id,
  p.product_name as product_name,
  p.quantity_ordered as quantity_ordered,
  p.quantity_delivered as quantity_delivered,
  ROUND(CAST(p.item_values_lc.unit_cost_lc AS FLOAT64), 2) as cost_unit_lc,
  ROUND(CAST(p.item_values_lc.amt_ordered_lc AS FLOAT64), 2) as amt_ordered_lc,
  ROUND(CAST(p.item_values_lc.amt_delivered_lc AS FLOAT64), 2) as amt_delivered_lc
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.created_localtime_at >= '2026-09-01'
  AND po.po_order_id = 'PO523428'
ORDER BY p.product_name ASC
