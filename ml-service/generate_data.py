"""Generate realistic multi-year synthetic data for COD CRM.

Creates ~4000 orders spanning Jan 2024 – Mar 2026 with:
- Algerian weekly pattern (Fri/Sat dip)
- Monthly salary-cycle pattern (more orders start/end of month)
- Gradual business growth trend
- Realistic cancellation/return rates correlated with order value, wilaya, customer history
- ~400 unique customers with repeat-buyer distribution

Outputs: seed_data.sql (run via XAMPP mysql CLI)
"""

import random
import datetime
import os

STORE_ID = 1
START_DATE = datetime.date(2024, 1, 1)
END_DATE = datetime.date(2026, 3, 12)

random.seed(42)

# ── Products (must match DB) ────────────────────────────────────────────
PRODUCTS = [
    {"id": 1,  "name": "Samsung Galaxy A13",    "price": 29999, "cost": 18000, "cat": "Electronics",  "weight": 5},
    {"id": 2,  "name": "iPhone 12 Pro",         "price": 99999, "cost": 70000, "cat": "Electronics",  "weight": 2},
    {"id": 3,  "name": "Realme 9 Pro",          "price": 27999, "cost": 16000, "cat": "Electronics",  "weight": 4},
    {"id": 4,  "name": "OnePlus 10",            "price": 42999, "cost": 30000, "cat": "Electronics",  "weight": 3},
    {"id": 5,  "name": "USB-C Cable 2m",        "price": 1999,  "cost": 800,   "cat": "Accessories",  "weight": 15},
    {"id": 6,  "name": "Wireless Charger",      "price": 4999,  "cost": 2500,  "cat": "Accessories",  "weight": 8},
    {"id": 7,  "name": "Phone Case Leather",    "price": 2499,  "cost": 1000,  "cat": "Accessories",  "weight": 12},
    {"id": 8,  "name": "Cotton T-Shirt White",  "price": 1999,  "cost": 700,   "cat": "Clothing",     "weight": 6},
    {"id": 9,  "name": "Jeans Blue Slim Fit",   "price": 3999,  "cost": 1500,  "cat": "Clothing",     "weight": 5},
    {"id": 10, "name": "Coffee Maker 1.5L",     "price": 5999,  "cost": 2800,  "cat": "Home",         "weight": 4},
    {"id": 11, "name": "LED Desk Lamp",         "price": 3499,  "cost": 1500,  "cat": "Home",         "weight": 3},
    {"id": 12, "name": "Running Shoes Adidas",  "price": 12999, "cost": 7000,  "cat": "Sports",       "weight": 3},
]
PRODUCT_WEIGHTS = [p["weight"] for p in PRODUCTS]

# ── Wilayas with zone + popularity weight ────────────────────────────────
WILAYAS = [
    (16, "zone_1", 25),   # Algiers
    (31, "zone_2", 10),   # Oran
    (25, "zone_2", 8),    # Constantine
    (9,  "zone_1", 7),    # Blida
    (19, "zone_2", 5),    # Setif
    (23, "zone_2", 4),    # Annaba
    (6,  "zone_2", 4),    # Bejaia
    (35, "zone_1", 4),    # Boumerdes
    (15, "zone_2", 3),    # Tizi Ouzou
    (26, "zone_2", 3),    # Medea
    (5,  "zone_3", 2),    # Batna
    (7,  "zone_3", 2),    # Biskra
    (43, "zone_3", 2),    # Mila
    (34, "zone_3", 2),    # Bordj Bou Arreridj
    (2,  "zone_3", 2),    # Chlef
    (44, "zone_3", 1),    # Ain Defla
    (42, "zone_3", 1),    # Tipaza
    (21, "zone_3", 1),    # Skikda
    (27, "zone_3", 1),    # Mostaganem
    (4,  "zone_3", 1),    # Oum El Bouaghi
    (36, "zone_3", 1),    # El Tarf
    (13, "zone_3", 1),    # Tlemcen
    (29, "zone_3", 1),    # Mascara
    (17, "zone_3", 1),    # Djelfa
    (3,  "zone_3", 1),    # Laghouat
]
WILAYA_IDS = [w[0] for w in WILAYAS]
WILAYA_ZONES = {w[0]: w[1] for w in WILAYAS}
WILAYA_WEIGHTS = [w[2] for w in WILAYAS]

SHIPPING_COST = {"zone_1": 300, "zone_2": 500, "zone_3": 800}

# ── Algerian first/last names ───────────────────────────────────────────
FIRST_NAMES = [
    "Ahmed", "Mohamed", "Fatima", "Amina", "Youssef", "Karim", "Meriem",
    "Samira", "Ali", "Omar", "Khaled", "Rachid", "Nadia", "Sara", "Djamel",
    "Hamza", "Louisa", "Rim", "Nassim", "Bilal", "Amine", "Rania", "Lina",
    "Sofiane", "Mourad", "Redha", "Amel", "Asma", "Houda", "Walid", "Farid",
    "Zakaria", "Imane", "Djamila", "Ines", "Ryad", "Mehdi", "Chaima",
    "Abdelkader", "Nadir", "Nabila", "Yasmina", "Hakim", "Noureddine",
    "Lamia", "Souhila", "Brahim", "Toufik", "Sihem", "Fouad",
]
LAST_NAMES = [
    "Benali", "Boumediene", "Khelifi", "Mebarki", "Bouzid", "Rahmani",
    "Belkacem", "Djebbar", "Mansouri", "Hamidi", "Zeroual", "Boudiaf",
    "Toumi", "Saidi", "Cherif", "Hadj", "Messaoud", "Larbi", "Ferhat",
    "Benkhedda", "Amrani", "Belaidi", "Bouazza", "Hadjadj", "Ait Ahmed",
    "Malek", "Bencherif", "Boudaoud", "Kadri", "Berrahma",
]
COMMUNES = [
    "Centre Ville", "El Harrach", "Bab Ezzouar", "Kouba", "El Biar",
    "Bir Mourad Rais", "Hussein Dey", "Sidi Bel Abbes", "Ain Temouchent",
    "El Khroub", "Didouche Mourad", "Hydra", "Oran Centre", "Setif Centre",
    "Bejaia Centre", "Annaba Centre",
]


def generate_customers(n=400):
    """Generate unique customers with phone numbers."""
    customers = []
    used_phones = set()
    for _ in range(n):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        prefix = random.choice(["05", "06", "07"])
        while True:
            phone = prefix + "".join(str(random.randint(0, 9)) for _ in range(8))
            if phone not in used_phones:
                used_phones.add(phone)
                break
        customers.append({"name": name, "phone": phone})
    return customers


def daily_order_count(date: datetime.date) -> int:
    """Return how many orders to generate for a given day."""
    # Base volume
    base = 7.0

    # Weekly pattern: Fri(4)=0.55, Sat(5)=0.45, Sun(6)=1.05, Mon-Thu = 1.0
    dow = date.weekday()  # Mon=0 ... Sun=6
    weekly = {0: 1.0, 1: 1.0, 2: 1.0, 3: 1.05, 4: 0.55, 5: 0.45, 6: 1.05}
    mult = weekly.get(dow, 1.0)

    # Monthly salary cycle: more orders days 1-5 and 25-31
    dom = date.day
    if dom <= 5 or dom >= 25:
        mult *= 1.2

    # Gradual growth: ~+30% over the 2-year span
    days_since_start = (date - START_DATE).days
    total_days = (END_DATE - START_DATE).days
    growth = 1.0 + 0.3 * (days_since_start / total_days)
    mult *= growth

    # Random noise ±35%
    noise = random.uniform(0.65, 1.35)
    mult *= noise

    count = int(round(base * mult))
    return max(1, count)


def pick_status(order_value, wilaya_id, is_repeat, days_ago):
    """Determine order status based on characteristics."""
    # Recent orders (< 7 days) might still be in progress
    if days_ago < 3:
        r = random.random()
        if r < 0.4:
            return random.choice(["new", "confirmed", "processing"])
        elif r < 0.55:
            return "shipped"
    elif days_ago < 7:
        r = random.random()
        if r < 0.15:
            return random.choice(["confirmed", "processing", "shipped"])

    # Base failure probability
    fail_prob = 0.28

    # Remote wilaya (zone_3): +10%
    zone = WILAYA_ZONES.get(wilaya_id, "zone_2")
    if zone == "zone_3":
        fail_prob += 0.10
    elif zone == "zone_1":
        fail_prob -= 0.05

    # High-value orders: higher cancel risk
    if order_value > 80000:
        fail_prob += 0.08
    elif order_value > 40000:
        fail_prob += 0.03
    elif order_value < 5000:
        fail_prob -= 0.05

    # Repeat customer: lower cancel risk
    if is_repeat:
        fail_prob -= 0.12

    fail_prob = max(0.08, min(0.50, fail_prob))

    if random.random() < fail_prob:
        # Failed order
        r = random.random()
        if r < 0.55:
            return "cancelled"
        elif r < 0.75:
            return "returned"
        elif r < 0.90:
            return "no_answer"
        else:
            return "postponed"
    else:
        return "delivered"


def generate_orders():
    """Generate all orders."""
    customers = generate_customers(1500)

    # Customer repeat behavior: assign order frequency tier
    # 60% order 1-2 times, 25% order 3-8 times, 10% order 8-20, 5% order 20-50
    customer_pool = []
    for i, c in enumerate(customers):
        r = random.random()
        if r < 0.60:
            repeats = random.randint(1, 2)
        elif r < 0.85:
            repeats = random.randint(3, 8)
        elif r < 0.95:
            repeats = random.randint(8, 20)
        else:
            repeats = random.randint(20, 50)
        for _ in range(repeats):
            customer_pool.append(i)

    random.shuffle(customer_pool)

    # Generate day-by-day
    orders = []
    returns = []  # Track return records
    order_id = 1
    current_date = START_DATE
    pool_idx = 0
    customer_order_counts = {}

    while current_date <= END_DATE:
        n_orders = daily_order_count(current_date)
        for _ in range(n_orders):
            # Pick customer
            if pool_idx < len(customer_pool):
                cust_idx = customer_pool[pool_idx]
                pool_idx += 1
            else:
                cust_idx = random.randint(0, len(customers) - 1)
            cust = customers[cust_idx]
            cust_count = customer_order_counts.get(cust_idx, 0)
            is_repeat = cust_count > 0
            customer_order_counts[cust_idx] = cust_count + 1

            # Pick product(s): 75% single item, 25% two items
            n_items = 2 if random.random() < 0.25 else 1
            items = random.choices(PRODUCTS, weights=PRODUCT_WEIGHTS, k=n_items)

            # Calculate amounts
            subtotal = sum(p["price"] for p in items)
            wilaya_id = random.choices(WILAYA_IDS, weights=WILAYA_WEIGHTS, k=1)[0]
            zone = WILAYA_ZONES[wilaya_id]
            shipping = SHIPPING_COST[zone]
            discount = 0
            if random.random() < 0.15:
                discount = random.choice([500, 1000, 1500, 2000, 3000])
            total = max(0, subtotal + shipping - discount)

            # Determine status
            days_ago = (END_DATE - current_date).days
            status = pick_status(total, wilaya_id, is_repeat, days_ago)

            # Timestamps
            created_at = datetime.datetime.combine(
                current_date,
                datetime.time(
                    random.randint(8, 22),
                    random.randint(0, 59),
                    random.randint(0, 59),
                ),
            )

            confirmed_at = None
            shipped_at = None
            delivered_at = None
            attempt_count = 0

            if status in ("delivered", "shipped", "returned"):
                confirmed_at = created_at + datetime.timedelta(
                    hours=random.randint(2, 36)
                )
                shipped_at = confirmed_at + datetime.timedelta(
                    hours=random.randint(12, 72)
                )
                if status == "delivered":
                    delivered_at = shipped_at + datetime.timedelta(
                        hours=random.randint(24, 120)
                    )
                elif status == "returned":
                    delivered_at = shipped_at + datetime.timedelta(
                        hours=random.randint(24, 96)
                    )
            elif status in ("confirmed", "processing"):
                confirmed_at = created_at + datetime.timedelta(
                    hours=random.randint(1, 24)
                )
            elif status == "cancelled":
                attempt_count = random.choices([0, 1, 2, 3], weights=[30, 40, 20, 10])[0]
                if random.random() < 0.6:
                    confirmed_at = created_at + datetime.timedelta(
                        hours=random.randint(2, 48)
                    )
            elif status == "no_answer":
                attempt_count = random.randint(1, 3)
                confirmed_at = created_at + datetime.timedelta(
                    hours=random.randint(2, 48)
                )
            elif status == "postponed":
                confirmed_at = created_at + datetime.timedelta(
                    hours=random.randint(2, 48)
                )

            ref = f"ORD-{current_date.year}-{order_id:05d}"

            orders.append({
                "id": order_id,
                "store_id": STORE_ID,
                "reference": ref,
                "customer_name": cust["name"],
                "customer_phone": cust["phone"],
                "wilaya_id": wilaya_id,
                "commune": random.choice(COMMUNES),
                "address": f"{random.randint(1, 200)} Rue {random.choice(LAST_NAMES)}",
                "subtotal": subtotal,
                "shipping_cost": shipping,
                "discount": discount,
                "total_amount": total,
                "status": status,
                "attempt_count": attempt_count,
                "source": random.choices(
                    ["facebook", "instagram", "website", "manual"],
                    weights=[40, 25, 20, 15],
                )[0],
                "created_at": created_at,
                "confirmed_at": confirmed_at,
                "shipped_at": shipped_at,
                "delivered_at": delivered_at,
                "items": [
                    {
                        "product_id": item["id"],
                        "product_name": item["name"],
                        "quantity": 1,
                        "price": item["price"],
                        "total": item["price"],
                    }
                    for item in items
                ],
            })

            # If order is returned, create return record
            if status == "returned":
                return_reasons = ["customer_refused", "wrong_address", "not_reachable", "damaged", "wrong_product", "duplicate", "other"]
                returns.append({
                    "order_id": order_id,
                    "store_id": STORE_ID,
                    "reason": random.choice(return_reasons),
                    "notes": f"Return processed for order {ref}",
                    "status": random.choices(
                        ["pending", "processing", "completed", "restocked"],
                        weights=[10, 20, 50, 20]
                    )[0],
                    "created_at": delivered_at + datetime.timedelta(
                        hours=random.randint(2, 48)
                    ) if delivered_at else created_at,
                })

            order_id += 1

        current_date += datetime.timedelta(days=1)

    return orders, returns


def write_sql(orders, returns, filepath="seed_data.sql"):
    """Write orders and returns as a SQL file."""
    def esc(val):
        if val is None:
            return "NULL"
        if isinstance(val, (int, float)):
            return str(val)
        if isinstance(val, datetime.datetime):
            return f"'{val.strftime('%Y-%m-%d %H:%M:%S')}'"
        s = str(val).replace("\\", "\\\\").replace("'", "\\'")
        return f"'{s}'"

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", filepath)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated realistic seed data for COD CRM\n")
        f.write(f"-- {len(orders)} orders, {datetime.date.today()}\n")
        f.write("-- Run: mysql -u root cod_crm < seed_data.sql\n\n")

        f.write("SET FOREIGN_KEY_CHECKS = 0;\n")
        f.write("DELETE FROM returns;\n")
        f.write("DELETE FROM deliveries;\n")
        f.write("DELETE FROM order_status_history;\n")
        f.write("DELETE FROM order_items;\n")
        f.write("DELETE FROM orders;\n")
        f.write("ALTER TABLE orders AUTO_INCREMENT = 1;\n")
        f.write("ALTER TABLE order_items AUTO_INCREMENT = 1;\n")
        f.write("SET FOREIGN_KEY_CHECKS = 1;\n\n")

        # Write orders in batches of 200
        batch_size = 200
        for i in range(0, len(orders), batch_size):
            batch = orders[i : i + batch_size]
            f.write("INSERT INTO `orders` (\n")
            f.write("  `id`, `store_id`, `reference`, `customer_name`, `customer_phone`,\n")
            f.write("  `wilaya_id`, `commune`, `address`, `subtotal`, `shipping_cost`,\n")
            f.write("  `discount`, `total_amount`, `status`, `attempt_count`, `source`,\n")
            f.write("  `created_at`, `confirmed_at`, `shipped_at`, `delivered_at`\n")
            f.write(") VALUES\n")
            rows = []
            for o in batch:
                vals = ", ".join([
                    esc(o["id"]), esc(o["store_id"]), esc(o["reference"]),
                    esc(o["customer_name"]), esc(o["customer_phone"]),
                    esc(o["wilaya_id"]), esc(o["commune"]), esc(o["address"]),
                    esc(o["subtotal"]), esc(o["shipping_cost"]),
                    esc(o["discount"]), esc(o["total_amount"]),
                    esc(o["status"]), esc(o["attempt_count"]), esc(o["source"]),
                    esc(o["created_at"]), esc(o["confirmed_at"]),
                    esc(o["shipped_at"]), esc(o["delivered_at"]),
                ])
                rows.append(f"({vals})")
            f.write(",\n".join(rows))
            f.write(";\n\n")

        # Write order_items in batches
        for i in range(0, len(orders), batch_size):
            batch = orders[i : i + batch_size]
            item_rows = []
            for o in batch:
                for item in o["items"]:
                    vals = ", ".join([
                        esc(o["id"]), esc(item["product_id"]),
                        esc(item["product_name"]), esc(item["quantity"]),
                        esc(item["price"]), esc(item["total"]),
                    ])
                    item_rows.append(f"({vals})")
            if item_rows:
                f.write("INSERT INTO `order_items` (\n")
                f.write("  `order_id`, `product_id`, `product_name`, `quantity`, `price`, `total`\n")
                f.write(") VALUES\n")
                f.write(",\n".join(item_rows))
                f.write(";\n\n")

        # Write returns in batches
        if returns:
            for i in range(0, len(returns), batch_size):
                batch = returns[i : i + batch_size]
                return_rows = []
                for r in batch:
                    vals = ", ".join([
                        esc(r["store_id"]), esc(r["order_id"]),
                        esc(r["reason"]), esc(r["notes"]),
                        esc(r["status"]), esc(r["created_at"]),
                    ])
                    return_rows.append(f"({vals})")
                f.write("INSERT INTO `returns` (\n")
                f.write("  `store_id`, `order_id`, `reason`, `notes`, `status`, `created_at`\n")
                f.write(") VALUES\n")
                f.write(",\n".join(return_rows))
                f.write(";\n\n")

    # Print statistics
    from collections import Counter
    statuses = Counter(o["status"] for o in orders)
    phones = set(o["customer_phone"] for o in orders)

    print(f"Generated {len(orders)} orders, {len(returns)} returns -> {out_path}")
    print(f"\n--- Order Status Distribution ---")
    for status, count in statuses.most_common():
        print(f"  {status:15s}: {count:5d} ({100*count/len(orders):.1f}%)")
    print(f"\n  Unique customers: {len(phones)}")
    print(f"  Date range:      {orders[0]['created_at'].date()} — {orders[-1]['created_at'].date()}")

    delivered = [o for o in orders if o["status"] == "delivered"]
    avg_val = sum(o["total_amount"] for o in delivered) / len(delivered)
    total_rev = sum(o["total_amount"] for o in delivered)
    print(f"  Avg delivered:   {avg_val:.0f} DZD")
    print(f"  Total revenue:   {total_rev:.0f} DZD")
    print(f"\nRun:  C:\\xampp\\mysql\\bin\\mysql.exe -u root cod_crm < {out_path}")


if __name__ == "__main__":
    orders, returns = generate_orders()
    write_sql(orders, returns)
