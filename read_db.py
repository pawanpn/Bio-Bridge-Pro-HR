import sqlite3, json
conn = sqlite3.connect(r'C:\Users\Admin\AppData\Roaming\com.biobridge.prohr\Databases\biobridge_pro.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM Employees')
print('Employee count:', cur.fetchone()[0])

cur.execute('SELECT * FROM Employees LIMIT 5')
rows = cur.fetchall()
for r in rows:
    d = dict(r)
    print(d)

print('---COLUMNS---')
cur.execute('PRAGMA table_info(Employees)')
for c in cur.fetchall():
    print(c[1], c[2])

conn.close()
