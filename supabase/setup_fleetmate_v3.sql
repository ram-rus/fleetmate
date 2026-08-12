-- ============================================================
-- FLEETMATE v3.0 — PT. MMS
-- SQL SETUP LENGKAP — Jalankan SEKALI di Supabase SQL Editor
-- ============================================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HAPUS TABEL LAMA (jika ada)
-- ============================================================
DROP TABLE IF EXISTS public.laporan_kerusakan CASCADE;
DROP TABLE IF EXISTS public.notifikasi        CASCADE;
DROP TABLE IF EXISTS public.dokumen           CASCADE;
DROP TABLE IF EXISTS public.storing           CASCADE;
DROP TABLE IF EXISTS public.spk               CASCADE;
DROP TABLE IF EXISTS public.p2h               CASCADE;
DROP TABLE IF EXISTS public.units             CASCADE;
DROP TABLE IF EXISTS public.users             CASCADE;

DROP VIEW IF EXISTS public.v_overview_armada  CASCADE;
DROP VIEW IF EXISTS public.v_storing_aktif    CASCADE;
DROP VIEW IF EXISTS public.v_dokumen_status   CASCADE;
DROP VIEW IF EXISTS public.v_p2h_hari_ini     CASCADE;
DROP VIEW IF EXISTS public.v_spk_aktif        CASCADE;

DROP FUNCTION IF EXISTS public.get_my_role()          CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_above()    CASCADE;
DROP FUNCTION IF EXISTS public.is_driver()            CASCADE;
DROP FUNCTION IF EXISTS public.is_mekanik()           CASCADE;
DROP FUNCTION IF EXISTS public.get_my_nopol()         CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at()    CASCADE;

-- ============================================================
-- TABEL USERS
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('driver','mekanik','admin','supervisor','manager')),
  no_hp         TEXT,
  nopol_assign  TEXT,
  fcm_token     TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL UNITS
-- ============================================================
CREATE TABLE public.units (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nopol         TEXT NOT NULL UNIQUE,
  tipe          TEXT NOT NULL CHECK (tipe IN ('Wing Box','CDD','CDE','Fuso','Grandmax')),
  merk          TEXT NOT NULL,
  tahun_buat    INTEGER NOT NULL,
  warna         TEXT,
  status        TEXT NOT NULL DEFAULT 'Standby Pool' CHECK (
                  status IN (
                    'Sedang Jalan','Standby Pool','Kontrak','On-Call',
                    'Perbaikan Pool','Bengkel Luar','Storing','Driver Izin'
                  )
                ),
  driver_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  km_terakhir   INTEGER DEFAULT 0,
  catatan       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL P2H
-- ============================================================
CREATE TABLE public.p2h (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id       UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  hasil         JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL CHECK (status IN ('LAYAK','TIDAK LAYAK')),
  catatan       TEXT,
  foto_urls     TEXT[] DEFAULT '{}',
  km_saat_p2h   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_id, tanggal)
);

-- ============================================================
-- TABEL SPK
-- ============================================================
CREATE TABLE public.spk (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  no_spk          TEXT NOT NULL UNIQUE,
  unit_id         UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  mekanik_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dibuat_oleh     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  keluhan         TEXT NOT NULL,
  jenis           TEXT NOT NULL CHECK (jenis IN ('Korektif','Preventif')),
  lokasi          TEXT NOT NULL CHECK (lokasi IN ('Pool','Bengkel Luar','Lapangan')),
  status          TEXT NOT NULL DEFAULT 'Waiting' CHECK (
                    status IN ('Waiting','In Progress','Selesai','Dibatalkan')
                  ),
  prioritas       TEXT DEFAULT 'Normal' CHECK (prioritas IN ('Normal','Urgent')),
  catatan_mekanik TEXT,
  foto_urls       TEXT[] DEFAULT '{}',
  tgl_mulai       DATE,
  tgl_selesai     DATE,
  storing_id      UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL STORING
-- ============================================================
CREATE TABLE public.storing (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id       UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lokasi        TEXT NOT NULL,
  koordinat     TEXT,
  alasan        TEXT NOT NULL,
  foto_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'Pending' CHECK (
                  status IN ('Pending','Aktif','Selesai','Ditolak')
                ),
  catatan_admin TEXT,
  approved_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tgl_mulai     TIMESTAMPTZ,
  tgl_selesai   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS mekanik_id           UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS tgl_berangkat        DATE;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS jam_berangkat        TIME;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS jam_estimasi_tiba    TIME;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS catatan_driver       TEXT;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS progres              TEXT DEFAULT 'Menunggu Mekanik';
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS laporan_kerusakan_id UUID;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS ditugaskan_at        TIMESTAMPTZ;
ALTER TABLE public.storing ADD COLUMN IF NOT EXISTS ditugaskan_oleh      UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE TABLE public.perbaikan (
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

CREATE TABLE public.perbaikan_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  perbaikan_id UUID NOT NULL REFERENCES public.perbaikan(id) ON DELETE CASCADE,
  status_lama  TEXT,
  status_baru  TEXT NOT NULL,
  catatan      TEXT,
  dibuat_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.standby_log (
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

CREATE TABLE public.storing_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storing_id   UUID NOT NULL REFERENCES public.storing(id) ON DELETE CASCADE,
  status_lama  TEXT,
  status_baru  TEXT NOT NULL,
  catatan      TEXT,
  dibuat_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL NOTIFIKASI
-- ============================================================
CREATE TABLE public.notifikasi (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  judul       TEXT NOT NULL,
  isi         TEXT NOT NULL,
  tipe        TEXT NOT NULL CHECK (tipe IN ('spk','storing','p2h','sistem')),
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL LAPORAN KERUSAKAN
-- ============================================================
CREATE TABLE public.laporan_kerusakan (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id     UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jenis       TEXT NOT NULL,
  deskripsi   TEXT NOT NULL,
  foto_urls   TEXT[] DEFAULT '{}',
  koordinat   TEXT,
  status      TEXT DEFAULT 'Dilaporkan' CHECK (
                status IN ('Dilaporkan','Ditangani','Selesai')
              ),
  spk_id      UUID REFERENCES public.spk(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS catatan          TEXT;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS koordinat_lat    DOUBLE PRECISION;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS koordinat_lng    DOUBLE PRECISION;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS km_kendaraan     INTEGER;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS pilihan_driver   TEXT;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS keputusan_admin  TEXT;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS diputuskan_oleh  UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS diputuskan_at    TIMESTAMPTZ;
ALTER TABLE public.laporan_kerusakan ADD COLUMN IF NOT EXISTS perbaikan_id    UUID;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_p2h_unit_tanggal ON public.p2h(unit_id, tanggal);
CREATE INDEX idx_p2h_driver       ON public.p2h(driver_id);
CREATE INDEX idx_p2h_tanggal      ON public.p2h(tanggal DESC);
CREATE INDEX idx_spk_status       ON public.spk(status);
CREATE INDEX idx_spk_unit         ON public.spk(unit_id);
CREATE INDEX idx_spk_mekanik      ON public.spk(mekanik_id);
CREATE INDEX idx_storing_status   ON public.storing(status);
CREATE INDEX idx_storing_unit     ON public.storing(unit_id);
CREATE INDEX idx_storing_driver   ON public.storing(driver_id);
CREATE INDEX idx_notif_user       ON public.notifikasi(user_id, is_read);
CREATE INDEX idx_units_status     ON public.units(status);
CREATE INDEX idx_laporan_unit     ON public.laporan_kerusakan(unit_id);
CREATE INDEX idx_laporan_driver   ON public.laporan_kerusakan(driver_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at  BEFORE UPDATE ON public.users  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_units_updated_at  BEFORE UPDATE ON public.units  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_spk_updated_at    BEFORE UPDATE ON public.spk    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_storing_updated_at BEFORE UPDATE ON public.storing FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helper functions untuk RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin','supervisor','manager')
  FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS BOOLEAN AS $$
  SELECT role = 'driver' FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_mekanik()
RETURNS BOOLEAN AS $$
  SELECT role = 'mekanik' FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2h               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spk               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storing           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_kerusakan ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- USERS
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (id = auth.uid() OR public.is_admin_or_above());

-- UNITS
CREATE POLICY "units_select" ON public.units FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "units_insert" ON public.units FOR INSERT WITH CHECK (public.is_admin_or_above());
CREATE POLICY "units_update" ON public.units FOR UPDATE USING (public.is_admin_or_above());
CREATE POLICY "units_delete" ON public.units FOR DELETE USING (public.get_my_role() = 'admin');

-- P2H
CREATE POLICY "p2h_select" ON public.p2h FOR SELECT USING (
  driver_id = auth.uid() OR public.is_admin_or_above() OR public.is_mekanik()
);
CREATE POLICY "p2h_insert" ON public.p2h FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "p2h_update" ON public.p2h FOR UPDATE USING (public.is_admin_or_above());

-- SPK
CREATE POLICY "spk_select" ON public.spk FOR SELECT USING (
  public.is_admin_or_above() OR mekanik_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id AND u.driver_id = auth.uid())
);
CREATE POLICY "spk_insert" ON public.spk FOR INSERT WITH CHECK (public.is_admin_or_above());
CREATE POLICY "spk_update" ON public.spk FOR UPDATE USING (
  public.is_admin_or_above() OR mekanik_id = auth.uid()
);

-- STORING
CREATE POLICY "storing_select" ON public.storing FOR SELECT USING (
  public.is_admin_or_above() OR driver_id = auth.uid()
);
CREATE POLICY "storing_insert" ON public.storing FOR INSERT WITH CHECK (
  public.is_admin_or_above() OR driver_id = auth.uid()
);
CREATE POLICY "storing_update" ON public.storing FOR UPDATE USING (
  public.is_admin_or_above() OR (driver_id = auth.uid() AND status = 'Pending')
);

-- NOTIFIKASI
CREATE POLICY "notif_select" ON public.notifikasi FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifikasi FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update" ON public.notifikasi FOR UPDATE USING (user_id = auth.uid());

-- LAPORAN KERUSAKAN
CREATE POLICY "laporan_select" ON public.laporan_kerusakan FOR SELECT USING (
  public.is_admin_or_above() OR public.is_mekanik() OR driver_id = auth.uid()
);
CREATE POLICY "laporan_insert" ON public.laporan_kerusakan FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "laporan_update" ON public.laporan_kerusakan FOR UPDATE USING (public.is_admin_or_above());

-- ============================================================
-- VIEWS
-- ============================================================
CREATE OR REPLACE VIEW public.v_overview_armada AS
SELECT
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE status = 'Sedang Jalan')      AS sedang_jalan,
  COUNT(*) FILTER (WHERE status = 'Standby Pool')      AS standby_pool,
  COUNT(*) FILTER (WHERE status = 'Kontrak')           AS kontrak,
  COUNT(*) FILTER (WHERE status = 'On-Call')           AS on_call,
  COUNT(*) FILTER (WHERE status = 'Perbaikan Pool')    AS perbaikan_pool,
  COUNT(*) FILTER (WHERE status = 'Bengkel Luar')      AS bengkel_luar,
  COUNT(*) FILTER (WHERE status = 'Storing')           AS storing,
  COUNT(*) FILTER (WHERE status = 'Driver Izin')       AS driver_izin
FROM public.units;

CREATE OR REPLACE VIEW public.v_p2h_hari_ini AS
SELECT p.*, u.nopol, u.tipe, us.nama AS nama_driver
FROM public.p2h p
JOIN public.units u  ON p.unit_id  = u.id
JOIN public.users us ON p.driver_id = us.id
WHERE p.tanggal = CURRENT_DATE;

CREATE OR REPLACE VIEW public.v_storing_aktif AS
SELECT
  s.*,
  u.nopol, u.tipe,
  us.nama AS nama_driver,
  COALESCE(EXTRACT(DAY FROM NOW() - s.tgl_mulai)::INTEGER, 0) AS durasi_hari
FROM public.storing s
JOIN public.units u  ON s.unit_id  = u.id
JOIN public.users us ON s.driver_id = us.id
WHERE s.status IN ('Pending','Aktif')
ORDER BY s.tgl_mulai ASC NULLS LAST;

CREATE OR REPLACE VIEW public.v_spk_aktif AS
SELECT
  s.*,
  u.nopol, u.tipe,
  um.nama AS nama_mekanik,
  ua.nama AS nama_pembuat
FROM public.spk s
JOIN  public.units u  ON s.unit_id     = u.id
LEFT JOIN public.users um ON s.mekanik_id  = um.id
LEFT JOIN public.users ua ON s.dibuat_oleh = ua.id
WHERE s.status IN ('Waiting','In Progress')
ORDER BY
  CASE s.prioritas WHEN 'Urgent' THEN 0 ELSE 1 END,
  s.created_at DESC;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('p2h-photos', 'p2h-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('storing-photos', 'storing-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kerusakan-photos', 'kerusakan-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies — allow authenticated upload & public read
CREATE POLICY "storage_p2h_upload"      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'p2h-photos'       AND auth.role() = 'authenticated');
CREATE POLICY "storage_p2h_read"        ON storage.objects FOR SELECT USING (bucket_id = 'p2h-photos');
CREATE POLICY "storage_storing_upload"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'storing-photos'   AND auth.role() = 'authenticated');
CREATE POLICY "storage_storing_read"    ON storage.objects FOR SELECT USING (bucket_id = 'storing-photos');
CREATE POLICY "storage_kerusakan_upload"ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kerusakan-photos' AND auth.role() = 'authenticated');
CREATE POLICY "storage_kerusakan_read"  ON storage.objects FOR SELECT USING (bucket_id = 'kerusakan-photos');

-- ============================================================
-- DATA SAMPLE UNITS (untuk testing)
-- ============================================================
INSERT INTO public.units (nopol, tipe, merk, tahun_buat, status) VALUES
  ('B 1001 MMS', 'Wing Box', 'Mitsubishi Fuso', 2020, 'Sedang Jalan'),
  ('B 1002 MMS', 'Wing Box', 'Mitsubishi Fuso', 2021, 'Sedang Jalan'),
  ('B 1003 MMS', 'Wing Box', 'Hino 500',        2021, 'Sedang Jalan'),
  ('B 1004 MMS', 'Wing Box', 'Hino 500',        2022, 'Standby Pool'),
  ('B 1005 MMS', 'Wing Box', 'Isuzu Giga',      2022, 'Kontrak'),
  ('B 2001 MMS', 'CDD',      'Hino Dutro',      2019, 'Sedang Jalan'),
  ('B 2002 MMS', 'CDD',      'Isuzu Elf',       2020, 'Sedang Jalan'),
  ('B 2003 MMS', 'CDD',      'Mitsubishi Colt', 2019, 'Perbaikan Pool'),
  ('B 2004 MMS', 'CDD',      'Hino Dutro',      2021, 'Storing'),
  ('B 2005 MMS', 'CDD',      'Isuzu Elf',       2022, 'On-Call')
ON CONFLICT (nopol) DO NOTHING;

-- ============================================================
-- SELESAI!
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM public.units)  AS total_units,
  (SELECT COUNT(*) FROM public.users)  AS total_users,
  'Database FleetMate v3.0 siap digunakan!' AS status;
