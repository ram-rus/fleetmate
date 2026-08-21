-- ============================================================
-- SQL Seed: Buat Akun Admin & Monitoring di Supabase SQL Editor
-- Jalankan script ini di SQL Editor Supabase Project FleetMate
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Buat / Reset Akun Admin
-- Username: admin / admin@mms.com
-- Password: admin123
-- Role: admin
DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@mms.com',
    crypt('admin123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nama":"Admin Utama"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('admin123', gen_salt('bf')),
    updated_at = NOW();

  INSERT INTO public.users (id, nama, role, is_active)
  VALUES (v_admin_id, 'Admin Utama', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET
    nama = 'Admin Utama',
    role = 'admin',
    is_active = true;
END $$;


-- 2. Buat / Reset Akun Monitoring
-- Username: monitoring / monitoring@mms.com
-- Password: monitoring123
-- Role: monitoring (Read-Only)
DO $$
DECLARE
  v_mon_id UUID := 'm0000000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) VALUES (
    v_mon_id,
    '00000000-0000-0000-0000-000000000000',
    'monitoring@mms.com',
    crypt('monitoring123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nama":"User Monitoring"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('monitoring123', gen_salt('bf')),
    updated_at = NOW();

  INSERT INTO public.users (id, nama, role, is_active)
  VALUES (v_mon_id, 'User Monitoring', 'monitoring', true)
  ON CONFLICT (id) DO UPDATE SET
    nama = 'User Monitoring',
    role = 'monitoring',
    is_active = true;
END $$;


-- 3. Verifikasi Hasil
SELECT id, nama, role, is_active, created_at FROM public.users WHERE role IN ('admin','monitoring');
