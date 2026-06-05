// Konstanta & helper untuk alur storing

export const PROGRES_LIST = [
  { value: 'Menunggu Mekanik',      icon: '⏳', color: '#74777f', bg: '#f3f4f6' },
  { value: 'Mekanik Ditugaskan',    icon: '👷', color: '#92400e', bg: '#fef3c7' },
  { value: 'Mekanik Berangkat',     icon: '🚗', color: '#1e3a8a', bg: '#dbeafe' },
  { value: 'Mekanik Tiba di Lokasi',icon: '📍', color: '#4c1d95', bg: '#ede9fe' },
  { value: 'Perbaikan Berlangsung', icon: '🔧', color: '#b45309', bg: '#fef9c3' },
  { value: 'Selesai',               icon: '✅', color: '#065f46', bg: '#d1fae5', label: 'Selesai — Unit Kembali ke Pool' },
];

const PROGRES_ALIASES = { 'Mekanik Tiba': 'Mekanik Tiba di Lokasi' };

export function normalizeProgres(value) {
  return PROGRES_ALIASES[value] || value || 'Menunggu Mekanik';
}

export function getProgresStyle(value) {
  return PROGRES_LIST.find(p => p.value === normalizeProgres(value)) || PROGRES_LIST[0];
}

export function getProgresIndex(value) {
  return PROGRES_LIST.findIndex(p => p.value === normalizeProgres(value));
}

export function getProgresLabel(value) {
  const p = getProgresStyle(value);
  return p.label || p.value;
}

export function getNextProgres(current) {
  const idx = getProgresIndex(current);
  return idx < PROGRES_LIST.length - 1 ? PROGRES_LIST[idx + 1].value : null;
}

export function formatJam(jam) {
  if (!jam) return '—';
  return jam.slice(0, 5);
}

export function formatJadwal(tgl, jam) {
  if (!tgl && !jam) return '—';
  const tglStr = tgl
    ? new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : '';
  const jamStr = formatJam(jam);
  return [tglStr, jamStr].filter(Boolean).join(' · ');
}

export const STORING_SELECT = `
  *,
  unit:units(nopol, tipe),
  driver:users!storing_driver_id_fkey(nama, no_hp),
  mekanik:users!storing_mekanik_id_fkey(nama, no_hp)
`;
