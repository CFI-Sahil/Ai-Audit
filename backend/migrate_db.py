import sqlite3
import os

db_path = "d:/Sahil/Zeex AI/Ai speech to text - Copy/backend/survey.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE surveys ADD COLUMN surveyor_name TEXT")
        conn.commit()
        print("Successfully added surveyor_name column to surveys table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column surveyor_name already exists.")
        else:
            print(f"Error adding column: {e}")
    conn.close()
else:
    print("Database file not found.")
