import subprocess
import json

sql = """
SELECT 
  po.po_order_id,
  po.supplier_id,
  po.supplier_name,
  po.order_status,
  po.created_localtime_at,
  po.received_localtime_at,
  po.warehouse.warehouse_name,
  count(1) as sku_count,
  sum(p.item_values_lc.amt_ordered_lc) as total_ordered,
  sum(p.item_values_lc.amt_delivered_lc) as total_delivered
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.created_localtime_at >= '2025-01-01'
  AND po.country_code = 'cl'
  AND (po.po_order_id = 'PO521534' OR po.po_order_id = '521534' OR po.po_order_id LIKE '%521534')
GROUP BY 1,2,3,4,5,6,7;
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=100 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
