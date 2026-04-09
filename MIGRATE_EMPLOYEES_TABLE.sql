-- Migration: Add missing columns to Employees table
-- Run this in your SQLite database or via the app's migration system

ALTER TABLE Employees ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS personal_email TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS personal_phone TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS department_id TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS designation_id TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS date_of_joining TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'Active';
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS reporting_manager_id TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE Employees ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT (datetime('now'));

-- Migrate existing data: split 'name' into first_name and last_name
UPDATE Employees SET 
    first_name = TRIM(SUBSTR(name, 1, INSTR(name, ' ') - 1)),
    last_name = TRIM(SUBSTR(name, INSTR(name, ' ') + 1))
WHERE first_name IS NULL AND INSTR(name, ' ') > 0;

-- For names without spaces, put everything in first_name
UPDATE Employees SET 
    first_name = name
WHERE first_name IS NULL;

-- Set employee_code if not set
UPDATE Employees SET 
    employee_code = 'EMP-' || printf('%04d', id)
WHERE employee_code IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON Employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON Employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON Employees(employment_status);
