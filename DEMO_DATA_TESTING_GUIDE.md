# 🎯 Complete Demo Data & Testing Guide

## ✅ Demo Data Summary

All demo data has been prepared across **12 modules**. Here's what's available:

---

## 📊 Data Overview

| Module | Records | Description |
|--------|---------|-------------|
| 🏢 **Branches** | 3 | Head Office, Pokhara, Biratnagar |
| 🚪 **Gates** | 4 | Entry points per branch |
| 📱 **Devices** | 3 | ZKTeco & Hikvision attendance devices |
| 👥 **Employees** | 15 | Complete staff across all branches |
| ⏰ **Attendance Logs** | 25 | Today + yesterday punch records |
| 🏖️ **Leave Requests** | 4 | Pending & approved leaves |
| 📦 **Inventory** | 7 | Items across categories |
| 📋 **Projects** | 3 | Active & planning projects |
| ✅ **Tasks** | 5 | Project tasks with assignments |
| 🤝 **CRM Leads** | 4 | Sales pipeline |
| 💻 **Assets** | 5 | Company assets |
| 💰 **Invoices** | 3 | Billing records |

---

## 🧪 Testing Guide - Menu by Menu

### 1. **ERP Dashboard** 
**Navigation**: Main Menu → ERP Dashboard

**What to Check**:
- ✅ Total employees: **15**
- ✅ Present today: **15** (all logged in by 9:45 AM)
- ✅ Attendance rate: **100%**
- ✅ Devices online: **1** (ZKTeco Main)
- ✅ Stats cards show correct counts
- ✅ Charts render with data

**Expected Display**:
```
┌─────────────────────────────────────────┐
│ Total Employees: 15                     │
│ Present Today: 15                       │
│ Absent Today: 0                         │
│ Late Today: 0                           │
│ On Leave: 0                             │
│                                         │
│ Devices: 1 Online, 2 Offline            │
└─────────────────────────────────────────┘
```

---

### 2. **Employees Management**
**Navigation**: Human Resources → Employees

**What to Check**:
- ✅ **15 employees** listed
- ✅ Search works (try "Purushottam", "Amit")
- ✅ Filter by department works
- ✅ Click employee → detail page opens
- ✅ Employee data correct:
  - **Purushottam Sharma** - IT Manager - 85,000
  - **Amit Shah** - Finance Accountant - 65,000
  - **Deepak Chaudhary** - Sr. Developer - 95,000
  - All 15 employees visible

**Test Actions**:
1. ✅ View all employees
2. ✅ Search for "Deepak"
3. ✅ Filter by "IT" department
4. ✅ Click on employee → see details
5. ✅ Check branch assignments

---

### 3. **Leave Management**
**Navigation**: Human Resources → Leave Management

**What to Check**:
- ✅ **4 leave requests** visible
- ✅ **2 Pending**, **1 Approved**, **1 Pending**
- ✅ Employee names displayed
- ✅ Leave types correct (Annual, Sick, Casual)
- ✅ Date ranges shown properly

**Leave Records**:
```
1. Purushottam Sharma - Annual - Apr 15-17 - Pending
2. Binod Karki - Sick - Apr 12-13 - Approved ✅
3. Eran Khadka - Casual - Apr 20 - Pending
4. Hari Prasad - Annual - Apr 25-27 - Pending
```

**Test Actions**:
1. ✅ View all leave requests
2. ✅ Filter by status (Pending/Approved)
3. ✅ Approve a pending request
4. ✅ Check employee leave balance

---

### 4. **Attendance Management** ⭐
**Navigation**: Human Resources → Attendance

**What to Check**:
- ✅ **25 attendance logs** total
- ✅ **15 logs** for today (Apr 10)
- ✅ **10 logs** for yesterday (Apr 9)
- ✅ All punch times between 9:08-9:45 AM
- ✅ Device sync buttons visible
- ✅ Stats cards show:
  - Total punches: 25
  - Unique employees: 15
  - Synced: 25

**Test Actions**:
1. ✅ Select date: April 10, 2026
2. ✅ See 15 attendance records
3. ✅ Change date to April 9
4. ✅ See 10 attendance records
5. ✅ Click "Sync from Device" button
6. ✅ Test device connection
7. ✅ View manual entry form
8. ✅ Check CSV import tab

---

### 5. **Payroll Management**
**Navigation**: Human Resources → Payroll

**What to Check**:
- ✅ **15 employees** with salaries
- ✅ Total monthly payroll calculated
- ✅ Salary range: 45,000 - 95,000
- ✅ Department-wise breakdown

**Salary Summary**:
```
IT Department:        322,000 (4 employees)
Finance:              130,000 (2 employees)
HR:                   130,000 (2 employees)
Marketing:            130,000 (2 employees)
Sales:                120,000 (2 employees)
Operations:           140,000 (2 employees)
Admin:                 45,000 (1 employee)
─────────────────────────────────────
Total Monthly:      1,017,000
```

**Test Actions**:
1. ✅ View employee salary list
2. ✅ Check total payroll amount
3. ✅ Generate payslip for one employee
4. ✅ Filter by department

---

### 6. **Finance & Accounts**
**Navigation**: Finance & Accounts → Invoices

**What to Check**:
- ✅ **3 invoices** visible
- ✅ **1 Paid**, **1 Pending**, **1 Overdue**
- ✅ Total revenue: 11,000,000
- ✅ Overdue invoice highlighted

**Invoices**:
```
1. INV-2026-001 - ABC Corporation - 2,500,000 - Paid ✅
2. INV-2026-002 - XYZ Enterprises - 5,000,000 - Pending ⏳
3. INV-2026-003 - PQR Industries - 3,500,000 - Overdue ❌
```

**Test Actions**:
1. ✅ View all invoices
2. ✅ Check overdue invoice (red highlight)
3. ✅ Filter by status
4. ✅ View invoice details

---

### 7. **Reports**
**Navigation**: Finance & Accounts → Reports

**What to Check**:
- ✅ Attendance reports generate
- ✅ Employee reports show data
- ✅ Date range picker works
- ✅ Export options available

**Test Actions**:
1. ✅ Generate attendance report (Apr 9-10)
2. ✅ Generate employee report
3. ✅ Export to PDF/Excel
4. ✅ Check report accuracy

---

### 8. **Inventory Management**
**Navigation**: Operations → Inventory

**What to Check**:
- ✅ **7 items** listed
- ✅ Categories: Electronics (3), Furniture (2), Stationery (2)
- ✅ Quantities and prices visible
- ✅ Low stock alerts work

**Inventory Summary**:
```
Electronics:
- Laptop Dell XPS 15: 25 units @ 150,000
- HP Printer: 10 units @ 35,000
- USB Flash Drive: 75 units @ 800

Furniture:
- Office Chair: 50 units @ 15,000
- Desk Lamp: 30 units @ 2,500

Stationery:
- A4 Paper: 200 units @ 350
- Whiteboard Markers: 100 units @ 250
```

**Test Actions**:
1. ✅ View all items
2. ✅ Filter by category
3. ✅ Check low stock items
4. ✅ Add new item
5. ✅ Update stock quantity

---

### 9. **Projects Management**
**Navigation**: Operations → Projects

**What to Check**:
- ✅ **3 projects** visible
- ✅ **2 Active**, **1 Planning**
- ✅ Total budget: 10,000,000
- ✅ Project timelines shown

**Projects**:
```
1. BioBridge ERP v2.0 - Active - High - 5,000,000
2. Mobile App Development - Active - Medium - 3,000,000
3. Infrastructure Upgrade - Planning - Low - 2,000,000
```

**Test Actions**:
1. ✅ View all projects
2. ✅ Click project → see details
3. ✅ View tasks for each project
4. ✅ Check project progress

---

### 10. **Tasks (Submenu of Projects)**
**Navigation**: Operations → Projects → Tasks

**What to Check**:
- ✅ **5 tasks** visible
- ✅ **1 Completed**, **2 In Progress**, **2 Todo**
- ✅ Assigned employees shown
- ✅ Due dates visible

**Tasks**:
```
1. Implement Attendance Module - In Progress - Deepak - Apr 20
2. Payroll Integration - Todo - Amit - May 15
3. UI/UX Design - Completed ✅ - Purushottam - Mar 30
4. Backend API Development - In Progress - Hari - May 1
5. Server Procurement - Todo - Ganesh - May 10
```

**Test Actions**:
1. ✅ View all tasks
2. ✅ Filter by status
3. ✅ Mark task as complete
4. ✅ Update task progress

---

### 11. **CRM Management**
**Navigation**: Operations → CRM

**What to Check**:
- ✅ **4 leads** visible
- ✅ Pipeline stages shown
- ✅ Total estimated value: 12,500,000
- ✅ Lead statuses correct

**Leads**:
```
1. ABC Corporation - New - 2,500,000
2. XYZ Enterprises - Qualified - 5,000,000
3. PQR Industries - Proposal - 3,500,000
4. LMN Solutions - New - 1,500,000
```

**Test Actions**:
1. ✅ View all leads
2. ✅ Filter by status
3. ✅ Update lead status
4. ✅ Add new lead

---

### 12. **Assets Management**
**Navigation**: Operations → Assets

**What to Check**:
- ✅ **5 assets** listed
- ✅ Categories: Electronics (3), Furniture (2)
- ✅ Total asset value: 505,000
- ✅ Assigned to employees shown

**Assets**:
```
1. Dell Laptop #001 - Electronics - Purushottam - 150,000
2. HP Printer #001 - Electronics - Office - 35,000
3. Office Desk #001 - Furniture - Reception - 25,000
4. MacBook Pro #001 - Electronics - Deepak - 250,000
5. Projector #001 - Electronics - Conference Room - 45,000
```

**Test Actions**:
1. ✅ View all assets
2. ✅ Filter by category
3. ✅ Check asset assignments
4. ✅ Add new asset

---

### 13. **System Settings > Attendance** ⭐
**Navigation**: System Settings → Attendance Tab

**What to Check**:
- ✅ **3 devices** listed
- ✅ **1 Online** (ZKTeco Main)
- ✅ Device details visible
- ✅ Sync buttons work
- ✅ Connection tips displayed

**Devices**:
```
1. ZKTeco Main - 192.168.1.201:4370 - Online ✅ - DEFAULT
2. ZKTeco Back - 192.168.1.202:4370 - Offline ⚫
3. Hikvision Pokhara - 192.168.2.101:8000 - Offline ⚫
```

**Test Actions**:
1. ✅ View device list
2. ✅ Click "Sync Logs" on ZKTeco Main
3. ✅ Test device connection
4. ✅ Add new device
5. ✅ Edit device settings
6. ✅ Check connection tips

---

### 14. **Organization Management**
**Navigation**: Administration → Organization

**What to Check**:
- ✅ **3 branches** visible
- ✅ **4 gates** visible
- ✅ Branch-device relationships shown

**Test Actions**:
1. ✅ View branches
2. ✅ View gates per branch
3. ✅ Add new branch
4. ✅ Add new gate

---

### 15. **Notifications**
**Navigation**: Administration → Notifications

**What to Check**:
- ✅ System notifications appear
- ✅ Attendance sync notifications
- ✅ Mark as read works

---

## 🎯 Quick Test Checklist

### Must-Test Features:
- [ ] Dashboard shows 15 employees
- [ ] Employee list displays all 15
- [ ] Attendance shows 25 logs
- [ ] Leave requests show 4 entries
- [ ] Inventory shows 7 items
- [ ] Projects show 3 entries
- [ ] Tasks show 5 entries
- [ ] CRM shows 4 leads
- [ ] Assets show 5 entries
- [ ] Devices show 3 entries
- [ ] Device sync button works
- [ ] Search functionality works
- [ ] Filters work correctly
- [ ] Detail pages open
- [ ] Forms work (add/edit)

---

## 🔍 Data Verification Queries

Run these in SQLite browser or via app:

```sql
-- Check all modules
SELECT 'Branches' as module, COUNT(*) as count FROM Branches
UNION ALL SELECT 'Employees', COUNT(*) FROM Employees
UNION ALL SELECT 'Attendance', COUNT(*) FROM AttendanceLogs
UNION ALL SELECT 'Leaves', COUNT(*) FROM LeaveRequests
UNION ALL SELECT 'Inventory', COUNT(*) FROM InventoryItems
UNION ALL SELECT 'Projects', COUNT(*) FROM Projects
UNION ALL SELECT 'Tasks', COUNT(*) FROM Tasks
UNION ALL SELECT 'Leads', COUNT(*) FROM Leads
UNION ALL SELECT 'Assets', COUNT(*) FROM Assets;

-- Check today's attendance
SELECT COUNT(*) as today_attendance 
FROM AttendanceLogs 
WHERE date(timestamp) = '2026-04-10';

-- Check employee salary summary
SELECT department, COUNT(*) as employees, SUM(base_salary) as total_salary
FROM Employees
GROUP BY department;
```

---

## 🚀 Next Steps

1. **Run the app** and navigate through each menu
2. **Verify data** matches the expected counts
3. **Test interactions** (click, filter, search)
4. **Test forms** (add, edit, delete)
5. **Test device sync** functionality
6. **Generate reports** and verify data
7. **Check all submenus** have data

---

**Status**: ✅ **DEMO DATA READY** - All 12 modules seeded with realistic data.

**Total Records**: 85+ records across all modules

**यो data ready छ! App chalaera test garnus.** 🎉
