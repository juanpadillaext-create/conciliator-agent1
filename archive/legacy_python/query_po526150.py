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
  po.warehouse.warehouse_id,
  count(1) as sku_count,
  sum(p.item_values_lc.amt_ordered_lc) as total_ordered,
  sum(p.item_values_lc.amt_delivered_lc) as total_delivered
FROM `peya-data-origins-pro.cl_dmarts.purchase_orders` po,
UNNEST(po.products_purchased) as p
WHERE po.country_code = 'cl'
  AND (po.po_order_id = 'PO526150' OR po.po_order_id = '526150' OR po.po_order_id LIKE '%526150')
GROUP BY 1,2,3,4,5,6,7,8;
"""

cmd = "bq query --use_legacy_sql=false --format=json --max_rows=100 --label datacloud:antigravity"
res = subprocess.run(cmd, input=sql, text=True, capture_output=True, shell=True)
print("STDOUT:", res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
