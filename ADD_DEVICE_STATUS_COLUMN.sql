-- Migration: Add status column to Devices table
-- Run this SQL if you have an existing database before this update
-- Date: 2026-04-15

-- Add status column to Devices table (if it doesn't exist)
-- Note: This will only work if the column doesn't already exist
-- If you get an error, the column may already exist

ALTER TABLE Devices ADD COLUMN status TEXT DEFAULT 'offline';

-- Update existing devices to offline status
UPDATE Devices SET status = 'offline' WHERE status IS NULL;

-- Verify the migration
SELECT id, name, ip_address, status FROM Devices;
