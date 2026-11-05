SELECT 
  po.po_order_id,
  po.warehouse.warehouse_name,
  po.supplier_id,
  po.supplier_name,
  po.order_status,
  po.created_localtime_at,
  po.received_localtime_at,
  po.invoice_number_value.invoice_number_1 as inv_num_1,
  po.invoice_number_value.invoice_number_2 as inv_num_2,
  po.invoice_number_value.invoice_number_3 as inv_num_3,
  COUNT(p.sku_id) as total_skus,
  ROUND(SUM(p.quantity_ordered), 2) as total_qty_ordered,
  ROUND(SUM(p.quantity_delivered), 2) as total_qty_delivered,
  ROUND(SUM(p.item_values_lc.amt_ordered_lc), 0) as total_amt_ordered,
  ROUND(SUM(p.item_values_lc.amt_delivered_lc), 0) as total_amt_delivered
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.created_localtime_at >= '2024-01-01'
  AND po.country_code = 'cl'
  AND (po.po_order_id LIKE '%524726%' OR po.po_order_id = 'PO524726' OR po.po_order_id = '524726')
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10;
