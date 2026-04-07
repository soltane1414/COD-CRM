"""Import seed_data.sql into MySQL using Python."""
import mysql.connector

sql_path = r"C:\Users\LENOVO\Desktop\Sem 8 TPs\Project stage\COD-CRM\seed_data.sql"

conn = mysql.connector.connect(
    host="127.0.0.1", port=3306, database="cod_crm",
    user="root", password="",
    allow_local_infile=True,
    autocommit=False,
)
cursor = conn.cursor()

with open(sql_path, "r", encoding="utf-8") as f:
    sql_content = f.read()

# Split by semicolons (respecting that data values may not contain bare semicolons)
statements = [s.strip() for s in sql_content.split(";\n") if s.strip()]

print(f"Found {len(statements)} SQL statements")

for i, stmt in enumerate(statements):
    if not stmt or stmt.startswith("--"):
        continue
    try:
        cursor.execute(stmt)
        conn.commit()
        if i % 10 == 0:
            print(f"  Executed statement {i+1}/{len(statements)}")
    except Exception as e:
        print(f"  ERROR at statement {i+1}: {e}")
        print(f"  Statement preview: {stmt[:200]}...")
        conn.rollback()
        break

cursor.execute("SELECT COUNT(*) FROM orders")
count = cursor.fetchone()[0]
print(f"\nTotal orders in database: {count}")

cursor.execute("SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY COUNT(*) DESC")
for row in cursor.fetchall():
    print(f"  {row[0]:15s}: {row[1]}")

cursor.close()
conn.close()
print("Done!")
