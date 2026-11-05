
SELECT 
  po_order_id,
  supplier_name,
  quantity_ordered,
  quantity_delivered,
  COALESCE(quantity_ordered - quantity_delivered, 0) as diff_qty,
  order_values_lc.amt_ordered_lc,
  order_values_lc.amt_delivered_lc,
  ROUND(COALESCE(order_values_lc.amt_ordered_lc - order_values_lc.amt_delivered_lc, 0), 0) as descalce_monto_clp,
  created_localtime_at,
  warehouse_id
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders`
WHERE created_localtime_at >= '2026-08-01'
  AND country_code = 'cl'
  AND warehouse_id = 'cc5d044f-9995-47cc-a1fe-975a04117178'
  AND LOWER(supplier_name) LIKE '%carozzi%'
ORDER BY created_localtime_at DESC;
