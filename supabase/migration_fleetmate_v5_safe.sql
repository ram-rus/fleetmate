-- ============================================================
-- FLEETMATE v5.0 — MIGRATION AMAN (IDEMPOTENT)
-- Jalankan di Supabase SQL Editor
-- Cocok untuk skema aplikasi yang saat ini dipakai
-- ============================================================

-- ============================================================
-- 0. FUNGSI HELPER
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. TABEL PERBAIKAN (terpusat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perbaikan (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  no_perbaikan        TEXT UNIQUE,
  unit_id             UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  driver_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dibuat_oleh         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  laporan_id          UUID,

  sumber              TEXT NOT NULL DEFAULT 'driver_app'
                      CHECK (sumber IN ('driver_app','admin_manual')),

  tipe                TEXT NOT NULL
                      CHECK (tipe IN (
                        'storing_internal',
                        'storing_luar',
                        'pulang_ke_pool',
                        'perbaikan_pool',
                        'bengkel_luar'
                      )),

  status              TEXT NOT NULL DEFAULT 'Menunggu Approval'
                      CHECK (status IN (
                        'Menunggu Approval',
                        'Disetujui',
                        'Berjalan',
                        'Selesai',
                        'Ditolak',
                        'Lanjut Perjalanan'
                      )),

  progres             TEXT DEFAULT 'Menunggu Mekanik'
                      CHECK (progres IN (
                        'Menunggu Mekanik',
                        'Mekanik Ditugaskan',
                        'Mekanik Berangkat',
                        'Mekanik Tiba',
                        'Perbaikan Berlangsung',
                        'Selesai'
                      )),

  mekanik_id          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  mekanik_luar_nama   TEXT,
  mekanik_luar_hp     TEXT,

  deskripsi           TEXT,
  lokasi              TEXT,
  lokasi_tipe         TEXT CHECK (lokasi_tipe IN ('Di Pool','Di Bengkel Luar','Di Lapangan')),
  koordinat_lat       NUMERIC(10,7),
  koordinat_lng       NUMERIC(10,7),
  foto_urls           TEXT[] DEFAULT '{}',
  km_kendaraan        INTEGER,

  tgl_berangkat       DATE,
  jam_berangkat       TIME,
  estimasi_tiba       TIME,
  catatan_untuk_driver TEXT,

  tgl_mulai           TIMESTAMPTZ,
  tgl_selesai         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.perbaikan
  ADD COLUMN IF NOT EXISTS no_perbaikan TEXT;
ALTER TABLE public.perbaikan
  ADD COLUMN IF NOT EXISTS laporan_id UUID;
ALTER TABLE public.perbaikan
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.perbaikan
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE SEQUENCE IF NOT EXISTS public.perbaikan_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_no_perbaikan()
RETURNS TRIGGER AS $func$
DECLARE
  tahun TEXT;
  urutan BIGINT;
BEGIN
  IF NEW.no_perbaikan IS NOT NULL AND trim(NEW.no_perbaikan) <> '' THEN
    RETURN NEW;
  END IF;

  tahun := TO_CHAR(COALESCE(NEW.created_at, NOW()), 'YYYY');

  SELECT COALESCE(MAX(CAST(substring(no_perbaikan FROM '[0-9]+$') AS BIGINT)), 0)
    INTO urutan
  FROM public.perbaikan
  WHERE no_perbaikan IS NOT NULL
    AND no_perbaikan ~ ('^PBR-' || tahun || '-[0-9]{4}$');

  PERFORM setval('public.perbaikan_seq', urutan, true);
  NEW.no_perbaikan := 'PBR-' || tahun || '-' || LPAD(nextval('public.perbaikan_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_perbaikan_no ON public.perbaikan;
CREATE TRIGGER trg_perbaikan_no
  BEFORE INSERT ON public.perbaikan
  FOR EACH ROW
  WHEN (NEW.no_perbaikan IS NULL)
  EXECUTE FUNCTION public.generate_no_perbaikan();

DROP TRIGGER IF EXISTS trg_perbaikan_updated_at ON public.perbaikan;
CREATE TRIGGER trg_perbaikan_updated_at
  BEFORE UPDATE ON public.perbaikan
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. TABEL PERBAIKAN_LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perbaikan_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  perbaikan_id  UUID NOT NULL REFERENCES public.perbaikan(id) ON DELETE CASCADE,
  status_lama   TEXT,
  status_baru   TEXT NOT NULL,
  catatan       TEXT,
  dibuat_oleh   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABEL STANDBY_LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.standby_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id       UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  dicatat_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  alasan        TEXT NOT NULL CHECK (alasan IN (
                  'Menunggu DO',
                  'Sudah Dapat DO',
                  'Standby Tidak Ada Sopir',
                  'Standby Driver Izin'
                )),
  catatan       TEXT,
  status        TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Selesai')),
  mulai_at      TIMESTAMPTZ DEFAULT NOW(),
  selesai_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. UPDATE LAPORAN_KERUSAKAN DAN UNITS
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.laporan_kerusakan') IS NOT NULL THEN
    ALTER TABLE public.laporan_kerusakan
      ADD COLUMN IF NOT EXISTS perbaikan_id UUID;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'laporan_kerusakan_perbaikan_id_fkey'
    ) THEN
      ALTER TABLE public.laporan_kerusakan
        ADD CONSTRAINT laporan_kerusakan_perbaikan_id_fkey
        FOREIGN KEY (perbaikan_id) REFERENCES public.perbaikan(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.laporan_kerusakan
  DROP CONSTRAINT IF EXISTS laporan_kerusakan_status_check;

ALTER TABLE public.laporan_kerusakan
  ADD CONSTRAINT laporan_kerusakan_status_check CHECK (
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

ALTER TABLE public.laporan_kerusakan
  DROP CONSTRAINT IF EXISTS laporan_kerusakan_keputusan_admin_check;

ALTER TABLE public.laporan_kerusakan
  ADD CONSTRAINT laporan_kerusakan_keputusan_admin_check CHECK (
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

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS tipe_kepemilikan TEXT DEFAULT 'Reguler';

ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_status_check;

ALTER TABLE public.units
  ADD CONSTRAINT units_status_check CHECK (
    status IN (
      'Sedang Jalan',
      'Standby Pool',
      'Kontrak',
      'On-Call',
      'Perbaikan Pool',
      'Bengkel Luar',
      'Storing',
      'Driver Izin',
      'Standby - Menunggu DO',
      'Standby - Sudah Dapat DO',
      'Standby - Tidak Ada Sopir'
    )
  );

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_perbaikan_unit      ON public.perbaikan(unit_id);
CREATE INDEX IF NOT EXISTS idx_perbaikan_driver    ON public.perbaikan(driver_id);
CREATE INDEX IF NOT EXISTS idx_perbaikan_status    ON public.perbaikan(status);
CREATE INDEX IF NOT EXISTS idx_perbaikan_tipe      ON public.perbaikan(tipe);
CREATE INDEX IF NOT EXISTS idx_perbaikan_laporan   ON public.perbaikan(laporan_id);
CREATE INDEX IF NOT EXISTS idx_perbaikan_log       ON public.perbaikan_log(perbaikan_id);
CREATE INDEX IF NOT EXISTS idx_standby_unit        ON public.standby_log(unit_id);
CREATE INDEX IF NOT EXISTS idx_standby_status      ON public.standby_log(status);

-- ============================================================
-- 6. RLS HELPER FUNCTIONS + POLICIES
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role FROM public.users WHERE id = auth.uid()), '') IN ('admin','supervisor','manager');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_mekanik()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role FROM public.users WHERE id = auth.uid()), '') = 'mekanik';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE public.perbaikan     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perbaikan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standby_log   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perbaikan_select" ON public.perbaikan;
CREATE POLICY "perbaikan_select" ON public.perbaikan
  FOR SELECT USING (
    public.is_admin_or_above()
    OR public.is_mekanik()
    OR driver_id = auth.uid()
  );

DROP POLICY IF EXISTS "perbaikan_insert" ON public.perbaikan;
CREATE POLICY "perbaikan_insert" ON public.perbaikan
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "perbaikan_update" ON public.perbaikan;
CREATE POLICY "perbaikan_update" ON public.perbaikan
  FOR UPDATE USING (
    public.is_admin_or_above()
    OR mekanik_id = auth.uid()
  );

DROP POLICY IF EXISTS "perbaikan_log_select" ON public.perbaikan_log;
CREATE POLICY "perbaikan_log_select" ON public.perbaikan_log
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "perbaikan_log_insert" ON public.perbaikan_log;
CREATE POLICY "perbaikan_log_insert" ON public.perbaikan_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "standby_select" ON public.standby_log;
CREATE POLICY "standby_select" ON public.standby_log
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "standby_insert" ON public.standby_log;
CREATE POLICY "standby_insert" ON public.standby_log
  FOR INSERT WITH CHECK (public.is_admin_or_above());

DROP POLICY IF EXISTS "standby_update" ON public.standby_log;
CREATE POLICY "standby_update" ON public.standby_log
  FOR UPDATE USING (public.is_admin_or_above());

-- ============================================================
-- 7. VIEWS UNTUK OVERVIEW DASHBOARD
-- ============================================================
CREATE OR REPLACE VIEW public.v_overview_armada AS
WITH
  perbaikan_aktif AS (
    SELECT unit_id, tipe, status FROM public.perbaikan
    WHERE status IN ('Berjalan','Disetujui')
  ),
  standby_aktif AS (
    SELECT unit_id, alasan FROM public.standby_log WHERE status = 'Aktif'
  )
SELECT
  COUNT(*)                                                        AS total,
  COUNT(*) FILTER (WHERE u.status = 'Sedang Jalan')              AS sedang_jalan,
  COUNT(*) FILTER (WHERE u.status = 'Standby Pool'
    AND NOT EXISTS (SELECT 1 FROM standby_aktif sa WHERE sa.unit_id = u.id))  AS standby_pool,
  COUNT(*) FILTER (WHERE u.status = 'Kontrak')                   AS kontrak,
  COUNT(*) FILTER (WHERE u.status = 'On-Call')                   AS on_call,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM perbaikan_aktif pa
    WHERE pa.unit_id = u.id
    AND pa.tipe IN ('perbaikan_pool','bengkel_luar')
  ))                                                              AS perbaikan_pool,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM perbaikan_aktif pa
    WHERE pa.unit_id = u.id
    AND pa.tipe IN ('storing_internal','storing_luar')
  ))                                                              AS storing,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM standby_aktif sa WHERE sa.unit_id = u.id
    AND sa.alasan IN ('Menunggu DO','Sudah Dapat DO')
  ))                                                              AS menunggu_do,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM standby_aktif sa WHERE sa.unit_id = u.id
    AND sa.alasan = 'Standby Driver Izin'
  ))                                                              AS driver_izin,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM standby_aktif sa WHERE sa.unit_id = u.id
    AND sa.alasan = 'Standby Tidak Ada Sopir'
  ))                                                              AS tidak_ada_sopir
FROM public.units u;

CREATE OR REPLACE VIEW public.v_perbaikan_aktif AS
SELECT
  p.*,
  u.nopol, u.tipe AS tipe_unit,
  us.nama AS nama_driver,
  um.nama AS nama_mekanik,
  um.no_hp AS hp_mekanik,
  COALESCE(EXTRACT(DAY FROM NOW() - p.tgl_mulai)::INTEGER, 0) AS durasi_hari
FROM public.perbaikan p
JOIN public.units u ON p.unit_id = u.id
LEFT JOIN public.users us ON p.driver_id = us.id
LEFT JOIN public.users um ON p.mekanik_id = um.id
WHERE p.status IN ('Berjalan','Disetujui','Menunggu Approval')
ORDER BY p.created_at DESC;

CREATE OR REPLACE VIEW public.v_standby_aktif AS
SELECT
  sl.*, u.nopol, u.tipe AS tipe_unit, u.status AS status_unit,
  us.nama AS nama_driver,
  ua.nama AS dicatat_oleh_nama
FROM public.standby_log sl
JOIN public.units u ON sl.unit_id = u.id
LEFT JOIN public.users us ON u.driver_id = us.id
LEFT JOIN public.users ua ON sl.dicatat_oleh = ua.id
WHERE sl.status = 'Aktif'
ORDER BY sl.mulai_at DESC;

-- ============================================================
-- SELESAI
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM public.perbaikan) AS tabel_perbaikan,
  (SELECT COUNT(*) FROM public.standby_log) AS tabel_standby_log,
  (SELECT COUNT(*) FROM public.perbaikan_log) AS tabel_perbaikan_log,
  'Migration FleetMate v5.0 aman berhasil!' AS status;
