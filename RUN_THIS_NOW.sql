-- ============================================================
-- BioBridge Pro — DIAGNOSE + FIX SCRIPT
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

-- === PART 1: DIAGNOSE — check what exists ===
SELECT '1. Check organizations table:' AS step;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') AS org_table_exists;
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name IN ('id','name');

SELECT '2. Check users table:' AS step;
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position;

SELECT '3. Check users.organization_id column:' AS step;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='organization_id') AS has_organization_id;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='auth_id') AS has_auth_id;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='password_hash') AS has_password_hash;

SELECT '4. Count existing data:' AS step;
SELECT (SELECT COUNT(*) FROM public.organizations) AS org_count;
SELECT (SELECT COUNT(*) FROM public.users) AS user_count;

SELECT '5. Check RL status:' AS step;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('organizations','users','branches','employees');

-- ============================================================
-- PART 2: FIX — Add missing columns on users table
-- ============================================================

-- Add organization_id if missing (compatible with BIGINT org IDs)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='organization_id') THEN
        ALTER TABLE public.users ADD COLUMN organization_id BIGINT;
        RAISE NOTICE 'Added organization_id column';
    END IF;
END $$;

-- Add auth_id if missing (links to Supabase auth.users)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='auth_id') THEN
        ALTER TABLE public.users ADD COLUMN auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added auth_id column';
    END IF;
END $$;

-- Add email if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email') THEN
        ALTER TABLE public.users ADD COLUMN email TEXT;
        RAISE NOTICE 'Added email column';
    END IF;
END $$;

-- Add password_hash if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE public.users ADD COLUMN password_hash TEXT;
        RAISE NOTICE 'Added password_hash column';
    END IF;
END $$;

-- Add is_active if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_active') THEN
        ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column';
    END IF;
END $$;

-- ============================================================
-- PART 3: FIX RLS — Ensure policies allow all operations
-- ============================================================

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing potentially restrictive policies
DO $$ 
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='organizations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policyname);
    END LOOP;
END $$;

-- Create permissive policies for users table
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_all" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_all" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_delete_all" ON public.users FOR DELETE USING (true);

-- Create permissive policies for organizations table
CREATE POLICY "org_select_all" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "org_insert_all" ON public.organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "org_update_all" ON public.organizations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "org_delete_all" ON public.organizations FOR DELETE USING (true);

-- Service role bypass
CREATE POLICY "users_service_role" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "org_service_role" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- PART 4: ADD update trigger to organizations
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- PART 5: ADD index for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- ============================================================
-- FINAL VERIFICATION
-- ============================================================
SELECT '✅ Script completed! Verify below:' AS result;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema='public' AND table_name='users' 
ORDER BY ordinal_position;

SELECT tablename, policyname FROM pg_policies 
WHERE schemaname='public' AND tablename IN ('organizations','users');
