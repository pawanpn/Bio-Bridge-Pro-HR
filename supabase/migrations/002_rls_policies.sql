-- Migration 002: Add RLS policies for all tables with organization_id
-- Run this on your Supabase SQL Editor if payments/invoices/etc. RLS errors occur.

-- Organization-scoped tables
CREATE POLICY IF NOT EXISTS org_isolation_departments ON departments
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_shifts ON shifts
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_attendance_logs ON attendance_logs
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_attendance_daily ON attendance_daily
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_leave_types ON leave_types
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_leave_balances ON leave_balances
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_leave_requests ON leave_requests
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_salary_components ON salary_components
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_payroll_runs ON payroll_runs
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_payroll_records ON payroll_records
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_items ON items
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_stock ON stock
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_projects ON projects
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_tasks ON tasks
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_crm_contacts ON crm_contacts
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_crm_opportunities ON crm_opportunities
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_assets ON assets
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_documents ON documents
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_invoices ON invoices
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_payments ON payments
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_bank_accounts ON bank_accounts
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_audit_logs ON audit_logs
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

CREATE POLICY IF NOT EXISTS org_isolation_notifications ON notifications
    FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE auth.uid() = users.auth_id));

-- ============================================================================
-- MANUAL FIX: If the above doesn't work because you need a quick workaround,
-- run this to temporarily disable RLS on the payments table:
--
--   ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
--
-- Then after the payment is saved, re-enable it:
--
--   ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ============================================================================
