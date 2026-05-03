-- ============================================
-- SUPABASE MIGRATION: EXTENDED EMPLOYEE DETAILS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Alter employees table to add missing columns
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS area_id TEXT,
ADD COLUMN IF NOT EXISTS location_id TEXT,
ADD COLUMN IF NOT EXISTS photo TEXT,
ADD COLUMN IF NOT EXISTS enable_self_service BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enable_mobile_access BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS local_name TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT, -- Note: citizenship_number already exists
ADD COLUMN IF NOT EXISTS contact_tel TEXT,
ADD COLUMN IF NOT EXISTS office_tel TEXT,
ADD COLUMN IF NOT EXISTS motorcycle_license TEXT,
ADD COLUMN IF NOT EXISTS automobile_license TEXT,
ADD COLUMN IF NOT EXISTS religion TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS passport_no TEXT,
ADD COLUMN IF NOT EXISTS verification_mode TEXT,
ADD COLUMN IF NOT EXISTS device_privilege TEXT DEFAULT 'Normal User',
ADD COLUMN IF NOT EXISTS device_password TEXT,
ADD COLUMN IF NOT EXISTS card_no TEXT,
ADD COLUMN IF NOT EXISTS bio_photo TEXT,
ADD COLUMN IF NOT EXISTS enable_attendance BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_holiday BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS outdoor_management BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS workflow_role TEXT,
ADD COLUMN IF NOT EXISTS mobile_punch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS app_role TEXT DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS whatsapp_alert BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_exception BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_punch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS supervisor_mobile TEXT;

COMMENT ON TABLE public.employees IS 'Extended employee records with biometrics, mobile app, and WhatsApp settings.';
