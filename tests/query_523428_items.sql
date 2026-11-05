SELECT 
  p.sku_id,
  p.product_name,
  p.quantity_ordered,
  p.quantity_delivered,
  (p.quantity_ordered - p.quantity_delivered) as diff_qty,
  p.item_values_lc.unit_cost_lc as cost_unit_lc,
  p.item_values_lc.amt_ordered_lc as amt_ordered_lc,
  p.item_values_lc.amt_delivered_lc as amt_delivered_lc,
  (p.item_values_lc.amt_ordered_lc - p.item_values_lc.amt_delivered_lc) as dif_amt_lc
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.created_localtime_at >= '2026-09-01'
  AND po.po_order_id = 'PO523428'
ORDER BY dif_amt_lc DESC
