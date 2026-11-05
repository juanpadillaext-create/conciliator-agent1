SELECT 
  po_order_id, 
  supplier_name,
  warehouse.warehouse_name,
  order_status,
  CAST(created_localtime_at AS STRING) as created_date,
  CAST(received_localtime_at AS STRING) as received_date,
  ROUND(CAST(order_values_lc.amt_ordered_lc AS FLOAT64), 0) as total_ordenado_neto,
  ROUND(CAST(order_values_lc.amt_delivered_lc AS FLOAT64), 0) as total_recepcionado_neto
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders`
WHERE created_localtime_at >= '2026-08-01'
  AND country_code = 'cl'
