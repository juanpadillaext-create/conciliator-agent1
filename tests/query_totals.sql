SELECT 
  po.po_order_id,
  po.warehouse.warehouse_name,
  po.supplier_name,
  COUNT(p.sku_id) as total_skus,
  SUM(CAST(p.quantity_ordered AS INT64)) as total_qty_ordered,
  SUM(CAST(p.quantity_delivered AS INT64)) as total_qty_delivered,
  SUM(p.item_values_lc.amt_ordered_lc) as total_amt_ordered,
  SUM(p.item_values_lc.amt_delivered_lc) as total_amt_delivered
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.country_code = 'cl'
  AND po.created_localtime_at >= '2024-01-01'
  AND po.po_order_id = 'PO519527'
GROUP BY 1, 2, 3;
