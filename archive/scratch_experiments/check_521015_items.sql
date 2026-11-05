SELECT 
  p.sku_id,
  p.product_name,
  p.quantity_ordered,
  p.quantity_delivered,
  p.item_values_lc.unit_cost_lc as cost_unit_lc,
  p.item_values_lc.amt_ordered_lc as amt_ordered_lc,
  p.item_values_lc.amt_delivered_lc as amt_delivered_lc,
  (p.item_values_lc.amt_ordered_lc - p.item_values_lc.amt_delivered_lc) as diff_ordered_delivered,
  p.quantity_ordered - p.quantity_delivered as diff_qty
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.created_localtime_at >= '2025-01-01'
  AND po.country_code = 'cl'
  AND po.po_order_id = 'PO521015'
ORDER BY diff_ordered_delivered DESC;
