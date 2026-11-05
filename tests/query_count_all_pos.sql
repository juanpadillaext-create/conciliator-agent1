SELECT 
  COUNT(*) as total_pos, 
  COUNT(DISTINCT po_order_id) as distinct_pos,
  SUM(order_values_lc.amt_ordered_lc) as total_ordered,
  SUM(order_values_lc.amt_delivered_lc) as total_delivered
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` 
WHERE created_localtime_at >= '2026-08-01' 
  AND country_code = 'cl'
