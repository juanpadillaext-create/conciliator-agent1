SELECT 
  po_order_id, 
  supplier_name, 
  warehouse.warehouse_name, 
  order_values_lc.amt_ordered_lc, 
  order_values_lc.amt_delivered_lc, 
  (order_values_lc.amt_ordered_lc - order_values_lc.amt_delivered_lc) as dif_ml,
  quantity_ordered,
  quantity_delivered,
  invoice_number_value
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` 
WHERE created_localtime_at >= '2026-09-01' 
  AND po_order_id = 'PO523428'
