SELECT 
  po.po_order_id, 
  po.warehouse.warehouse_name, 
  po.supplier_name, 
  po.order_status, 
  po.created_localtime_at, 
  COUNT(p.sku_id) as total_skus, 
  ROUND(SUM(p.item_values_lc.amt_ordered_lc), 0) as total_amt_ordered, 
  ROUND(SUM(p.item_values_lc.amt_delivered_lc), 0) as total_amt_delivered 
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po, 
UNNEST(po.products_purchased) as p 
WHERE po.country_code = 'cl' 
  AND po.created_localtime_at >= '2026-01-01'
  AND (po.po_order_id LIKE '%524332%' OR po.po_order_id LIKE '%524331%') 
GROUP BY 1, 2, 3, 4, 5;
