# Attendance Device Sync System - Complete Documentation

## 📋 Overview
The attendance device sync system is **fully restored and functional** in the current codebase. It supports ZKTeco and Hikvision attendance devices with real-time synchronization, device management, and comprehensive reporting.

---

## 🎯 System Architecture

### Backend (Rust/Tauri)
- **Device Drivers**: `src-tauri/src/hardware/zkteco.rs` & `hikvision.rs`
- **Node.js Bridge**: `src-tauri/src/bin/zk_fetch.cjs` (communicates with ZKTeco devices)
- **Device Registry**: Factory pattern for adding new device brands
- **Sync Engine**: Retry logic (3 attempts), 10s timeout, real-time listening

### Frontend (React/TypeScript)
- **Device Management**: `src/pages/BranchGateDeviceManagement.tsx`
- **Attendance Management**: `src/pages/AttendanceManagement.tsx` (with device sync)
- **Dashboard**: `src/pages/Dashboard.tsx` (auto-sync on connect)
- **Live Console**: `src/components/AttendanceConsole.tsx`

---

## 🔧 Key Features

### 1. Device Management (Branch/Gate/Device Hierarchy)
**Location**: `Organization > Branch/Gate/Device Management`

**Features**:
- ✅ Create branches (company locations)
- ✅ Add gates (entry points within branches)
- ✅ Register devices (ZKTeco/Hikvision)
- ✅ Set default device for auto-sync
- ✅ Test connectivity from UI
- ✅ View device status (online/offline)

**Database Tables**:
```sql
- Branches (id, name, location)
- Gates (id, branch_id, name)
- Devices (id, name, brand, ip, port, comm_key, machine_number, branch_id, gate_id, is_default)
```

### 2. Attendance Device Sync
**Location**: `Attendance Management > Daily Tab`

**Features**:
- ✅ **Sync from Device** button pulls latest attendance logs
- ✅ Shows all connected devices with individual sync buttons
- ✅ Real-time sync status feedback
- ✅ Auto-syncs to Google Drive (if configured)
- ✅ Duplicate detection (prevents re-importing same logs)

**Sync Process**:
1. Connects to device via TCP (IP:Port)
2. Fetches attendance logs using `node-zklib` library
3. Parses device user IDs and timestamps
4. Filters duplicates based on existing records
5. Stores in local SQLite database
6. Optionally syncs to cloud (Google Drive)

### 3. Real-time Attendance Listening
**Location**: Enabled via Dashboard toggle

**Features**:
- ✅ Real-time punch events from devices
- ✅ Live console showing sync logs
- ✅ Automatic database insertion
- ✅ Cancel/stop functionality

### 4. Attendance Console
**Location**: Bottom of main layout (collapsible)

**Features**:
- ✅ Live terminal output of sync operations
- ✅ Timestamped log entries
- ✅ Color-coded status messages
- ✅ Expandable/collapsible UI

---

## 🚀 How to Use

### Step 1: Setup Attendance Device
1. Navigate to **Branch/Gate/Device Management**
2. Add a **Branch** (e.g., "Head Office")
3. Add a **Gate** under the branch (e.g., "Main Entrance")
4. Add a **Device**:
   - **Name**: "ZKTeco Main"
   - **Brand**: ZKTeco or Hikvision
   - **IP Address**: Device IP (e.g., `192.168.1.201`)
   - **Port**: Usually `4370` for ZKTeco
   - **Communication Key**: Default `0` (check device settings)
   - **Machine Number**: Device ID (e.g., `1`)
   - **Branch/Gate**: Select from dropdowns
   - ✅ Check "Set as Default" for auto-sync

### Step 2: Test Device Connection
1. In Device Management, click the **Eye icon** (Test Connection)
2. Wait for confirmation: "✅ Device is online and reachable!"
3. If fails, check:
   - Device is powered on
   - Network connectivity (ping the IP)
   - Firewall rules (port 4370 open)
   - Correct IP and port

### Step 3: Sync Attendance Logs
**Method 1: From Attendance Management**
1. Go to **Attendance Management**
2. Select **Branch** and **Date**
3. Click **"Sync from Device"** button
4. Wait for sync completion message
5. View synced logs in the table below

**Method 2: From Dashboard**
1. Dashboard auto-detects connected devices
2. Shows device online/offline status
3. Auto-syncs when device connects (if enabled)
4. Manual sync via **"Pull ALL Logs"** button

**Method 3: Real-time Sync**
1. In Dashboard, enable **"Real-time Push"** toggle
2. System listens for live punch events
3. Logs appear instantly in database
4. Disable when not needed

### Step 4: View Reports
- **Daily View**: Shows all punches for selected date/branch
- **Manual Entry**: Add missing attendance manually
- **CSV Import**: Bulk import from CSV files
- **Reports Tab**: Generate attendance reports

---

## 🔍 Technical Details

### ZKTeco Driver Implementation
**File**: `src-tauri/src/hardware/zkteco.rs`

**Methods**:
```rust
- sync_logs(): Fetch attendance logs with retry logic
- get_all_user_info(): Fetch user list from device
- test_connectivity(): TCP port check
- listen_realtime(): Continuous event listener
```

**Node.js Bridge**: `src-tauri/src/bin/zk_fetch.cjs`
- Uses `node-zklib` library
- Supports actions: `test`, `sync`, `realtime`, `unlock`, `clear`
- Outputs clean JSON to stdout
- Handles connection errors gracefully

### Retry & Timeout Logic
- **Timeout**: 10 seconds per attempt
- **Max Retries**: 3 attempts
- **Retry Delay**: 1 second between attempts
- **Fast Fail**: TCP pre-check before full sync

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS AttendanceLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    employee_id INTEGER,
    timestamp TEXT,
    punch_method TEXT,
    is_synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INTEGER NOT NULL,
    comm_key INTEGER DEFAULT 0,
    machine_number INTEGER NOT NULL,
    branch_id INTEGER,
    gate_id INTEGER,
    status TEXT DEFAULT 'offline',
    is_default INTEGER DEFAULT 0,
    FOREIGN KEY (branch_id) REFERENCES Branches(id),
    FOREIGN KEY (gate_id) REFERENCES Gates(id)
);
```

### Tauri Commands (Backend API)
```rust
// Device Management
add_device(device)
list_all_devices()
update_device(id, device)
delete_device(id)
test_device_connection(ip, port, comm_key, machine_number, brand)

// Branch/Gate Management
add_branch(name, location)
list_branches()
update_branch(id, name, location)
delete_branch(id)
add_gate(branch_id, name)
list_gates(branch_id)

// Attendance Sync
sync_device_logs(ip, port, deviceId, brand)
pull_all_logs(ip, port, deviceId, brand)  // Fetches entire history
start_realtime_sync()
stop_realtime_sync()

// Attendance Data
get_daily_reports(branch_id, date)
add_manual_attendance(employee_id, date, time, method)
import_csv_attendance(csv_content, branch_id)
```

---

## 🐛 Troubleshooting

### Device Connection Fails
**Symptoms**: "Device unreachable" error

**Solutions**:
1. **Ping Test**: `ping 192.168.1.201` from command prompt
2. **Port Test**: `telnet 192.168.1.201 4370` (should connect)
3. **Check Device Settings**:
   - Network configuration (IP, subnet, gateway)
   - Communication key (default: 0)
   - Max concurrent connections
4. **Firewall**: Allow port 4370 in Windows Firewall
5. **Device Lock**: Some devices lock after failed attempts; reboot device

### Sync Returns Zero Logs
**Symptoms**: "Synced 0 logs from device"

**Possible Causes**:
1. **No attendance records** on device (device is new/cleared)
2. **Wrong device user ID mapping**: Device user ID must match employee_id
3. **Already synced**: Logs were previously pulled (duplicate filter active)
4. **Date range**: Device might have old logs only

**Solutions**:
- Use **"Pull ALL Logs"** from Dashboard to fetch entire history
- Check device user list matches employee database
- Clear device logs after successful sync (via device menu)

### Node.js Errors
**Symptoms**: "Node.js not installed" or script errors

**Solutions**:
1. Install Node.js: https://nodejs.org/
2. Verify installation: `node --version`
3. Install `node-zklib`: Already in `package.json`
4. Check script path: `src-tauri/src/bin/zk_fetch.cjs` exists

### Real-time Sync Not Working
**Symptoms**: No live events appearing

**Check**:
1. Device supports realtime push (most ZKTeco do)
2. Real-time toggle enabled in Dashboard
3. `AttendanceConsole` component visible (bottom of screen)
4. Device network connection stable

---

## 📦 Dependencies

### Node.js Libraries
```json
{
  "node-zklib": "latest"  // ZKTeco device communication
}
```

### Rust Crates
```toml
[dependencies]
async-trait = "0.1"
tokio = { version = "1", features = ["full"] }
serde_json = "1.0"
chrono = "0.4"
```

---

## 🔄 Data Flow

```
[Attendance Device]
       ↓ (TCP:4370)
[node-zklib via zk_fetch.cjs]
       ↓ (JSON to stdout)
[ZKTecoDriver::sync_logs()]
       ↓ (Vec<AttendanceLog>)
[Tauri Command: sync_device_logs]
       ↓ (Insert into SQLite)
[Local Database]
       ↓ (Optional)
[Google Drive Sync]
       ↓
[Frontend Display]
```

---

## 🎨 UI Components

### Attendance Management Page
- **Sync from Device** button (top filters)
- **Device Status** messages (success/error)
- **Connected Devices** card showing all devices
- Individual **Sync** and **Test** buttons per device

### Branch/Gate/Device Management
- Hierarchical tree view
- CRUD operations for all entities
- Connectivity testing
- Default device selection

### Dashboard
- Auto-detect and test devices on load
- Auto-sync when device online
- Real-time push toggle
- Pull ALL logs button
- Device online/offline indicator

### Attendance Console
- Fixed bottom panel
- Live log streaming
- Collapsible UI
- Monospace font for readability

---

## 🔐 Security Notes

1. **Communication Key**: Stored encrypted in database
2. **Device IP Whitelist**: Configure device to accept only server IP
3. **Admin Access**: Only admins can manage devices
4. **Audit Trail**: All sync operations logged with timestamps

---

## 📈 Future Enhancements

Potential improvements:
- [ ] Multi-device sync (parallel syncing)
- [ ] Sync scheduling (cron jobs)
- [ ] Device firmware updates from UI
- [ ] Biometric template backup
- [ ] SMS/Email notifications on sync failures
- [ ] Advanced filtering (date ranges, employees)
- [ ] Export to Excel/PDF

---

## ✅ Verification Checklist

- [x] ZKTeco driver implemented (`zkteco.rs`)
- [x] Node.js bridge script (`zk_fetch.cjs`)
- [x] Device management CRUD operations
- [x] Branch/Gate hierarchy
- [x] Sync from Device button in Attendance Management
- [x] Test connectivity functionality
- [x] Real-time listening capability
- [x] Attendance console component
- [x] Retry logic and timeout handling
- [x] Database schema for devices
- [x] Auto-sync on device connect (Dashboard)
- [x] Pull ALL logs functionality
- [x] Duplicate detection
- [x] Cloud sync integration (Google Drive)

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review git commit history for implementation details
3. Check `AttendanceConsole` for live error messages
4. Verify device network connectivity
5. Test with `zk_fetch.cjs` directly: `node src-tauri/src/bin/zk_fetch.cjs test 192.168.1.201 4370`

---

**Status**: ✅ **FULLY OPERATIONAL** - All attendance device sync features are present and functional in the current codebase.
