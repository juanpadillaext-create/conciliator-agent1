SELECT 
  po.po_order_id,
  ANY_VALUE(po.supplier_id) as supplier_id,
  ANY_VALUE(po.supplier_name) as supplier_name,
  ANY_VALUE(po.warehouse.warehouse_name) as warehouse_name,
  ANY_VALUE(po.order_status) as order_status,
  SUBSTR(CAST(MAX(po.created_localtime_at) AS STRING), 1, 10) as created_date,
  SUBSTR(CAST(MAX(po.received_localtime_at) AS STRING), 1, 10) as received_date,
  COUNT(p.sku_id) as items_count,
  ROUND(SUM(p.item_values_lc.amt_ordered_lc), 0) as total_ordenado_neto,
  ROUND(SUM(p.item_values_lc.amt_delivered_lc), 0) as total_recepcionado_neto
FROM peya-data-origins-pro.cl_dmarts.purchase_orders po,
UNNEST(po.products_purchased) p
WHERE po.country_code = 'cl'
  AND po.created_localtime_at >= '2026-08-01'
GROUP BY po.po_order_id
ORDER BY created_date DESC
LIMIT 1000