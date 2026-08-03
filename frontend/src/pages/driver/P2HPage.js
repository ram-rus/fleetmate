// src/pages/driver/P2HPage.js — v7
// Checklist P2H per section (fluida, rem, ban, dokumen, lain)
// Severity 3 tingkat: OK / PERHATIAN / BAHAYA -> LAYAK / LAYAK DENGAN CATATAN / TIDAK LAYAK
// Ban dinamis mengikuti units.tipe (Wing Box / CDD / CDE) berdasarkan driver.unit_id
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useDriverAuth } from '../../context/DriverAuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import toast from 'react-hot-toast';

// ---------- Severity ----------

const SEV = { OK: 0, PERHATIAN: 1, BAHAYA: 2 };

const SEV_COLOR = {
  [SEV.OK]:        { bg: '#d1fae5', fg: '#065f46' },
  [SEV.PERHATIAN]: { bg: '#fffbeb', fg: '#92400e' },
  [SEV.BAHAYA]:    { bg: '#fee2e2', fg: '#7f1d1d' },
};

const STATUS_COLOR = {
  'LAYAK':                { bg: '#d1fae5', fg: '#065f46' },
  'LAYAK DENGAN CATATAN': { bg: '#fffbeb', fg: '#92400e' },
  'TIDAK LAYAK':          { bg: '#fee2e2', fg: '#7f1d1d' },
};

// ---------- Konfigurasi ban per tipe unit ----------
// Sumber tipe: kolom units.tipe (dilihat dari Data Unit admin: "Wing Box", "CDD").
// CDE belum ada unitnya di database saat kode ini ditulis — asumsi string "CDE".
// Kalau nanti string aslinya beda, tinggal sesuaikan key di BAN_CONFIG (sudah
// dinormalisasi lowercase+trim jadi tidak sensitif kapitalisasi/spasi).

const BAN_CONFIG = {
  'wing box': [
    'depan_kiri', 'depan_kanan',
    'engkel_kiri_luar', 'engkel_kiri_dalam', 'engkel_kanan_luar', 'engkel_kanan_dalam',
    'tronton_kiri_luar', 'tronton_kiri_dalam', 'tronton_kanan_luar', 'tronton_kanan_dalam',
    'ban_stip',
  ],
  'cdd': [
    'depan_kiri', 'depan_kanan',
    'engkel_kiri_luar', 'engkel_kiri_dalam', 'engkel_kanan_luar', 'engkel_kanan_dalam',
    'ban_stip',
  ],
  'cde': [
    'depan_kiri', 'depan_kanan', 'engkel_kiri', 'engkel_kanan', 'ban_stip',
  ],
};

const BAN_LABEL = {
  depan_kiri: 'Depan kiri', depan_kanan: 'Depan kanan',
  engkel_kiri: 'Engkel kiri', engkel_kanan: 'Engkel kanan',
  engkel_kiri_luar: 'Engkel kiri luar', engkel_kiri_dalam: 'Engkel kiri dalam',
  engkel_kanan_luar: 'Engkel kanan luar', engkel_kanan_dalam: 'Engkel kanan dalam',
  tronton_kiri_luar: 'Tronton kiri luar', tronton_kiri_dalam: 'Tronton kiri dalam',
  tronton_kanan_luar: 'Tronton kanan luar', tronton_kanan_dalam: 'Tronton kanan dalam',
  ban_stip: 'Ban stip',
};

function normalizeTipe(tipe) {
  return (tipe || '').trim().toLowerCase();
}

function getBanKeys(tipeUnit) {
  return BAN_CONFIG[normalizeTipe(tipeUnit)] || null; // null = tipe belum dikenal sistem
}

// ---------- Opsi per item ----------

const FLUIDA_OPTS = [
  { value: 'normal',    label: 'Normal',    severity: SEV.OK },
  { value: 'berkurang', label: 'Berkurang', severity: SEV.PERHATIAN },
  { value: 'kritis',    label: 'Kritis',    severity: SEV.BAHAYA },
  { value: 'kosong',    label: 'Kosong',    severity: SEV.BAHAYA },
];

const MINYAK_REM_OPTS = [
  { value: 'normal',    label: 'Normal',    severity: SEV.OK },
  { value: 'berkurang', label: 'Berkurang', severity: SEV.BAHAYA },
  { value: 'kritis',    label: 'Kritis',    severity: SEV.BAHAYA },
  { value: 'kosong',    label: 'Kosong',    severity: SEV.BAHAYA },
];

const REM_OPTS = [
  { value: 'normal', label: 'Normal', severity: SEV.OK },
  { value: 'kurang', label: 'Kurang', severity: SEV.PERHATIAN },
  { value: 'bocor',  label: 'Bocor',  severity: SEV.BAHAYA },
];

const BAN_OPTS = [
  { value: 'normal', label: 'Normal', severity: SEV.OK },
  { value: 'gundul', label: 'Gundul', severity: SEV.BAHAYA },
  { value: 'bocor',  label: 'Bocor',  severity: SEV.BAHAYA },
];

// Dokumen tidak punya severity — murni catatan, tidak pengaruh ke status akhir.
const DOKUMEN_OPTS = [
  { value: 'ada',        label: 'Ada' },
  { value: 'tidak_ada',  label: 'Tidak ada' },
  { value: 'kadaluarsa', label: 'Kadaluarsa' },
];

// Item kritis (lampu depan): NOK langsung BAHAYA, konsisten dengan aturan bisnis lama.
const OK_OPTS_KRITIS = [
  { value: 'ok',  label: 'OK',  severity: SEV.OK },
  { value: 'nok', label: 'NOK', severity: SEV.BAHAYA },
];

// Item ringan: NOK cuma PERHATIAN.
const OK_OPTS_RINGAN = [
  { value: 'ok',  label: 'OK',  severity: SEV.OK },
  { value: 'nok', label: 'NOK', severity: SEV.PERHATIAN },
];

function buildSections(banKeys) {
  return [
    {
      id: 'fluida', title: 'Cairan & fluida',
      items: [
        { key: 'oli_mesin',    label: 'Oli mesin',    opts: FLUIDA_OPTS },
        { key: 'air_radiator', label: 'Air radiator', opts: FLUIDA_OPTS },
        { key: 'minyak_rem',   label: 'Minyak rem',   opts: MINYAK_REM_OPTS },
      ],
    },
    {
      id: 'rem', title: 'Rem',
      items: [
        { key: 'rem_depan',    label: 'Rem depan',    opts: REM_OPTS },
        { key: 'rem_belakang', label: 'Rem belakang', opts: REM_OPTS },
      ],
    },
    {
      id: 'ban', title: 'Ban',
      items: (banKeys || []).map(k => ({ key: k, label: BAN_LABEL[k] || k, opts: BAN_OPTS })),
    },
    {
      id: 'dokumen', title: 'Surat-surat', catatanOnly: true,
      items: [
        { key: 'stnk', label: 'STNK',        opts: DOKUMEN_OPTS },
        { key: 'kir',  label: 'KIR',         opts: DOKUMEN_OPTS },
        { key: 'sim',  label: 'SIM driver',  opts: DOKUMEN_OPTS },
      ],
    },
    {
      id: 'lain', title: 'Item lain',
      items: [
        { key: 'lampu_depan',    label: 'Lampu depan',      opts: OK_OPTS_KRITIS },
        { key: 'lampu_belakang', label: 'Lampu belakang',   opts: OK_OPTS_RINGAN },
        { key: 'lampu_sein',     label: 'Lampu sein',       opts: OK_OPTS_RINGAN },
        { key: 'wiper',          label: 'Wiper / kaca',     opts: OK_OPTS_RINGAN },
        { key: 'klakson',        label: 'Klakson',          opts: OK_OPTS_RINGAN },
        { key: 'kebersihan',     label: 'Kebersihan kabin', opts: OK_OPTS_RINGAN },
      ],
    },
  ];
}

// hasil menyimpan { value, severity, label } per item — bukan cuma value mentah.
// Alasan: kata yang sama ("berkurang") bisa beda severity tergantung item
// (oli = PERHATIAN, minyak rem = BAHAYA). Dengan severity+label ikut disimpan,
// dashboard admin tinggal baca tanpa perlu duplikasi aturan bisnis ini.
function defaultHasil(sections) {
  const out = {};
  sections.forEach(sec => {
    out[sec.id] = {};
    sec.items.forEach(it => {
      const opt = it.opts[0];
      out[sec.id][it.key] = { value: opt.value, label: opt.label, severity: opt.severity ?? null };
    });
  });
  return out;
}

function severityOf(sec, it, hasil) {
  return hasil[sec.id]?.[it.key]?.severity ?? SEV.OK; // dokumen (catatanOnly) severity-nya null -> anggap OK
}

function computeStatus(sections, hasil) {
  let maxSeverity = SEV.OK;
  sections.forEach(sec => {
    if (sec.catatanOnly) return; // dokumen tidak pengaruh ke status
    sec.items.forEach(it => {
      const s = severityOf(sec, it, hasil);
      if (s > maxSeverity) maxSeverity = s;
    });
  });
  if (maxSeverity === SEV.BAHAYA) return 'TIDAK LAYAK';
  if (maxSeverity === SEV.PERHATIAN) return 'LAYAK DENGAN CATATAN';
  return 'LAYAK';
}

// ---------- Komponen ----------

export default function DriverP2HPage() {
  const { driver } = useDriverAuth();
  const [unit, setUnit]               = useState(null); // { id, nopol, tipe }
  const [existing, setExist]          = useState(null);
  const [loadingCek, setCek]          = useState(true);
  const [openSection, setOpenSection] = useState('fluida');
  const [hasil, setHasil]             = useState({});
  const [km, setKm]                   = useState('');
  const [catatan, setCatatan]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);

  const banKeys  = useMemo(() => (unit ? getBanKeys(unit.tipe) : null), [unit]);
  const sections = useMemo(() => buildSections(banKeys), [banKeys]);

  useEffect(() => {
    if (!driver?.unit_id) { setCek(false); return; }
    async function cek() {
      const { data: unitData } = await supabase
        .from('units').select('id, nopol, tipe').eq('id', driver.unit_id).maybeSingle();
      setUnit(unitData);

      const today = new Date().toISOString().slice(0, 10);
      const { data: p2h } = await supabase
        .from('p2h').select('*').eq('unit_id', driver.unit_id).eq('tanggal', today).maybeSingle();
      setExist(p2h);
      setCek(false);
    }
    cek();
  }, [driver]);

  useEffect(() => {
    if (sections.length) setHasil(defaultHasil(sections));
  }, [sections]);

  const statusHasil = useMemo(() => computeStatus(sections, hasil), [sections, hasil]);

  function setItemValue(sectionId, itemKey, opt) {
    setHasil(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [itemKey]: { value: opt.value, label: opt.label, severity: opt.severity ?? null },
      },
    }));
  }

  async function handleSubmit() {
    if (!unit) { toast.error('Unit tidak ditemukan'); return; }
    if (banKeys === null) { toast.error(`Tipe unit "${unit.tipe}" belum dikenali sistem, hubungi admin`); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('p2h').insert({
        unit_id:     unit.id,
        driver_id:   driver.id,
        tanggal:     new Date().toISOString().slice(0, 10),
        hasil,
        status:      statusHasil,
        km_saat_p2h: km ? parseInt(km) : null,
        catatan,
      });
      if (error) {
        if (error.code === '23505') toast.error('P2H sudah disubmit hari ini');
        else throw error;
        return;
      }
      if (km) await supabase.from('units').update({ km_terakhir: parseInt(km) }).eq('id', unit.id);
      setDone(true);
      toast.success('P2H berhasil disubmit!');
    } catch (e) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingCek) {
    return <DriverLayout title="P2H Digital" back><div style={{ padding: 40, textAlign: 'center' }}>Memuat...</div></DriverLayout>;
  }

  if (existing || done) {
    const data = existing || {};
    const sc = STATUS_COLOR[data.status] || STATUS_COLOR['LAYAK'];
    return (
      <DriverLayout title="P2H Digital" back>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: sc.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '20px auto 16px' }}>
            {data.status === 'TIDAK LAYAK' ? '⛔' : '✅'}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1c1e', marginBottom: 6 }}>P2H Sudah Disubmit</h2>
          <p style={{ fontSize: 12, color: '#74777f', marginBottom: 20 }}>Anda sudah melakukan P2H hari ini</p>
          <div style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 12, padding: 16, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
              <span style={{ color: '#74777f' }}>Status</span>
              <span style={{ fontWeight: 700, color: sc.fg }}>{data.status || statusHasil}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#74777f' }}>Waktu</span>
              <span style={{ fontWeight: 600 }}>
                {(data.created_at ? new Date(data.created_at) : new Date()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout title="P2H Digital" back>
      <div style={{ padding: 16 }}>
        <div style={{ background: '#1a2b4b', borderRadius: 12, padding: 14, marginBottom: 16, color: '#fff' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Unit Anda</p>
          <p style={{ fontSize: 18, fontWeight: 700 }}>
            {unit?.nopol || '—'}{unit?.tipe ? ` — ${unit.tipe}` : ''}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {unit && banKeys === null && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#9f1239', fontWeight: 600 }}>
            ⚠ Tipe unit "{unit.tipe}" belum dikenali sistem. Hubungi admin sebelum submit P2H.
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>KM Saat Ini</label>
          <input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="Contoh: 87500"
            style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'Montserrat,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {sections.map(sec => {
          const isOpen = openSection === sec.id;
          let sectionMaxSeverity = SEV.OK;
          sec.items.forEach(it => {
            const s = severityOf(sec, it, hasil);
            if (s > sectionMaxSeverity) sectionMaxSeverity = s;
          });
          const badgeColor = sec.catatanOnly ? { bg: '#f1f0ea', fg: '#5f5e5a' } : SEV_COLOR[sectionMaxSeverity];
          const badgeText = sec.catatanOnly
            ? `${sec.items.length} item`
            : sectionMaxSeverity === SEV.BAHAYA ? 'perlu perhatian'
            : sectionMaxSeverity === SEV.PERHATIAN ? 'catatan'
            : `${sec.items.length} item`;

          return (
            <div key={sec.id} style={{ border: '1px solid #ebeced', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
              <div onClick={() => setOpenSection(isOpen ? null : sec.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', background: '#f8f9fa' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1e' }}>{sec.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: badgeColor.bg, color: badgeColor.fg }}>{badgeText}</span>
                  <span style={{ fontSize: 12, color: '#74777f', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: '10px 14px 14px' }}>
                  {sec.items.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9f1239' }}>Konfigurasi ban untuk tipe unit ini belum tersedia.</p>
                  )}
                  {sec.items.map(it => {
                    const current = hasil[sec.id]?.[it.key];
                    const val = current?.value;
                    const opt = it.opts.find(o => o.value === val) || it.opts[0];
                    const color = sec.catatanOnly
                      ? (opt.value === 'ada' ? SEV_COLOR[SEV.OK] : SEV_COLOR[SEV.BAHAYA])
                      : SEV_COLOR[opt.severity];
                    return (
                      <div key={it.key} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1c1e' }}>{it.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: color.bg, color: color.fg }}>{opt.label}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${it.opts.length}, 1fr)`, gap: 6 }}>
                          {it.opts.map(o => {
                            const active = o.value === val;
                            const c = sec.catatanOnly
                              ? (o.value === 'ada' ? SEV_COLOR[SEV.OK] : SEV_COLOR[SEV.BAHAYA])
                              : SEV_COLOR[o.severity];
                            return (
                              <button key={o.value} onClick={() => setItemValue(sec.id, it.key, o)}
                                style={{
                                  fontSize: 11, fontWeight: active ? 700 : 500, padding: '8px 4px', borderRadius: 8,
                                  border: active ? `1px solid ${c.fg}` : '1px solid #c4c7cf',
                                  background: active ? c.bg : '#fff', color: active ? c.fg : '#44474e',
                                  cursor: 'pointer', fontFamily: 'Montserrat,sans-serif',
                                }}>
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Catatan (opsional)</label>
          <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan tambahan..."
            style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 16,
          background: STATUS_COLOR[statusHasil].bg, color: STATUS_COLOR[statusHasil].fg }}>
          Hasil P2H: {statusHasil}
        </div>

        <button onClick={handleSubmit} disabled={saving || banKeys === null}
          style={{ width: '100%', background: (saving || banKeys === null) ? '#6b7280' : '#1a2b4b', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: (saving || banKeys === null) ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Menyimpan...' : 'Submit P2H'}
        </button>
      </div>
    </DriverLayout>
  );
}