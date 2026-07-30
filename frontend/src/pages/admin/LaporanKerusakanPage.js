// src/pages/admin/LaporanKerusakanPage.js
// Dashboard admin — Laporan Kerusakan dari driver

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_STYLE = {
  'Dilaporkan':                  { bg:'#f3f4f6', color:'#374151' },
  'Ditangani':                   { bg:'#dbeafe', color:'#1e3a8a' },
  'Menunggu Approval Storing':   { bg:'#fee2e2', color:'#7f1d1d' },
  'Menunggu Keputusan Pengurus': { bg:'#fef3c7', color:'#92400e' },
  'Storing Disetujui':           { bg:'#d1fae5', color:'#065f46' },
  'Pulang ke Pool':              { bg:'#dbeafe', color:'#1e3a8a' },
  'Selesai':                     { bg:'#d1fae5', color:'#065f46' },
};

export default function LaporanKerusakanPage() {
  const { profile }             = useAuth();
  const [list, setList]         = useState([]);
  const [loading, setLoad]      = useState(true);
  const [detail, setDetail]     = useState(null);
  const [filter, setFilter]     = useState('Semua');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoad(true);
    let q = supabase
      .from('laporan_kerusakan')
      .select(`
        *,
        unit:units(nopol, tipe),
        driver:users(nama, no_hp)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'Semua') {
      if (filter === 'Menunggu Approval Storing') {
        q = q.eq('status', 'Dilaporkan').eq('pilihan_driver', 'minta_storing');
      } else if (filter === 'Menunggu Keputusan Pengurus') {
        q = q.eq('status', 'Dilaporkan').eq('pilihan_driver', 'pulang_ke_pool');
      } else {
        q = q.eq('status', filter);
      }
    }

    const { data, error } = await q;
    if (error) { toast.error('Gagal memuat data'); setLoad(false); return; }
    setList(data || []);
    setLoad(false);
  }

  async function handleKeputusan(laporan, keputusan) {
    setSaving(true);
    try {
      let statusBaru = 'Ditangani';

      // Update laporan
      const { error } = await supabase
        .from('laporan_kerusakan')
        .update({
          status:          statusBaru,
          keputusan_admin: keputusan,
          diputuskan_oleh: profile?.id,
          diputuskan_at:   new Date().toISOString(),
        })
        .eq('id', laporan.id);

      if (error) throw error;

      // Jika approve storing → buat entry storing otomatis + audit log awal
      if (keputusan === 'approve_storing') {
        const { data: storingBaru, error: storingErr } = await supabase.from('storing').insert({
          unit_id:              laporan.unit_id,
          driver_id:            laporan.driver_id,
          lokasi:               laporan.koordinat || 'Lokasi dari laporan kerusakan',
          alasan:               laporan.deskripsi,
          status:               'Aktif',
          approved_by:          profile?.id,
          tgl_mulai:            new Date().toISOString(),
          progres:              'Menunggu Mekanik',
          laporan_kerusakan_id: laporan.id,
        }).select().single();

        if (storingErr) throw storingErr;

        await supabase.from('storing_log').insert({
          storing_id:  storingBaru.id,
          status_baru: 'Menunggu Mekanik',
          catatan:     `Storing dibuat dari laporan kerusakan. Unit: ${laporan.unit?.nopol}`,
          dibuat_oleh: profile?.id,
        });

        await supabase.from('units').update({ status: 'Storing' }).eq('id', laporan.unit_id);

        // Notifikasi ke admin: segera assign mekanik
        const { data: admins } = await supabase.from('users').select('id').in('role', ['admin', 'supervisor']);
        for (const a of admins || []) {
          await supabase.from('notifikasi').insert({
            user_id: a.id,
            judul:   `🆘 Storing Baru — ${laporan.unit?.nopol}`,
            isi:     `Storing disetujui. Segera assign mekanik di Menu Storing.`,
            tipe:    'storing',
            data:    { storing_id: storingBaru.id, alert_key: 'storing_baru' },
          });
        }
      }

      // Notifikasi ke driver
      await supabase.from('notifikasi').insert({
        user_id: laporan.driver_id,
        judul:   keputusan === 'approve_storing'
          ? '✅ Storing Disetujui'
          : '🏠 Silakan Pulang ke Pool',
        isi: keputusan === 'approve_storing'
          ? 'Storing disetujui! Tetap di lokasi. Anda akan mendapat info mekanik & jadwal berangkat segera setelah penugasan dikonfirmasi.'
          : 'Pengurus memutuskan kendaraan Anda untuk pulang ke pool. Segera kembali ke pool.',
        tipe: 'storing',
      });

      toast.success(keputusan === 'approve_storing' ? 'Storing disetujui!' : 'Driver diperintahkan pulang ke pool');
      setDetail(null);
      load();
    } catch(e) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const filters = [
    { value: 'Semua',                        label: 'Semua',            count: list.length },
    { value: 'Menunggu Approval Storing',    label: '🆘 Minta Storing', count: 0 },
    { value: 'Menunggu Keputusan Pengurus',  label: '⏳ Menunggu',      count: 0 },
    { value: 'Storing Disetujui',            label: '✅ Disetujui',     count: 0 },
    { value: 'Pulang ke Pool',               label: '🏠 Pulang Pool',   count: 0 },
  ];

  const mintaStoring = list.filter(l => l.status === 'Dilaporkan' && l.pilihan_driver === 'minta_storing').length;
  const menunggu     = list.filter(l => l.status === 'Dilaporkan' && l.pilihan_driver === 'pulang_ke_pool').length;

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:'Montserrat,sans-serif' }}>Memuat...</div>
  );

  return (
    <div style={{ fontFamily:'Montserrat,sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Laporan Kerusakan</h2>
        <p style={{ fontSize:11, color:'#74777f' }}>Laporan kerusakan dari driver yang membutuhkan keputusan</p>
      </div>

      {/* Alert */}
      {mintaStoring > 0 && (
        <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#7f1d1d', fontWeight:600 }}>
          🆘 {mintaStoring} laporan minta storing menunggu approval!
        </div>
      )}
      {menunggu > 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e', fontWeight:600 }}>
          ⏳ {menunggu} laporan menunggu keputusan pengurus
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {filters.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid',
              background: filter===f.value ? '#1a2b4b' : '#fff',
              color:      filter===f.value ? '#fff'    : '#44474e',
              borderColor:filter===f.value ? '#1a2b4b' : '#c4c7cf',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>
          Belum ada laporan kerusakan
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f8f9fa', borderBottom:'1px solid #ebeced' }}>
                {['Tanggal','No Pol','Driver','Kerusakan','Pilihan Driver','Status','Aksi'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 12px', fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(l => {
                const sc = STATUS_STYLE[l.status] || STATUS_STYLE['Dilaporkan'];
                const needsAction = ['Menunggu Approval Storing','Menunggu Keputusan Pengurus'].includes(l.status);
                return (
                  <tr key={l.id}
                    style={{ borderBottom:'1px solid #f1f2f3', background: needsAction ? '#fffbeb' : '#fff' }}
                    onMouseOver={e => e.currentTarget.style.background = needsAction ? '#fef9c3' : '#f8f9fa'}
                    onMouseOut={e  => e.currentTarget.style.background = needsAction ? '#fffbeb' : '#fff'}
                  >
                    <td style={{ padding:'10px 12px', color:'#74777f', whiteSpace:'nowrap' }}>
                      {new Date(l.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700 }}>{l.unit?.nopol}</td>
                    <td style={{ padding:'10px 12px', color:'#44474e' }}>{l.driver?.nama}</td>
                    <td style={{ padding:'10px 12px', color:'#44474e', maxWidth:150 }}>
                      <p style={{ fontWeight:600 }}>{l.jenis}</p>
                      <p style={{ color:'#74777f', fontSize:10, marginTop:2 }}>{l.deskripsi?.slice(0,40)}...</p>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {l.pilihan_driver === 'minta_storing' ? (
                        <span style={{ background:'#fee2e2', color:'#7f1d1d', padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>🆘 Minta Storing</span>
                      ) : l.pilihan_driver === 'pulang_ke_pool' ? (
                        <span style={{ background:'#dbeafe', color:'#1e3a8a', padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>🏠 Pulang ke Pool</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:sc.bg, color:sc.color, padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{l.status}</span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <button onClick={() => setDetail(l)}
                        style={{ background:'#1a2b4b', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detail */}
      {detail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>

            {/* Header modal */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #ebeced' }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>Detail Laporan — {detail.unit?.nopol}</h3>
              <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#74777f' }}>×</button>
            </div>

            <div style={{ padding:20 }}>

              {/* Info dasar */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  ['No Polisi',  detail.unit?.nopol],
                  ['Tipe Unit',  detail.unit?.tipe],
                  ['Driver',     detail.driver?.nama],
                  ['No HP',      detail.driver?.no_hp || '—'],
                  ['KM Kendaraan', detail.km_kendaraan ? detail.km_kendaraan.toLocaleString('id-ID') + ' km' : '—'],
                  ['Waktu Lapor', new Date(detail.created_at).toLocaleString('id-ID')],
                ].map(([k,v]) => (
                  <div key={k}>
                    <p style={{ fontSize:10, color:'#74777f', marginBottom:2 }}>{k}</p>
                    <p style={{ fontSize:12, fontWeight:700 }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Kerusakan */}
              <div style={{ background:'#f8f9fa', borderRadius:8, padding:12, marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <div>
                    <p style={{ fontSize:10, color:'#74777f' }}>Jenis Kerusakan</p>
                    <p style={{ fontSize:13, fontWeight:700 }}>{detail.jenis}</p>
                  </div>
                  {(() => {
                    const sc = STATUS_STYLE[detail.status] || STATUS_STYLE['Dilaporkan'];
                    return <span style={{ background:sc.bg, color:sc.color, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, alignSelf:'center' }}>{detail.status}</span>;
                  })()}
                </div>
                <p style={{ fontSize:11, color:'#44474e', lineHeight:1.6 }}>{detail.deskripsi}</p>
                {detail.catatan && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #ebeced' }}>
                    <p style={{ fontSize:10, color:'#74777f', marginBottom:2 }}>Catatan Tambahan</p>
                    <p style={{ fontSize:11, color:'#44474e' }}>{detail.catatan}</p>
                  </div>
                )}
              </div>

              {/* Lokasi */}
              {detail.koordinat && (
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:11, color:'#1e3a8a' }}>
                  📍 <strong>Lokasi:</strong> {detail.koordinat}
                  {detail.koordinat_lat && detail.koordinat_lng && (
                    <a href={`https://maps.google.com/?q=${detail.koordinat_lat},${detail.koordinat_lng}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft:8, color:'#1e3a8a', fontWeight:700 }}>
                      Buka di Maps →
                    </a>
                  )}
                </div>
              )}

              {/* Pilihan driver */}
              <div style={{ marginBottom:12 }}>
                <p style={{ fontSize:10, color:'#74777f', marginBottom:6 }}>PILIHAN DRIVER</p>
                {detail.pilihan_driver === 'minta_storing' ? (
                  <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'10px 12px' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#7f1d1d' }}>🆘 Minta Storing</p>
                    <p style={{ fontSize:11, color:'#7f1d1d', marginTop:3 }}>Kendaraan tidak memungkinkan melanjutkan perjalanan</p>
                  </div>
                ) : (
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 12px' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#1e3a8a' }}>🏠 Pulang ke Pool</p>
                    <p style={{ fontSize:11, color:'#1e3a8a', marginTop:3 }}>Kendaraan masih bisa berjalan menuju pool</p>
                  </div>
                )}
              </div>

              {/* Foto */}
              {detail.foto_urls?.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ fontSize:10, color:'#74777f', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Foto Kerusakan</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {detail.foto_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Foto ${i+1}`} style={{ width:'100%', aspectRatio:1, objectFit:'cover', borderRadius:8, border:'1px solid #ebeced' }}/>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Tombol keputusan — hanya tampil jika belum diputuskan */}
              {['Menunggu Approval Storing','Menunggu Keputusan Pengurus'].includes(detail.status) && (
                <div style={{ borderTop:'1px solid #ebeced', paddingTop:16 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'#44474e', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    Tindakan Pengurus
                  </p>
                  <div style={{ display:'flex', gap:10 }}>
                    <button
                      onClick={() => handleKeputusan(detail, 'approve_storing')}
                      disabled={saving}
                      style={{ flex:1, background: saving?'#9ca3af':'#7f1d1d', color:'#fff', border:'none', borderRadius:10, padding:'14px 12px', fontSize:12, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'Montserrat,sans-serif', textAlign:'center', lineHeight:1.4 }}>
                      🆘 APPROVE STORING
                      <br/>
                      <span style={{ fontSize:10, opacity:0.8, fontWeight:400 }}>Kirim mekanik ke lokasi</span>
                    </button>
                    <button
                      onClick={() => handleKeputusan(detail, 'pulang_ke_pool')}
                      disabled={saving}
                      style={{ flex:1, background: saving?'#9ca3af':'#1e3a8a', color:'#fff', border:'none', borderRadius:10, padding:'14px 12px', fontSize:12, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'Montserrat,sans-serif', textAlign:'center', lineHeight:1.4 }}>
                      🏠 PULANGKAN KE POOL
                      <br/>
                      <span style={{ fontSize:10, opacity:0.8, fontWeight:400 }}>Driver bawa ke pool</span>
                    </button>
                  </div>
                  {saving && <p style={{ textAlign:'center', fontSize:11, color:'#74777f', marginTop:8 }}>⏳ Memproses...</p>}
                </div>
              )}

              {/* Sudah diputuskan */}
              {detail.diputuskan_at && (
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 12px', marginTop:12, fontSize:11, color:'#166534' }}>
                  ✅ Diputuskan pada: {new Date(detail.diputuskan_at).toLocaleString('id-ID')}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
