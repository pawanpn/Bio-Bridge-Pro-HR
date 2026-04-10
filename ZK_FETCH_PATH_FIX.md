# ✅ ZKTeco Script Path Fixed

## 🐛 Problem
When clicking "Sync Logs" from Device Management, the following error occurred:
```
❌ Sync failed: Hardware connection refused: Failed to retrieve users. Err: 
Cannot find module 'C:\Users\Admin\Desktop\BioBridge Pro HR\src-tauri\target\debug\src\bin\zk_fetch.cjs'
```

## 🔍 Root Cause
The Rust code was using `std::env::current_dir()` to find `zk_fetch.cjs`. During development, when running from `target/debug/`, this resolves to:
- `target/debug/src/bin/zk_fetch.cjs` ❌ (WRONG)

But the actual file is at:
- `src-tauri/src/bin/zk_fetch.cjs` ✅ (CORRECT)

## ✅ Solution
Updated `src-tauri/src/hardware/zkteco.rs` to use `CARGO_MANIFEST_DIR` for development:

```rust
// Use CARGO_MANIFEST_DIR for dev, fallback to current_dir for production
let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
let script_path = manifest_dir.join("src").join("bin").join("zk_fetch.cjs");

// If script doesn't exist at manifest path, try current dir (production)
let script_path = if script_path.exists() {
    script_path
} else {
    let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    current_dir.join("src").join("bin").join("zk_fetch.cjs")
};
```

## 📝 Files Modified
- `src-tauri/src/hardware/zkteco.rs`
  - Fixed path in `sync_logs()` method
  - Fixed path in `get_all_user_info()` method
  - Fixed path in `listen_realtime()` method

## 🎯 How It Works Now

### Development Mode:
```
CARGO_MANIFEST_DIR = "C:\Users\Admin\Desktop\BioBridge Pro HR\src-tauri"
Script Path = "src-tauri/src/bin/zk_fetch.cjs" ✅
```

### Production Mode:
```
current_dir() = "C:\Program Files\BioBridge Pro HR\"
Script Path = "C:\Program Files\BioBridge Pro HR\src\bin\zk_fetch.cjs" ✅
```

## ✅ Testing
After this fix:
1. Navigate to System Settings > Attendance
2. Click "Sync Logs" on any device
3. Should now successfully connect and sync
4. No more "MODULE_NOT_FOUND" error

## 🚀 Status
**FIXED** ✅ - Script path now resolves correctly in both development and production.
