// Menu Storing — assign mekanik, timeline visual, audit log, alert otomatis

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import StoringTimeline from '../../components/storing/StoringTimeline';
import {
  PROGRES_LIST, STORING_SELECT, getProgresStyle, getNextProgres,
  getProgresLabel, getProgresIndex, formatJadwal, formatJam,
} from '../../lib/storingConstants';
import { checkStoringAlerts } from '../../lib/storingAlerts';

const EMPTY_FORM = { mekanik_id: '', tgl_berangkat: '', jam_berangkat: '', jam_estimasi_tiba: '', catatan_driver: '' };

export default function StoringProgressPage() {
  const { profile }             = useAuth();
  const [list, setList]         = useState([]);
  const [loading, setLoad]      = useState(true);
  const [selected, setSelected]   = useState(null);
  const [mekaniks, setMekaniks] = useState([]);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [logs, setLogs]         = useState([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('storing')
      .select(STORING_SELECT)
      .in('status', ['Aktif', 'Pending'])
      .order('created_at', { ascending: false });

    if (error) { toast.error('Gagal memuat storing'); setLoad(false); return; }

    const items = data || [];
    setList(items);
    setLoad(false);

    const alertCount = await checkStoringAlerts(items);
    if (alertCount > 0) toast(`${alertCount} alert otomatis dikirim`, { icon: '🔔' });
  }, []);

  useEffect(() => {
    load();
    supabase.from('users').select('id,nama').eq('role', 'mekanik').then(({ data }) => setMekaniks(data || []));

    const channel = supabase
      .channel('storing-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storing' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'storing_log' }, () => {
        if (selected) loadLogs(selected.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, selected]);

  async function loadLogs(storingId) {
    const { data } = await supabase
      .from('storing_log')
      .select('*, user:users!storing_log_dibuat_oleh_fkey(nama)')
      .eq('storing_id', storingId)
      .order('created_at', { ascending: true });
    setLogs(data || []);
  }

  function openDetail(s) {
    setSelected(s);
    loadLogs(s.id);
    if (!s.mekanik_id) {
      setForm({
        ...EMPTY_FORM,
        tgl_berangkat: new Date().toISOString().slice(0, 10),
      });
    }
  }

  async function handleKonfirmasiPenugasan() {
    if (!form.mekanik_id) { toast.error('Pilih mekanik dulu'); return; }
    if (!form.tgl_berangkat || !form.jam_berangkat) { toast.error('Tanggal & jam berangkat wajib diisi'); return; }

    setSaving(true);
    try {
      const mekanik = mekaniks.find(m => m.id === form.mekanik_id);
      const progresLama = selected.progres || 'Menunggu Mekanik';

      const { error } = await supabase.from('storing').update({
        mekanik_id:         form.mekanik_id,
        tgl_berangkat:      form.tgl_berangkat,
        jam_berangkat:      form.jam_berangkat,
        jam_estimasi_tiba:  form.jam_estimasi_tiba || null,
        catatan_driver:     form.catatan_driver || null,
        progres:            'Mekanik Ditugaskan',
        ditugaskan_at:      new Date().toISOString(),
        ditugaskan_oleh:    profile?.id,
      }).eq('id', selected.id);

      if (error) throw error;

      const catatanLog = [
        `Mekanik: ${mekanik?.nama}`,
        `Berangkat: ${formatJadwal(form.tgl_berangkat, form.jam_berangkat)}`,
        form.jam_estimasi_tiba ? `Est. Tiba: ${formatJam(form.jam_estimasi_tiba)}` : null,
        form.catatan_driver ? `Catatan: ${form.catatan_driver}` : null,
      ].filter(Boolean).join(' · ');

      await supabase.from('storing_log').insert({
        storing_id:  selected.id,
        status_lama: progresLama,
        status_baru: 'Mekanik Ditugaskan',
        catatan:     catatanLog,
        dibuat_oleh: profile?.id,
      });

      const notifIsi = [
        `Mekanik: ${mekanik?.nama}`,
        `Berangkat: ${formatJam(form.jam_berangkat)}`,
        form.jam_estimasi_tiba ? `Est. Tiba: ${formatJam(form.jam_estimasi_tiba)}` : null,
        form.catatan_driver || null,
      ].filter(Boolean).join(' | ');

      await supabase.from('notifikasi').insert({
        user_id: selected.driver_id,
        judul:   '👷 Mekanik Ditugaskan',
        isi:     notifIsi,
        tipe:    'storing',
        data:    { storing_id: selected.id, type: 'penugasan' },
      });

      toast.success('Penugasan dikonfirmasi! Driver sudah dinotifikasi.');
      setSelected(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateProgres(storing, progres) {
    setSaving(true);
    try {
      const progresLama = storing.progres;
      const updates = { progres };
      if (progres === 'Selesai') {
        updates.status = 'Selesai';
        updates.tgl_selesai = new Date().toISOString();
      }

      const { error } = await supabase.from('storing').update(updates).eq('id', storing.id);
      if (error) throw error;

      if (progres === 'Selesai') {
        await supabase.from('units').update({ status: 'Standby Pool' }).eq('id', storing.unit_id);
      }

      await supabase.from('storing_log').insert({
        storing_id:  storing.id,
        status_lama: progresLama,
        status_baru: progres,
        dibuat_oleh: profile?.id,
      });

      await supabase.from('notifikasi').insert({
        user_id: storing.driver_id,
        judul:   `📍 Update Storing — ${getProgresLabel(progres)}`,
        isi:     `Status storing ${storing.unit?.nopol} diperbarui: ${getProgresLabel(progres)}`,
        tipe:    'storing',
        data:    { storing_id: storing.id, progres },
      });

      toast.success(`Status: ${getProgresLabel(progres)}`);
      if (selected?.id === storing.id) {
        setSelected(prev => ({ ...prev, progres }));
        loadLogs(storing.id);
      }
      load();
    } catch (e) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const getDurasi = (s) => {
    const tgl = s.tgl_mulai || s.created_at;
    return Math.floor((Date.now() - new Date(tgl).getTime()) / (1000 * 60 * 60 * 24));
  };

  const belumDitugaskan = list.filter(s => !s.mekanik_id).length;

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#74777f', fontFamily: 'Montserrat,sans-serif' }}>Memuat...</div>;
  }

  return (
    <div style={{ fontFamily: 'Montserrat,sans-serif' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Menu Storing</h2>
      <p style={{ fontSize: 11, color: '#74777f', marginBottom: 16 }}>
        Assign mekanik, monitor timeline progres, dan audit log perubahan
      </p>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Storing Aktif', val: list.length, color: '#1a2b4b', bg: '#dbeafe' },
          { label: 'Belum Ditugaskan', val: belumDitugaskan, color: '#7f1d1d', bg: '#fee2e2' },
          { label: 'Flag >7 Hari', val: list.filter(s => getDurasi(s) > 7).length, color: '#92400e', bg: '#fef3c7' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 8, padding: 14, textAlign: 'center', borderTop: `3px solid ${c.color}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {belumDitugaskan > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#7f1d1d', fontWeight: 600 }}>
          ⚠ {belumDitugaskan} unit belum ada mekanik — segera konfirmasi penugasan!
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 8, padding: 40, textAlign: 'center', color: '#c4c7cf' }}>
          Tidak ada unit storing aktif saat ini
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(s => {
            const ps      = getProgresStyle(s.progres);
            const nextP   = getNextProgres(s.progres);
            const durasi  = getDurasi(s);
            const isOver7 = durasi > 7;
            const isOver30= durasi > 30;

            return (
              <div key={s.id} style={{
                background: '#fff', borderRadius: 10, padding: '16px 18px',
                border: isOver30 ? '1px solid #fca5a5' : isOver7 ? '1px solid #fcd34d' : '1px solid #ebeced',
                borderLeft: `4px solid ${isOver30 ? '#ba1a1a' : isOver7 ? '#f59e0b' : '#1a2b4b'}`,
              }}>
                {/* Header card */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{s.unit?.nopol}</span>
                      <span style={{ background: ps.bg, color: ps.color, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                        {ps.icon} {getProgresLabel(s.progres)}
                      </span>
                      {isOver30 && <span style={{ background: '#fee2e2', color: '#7f1d1d', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>🚨 {durasi} hari</span>}
                      {isOver7 && !isOver30 && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>⚠ {durasi} hari</span>}
                    </div>
                    <p style={{ fontSize: 11, color: '#44474e' }}>Driver: <b>{s.driver?.nama}</b> · {s.driver?.no_hp}</p>
                    <p style={{ fontSize: 11, color: '#44474e' }}>
                      Mekanik: <b style={{ color: s.mekanik?.nama ? '#065f46' : '#ba1a1a' }}>
                        {s.mekanik?.nama || 'Belum ditugaskan'}
                      </b>
                    </p>
                    {s.mekanik_id && (
                      <p style={{ fontSize: 11, color: '#74777f', marginTop: 2 }}>
                        🚗 Berangkat: {formatJadwal(s.tgl_berangkat, s.jam_berangkat)}
                        {s.jam_estimasi_tiba && ` · Est. Tiba: ${formatJam(s.jam_estimasi_tiba)}`}
                      </p>
                    )}
                    {s.lokasi && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>📍 {s.lokasi}</p>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 130 }}>
                    {!s.mekanik_id && (
                      <button onClick={() => openDetail(s)}
                        style={{ background: '#1a2b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        👷 Assign Mekanik
                      </button>
                    )}
                    {nextP && s.progres !== 'Selesai' && s.mekanik_id && (
                      <button onClick={() => updateProgres(s, nextP)} disabled={saving}
                        style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {getProgresStyle(nextP).icon} {getProgresLabel(nextP)}
                      </button>
                    )}
                    <button onClick={() => openDetail(s)}
                      style={{ background: '#fff', color: '#1a2b4b', border: '1px solid #c4c7cf', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      📋 Detail & Log
                    </button>
                  </div>
                </div>

                {/* Timeline visual di card */}
                <StoringTimeline progres={s.progres || 'Menunggu Mekanik'} compact/>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail / Assign / Log */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #ebeced', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Storing — {selected.unit?.nopol}</h3>
              <button onClick={() => { setSelected(null); setLogs([]); setForm(EMPTY_FORM); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#74777f' }}>×</button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Timeline penuh */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', marginBottom: 12 }}>Timeline Progres</p>
                <StoringTimeline progres={selected.progres || 'Menunggu Mekanik'}/>
              </div>

              {/* Quick update status */}
              {selected.mekanik_id && selected.progres !== 'Selesai' && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', marginBottom: 8 }}>Update Status (1 Klik)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {PROGRES_LIST.map(p => (
                      <button key={p.value}
                        onClick={() => updateProgres(selected, p.value)}
                        disabled={saving || getProgresIndex(selected.progres) >= getProgresIndex(p.value)}
                        style={{
                          padding: '6px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${p.color}40`,
                          background: selected.progres === p.value ? p.bg : '#fff',
                          color: p.color,
                          opacity: getProgresIndex(selected.progres) >= getProgresIndex(p.value) ? 0.5 : 1,
                        }}>
                        {p.icon} {p.label || p.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Form assign mekanik */}
              {!selected.mekanik_id && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>👷 Konfirmasi Penugasan Mekanik</p>
                  <p style={{ fontSize: 11, color: '#92400e', marginBottom: 14 }}>Isi detail penugasan — driver akan langsung mendapat notifikasi</p>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Pilih Mekanik *</label>
                    <select value={form.mekanik_id} onChange={e => setForm(p => ({ ...p, mekanik_id: e.target.value }))}
                      style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '9px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', outline: 'none' }}>
                      <option value="">-- Pilih Mekanik --</option>
                      {mekaniks.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Tgl Berangkat *</label>
                      <input type="date" value={form.tgl_berangkat} onChange={e => setForm(p => ({ ...p, tgl_berangkat: e.target.value }))}
                        style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', outline: 'none', boxSizing: 'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Jam Berangkat *</label>
                      <input type="time" value={form.jam_berangkat} onChange={e => setForm(p => ({ ...p, jam_berangkat: e.target.value }))}
                        style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', outline: 'none', boxSizing: 'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Estimasi Tiba</label>
                      <input type="time" value={form.jam_estimasi_tiba} onChange={e => setForm(p => ({ ...p, jam_estimasi_tiba: e.target.value }))}
                        style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', outline: 'none', boxSizing: 'border-box' }}/>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Catatan untuk Driver</label>
                    <textarea rows={2} value={form.catatan_driver} onChange={e => setForm(p => ({ ...p, catatan_driver: e.target.value }))}
                      placeholder="Contoh: Mekanik bawa suku cadang transmisi. Tunggu di lokasi."
                      style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box' }}/>
                  </div>

                  <button onClick={handleKonfirmasiPenugasan} disabled={saving}
                    style={{ width: '100%', background: saving ? '#9ca3af' : '#1a2b4b', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                    {saving ? 'Menyimpan...' : '✅ Konfirmasi Penugasan'}
                  </button>
                </div>
              )}

              {/* Info penugasan sudah ada */}
              {selected.mekanik_id && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 11 }}>
                  <p style={{ fontWeight: 700, color: '#166534', marginBottom: 6 }}>Penugasan Aktif</p>
                  <p>👷 {selected.mekanik?.nama} · 🚗 {formatJadwal(selected.tgl_berangkat, selected.jam_berangkat)} · 📍 Est. {formatJam(selected.jam_estimasi_tiba)}</p>
                  {selected.catatan_driver && <p style={{ color: '#166534', marginTop: 4 }}>Catatan: {selected.catatan_driver}</p>}
                </div>
              )}

              {/* Audit log */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', marginBottom: 8 }}>Audit Log</p>
                {logs.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#c4c7cf' }}>Belum ada riwayat perubahan</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {logs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#f8f9fa', borderRadius: 8, borderLeft: '3px solid #1a2b4b' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 600 }}>
                            {log.status_lama ? `${log.status_lama} → ` : ''}{log.status_baru}
                          </p>
                          {log.catatan && <p style={{ fontSize: 10, color: '#74777f', marginTop: 2 }}>{log.catatan}</p>}
                          <p style={{ fontSize: 10, color: '#c4c7cf', marginTop: 2 }}>
                            {log.user?.nama} · {new Date(log.created_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
