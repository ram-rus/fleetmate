// src/lib/perbaikanConstants.js — v5.2
// Konstanta terpusat untuk tipe, status, progres perbaikan

// ── Selector untuk query Supabase ──────────────────────────
export const PERBAIKAN_SELECT = `
  *,
  unit:units(id,nopol,tipe),
  mekanik:users!perbaikan_mekanik_id_fkey(id,nama,no_hp)
`;

// ── Klasifikasi tipe: mana yang masuk Storing vs Perbaikan ─
// Storing  : storing_internal, storing_luar, bengkel_luar, pulang_ke_pool
// Perbaikan: perbaikan_pool
// Catatan: pulang_ke_pool sebelumnya TIDAK masuk ke daftar manapun — akibatnya
// unit dengan tipe ini tidak pernah dihitung sebagai "sibuk" di Overview, dan
// bisa salah tampil sebagai "Sedang Jalan" padahal sedang menuju pool.
export const TIPE_STORING    = ['storing_internal','storing_luar','bengkel_luar'];
export const TIPE_PERBAIKAN  = ['perbaikan_pool'];
export const TIPE_PULANG_POOL = ['pulang_ke_pool'];

export function isStoring(tipe)   { return TIPE_STORING.includes(tipe); }
export function isPerbaikan(tipe) { return TIPE_PERBAIKAN.includes(tipe); }
export function hasTahapan(tipe)  { return TIPE_STORING.includes(tipe); }

// ── Tipe perbaikan ──────────────────────────────────────────
const TIPE_MAP = {
  storing_internal: { label:'Storing Internal',      icon:'📍', color:'#7f1d1d', bg:'#fee2e2' },
  storing_luar:     { label:'Storing Luar',           icon:'🏭', color:'#92400e', bg:'#fef3c7' },
  bengkel_luar:     { label:'Bengkel Luar / Rekanan', icon:'🔩', color:'#6d28d9', bg:'#ede9fe' },
  pulang_ke_pool:   { label:'Pulang ke Pool',         icon:'🏠', color:'#1e3a8a', bg:'#dbeafe' },
  perbaikan_pool:   { label:'Perbaikan Pool',         icon:'🔧', color:'#b45309', bg:'#fef9c3' },
};

export function getTipe(tipe) {
  return TIPE_MAP[tipe] || { label: tipe || '—', icon:'❓', color:'#374151', bg:'#f3f4f6' };
}

// ── Status perbaikan ────────────────────────────────────────
const STATUS_MAP = {
  'Menunggu Approval': { label:'Menunggu Approval', color:'#92400e', bg:'#fef3c7' },
  'Disetujui':         { label:'Disetujui',         color:'#065f46', bg:'#d1fae5' },
  'Berjalan':          { label:'Berjalan',           color:'#1e3a8a', bg:'#dbeafe' },
  'Menunggu Tiba di Pool': { label:'Menunggu Tiba di Pool', color:'#1e3a8a', bg:'#dbeafe' },
  'Tiba di Pool':      { label:'Tiba di Pool',       color:'#065f46', bg:'#d1fae5' },
  'Selesai':           { label:'Selesai',            color:'#374151', bg:'#f3f4f6' },
  'Ditolak':           { label:'Ditolak',            color:'#7f1d1d', bg:'#fee2e2' },
  'Lanjut Perjalanan': { label:'Lanjut Perjalanan',  color:'#065f46', bg:'#f0fdf4' },
};

export function getStatus(status) {
  return STATUS_MAP[status] || { label: status || '—', color:'#374151', bg:'#f3f4f6' };
}

// ── Progres STORING — alur lengkap 6 tahap ─────────────────
export const PROGRES_STORING = [
  { value:'Menunggu Mekanik',      icon:'⏳', color:'#92400e', bg:'#fef3c7', next:'Mekanik Ditugaskan'     },
  { value:'Mekanik Ditugaskan',    icon:'👷', color:'#1e3a8a', bg:'#dbeafe', next:'Mekanik Berangkat'      },
  { value:'Mekanik Berangkat',     icon:'🚗', color:'#6d28d9', bg:'#ede9fe', next:'Mekanik Tiba'           },
  { value:'Mekanik Tiba',          icon:'📍', color:'#065f46', bg:'#dcfce7', next:'Perbaikan Berlangsung'  },
  { value:'Perbaikan Berlangsung', icon:'🔧', color:'#b45309', bg:'#fef9c3', next:'Selesai'                },
  { value:'Selesai',               icon:'✅', color:'#166534', bg:'#f0fdf4', next:null                     },
];

// ── Progres PERBAIKAN POOL — alur pendek 3 tahap ───────────
export const PROGRES_PERBAIKAN = [
  { value:'Perbaikan Ditugaskan',  icon:'📋', color:'#1e3a8a', bg:'#dbeafe', next:'Perbaikan Berlangsung'  },
  { value:'Perbaikan Berlangsung', icon:'🔧', color:'#b45309', bg:'#fef9c3', next:'Selesai'                },
  { value:'Selesai',               icon:'✅', color:'#166534', bg:'#f0fdf4', next:null                     },
];

export const PROGRES_PULANG_POOL = [
  { value:'Menunggu Tiba di Pool', icon:'🏠', color:'#1e3a8a', bg:'#dbeafe', next:'Tiba di Pool' },
  { value:'Tiba di Pool', icon:'✅', color:'#166534', bg:'#f0fdf4', next:null },
];

// ── Helper: pilih PROGRES_LIST sesuai tipe ──────────────────
export function getProgresList(tipe) {
  if (TIPE_PULANG_POOL.includes(tipe)) return PROGRES_PULANG_POOL;
  if (isPerbaikan(tipe)) {
    return [{ value:'Tanpa Tahapan', icon:'•', color:'#64748b', bg:'#f1f5f9', next:null }];
  }
  return PROGRES_STORING;
}

// ── Tetap export PROGRES_LIST sebagai alias PROGRES_STORING ─
// untuk kompatibilitas komponen lama (HomePage, HistoriPage)
export const PROGRES_LIST = PROGRES_STORING;

export function getProgres(progres, tipe) {
  const list = getProgresList(tipe);
  // Cari di list yang sesuai tipe dulu
  const found = list.find(p => p.value === progres);
  if (found) return found;
  // Jika perbaikan_pool, JANGAN fallback ke PROGRES_STORING
  // — tampilkan progres tidak dikenal daripada tampilkan alur yang salah
  if (isPerbaikan(tipe) || TIPE_PULANG_POOL.includes(tipe)) {
    return { value: progres || '—', icon:'⚠️', color:'#92400e', bg:'#fef3c7', next:'Perbaikan Ditugaskan' };
  }
  // Untuk storing, cari di seluruh PROGRES_STORING
  return PROGRES_STORING.find(p => p.value === progres)
    || { value: progres || '—', icon:'⏳', color:'#92400e', bg:'#fef3c7', next:null };
}

export function getProgresIdx(progres, tipe) {
  const list = getProgresList(tipe);
  const idx  = list.findIndex(p => p.value === progres);
  return idx >= 0 ? idx : 0;
}

// ── Alasan standby ──────────────────────────────────────────
export const ALASAN_STANDBY = [
  { value:'Menunggu DO',             icon:'📋', label:'Menunggu DO'     },
  { value:'Sudah Dapat DO',          icon:'✅', label:'Sudah Dapat DO'  },
  { value:'Standby Tidak Ada Sopir', icon:'🚫', label:'Tidak Ada Sopir' },
  { value:'Standby Driver Izin',     icon:'🙅', label:'Driver Izin'     },
];

// ── Konfigurasi ban per tipe unit ──────────────────────────
// Dipisahkan dari komponen agar admin bisa tambah tipe unit baru
// tanpa edit kode komponen — cukup edit file ini.
export const BAN_CONFIG = {
  'wing box': [
    'depan_kiri', 'depan_kanan',
    'engkel_kiri_luar', 'engkel_kiri_dalam', 'engkel_kanan_luar', 'engkel_kanan_dalam',
    'tronton_kiri_luar', 'tronton_kiri_dalam', 'tronton_kanan_luar', 'tronton_kanan_dalam',
    'ban_stip',
  ],
  'wingbox': [
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
  'fuso': [
    'depan_kiri', 'depan_kanan',
    'engkel_kiri_luar', 'engkel_kiri_dalam', 'engkel_kanan_luar', 'engkel_kanan_dalam',
    'ban_stip',
  ],
  'grandmax': [
    'depan_kiri', 'depan_kanan', 'engkel_kiri', 'engkel_kanan', 'ban_stip',
  ],
};

export const BAN_LABEL = {
  depan_kiri: 'Depan kiri', depan_kanan: 'Depan kanan',
  engkel_kiri: 'Engkel kiri', engkel_kanan: 'Engkel kanan',
  engkel_kiri_luar: 'Engkel kiri luar', engkel_kiri_dalam: 'Engkel kiri dalam',
  engkel_kanan_luar: 'Engkel kanan luar', engkel_kanan_dalam: 'Engkel kanan dalam',
  tronton_kiri_luar: 'Tronton kiri luar', tronton_kiri_dalam: 'Tronton kiri dalam',
  tronton_kanan_luar: 'Tronton kanan luar', tronton_kanan_dalam: 'Tronton kanan dalam',
  ban_stip: 'Ban stip',
};

export function normalizeTipeBan(tipe) {
  const str = (tipe || '').toLowerCase().trim().replace(/[-_]/g, ' ');
  if (str.includes('gran') || str.includes('grand') || str.includes('max') || str.includes('l300') || str.includes('traga') || str.includes('carry')) return 'grandmax';
  if (str.includes('fuso')) return 'fuso';
  if (str.includes('wing') || str.includes('box')) return 'wing box';
  if (str.includes('cdd')) return 'cdd';
  if (str.includes('cde') || str.includes('engkel')) return 'cde';
  return str;
}

export function getBanKeys(tipeUnit) {
  const norm = normalizeTipeBan(tipeUnit);
  return BAN_CONFIG[norm] || BAN_CONFIG['cde'];
}
