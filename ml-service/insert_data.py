"""Generate and directly insert multi-year data into MySQL."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Reuse the generate_data module
from generate_data import generate_orders
import mysql.connector

def insert_orders(orders):
    conn = mysql.connector.connect(
        host="127.0.0.1", database="cod_crm", user="root", password=""
    )
    cur = conn.cursor()

    print("Clearing old data...")
    cur.execute("SET FOREIGN_KEY_CHECKS = 0")
    for t in ["returns","deliveries","order_status_history","order_items","orders"]:
        cur.execute(f"DELETE FROM {t}")
    cur.execute("ALTER TABLE orders AUTO_INCREMENT = 1")
    cur.execute("ALTER TABLE order_items AUTO_INCREMENT = 1")
    cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()

    print(f"Inserting {len(orders)} orders...")
    o_sql = """INSERT INTO orders
        (id, store_id, reference, customer_name, customer_phone,
         wilaya_id, commune, address, subtotal, shipping_cost,
         discount, total_amount, status, attempt_count, source,
         created_at, confirmed_at, shipped_at, delivered_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
    i_sql = """INSERT INTO order_items
        (order_id, product_id, product_name, quantity, price, total)
        VALUES (%s,%s,%s,%s,%s,%s)"""

    for idx in range(0, len(orders), 200):
        batch = orders[idx:idx+200]
        o_rows = [(o["id"],o["store_id"],o["reference"],o["customer_name"],
                    o["customer_phone"],o["wilaya_id"],o["commune"],o["address"],
                    o["subtotal"],o["shipping_cost"],o["discount"],o["total_amount"],
                    o["status"],o["attempt_count"],o["source"],
                    o["created_at"],o["confirmed_at"],o["shipped_at"],o["delivered_at"])
                   for o in batch]
        i_rows = [(o["id"],it["product_id"],it["product_name"],it["quantity"],
                    it["price"],it["total"])
                   for o in batch for it in o["items"]]
        cur.executemany(o_sql, o_rows)
        cur.executemany(i_sql, i_rows)
        conn.commit()
        if (idx // 200) % 5 == 0:
            print(f"  {min(idx+200, len(orders))}/{len(orders)}")

    cur.execute("SELECT COUNT(*) FROM orders")
    print(f"\nTotal orders: {cur.fetchone()[0]}")
    cur.execute("SELECT status, COUNT(*) c FROM orders GROUP BY status ORDER BY c DESC")
    for r in cur.fetchall():
        print(f"  {r[0]:15s}: {r[1]}")
    cur.close()
    conn.close()
    print("Done!")

if __name__ == "__main__":
    orders = generate_orders()
    insert_orders(orders)
