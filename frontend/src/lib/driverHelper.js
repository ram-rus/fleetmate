// src/lib/driverHelper.js
// Helper untuk gabung data driver_accounts secara manual ke hasil query lain
// (dipakai karena driver_id TIDAK lagi FK ke users, tapi ke driver_accounts
//  yang aksesnya terpisah dari Supabase Auth)

import { supabase } from './supabase';

/**
 * Ambil data driver (nama, no_hp) untuk sekumpulan driver_id,
 * dan gabungkan ke setiap row di `rows` sebagai field `driver`.
 *
 * @param {Array} rows - hasil query yang punya kolom driver_id
 * @param {string} idKey - nama kolom id driver di rows (default 'driver_id')
 * @returns {Array} rows yang sudah punya field .driver = {nama, no_hp}
 */
export async function attachDriverInfo(rows, idKey = 'driver_id') {
  if (!rows || rows.length === 0) return rows || [];

  const driverIds = [...new Set(rows.map(r => r[idKey]).filter(Boolean))];
  if (driverIds.length === 0) return rows;

  const { data: drivers } = await supabase
    .from('driver_accounts')
    .select('id, nama, no_hp')
    .in('id', driverIds);

  const driverMap = {};
  (drivers || []).forEach(d => { driverMap[d.id] = d; });

  return rows.map(r => ({
    ...r,
    driver: driverMap[r[idKey]] || null,
  }));
}

/**
 * Ambil 1 driver by id — dipakai untuk kasus single row
 */
export async function getDriverInfo(driverId) {
  if (!driverId) return null;
  const { data } = await supabase
    .from('driver_accounts')
    .select('id, nama, no_hp')
    .eq('id', driverId)
    .maybeSingle();
  return data;
}
