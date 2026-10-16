// src/lib/nopolUtils.js — FleetMate v6
// Shared utility untuk normalisasi nomor polisi

/**
 * Normalisasi nomor polisi:
 * - Trim whitespace
 * - Uppercase
 * - Hapus spasi berlebih (collapse multiple spaces)
 * Contoh: "b 1001 mms" → "B 1001 MMS"
 */
export function normalisasiNopol(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Cek apakah dua nomor polisi cocok (case & space insensitive)
 */
export function nopolMatch(a, b) {
  if (!a || !b) return false;
  return normalisasiNopol(a).replace(/\s/g, '') === normalisasiNopol(b).replace(/\s/g, '');
}
