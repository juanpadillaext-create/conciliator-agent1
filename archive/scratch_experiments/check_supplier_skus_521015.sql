SELECT 
  ps.sku,
  s.supplier_id,
  s.supplier_name,
  s.supplier_sku
FROM `peya-data-origins-pro.cl_dmarts.products_suppliers` ps,
UNNEST(ps.suppliers) as s
WHERE ps.country_code = 'cl'
  AND s.supplier_id = 50
  AND ps.sku IN (
    SELECT DISTINCT p.sku_id
    FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
    UNNEST(po.products_purchased) p
    WHERE po.created_localtime_at >= '2025-01-01'
      AND po.po_order_id = 'PO521015'
  )
LIMIT 20;
