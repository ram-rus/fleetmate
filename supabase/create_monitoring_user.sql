-- ============================================================
-- SQL: Buat Akun Monitoring
-- Jalankan script ini di SQL Editor Supabase Project FleetMate
-- URL: https://supabase.com/dashboard/project/dbmlukdtykshvtnofbby/sql
-- ============================================================
-- Username (email) : monitoring@mms.com
-- Password         : mmsmonitoring
-- Nama             : Monitoring
-- Role             : monitoring (Read-Only)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Pastikan constraint role sudah include 'monitoring'
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'supervisor', 'manager', 'driver', 'mekanik', 'monitoring'));

-- Step 2: Buat / update akun monitoring
DO $$
DECLARE
  v_mon_id UUID := 'a1000000-0000-0000-0000-000000000010';
BEGIN

  -- Buat / update di auth.users (Supabase Auth)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) VALUES (
    v_mon_id,
    '00000000-0000-0000-0000-000000000000',
    'monitoring@mms.com',
    crypt('mmsmonitoring', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nama":"Monitoring"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('mmsmonitoring', gen_salt('bf')),
    email              = 'monitoring@mms.com',
    updated_at         = NOW();

  -- Buat / update di public.users (tabel profil aplikasi)
  INSERT INTO public.users (id, nama, role, is_active)
  VALUES (v_mon_id, 'Monitoring', 'monitoring', true)
  ON CONFLICT (id) DO UPDATE SET
    nama      = 'Monitoring',
    role      = 'monitoring',
    is_active = true;

END $$;

-- Step 3: Verifikasi hasil
SELECT id, nama, role, is_active, created_at
FROM public.users
WHERE role = 'monitoring';
