// Fleet Precision Design Tokens Applied
// src/components/admin/KeputusanModal.js
// v5.2 — Modal keputusan admin: Refactored constants & DRY helper for mechanic assignment

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// ── Definisi opsi keputusan (berada di luar komponen untuk mencegah alokasi ulang memori) ──
const OPSI_MINTA = [
  { value:'storing_internal', icon:'✅', label:'Storing Internal', desc:'Kirim mekanik internal ke lokasi driver', color:'#065f46', bg:'#d1fae5', border:'#bbf7d0' },
  { value:'mekanik_luar',     icon:'🏭', label:'Mekanik Luar',     desc:'Gunakan bengkel/mekanik luar', color:'#92400e', bg:'#fef3c7', border:'#fcd34d' },
  { value:'alihkan_pool',     icon:'🏠', label:'Alihkan ke Pulang Pool', desc:'Kendaraan masih bisa jalan ke pool', color:'#1e3a8a', bg:'#dbeafe', border:'#93c5fd' },
];

const OPSI_PULANG = [
  { value:'setujui_pulang',        icon:'🏠', label:'Setujui Pulang ke Pool', desc:'Bawa kendaraan ke pool segera', color:'#1e3a8a', bg:'#dbeafe', border:'#93c5fd' },
  { value:'lanjut_perjalanan',     icon:'🚗', label:'Lanjutkan Perjalanan',   desc:'Kerusakan minor, bisa lanjut jalan', color:'#065f46', bg:'#d1fae5', border:'#bbf7d0' },
  { value:'alihkan_storing',       icon:'📍', label:'Alihkan ke Storing',     desc:'Ternyata butuh bantuan mekanik di lapangan', color:'#7f1d1d', bg:'#fee2e2', border:'#fca5a5' },
  { value:'alihkan_mekanik_luar',  icon:'🏭', label:'Alihkan ke Mekanik Luar', desc:'Gunakan bengkel/mekanik luar', color:'#92400e', bg:'#fef3c7', border:'#fcd34d' },
];

// Helper fungsi terpisah untuk memproses penugasan mekanik luar (DRY)
async function prosesMekanikLuar({ unitId, driverId, laporanId, profileId, deskripsi, lokasi, namaLuar, hpLuar, isAlihan = false }) {
  const { error: prbErr } = await supabase.from('perbaikan').insert({
    unit_id:          unitId,
    driver_id:        driverId,
    laporan_id:       laporanId,
    dibuat_oleh:      profileId,
    sumber:           'driver_app',
    tipe:             'storing_luar',
    status:           'Berjalan',
    progres:          'Mekanik Ditugaskan',
    deskripsi:        deskripsi,
    lokasi:           lokasi,
    mekanik_luar_nama:namaLuar.trim(),
    mekanik_luar_hp:  hpLuar.trim(),
    tgl_mulai:        new Date().toISOString(),
  });
  if (prbErr) throw prbErr;

  const { error: lapErr } = await supabase.from('laporan_kerusakan').update({ status: 'Storing Luar Disetujui' }).eq('id', laporanId);
  if (lapErr) throw lapErr;

  const { error: unitErr } = await supabase.from('units').update({ status: 'Storing' }).eq('id', unitId);
  if (unitErr) throw unitErr;

  if (driverId) {
    await supabase.from('notifikasi').insert({
      user_id: driverId,
      judul:   isAlihan ? '🏭 Dialihkan ke Mekanik Luar' : '🏭 Mekanik Luar Ditugaskan',
      isi:     `Mekanik: ${namaLuar.trim()} · HP: ${hpLuar.trim()}`,
      tipe:    'storing',
    });
  }
}

export default function KeputusanModal({ laporan, mekaniks, onClose, onDone }) {
  const { profile, canManage = true } = useAuth();
  const isMinta               = laporan.pilihan_driver === 'minta_storing';
  const [pilihan, setPilihan] = useState('');
  const [saving, setSaving]   = useState(false);

  // Form storing internal
  const [mekanikId, setMekanikId]       = useState('');
  const [tglBerangkat, setTglBrkt]      = useState('');
  const [jamBerangkat, setJamBrkt]      = useState('');
  const [estimasiTiba, setEstTiba]      = useState('');
  const [catatanDriver, setCatatanDrv]  = useState('');

  // Form mekanik luar
  const [namaLuar, setNamaLuar] = useState('');
  const [hpLuar, setHpLuar]     = useState('');

  const OPSI = isMinta ? OPSI_MINTA : OPSI_PULANG;

  async function handleSubmit() {
    if (!pilihan) { toast.error('Pilih keputusan terlebih dahulu'); return; }
    if (pilihan === 'storing_internal' && !mekanikId) { toast.error('Pilih mekanik internal'); return; }
    if ((pilihan === 'mekanik_luar' || pilihan === 'alihkan_mekanik_luar') && (!namaLuar.trim() || !hpLuar.trim())) {
      toast.error('Nama dan HP mekanik luar wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const unitId   = laporan.unit?.id || laporan.unit_id;
      const driverId = laporan.driver_id;

      // Guard duplikat — cek apakah unit sudah punya storing aktif
      if (['storing_internal', 'mekanik_luar', 'alihkan_storing', 'alihkan_mekanik_luar'].includes(pilihan)) {
        const { data: existingStoring, error: checkErr } = await supabase.from('perbaikan')
          .select('id,tipe,no_perbaikan')
          .eq('unit_id', unitId)
          .in('status', ['Berjalan','Disetujui','Menunggu Approval'])
          .in('tipe', ['storing_internal','storing_luar','bengkel_luar'])
          .limit(1);

        if (checkErr) throw checkErr;

        if (existingStoring && existingStoring.length > 0) {
          toast.error(`Unit ini sudah punya storing aktif (${existingStoring[0].no_perbaikan || '—'}). Selesaikan dulu sebelum membuat storing baru.`);
          setSaving(false);
          return;
        }
      }

      // ── KEPUTUSAN: Minta Storing ────────────────────────────────
      if (isMinta) {
        if (pilihan === 'storing_internal') {
          // Buat perbaikan storing internal
          const { error: prbErr } = await supabase.from('perbaikan').insert({
            unit_id:             unitId,
            driver_id:           driverId,
            laporan_id:          laporan.id,
            dibuat_oleh:         profile?.id,
            sumber:              'driver_app',
            tipe:                'storing_internal',
            status:              'Berjalan',
            progres:             'Mekanik Ditugaskan',
            deskripsi:           laporan.deskripsi,
            lokasi:              laporan.koordinat,
            koordinat_lat:       laporan.koordinat_lat,
            koordinat_lng:       laporan.koordinat_lng,
            mekanik_id:          mekanikId,
            tgl_berangkat:       tglBerangkat || null,
            jam_berangkat:       jamBerangkat || null,
            estimasi_tiba:       estimasiTiba || null,
            catatan_untuk_driver:catatanDriver || null,
            tgl_mulai:           new Date().toISOString(),
          });
          if (prbErr) throw prbErr;

          const { error: lapErr } = await supabase.from('laporan_kerusakan').update({
            status: 'Storing Disetujui',
          }).eq('id', laporan.id);
          if (lapErr) throw lapErr;

          const { error: unitErr } = await supabase.from('units').update({ status:'Storing' }).eq('id', unitId);
          if (unitErr) throw unitErr;

          if (driverId) {
            const mk = mekaniks.find(m => m.id === mekanikId);
            await supabase.from('notifikasi').insert({
              user_id: driverId,
              judul:   '✅ Storing Disetujui — Mekanik Dikirim',
              isi:     `Mekanik ${mk?.nama || ''} akan tiba${estimasiTiba ? ' sekitar ' + estimasiTiba : ''}. ${catatanDriver || ''}`,
              tipe:    'storing',
            });
          }
          toast.success('Storing internal disetujui!');

        } else if (pilihan === 'mekanik_luar') {
          await prosesMekanikLuar({
            unitId,
            driverId,
            laporanId: laporan.id,
            profileId: profile?.id,
            deskripsi: laporan.deskripsi,
            lokasi: laporan.koordinat,
            namaLuar,
            hpLuar,
            isAlihan: false,
          });
          toast.success('Mekanik luar ditugaskan!');

        } else if (pilihan === 'alihkan_pool') {
          const { error: lapErr } = await supabase.from('laporan_kerusakan').update({
            status:         'Pulang ke Pool Disetujui',
            pilihan_driver: 'pulang_ke_pool',
          }).eq('id', laporan.id);
          if (lapErr) throw lapErr;

          const { error: prbErr } = await supabase.from('perbaikan').insert({
            unit_id:    unitId,
            driver_id:  driverId,
            laporan_id: laporan.id,
            dibuat_oleh:profile?.id,
            sumber:     'driver_app',
            tipe:       'pulang_ke_pool',
            status:     'Menunggu Tiba di Pool',
            progres:    'Menunggu Tiba di Pool',
            deskripsi:  laporan.deskripsi,
            tgl_mulai:  new Date().toISOString(),
          });
          if (prbErr) throw prbErr;

          await supabase.from('units').update({ status:'Pulang ke Pool' }).eq('id', unitId);

          if (driverId) {
            await supabase.from('notifikasi').insert({
              user_id: driverId,
              judul:   '🏠 Alihkan ke Pulang ke Pool',
              isi:     'Pengurus memutuskan agar kendaraan dibawa ke pool.',
              tipe:    'storing',
            });
          }
          toast.success('Dialihkan ke pulang ke pool!');
        }

      // ── KEPUTUSAN: Pulang ke Pool ───────────────────────────────
      } else {
        if (pilihan === 'setujui_pulang') {
          const { error: lapErr } = await supabase.from('laporan_kerusakan').update({ status:'Pulang ke Pool Disetujui' }).eq('id', laporan.id);
          if (lapErr) throw lapErr;

          const { error: prbErr } = await supabase.from('perbaikan').insert({
            unit_id:    unitId,
            driver_id:  driverId,
            laporan_id: laporan.id,
            dibuat_oleh:profile?.id,
            sumber:     'driver_app',
            tipe:       'pulang_ke_pool',
            status:     'Menunggu Tiba di Pool',
            progres:    'Menunggu Tiba di Pool',
            deskripsi:  laporan.deskripsi,
            tgl_mulai:  new Date().toISOString(),
          });
          if (prbErr) throw prbErr;

          await supabase.from('units').update({ status:'Pulang ke Pool' }).eq('id', unitId);

          if (driverId) {
            await supabase.from('notifikasi').insert({
              user_id: driverId,
              judul:   '🏠 Pulang ke Pool Disetujui',
              isi:     'Segera bawa kendaraan ke pool.',
              tipe:    'storing',
            });
          }
          toast.success('Pulang ke pool disetujui!');

        } else if (pilihan === 'lanjut_perjalanan') {
          const { error: lapErr } = await supabase.from('laporan_kerusakan').update({ status:'Lanjut Perjalanan' }).eq('id', laporan.id);
          if (lapErr) throw lapErr;

          const { error: prbErr } = await supabase.from('perbaikan').insert({
            unit_id:    unitId,
            driver_id:  driverId,
            laporan_id: laporan.id,
            dibuat_oleh:profile?.id,
            sumber:     'driver_app',
            tipe:       'pulang_ke_pool',
            status:     'Lanjut Perjalanan',
            deskripsi:  laporan.deskripsi,
            tgl_mulai:  new Date().toISOString(),
            tgl_selesai:new Date().toISOString(),
          });
          if (prbErr) throw prbErr;

          if (driverId) {
            await supabase.from('notifikasi').insert({
              user_id: driverId,
              judul:   '🚗 Lanjutkan Perjalanan',
              isi:     'Pengurus memutuskan perjalanan dapat dilanjutkan.',
              tipe:    'storing',
            });
          }
          toast.success('Driver diminta lanjut perjalanan!');

        } else if (pilihan === 'alihkan_storing') {
          const { error: lapErr } = await supabase.from('laporan_kerusakan').update({
            status:         'Menunggu Approval Storing',
            pilihan_driver: 'minta_storing',
          }).eq('id', laporan.id);
          if (lapErr) throw lapErr;

          toast.success('Dialihkan ke antrian storing. Pilih mekanik di laporan berikutnya.');

        } else if (pilihan === 'alihkan_mekanik_luar') {
          await prosesMekanikLuar({
            unitId,
            driverId,
            laporanId: laporan.id,
            profileId: profile?.id,
            deskripsi: laporan.deskripsi,
            lokasi: laporan.koordinat,
            namaLuar,
            hpLuar,
            isAlihan: true,
          });
          toast.success('Dialihkan ke mekanik luar!');
        }
      }

      onDone();
    } catch(e) {
      console.error('Error saat menyimpan keputusan:', e);
      toast.error('Gagal memproses keputusan: ' + (e.message || 'Terjadi kesalahan sistem'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:460, maxHeight:'92vh', overflowY:'auto', fontFamily:"'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #ebeced' }}>
          <div>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:2 }}>
              {isMinta ? '🆘 Minta Storing' : '🏠 Minta Pulang ke Pool'} — {laporan.unit?.nopol}
            </h3>
            <p style={{ fontSize:11, color:'#74777f' }}>Driver: {laporan.driver?.nama}</p>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#74777f' }}>×</button>
        </div>

        <div style={{ padding:20 }}>

          {/* Ringkasan laporan */}
          <div style={{ background:'#F8F9FF', border:'1px solid #ebeced', borderRadius:10, padding:12, marginBottom:16, fontSize:11 }}>
            <p style={{ color:'#44474e', marginBottom:4 }}><b>Keluhan:</b> {laporan.deskripsi}</p>
            {laporan.koordinat && <p style={{ color:'#74777f' }}>📍 {laporan.koordinat}</p>}
            <p style={{ color:'#c4c7cf', marginTop:4, fontSize:10 }}>
              {new Date(laporan.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
            </p>
          </div>

          {/* Mode Monitoring (Read-Only) vs Mode Manage */}
          {!canManage ? (
            <div style={{ marginTop:16 }}>
              <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, padding:14, marginBottom:16, fontSize:12, color:'#92400e', fontWeight:600, textAlign:'center' }}>
                🔒 Anda masuk sebagai role <b>Monitoring (Hanya Lihat)</b>. Pengambilan keputusan hanya dapat dilakukan oleh Admin / Manager.
              </div>
              <button onClick={onClose}
                style={{ width:'100%', background:'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'11px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                Tutup Detail
              </button>
            </div>
          ) : (
            <>
              {/* Pilihan keputusan */}
              <p style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>Pilih Tindakan</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {OPSI.map(o => (
                  <label key={o.value} onClick={()=>setPilihan(o.value)}
                    style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 14px', cursor:'pointer',
                      border: pilihan===o.value?`2px solid ${o.border}`:'1px solid #ebeced',
                      borderRadius:10, background: pilihan===o.value?o.bg:'#fff', transition:'all 0.15s',
                    }}>
                    <input type="radio" name="keputusan" checked={pilihan===o.value} onChange={()=>setPilihan(o.value)} style={{ accentColor:'#1a2b4b', marginTop:1, flexShrink:0 }}/>
                    <span style={{ fontSize:20, flexShrink:0 }}>{o.icon}</span>
                    <div>
                      <p style={{ fontSize:12, fontWeight:700, color:pilihan===o.value?o.color:'#1a1c1e', marginBottom:2 }}>{o.label}</p>
                      <p style={{ fontSize:10, color:pilihan===o.value?o.color:'#74777f', opacity:0.85 }}>{o.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Form tambahan: Storing Internal */}
              {pilihan === 'storing_internal' && (
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:14, marginBottom:16 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'#065f46', marginBottom:10 }}>👷 Penugasan Mekanik Internal</p>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Mekanik <span style={{ color:'#ba1a1a' }}>*</span></label>
                    <select value={mekanikId} onChange={e=>setMekanikId(e.target.value)}
                      style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none' }}>
                      <option value="">-- Pilih Mekanik --</option>
                      {mekaniks.map(m=><option key={m.id} value={m.id}>{m.nama} {m.no_hp?`(${m.no_hp})`:''}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Tgl Berangkat</label>
                      <input type="date" value={tglBerangkat} onChange={e=>setTglBrkt(e.target.value)}
                        style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Jam Berangkat</label>
                      <input type="time" value={jamBerangkat} onChange={e=>setJamBrkt(e.target.value)}
                        style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box' }}/>
                    </div>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Estimasi Tiba</label>
                    <input type="time" value={estimasiTiba} onChange={e=>setEstTiba(e.target.value)}
                      style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Pesan untuk Driver (opsional)</label>
                    <textarea rows={2} value={catatanDriver} onChange={e=>setCatatanDrv(e.target.value)}
                      placeholder="Contoh: Tetap standby di lokasi, mekanik segera tiba..."
                      style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:"'Inter',sans-serif", resize:'none', outline:'none', boxSizing:'border-box' }}/>
                  </div>
                </div>
              )}

              {/* Form tambahan: Mekanik Luar (untuk storing atau alihan) */}
              {(pilihan === 'mekanik_luar' || pilihan === 'alihkan_mekanik_luar') && (
                <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, padding:14, marginBottom:16 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:10 }}>🏭 Data Mekanik Luar</p>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Nama Bengkel / Mekanik <span style={{ color:'#ba1a1a' }}>*</span></label>
                    <input value={namaLuar} onChange={e=>setNamaLuar(e.target.value)} placeholder="Nama bengkel atau mekanik..."
                      style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>No HP <span style={{ color:'#ba1a1a' }}>*</span></label>
                    <input value={hpLuar} onChange={e=>setHpLuar(e.target.value)} placeholder="08xxxxxxxxxx" type="tel"
                      style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box' }}/>
                  </div>
                </div>
              )}

              {/* Tombol aksi */}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onClose}
                  style={{ flex:1, background:'#fff', color:'#44474e', border:'1px solid #c4c7cf', borderRadius:10, padding:'11px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                  Batal
                </button>
                <button onClick={handleSubmit} disabled={saving || !pilihan}
                  style={{ flex:2, background:(saving||!pilihan)?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'11px 0', fontSize:12, fontWeight:700, cursor:(saving||!pilihan)?'not-allowed':'pointer', fontFamily:"'Inter',sans-serif" }}>
                  {saving ? '⏳ Memproses...' : '✓ Konfirmasi Keputusan'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
