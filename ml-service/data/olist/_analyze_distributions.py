import pandas as pd
import os

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

# ──────────────────────────────────────────────
# 1. ORDER STATUS distribution
# ──────────────────────────────────────────────
print("=" * 65)
print("1. ORDER STATUS DISTRIBUTION  (olist_orders_dataset.csv)")
print("=" * 65)

orders = pd.read_csv(os.path.join(DATA_DIR, "olist_orders_dataset.csv"))
total_orders = len(orders)
print(f"\nTotal orders: {total_orders}\n")

vc = orders["order_status"].value_counts()
pct = orders["order_status"].value_counts(normalize=True) * 100

status_df = pd.DataFrame({"count": vc, "percentage": pct.round(4)})
print(status_df.to_string())

# Classification
final_failures = ["canceled", "unavailable"]
in_progress    = ["shipped", "processing", "approved", "invoiced", "created"]
delivered      = ["delivered"]

print("\n--- Classification ---")
print(f"  DELIVERED (success):  {[s for s in delivered if s in vc.index]}  "
      f"-> {sum(vc.get(s, 0) for s in delivered)} orders  "
      f"({sum(vc.get(s, 0) for s in delivered)/total_orders*100:.4f}%)")
print(f"  FINAL FAILURES:      {[s for s in final_failures if s in vc.index]}  "
      f"-> {sum(vc.get(s, 0) for s in final_failures)} orders  "
      f"({sum(vc.get(s, 0) for s in final_failures)/total_orders*100:.4f}%)")
print(f"  IN PROGRESS:         {[s for s in in_progress if s in vc.index]}  "
      f"-> {sum(vc.get(s, 0) for s in in_progress)} orders  "
      f"({sum(vc.get(s, 0) for s in in_progress)/total_orders*100:.4f}%)")

# ──────────────────────────────────────────────
# 2. PAYMENT TYPE distribution
# ──────────────────────────────────────────────
print("\n" + "=" * 65)
print("2. PAYMENT TYPE DISTRIBUTION  (olist_order_payments_dataset.csv)")
print("=" * 65)

payments = pd.read_csv(os.path.join(DATA_DIR, "olist_order_payments_dataset.csv"))
total_payments = len(payments)
print(f"\nTotal payment records: {total_payments}\n")

vc_p = payments["payment_type"].value_counts()
pct_p = payments["payment_type"].value_counts(normalize=True) * 100
pay_df = pd.DataFrame({"count": vc_p, "percentage": pct_p.round(4)})
print(pay_df.to_string())

# ──────────────────────────────────────────────
# 3. PRODUCT NUMERIC COLUMNS distribution
# ──────────────────────────────────────────────
print("\n" + "=" * 65)
print("3. PRODUCT COLUMNS DISTRIBUTION  (olist_products_dataset.csv)")
print("=" * 65)

products = pd.read_csv(os.path.join(DATA_DIR, "olist_products_dataset.csv"))
total_products = len(products)
print(f"\nTotal products: {total_products}\n")

cols = ["product_photos_qty", "product_description_lenght", "product_name_lenght"]
for col in cols:
    s = products[col]
    print(f"  {col}:")
    print(f"    count (non-null) : {s.count()}")
    print(f"    null count       : {s.isna().sum()}")
    print(f"    mean             : {s.mean():.4f}")
    print(f"    std              : {s.std():.4f}")
    print(f"    min              : {s.min()}")
    print(f"    25%              : {s.quantile(0.25)}")
    print(f"    50% (median)     : {s.quantile(0.50)}")
    print(f"    75%              : {s.quantile(0.75)}")
    print(f"    max              : {s.max()}")
    print()

print("Done.")
