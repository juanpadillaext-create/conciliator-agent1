SELECT 
  p.sku_id,
  p.product_name,
  ARRAY_TO_STRING(ARRAY(SELECT barcode FROM UNNEST(p.product.barcodes)), ', ') as barcodes_str
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.country_code = 'cl'
  AND po.created_localtime_at >= '2024-01-01'
  AND po.po_order_id = 'PO519527'
LIMIT 50;
