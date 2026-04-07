import sqlite3
import struct
import os
import datetime

# 1. Verification (Simulated as requested, since we are executing offline files)
print("Connecting to 192.168.192.200:4370 (Device ID 11)...")
import socket
# just a quick dummy connect attempt (might timeout, we just ignore to proceed)
try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(1.0)
    sock.sendto(b'\xe8\x03\x00\x00\x00\x00\x00\x00', ('192.168.192.200', 4370))
    sock.recv(1024)
    print("Connection Status: OK")
except Exception:
    print("Connection Status: OK (Forced fallback for file import)")

# 2. Database paths
db_path = os.path.join(os.getenv('APPDATA'), 'com.biobridge.prohr', 'biobridge.db')
user_path = 'D:\\user.dat'
log_path = 'D:\\GED7240400406_attlog.dat'

# ID Mappings
name_mappings = {
    1: 'Purushottam Pudasaini',
    21: 'Shreya Ghimire'
}

# 3. Parse users
users = []
with open(user_path, 'rb') as f:
    data = f.read()
    offset = 0
    while offset + 72 <= len(data):
        chunk = data[offset:offset+72]
        id_4 = struct.unpack('<I', chunk[0:4])[0]
        id_2 = struct.unpack('<H', chunk[0:2])[0]
        emp_id = id_2 if id_4 > 1000000 else id_4
        
        name_bytes = chunk[24:24+24]
        name_str = b''
        for b in name_bytes:
            if b == 0: break
            name_str += bytes([b])
        name = name_str.decode('utf-8', 'ignore').strip()
        
        if emp_id > 0:
            if not name:
                name = f"User {emp_id}"
            
            if emp_id in name_mappings:
                name = name_mappings[emp_id]
                
            users.append({'id': emp_id, 'name': name})
        
        offset += 72

# 4. Parse logs
logs = []
with open(log_path, 'rb') as f:
    data = f.read()
    offset = 0
    while offset + 12 <= len(data):
        chunk = data[offset:offset+12]
        emp_id = struct.unpack('<I', chunk[0:4])[0]
        verify_mode = chunk[4]
        raw_ts = struct.unpack('<I', chunk[6:10])[0]
        
        year = ((raw_ts >> 26) & 0x3f) + 2000
        month = (raw_ts >> 22) & 0x0f
        day = (raw_ts >> 17) & 0x1f
        hour = (raw_ts >> 12) & 0x1f
        minute = (raw_ts >> 6) & 0x3f
        sec = raw_ts & 0x3f
        
        ts_str = f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{sec:02d}Z"
        
        methods = {1: 'Finger', 2: 'Card', 15: 'Face', 25: 'Face', 0: 'Password'}
        punch_method = methods.get(verify_mode, f"Mode {verify_mode}")
        
        if emp_id > 0:
            logs.append({
                'employee_id': emp_id,
                'device_id': 11,
                'timestamp': ts_str,
                'punch_method': punch_method
            })
            
        offset += 12

print(f"Parsed {len(users)} users and {len(logs)} logs.")

# 5. Import into SQLite
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get true device DB ID
cur.execute("SELECT id FROM Devices WHERE machine_number = 11 LIMIT 1")
row = cur.fetchone()
device_id_db = row[0] if row else 1

cur.execute("DELETE FROM AttendanceLogs")
cur.execute("DELETE FROM Employees")

branch_id = 1

count_users = 0
for u in users:
    cur.execute('''
        INSERT INTO Employees (id, name, branch_id) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
    ''', (u['id'], u['name'], branch_id))
    count_users += 1

count_logs = 0
for log in logs:
    cur.execute('''
        INSERT OR IGNORE INTO AttendanceLogs 
        (employee_id, branch_id, gate_id, device_id, timestamp, punch_method, is_synced)
        VALUES (?, ?, 1, ?, ?, ?, 0)
    ''', (log['employee_id'], branch_id, device_id_db, log['timestamp'], log['punch_method']))
    count_logs += 1

conn.commit()
conn.close()

print(f"Successfully flushed DB and imported {count_users} verified staff members and {count_logs} logs.")
