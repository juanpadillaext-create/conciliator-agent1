SELECT 
  purchase_order_id, 
  supplier_name, 
  warehouse_name, 
  order_status, 
  total_amount, 
  total_delivered_amount, 
  total_invoiced_amount 
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` 
WHERE purchase_order_id LIKE '%526132%' 
LIMIT 10;
