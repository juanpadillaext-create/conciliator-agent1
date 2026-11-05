import json

# Let's inspect data/carozzi_pos_bq.json
if os.path.exists('data/carozzi_pos_bq.json'):
    with open('data/carozzi_pos_bq.json', encoding='utf-8') as f:
        carozzi_pos = json.load(f)
    print("carozzi_pos_bq count:", len(carozzi_pos))
    print("Keys:", list(carozzi_pos[0].keys()) if carozzi_pos else [])
    for cp in sorted(carozzi_pos, key=lambda x: x.get('amt_ordered_lc', 0) - x.get('amt_delivered_lc', 0), reverse=True)[:5]:
        po = cp.get('po_order_id')
        amt_ord = cp.get('amt_ordered_lc', 0)
        amt_del = cp.get('amt_delivered_lc', 0)
        diff = amt_ord - amt_del
        print(f"PO {po}: Ordenado ${amt_ord:,.0f} | Recibido ${amt_del:,.0f} | Delta ${diff:,.0f}")
