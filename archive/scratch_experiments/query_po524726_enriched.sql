WITH po_items AS (
  SELECT 
    po.po_order_id,
    po.warehouse_id,
    po.warehouse.warehouse_name,
    po.supplier_id,
    po.supplier_name,
    po.order_status,
    po.created_localtime_at,
    po.received_localtime_at,
    p.sku_id,
    p.product_name,
    p.quantity_ordered,
    p.quantity_delivered,
    p.item_values_lc.unit_cost_lc as cost_unit_lc,
    p.item_values_lc.amt_ordered_lc as amt_ordered_lc,
    p.item_values_lc.amt_delivered_lc as amt_delivered_lc,
    ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(p.product.barcodes)), ', ') as barcodes_str
  FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
  UNNEST(po.products_purchased) as p
  WHERE po.created_localtime_at >= '2024-01-01'
    AND po.country_code = 'cl'
    AND po.po_order_id = 'PO524726'
),
supplier_info AS (
  SELECT 
    ps.sku, 
    ANY_VALUE(s.supplier_sku) as supplier_sku,
    ANY_VALUE(s.supplier_tax_id) as supplier_tax_id
  FROM `peya-data-origins-pro.cl_dmarts.products_suppliers` ps,
  UNNEST(ps.suppliers) as s
  WHERE ps.country_code = 'cl' 
    AND ps.sku IN (SELECT DISTINCT sku_id FROM po_items)
  GROUP BY ps.sku
)
SELECT 
  poi.*,
  si.supplier_sku,
  si.supplier_tax_id
FROM po_items poi
LEFT JOIN supplier_info si ON poi.sku_id = si.sku
ORDER BY poi.product_name ASC;
