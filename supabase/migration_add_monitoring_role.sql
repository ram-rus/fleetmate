-- Migration: Tambah Role 'monitoring' ke Tabel public.users
-- Dapat dijalankan dengan aman pada database Supabase FleetMate

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'supervisor', 'manager', 'driver', 'mekanik', 'monitoring'));
