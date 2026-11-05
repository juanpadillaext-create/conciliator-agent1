SELECT 
  po.po_order_id,
  po.supplier_id,
  po.supplier_name,
  po.warehouse_id,
  po.warehouse.warehouse_name,
  po.created_localtime_at,
  po.order_status,
  po.invoice_number_value.invoice_number_1 as inv_num_1,
  po.invoice_number_value.invoice_number_2 as inv_num_2,
  po.invoice_number_value.invoice_number_3 as inv_num_3,
  p.sku_id,
  p.product_name,
  p.quantity_ordered,
  p.quantity_delivered,
  p.item_values_lc.unit_cost_lc as unit_cost,
  p.item_values_lc.amt_ordered_lc as amt_ordered,
  p.item_values_lc.amt_delivered_lc as amt_delivered
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.po_order_id LIKE '%524064%'
  AND po.country_code = 'cl'
  AND po.created_localtime_at >= '2026-01-01'
