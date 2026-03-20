import sqlite3
try:
    conn = sqlite3.connect('survey.db')
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE surveys ADD COLUMN full_result_json TEXT")
    conn.commit()
    print("Column added successfully")
except Exception as e:
    print(f"Error adding column: {e}")
finally:
    conn.close()
