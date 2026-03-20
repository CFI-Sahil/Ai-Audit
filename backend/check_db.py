import sqlite3
conn = sqlite3.connect('survey.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(surveys)")
columns = cursor.fetchall()
for col in columns:
    print(col)
conn.close()
