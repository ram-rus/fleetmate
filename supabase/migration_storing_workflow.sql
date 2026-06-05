-- ============================================================
-- FLEETMATE v3.1 — Migration: Storing Workflow Enhancement
-- Jalankan di Supabase SQL Editor SETELAH setup_fleetmate_v3.sql
-- Aman dijalankan berulang (idempotent)
-- ============================================================

-- ── LAPORAN KERUSAKAN: kolom tambahan ──────────────────────
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS catatan          TEXT;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS koordinat_lat    DOUBLE PRECISION;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS koordinat_lng    DOUBLE PRECISION;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS km_kendaraan     INTEGER;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS pilihan_driver   TEXT;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS keputusan_admin  TEXT;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS diputuskan_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS diputuskan_at    TIMESTAMPTZ;

-- Perluas status laporan_kerusakan
ALTER TABLE public.laporan_kerusakan DROP CONSTRAINT IF EXISTS laporan_kerusakan_status_check;
ALTER TABLE public.laporan_kerusakan ADD CONSTRAINT laporan_kerusakan_status_check CHECK (
  status IN (
    'Dilaporkan',
    'Menunggu Approval Storing',
    'Menunggu Keputusan Pengurus',
    'Storing Disetujui',
    'Pulang ke Pool',
    'Ditangani',
    'Selesai'
  )
);

-- ── STORING: kolom tambahan ──────────────────────────────────
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS mekanik_id           UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS tgl_berangkat        DATE;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS jam_berangkat        TIME;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS jam_estimasi_tiba    TIME;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS catatan_driver       TEXT;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS progres              TEXT DEFAULT 'Menunggu Mekanik';
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS laporan_kerusakan_id UUID REFERENCES public.laporan_kerusakan(id) ON DELETE SET NULL;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS ditugaskan_at        TIMESTAMPTZ;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS ditugaskan_oleh      UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Perluas status storing
ALTER TABLE public.storing DROP CONSTRAINT IF EXISTS storing_status_check;
ALTER TABLE public.storing ADD CONSTRAINT storing_status_check CHECK (
  status IN ('Pending','Aktif','Selesai','Ditolak')
);

-- Progres CHECK
ALTER TABLE public.storing DROP CONSTRAINT IF EXISTS storing_progres_check;
ALTER TABLE public.storing ADD CONSTRAINT storing_progres_check CHECK (
  progres IN (
    'Menunggu Mekanik',
    'Mekanik Ditugaskan',
    'Mekanik Berangkat',
    'Mekanik Tiba di Lokasi',
    'Perbaikan Berlangsung',
    'Selesai'
  )
);

CREATE INDEX IF NOT EXISTS idx_storing_mekanik   ON public.storing(mekanik_id);
CREATE INDEX IF NOT EXISTS idx_storing_progres   ON public.storing(progres);
CREATE INDEX IF NOT EXISTS idx_storing_laporan  ON public.storing(laporan_kerusakan_id);

-- ── STORING LOG (audit trail) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.storing_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storing_id   UUID NOT NULL REFERENCES public.storing(id) ON DELETE CASCADE,
  status_lama  TEXT,
  status_baru  TEXT NOT NULL,
  catatan      TEXT,
  dibuat_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storing_log_storing ON public.storing_log(storing_id);

ALTER TABLE public.storing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storing_log_select" ON public.storing_log;
CREATE POLICY "storing_log_select" ON public.storing_log FOR SELECT USING (
  public.is_admin_or_above()
  OR EXISTS (
    SELECT 1 FROM public.storing s
    WHERE s.id = storing_id AND s.driver_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "storing_log_insert" ON public.storing_log;
CREATE POLICY "storing_log_insert" ON public.storing_log FOR INSERT WITH CHECK (
  public.is_admin_or_above()
);

-- ── NOTIFIKASI: simpan metadata alert agar tidak duplikat ───
-- (kolom data JSONB sudah ada di tabel notifikasi)

-- Migrasi nilai progres lama
UPDATE public.storing SET progres = 'Mekanik Tiba di Lokasi' WHERE progres = 'Mekanik Tiba';

DO $$ BEGIN
  RAISE NOTICE 'Migration storing workflow v3.1 selesai!';
END $$;
