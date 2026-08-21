-- ============================================================
-- SQL: Fix RLS users table - Anti Recursive Policy
-- Jalankan di Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/dbmlukdtykshvtnofbby/sql
-- ============================================================
-- MASALAH: Policy sebelumnya menyebabkan infinite recursion karena
-- subquery ke public.users di dalam policy public.users itu sendiri.
-- SOLUSI: Gunakan SECURITY DEFINER function untuk bypass RLS saat cek role.
-- ============================================================

-- Step 1: Buat/update helper function (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()),
    ''
  );
$$;

-- Step 2: Hapus policy lama yang bermasalah
DROP POLICY IF EXISTS "users_select_own"      ON public.users;
DROP POLICY IF EXISTS "users_select_all_admin" ON public.users;

-- Hapus juga policy lama dari setup sebelumnya (jika ada)
DROP POLICY IF EXISTS "users_select"          ON public.users;
DROP POLICY IF EXISTS "users_insert"          ON public.users;
DROP POLICY IF EXISTS "users_update"          ON public.users;

-- Step 3: Pastikan RLS aktif
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 4: Buat policy yang benar (tanpa recursive subquery)

-- Semua user authenticated bisa baca data dirinya sendiri (wajib untuk login)
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Admin/supervisor/manager/monitoring bisa baca semua user
-- Menggunakan get_my_role() yang SECURITY DEFINER -> tidak rekursif
CREATE POLICY "users_select_all_admin"
  ON public.users FOR SELECT
  USING (public.get_my_role() IN ('admin', 'supervisor', 'manager', 'monitoring'));

-- Semua authenticated user bisa insert (untuk registrasi)
CREATE POLICY "users_insert"
  ON public.users FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- User hanya bisa update data dirinya sendiri
-- Admin bisa update semua
CREATE POLICY "users_update"
  ON public.users FOR UPDATE
  USING (
    auth.uid() = id
    OR public.get_my_role() IN ('admin', 'supervisor', 'manager')
  );

-- Step 5: Verifikasi policies
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY cmd, policyname;
