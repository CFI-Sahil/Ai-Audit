import sqlite3
import json
import sys

db_path = "survey.db"
target_uid = "111379"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

query = "SELECT full_result_json FROM surveys WHERE full_result_json LIKE ? ORDER BY id DESC LIMIT 1"
cursor.execute(query, (f"%{target_uid}%",))
row = cursor.fetchone()

if row:
    result = json.loads(row[0])
    print(json.dumps(result, indent=2))
else:
    print(f"No result found for UID {target_uid}")

conn.close()
