-- Pulang ke Pool is a separate confirmation flow, not a storing workflow.
-- Run this once in Supabase SQL Editor before deploying the frontend changes.

ALTER TABLE public.perbaikan DROP CONSTRAINT IF EXISTS perbaikan_status_check;
ALTER TABLE public.perbaikan ADD CONSTRAINT perbaikan_status_check CHECK (
  status IN ('Disetujui','Berjalan','Menunggu Tiba di Pool','Selesai','Ditolak','Lanjut Perjalanan')
);

ALTER TABLE public.perbaikan DROP CONSTRAINT IF EXISTS perbaikan_progres_check;
ALTER TABLE public.perbaikan ADD CONSTRAINT perbaikan_progres_check CHECK (
  progres IS NULL OR progres IN (
    'Menunggu Mekanik','Mekanik Ditugaskan','Mekanik Berangkat','Mekanik Tiba',
    'Perbaikan Ditugaskan','Perbaikan Berlangsung','Menunggu Tiba di Pool',
    'Tiba di Pool','Tanpa Tahapan','Selesai','Disetujui'
  )
);

ALTER TABLE public.laporan_kerusakan DROP CONSTRAINT IF EXISTS laporan_kerusakan_status_check;
ALTER TABLE public.laporan_kerusakan ADD CONSTRAINT laporan_kerusakan_status_check CHECK (
  status IN (
    'Dilaporkan','Ditangani','Menunggu Approval Storing','Menunggu Approval Pulang ke Pool',
    'Menunggu Keputusan Pengurus','Storing Disetujui','Storing Luar Disetujui',
    'Pulang ke Pool Disetujui','Pulang ke Pool','Tiba di Pool','Lanjut Perjalanan','Selesai'
  )
);

ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_status_check;
ALTER TABLE public.units ADD CONSTRAINT units_status_check CHECK (
  status IN (
    'Sedang Jalan','Standby Pool','Kontrak','On-Call','Perbaikan Pool','Bengkel Luar',
    'Storing','Pulang ke Pool','Tiba di Pool','Driver Izin','Standby - Menunggu DO',
    'Standby - Sudah Dapat DO','Standby - Tidak Ada Sopir'
  )
);

-- Existing approved requests remain visible for confirmation after this migration.
UPDATE public.perbaikan
SET status = 'Menunggu Tiba di Pool', progres = 'Menunggu Tiba di Pool', tgl_selesai = NULL
WHERE tipe = 'pulang_ke_pool' AND status IN ('Disetujui','Berjalan');

-- Driver may only confirm arrival for their own active Pulang ke Pool record.
-- SECURITY DEFINER keeps the four related updates atomic while RLS remains strict.
CREATE OR REPLACE FUNCTION public.konfirmasi_tiba_pool(p_perbaikan_id UUID, p_driver_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perbaikan public.perbaikan%ROWTYPE;
BEGIN
  SELECT * INTO v_perbaikan
  FROM public.perbaikan
  WHERE id = p_perbaikan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pulang ke pool tidak ditemukan';
  END IF;
  IF v_perbaikan.driver_id IS DISTINCT FROM p_driver_id THEN
    RAISE EXCEPTION 'Anda tidak berhak mengonfirmasi kendaraan ini';
  END IF;
  IF v_perbaikan.tipe <> 'pulang_ke_pool' OR v_perbaikan.status <> 'Menunggu Tiba di Pool' THEN
    RAISE EXCEPTION 'Kendaraan ini tidak menunggu konfirmasi tiba di pool';
  END IF;

  UPDATE public.perbaikan
  SET status = 'Selesai', progres = 'Tiba di Pool', tgl_selesai = NOW()
  WHERE id = v_perbaikan.id;

  UPDATE public.units SET status = 'Tiba di Pool' WHERE id = v_perbaikan.unit_id;
  UPDATE public.laporan_kerusakan SET status = 'Tiba di Pool' WHERE id = v_perbaikan.laporan_id;
  INSERT INTO public.perbaikan_log (perbaikan_id, status_lama, status_baru)
  VALUES (v_perbaikan.id, v_perbaikan.progres, 'Tiba di Pool');
END;
$$;

REVOKE ALL ON FUNCTION public.konfirmasi_tiba_pool(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.konfirmasi_tiba_pool(UUID, UUID) TO anon, authenticated;
