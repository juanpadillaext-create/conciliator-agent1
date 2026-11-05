import subprocess
import json

sql = """
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
WHERE po.created_localtime_at >= '2025-01-01'
  AND po.country_code = 'cl'
  AND (po.po_order_id = 'PO521534' OR po.po_order_id = '521534' OR po.po_order_id LIKE '%521534')
ORDER BY p.product_name ASC;
"""

res = subprocess.run("bq query --use_legacy_sql=false --format=json --max_rows=200 --label datacloud:antigravity", input=sql, text=True, capture_output=True, shell=True)
stdout = res.stdout.strip()
idx = stdout.find('[')
if idx != -1:
    try:
        data = json.loads(stdout[idx:])
        print("Total items:", len(data))
        with open("po521534_bq_items.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error parsing JSON:", e)
        print("Raw stdout preview:", repr(stdout[:300]))
else:
    print("No JSON array found in stdout:", stdout[:200])
    print("Stderr:", res.stderr)
