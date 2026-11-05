SELECT 
  po_order_id, 
  supplier_id, 
  supplier_name, 
  order_status, 
  created_localtime_at, 
  order_values_lc.amt_ordered_lc, 
  order_values_lc.amt_delivered_lc, 
  order_values_lc.amt_discount_lc,
  invoice_number_value 
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` 
WHERE po_order_id = 'PO526132' 
  AND created_localtime_at >= '2024-01-01' 
LIMIT 5;
