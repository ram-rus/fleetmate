-- Tambahkan seluruh tipe kendaraan yang digunakan aplikasi Data Unit.
-- Aman dijalankan pada database yang sudah ada.
ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_tipe_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_tipe_check
  CHECK (tipe IN ('Wing Box', 'CDD', 'CDE', 'Fuso', 'Grandmax'));
