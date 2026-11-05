WITH po_sku AS (
  SELECT
    po_number,
    store_name,
    sku_id,
    barcode,
    product_name,
    IFNULL(received_qty, 0) AS received_qty,
    unit_cost_after_discount_lc,
    IFNULL(internal_tax_lc, 0) AS internal_tax_lc,
    country_name
  FROM peya-datamarts-pro.dm_dmarts.purchase_orders_sku_level
  WHERE po_creation_date >= DATE('2024-01-01')
),
sku_weightable AS (
  SELECT DISTINCT
    sku,
    is_weightable,
    barcodes AS EAN
  FROM peya-bi-tools-pro.il_qcommerce.dim_vendor_product
),
sku_final AS (
  SELECT
    p.* EXCEPT (sku_id),
    p.sku_id,
    s.EAN,
    -- Normalización para pesables (kg vs gr)
    CASE WHEN s.is_weightable = TRUE THEN p.received_qty / 1000 ELSE p.received_qty END AS received_qty_final,
    CASE WHEN s.is_weightable = TRUE THEN p.unit_cost_after_discount_lc * 1000 ELSE p.unit_cost_after_discount_lc END AS unit_cost_after_discount_lc_final,
    CASE WHEN s.is_weightable = TRUE THEN p.internal_tax_lc * 1000 ELSE p.internal_tax_lc END AS internal_tax_lc_final,
    CASE WHEN s.is_weightable = TRUE THEN 'PESABLE' ELSE 'UNIDAD' END AS product_type
  FROM po_sku p
  LEFT JOIN sku_weightable s ON p.sku_id = s.sku
)
SELECT
  po_number,
  store_name,
  sku_id,
  IFNULL(barcode, EAN) AS barcode,
  product_name,
  product_type,
  received_qty_final,
  unit_cost_after_discount_lc_final,
  internal_tax_lc_final AS internal_tax_lc,
  ROUND((IFNULL(unit_cost_after_discount_lc_final, 0) + IFNULL(internal_tax_lc_final, 0)) * IFNULL(received_qty_final, 0), 2) AS total_amount_lc
FROM sku_final
WHERE country_name = 'Chile'
  AND po_number IN ('PO012345', '...') -- O JOIN con las POs a conciliar

