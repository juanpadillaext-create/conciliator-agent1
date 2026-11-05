SELECT 
  purchase_order_id,
  store_name,
  sku,
  product_name,
  ordered_items,
  delivered_items,
  putaway_items_initial,
  putaway_items_on_shelf,
  missing_items_approved
FROM `peya-data-origins-pro.cl_dmarts.dmart_ops_st_po_receiving_putaway_sku_details`
WHERE purchase_order_id = 'PO526132'
LIMIT 20;
