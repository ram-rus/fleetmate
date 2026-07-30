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
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS perbaikan_id    UUID;

-- Perluas status laporan_kerusakan
ALTER TABLE public.laporan_kerusakan DROP CONSTRAINT IF EXISTS laporan_kerusakan_status_check;
ALTER TABLE public.laporan_kerusakan ADD CONSTRAINT laporan_kerusakan_status_check CHECK (
  status IN (
    'Dilaporkan',
    'Ditangani',
    'Menunggu Approval Storing',
    'Menunggu Approval Pulang ke Pool',
    'Menunggu Keputusan Pengurus',
    'Storing Disetujui',
    'Storing Luar Disetujui',
    'Pulang ke Pool Disetujui',
    'Pulang ke Pool',
    'Lanjut Perjalanan',
    'Selesai'
  )
);

ALTER TABLE public.laporan_kerusakan DROP CONSTRAINT IF EXISTS laporan_kerusakan_keputusan_admin_check;
ALTER TABLE public.laporan_kerusakan ADD CONSTRAINT laporan_kerusakan_keputusan_admin_check CHECK (
  keputusan_admin IS NULL OR keputusan_admin IN (
    'approve_storing',
    'approve_pool',
    'storing_internal',
    'storing_luar',
    'pulang_ke_pool',
    'lanjut_perjalanan',
    'reject'
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
    'Mekanik Tiba',
    'Perbaikan Berlangsung',
    'Selesai'
  )
);

CREATE INDEX IF NOT EXISTS idx_storing_mekanik   ON public.storing(mekanik_id);
CREATE INDEX IF NOT EXISTS idx_storing_progres   ON public.storing(progres);
CREATE INDEX IF NOT EXISTS idx_storing_laporan  ON public.storing(laporan_kerusakan_id);

-- ── PERBAIKAN / AUDIT ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perbaikan (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id            UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  driver_id          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dibuat_oleh        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  laporan_id         UUID REFERENCES public.laporan_kerusakan(id) ON DELETE SET NULL,
  sumber             TEXT NOT NULL DEFAULT 'driver_app' CHECK (sumber IN ('driver_app','admin_manual')),
  tipe               TEXT NOT NULL CHECK (tipe IN ('storing_internal','storing_luar','pulang_ke_pool','perbaikan_pool','bengkel_luar')),
  status             TEXT NOT NULL DEFAULT 'Disetujui' CHECK (status IN ('Disetujui','Berjalan','Selesai','Ditolak','Lanjut Perjalanan')),
  progres            TEXT DEFAULT 'Menunggu Mekanik' CHECK (progres IN ('Menunggu Mekanik','Mekanik Ditugaskan','Mekanik Berangkat','Mekanik Tiba','Perbaikan Berlangsung','Selesai')),
  deskripsi          TEXT,
  lokasi             TEXT,
  lokasi_tipe        TEXT,
  koordinat_lat      DOUBLE PRECISION,
  koordinat_lng      DOUBLE PRECISION,
  foto_urls          TEXT[] DEFAULT '{}',
  km_kendaraan       INTEGER,
  tgl_mulai          TIMESTAMPTZ,
  tgl_selesai        TIMESTAMPTZ,
  mekanik_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tgl_berangkat      DATE,
  jam_berangkat      TIME,
  estimasi_tiba      TIME,
  catatan_untuk_driver TEXT,
  mekanik_luar_nama  TEXT,
  mekanik_luar_hp    TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.perbaikan_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  perbaikan_id UUID NOT NULL REFERENCES public.perbaikan(id) ON DELETE CASCADE,
  status_lama  TEXT,
  status_baru  TEXT NOT NULL,
  catatan      TEXT,
  dibuat_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.standby_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id      UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  dicatat_oleh UUID REFERENCES public.users(id) ON DELETE SET NULL,
  alasan       TEXT NOT NULL,
  catatan      TEXT,
  status       TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Selesai')),
  mulai_at     TIMESTAMPTZ DEFAULT NOW(),
  selesai_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perbaikan_unit       ON public.perbaikan(unit_id);
CREATE INDEX IF NOT EXISTS idx_perbaikan_driver     ON public.perbaikan(driver_id);
CREATE INDEX IF NOT EXISTS idx_perbaikan_mekanik    ON public.perbaikan(mekanik_id);
CREATE INDEX IF NOT EXISTS idx_perbaikan_status     ON public.perbaikan(status);
CREATE INDEX IF NOT EXISTS idx_perbaikan_log_perbaikan ON public.perbaikan_log(perbaikan_id);
CREATE INDEX IF NOT EXISTS idx_standby_log_unit     ON public.standby_log(unit_id);
CREATE INDEX IF NOT EXISTS idx_standby_log_status   ON public.standby_log(status);

ALTER TABLE public.perbaikan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perbaikan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standby_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perbaikan_select" ON public.perbaikan;
CREATE POLICY "perbaikan_select" ON public.perbaikan FOR SELECT USING (
  public.is_admin_or_above() OR driver_id = auth.uid() OR mekanik_id = auth.uid()
);

DROP POLICY IF EXISTS "perbaikan_insert" ON public.perbaikan;
CREATE POLICY "perbaikan_insert" ON public.perbaikan FOR INSERT WITH CHECK (public.is_admin_or_above() OR driver_id = auth.uid());

DROP POLICY IF EXISTS "perbaikan_update" ON public.perbaikan;
CREATE POLICY "perbaikan_update" ON public.perbaikan FOR UPDATE USING (public.is_admin_or_above() OR driver_id = auth.uid() OR mekanik_id = auth.uid());

DROP POLICY IF EXISTS "perbaikan_log_select" ON public.perbaikan_log;
CREATE POLICY "perbaikan_log_select" ON public.perbaikan_log FOR SELECT USING (
  public.is_admin_or_above() OR EXISTS (
    SELECT 1 FROM public.perbaikan p
    WHERE p.id = perbaikan_id AND (p.driver_id = auth.uid() OR p.mekanik_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "perbaikan_log_insert" ON public.perbaikan_log;
CREATE POLICY "perbaikan_log_insert" ON public.perbaikan_log FOR INSERT WITH CHECK (public.is_admin_or_above());

DROP POLICY IF EXISTS "standby_log_select" ON public.standby_log;
CREATE POLICY "standby_log_select" ON public.standby_log FOR SELECT USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "standby_log_insert" ON public.standby_log;
CREATE POLICY "standby_log_insert" ON public.standby_log FOR INSERT WITH CHECK (public.is_admin_or_above());

CREATE OR REPLACE VIEW public.v_perbaikan_aktif AS
SELECT * FROM public.perbaikan WHERE status IN ('Disetujui','Berjalan');

CREATE OR REPLACE VIEW public.v_standby_aktif AS
SELECT sl.*, u.nopol, u.tipe
FROM public.standby_log sl
LEFT JOIN public.units u ON u.id = sl.unit_id
WHERE sl.status = 'Aktif';

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

DROP POLICY IF EXISTS "storing_insert" ON public.storing;
CREATE POLICY "storing_insert" ON public.storing FOR INSERT WITH CHECK (
  public.is_admin_or_above() OR driver_id = auth.uid()
);

DROP POLICY IF EXISTS "storing_update" ON public.storing;
CREATE POLICY "storing_update" ON public.storing FOR UPDATE USING (
  public.is_admin_or_above() OR (driver_id = auth.uid() AND status = 'Pending')
);

-- ── NOTIFIKASI: simpan metadata alert agar tidak duplikat ───
-- (kolom data JSONB sudah ada di tabel notifikasi)

-- Migrasi nilai progres lama
UPDATE public.storing SET progres = 'Mekanik Tiba' WHERE progres = 'Mekanik Tiba di Lokasi';

DO $$ BEGIN
  RAISE NOTICE 'Migration storing workflow v3.1 selesai!';
END $$;
