SELECT 
  ps.sku,
  s.supplier_sku,
  s.supplier_tax_id,
  s.supplier_name
FROM `peya-data-origins-pro.cl_dmarts.products_suppliers` ps,
UNNEST(ps.suppliers) as s
WHERE ps.country_code = 'cl'
  AND (s.supplier_tax_id LIKE '%82623500%' OR s.supplier_name LIKE '%Ideal%' OR s.supplier_name LIKE '%Bimbo%')
LIMIT 50;
