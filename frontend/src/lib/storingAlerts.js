// Alert otomatis untuk storing — dijalankan saat admin buka menu Storing
import { supabase } from './supabase';

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 jam

async function alreadySent(alertKey, storingId) {
  const since = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
  const { data } = await supabase
    .from('notifikasi')
    .select('id')
    .gte('created_at', since)
    .contains('data', { alert_key: alertKey, storing_id: storingId })
    .limit(1);
  return (data || []).length > 0;
}

async function notifyRole(role, judul, isi, tipe, data) {
  const { data: users } = await supabase.from('users').select('id').eq('role', role);
  for (const u of users || []) {
    await supabase.from('notifikasi').insert({
      user_id: u.id,
      judul,
      isi,
      tipe,
      data,
    });
  }
}

async function notifyAdmins(judul, isi, tipe, data) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'supervisor', 'manager']);
  for (const u of users || []) {
    await supabase.from('notifikasi').insert({
      user_id: u.id,
      judul,
      isi,
      tipe,
      data,
    });
  }
}

/**
 * Cek semua storing aktif dan kirim alert jika perlu.
 * @returns {number} jumlah alert yang dikirim
 */
export async function checkStoringAlerts(storingList) {
  let sent = 0;
  const now = Date.now();

  for (const s of storingList) {
    if (!['Aktif', 'Pending'].includes(s.status)) continue;

    const nopol = s.unit?.nopol || 'Unit';
    const tglMulai = s.tgl_mulai ? new Date(s.tgl_mulai).getTime() : new Date(s.created_at).getTime();
    const durasiHari = Math.floor((now - tglMulai) / (1000 * 60 * 60 * 24));
    const durasiJam  = Math.floor((now - new Date(s.created_at).getTime()) / (1000 * 60 * 60));

    // Alert: mekanik belum ditugaskan > 2 jam
    if (!s.mekanik_id && s.progres === 'Menunggu Mekanik' && durasiJam >= 2) {
      const key = 'mekanik_belum_2jam';
      if (!(await alreadySent(key, s.id))) {
        await notifyAdmins(
          `⚠ Belum Ada Mekanik — ${nopol}`,
          `${nopol} menunggu penugasan mekanik sudah ${durasiJam} jam. Segera assign mekanik.`,
          'storing',
          { alert_key: key, storing_id: s.id }
        );
        sent++;
      }
    }

    // Alert: storing > 7 hari → supervisor
    if (durasiHari > 7 && durasiHari <= 30) {
      const key = 'storing_over_7';
      if (!(await alreadySent(key, s.id))) {
        await notifyRole(
          'supervisor',
          `⚠ Storing > 7 Hari — ${nopol}`,
          `Unit ${nopol} sudah storing ${durasiHari} hari. Perlu ditindaklanjuti.`,
          'storing',
          { alert_key: key, storing_id: s.id }
        );
        sent++;
      }
    }

    // Alert: storing > 30 hari → manager
    if (durasiHari > 30) {
      const key = 'storing_over_30';
      if (!(await alreadySent(key, s.id))) {
        await notifyRole(
          'manager',
          '🚨 Storing > 30 Hari — ' + nopol,
          `Unit ${nopol} sudah storing ${durasiHari} hari! Eskalasi ke manajemen.`,
          'storing',
          { alert_key: key, storing_id: s.id }
        );
        sent++;
      }
    }
  }

  return sent;
}
