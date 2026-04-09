-- Add is_active column to employees table
-- This column was missing from the original schema but is used by the Employee Hierarchy component

-- Add the column with a default value based on employment_status
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing employees: set is_active based on employment_status
UPDATE employees
SET is_active = CASE
  WHEN employment_status IN ('Active', 'active') THEN TRUE
  ELSE FALSE
END;

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- Add comment
COMMENT ON COLUMN employees.is_active IS 'Whether the employee is currently active in the organization';
