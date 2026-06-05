// src/pages/driver/StoringPage.js
import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadFile, getPublicUrl } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import toast from 'react-hot-toast';

const ALASAN = ['Mogok / Mesin Mati','Ban Pecah / Kempes','Kecelakaan','Banjir / Jalan Terblokir','Menunggu Muatan','Kerusakan Komponen','Lainnya'];

export default function DriverStoringPage() {
  const { profile }             = useAuth();
  const [list, setList]         = useState([]);
  const [showForm, setForm]     = useState(false);
  const [alasan, setAlasan]     = useState('');
  const [alasanCustom, setAC]   = useState('');
  const [lokasi, setLokasi]     = useState('');
  const [foto, setFoto]         = useState(null);
  const [gpsLoad, setGPS]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef();

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    const { data } = await supabase
      .from('storing')
      .select('*, unit:units(nopol)')
      .eq('driver_id', profile.id)
      .order('created_at', { ascending:false })
      .limit(10);
    setList(data || []);
  }

  function ambilGPS() {
    if (!navigator.geolocation) { toast.error('GPS tidak tersedia'); return; }
    setGPS(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLokasi(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        toast.success('Lokasi GPS berhasil diambil');
        setGPS(false);
      },
      () => { toast.error('GPS gagal. Isi manual.'); setGPS(false); },
      { timeout: 10000 }
    );
  }

  async function handleSubmit() {
    const finalAlasan = alasan === 'Lainnya' ? alasanCustom : alasan;
    if (!finalAlasan) { toast.error('Pilih alasan storing'); return; }
    if (!lokasi.trim()) { toast.error('Lokasi wajib diisi'); return; }

    setSaving(true);
    try {
      let fotoUrl = null;
      if (foto) {
        const path = await uploadFile('storing-photos', foto, profile.id);
        fotoUrl = getPublicUrl('storing-photos', path);
      }

      const { data: unit } = await supabase.from('units').select('id').eq('nopol', profile.nopol_assign).single();
      if (!unit) { toast.error('Unit tidak ditemukan'); setSaving(false); return; }

      const { error } = await supabase.from('storing').insert({
        unit_id:   unit.id,
        driver_id: profile.id,
        lokasi,
        alasan:    finalAlasan,
        foto_url:  fotoUrl,
        status:    'Pending',
      });
      if (error) throw error;

      toast.success('Request storing berhasil dikirim!');
      setForm(false); setAlasan(''); setAC(''); setLokasi(''); setFoto(null);
      load();
    } catch(e) { toast.error('Gagal: ' + e.message); }
    finally { setSaving(false); }
  }

  const storingAktif = list.find(s => ['Aktif','Pending'].includes(s.status));

  const statusStyle = {
    'Pending': { bg:'#dbeafe', color:'#1e3a8a' },
    'Aktif':   { bg:'#fef3c7', color:'#92400e' },
    'Selesai': { bg:'#d1fae5', color:'#065f46' },
    'Ditolak': { bg:'#fee2e2', color:'#7f1d1d' },
  };

  return (
    <DriverLayout title="Request Storing" back>
      <div style={{ padding:16 }}>

        {/* Ada storing aktif */}
        {storingAktif && (
          <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:12, padding:14, marginBottom:16 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:8 }}>⚠ Unit Sedang Storing</p>
            {[
              ['Status', <span style={{ background:statusStyle[storingAktif.status]?.bg, color:statusStyle[storingAktif.status]?.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{storingAktif.status}</span>],
              ['Lokasi', storingAktif.lokasi],
              ['Alasan', storingAktif.alasan],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
                <span style={{ color:'#92400e' }}>{k}</span>
                <span style={{ fontWeight:600, color:'#92400e', maxWidth:'60%', textAlign:'right' }}>{v}</span>
              </div>
            ))}
            {storingAktif.status === 'Pending' && (
              <p style={{ fontSize:10, color:'#92400e', marginTop:6, fontStyle:'italic' }}>Menunggu persetujuan admin...</p>
            )}
          </div>
        )}

        {/* Tombol request */}
        {!storingAktif && !showForm && (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:48, marginBottom:10 }}>📍</div>
            <p style={{ fontSize:14, fontWeight:700, color:'#1a1c1e', marginBottom:6 }}>Tidak ada storing aktif</p>
            <p style={{ fontSize:12, color:'#74777f', marginBottom:20 }}>Gunakan ini jika unit mengalami masalah di jalan</p>
            <button onClick={() => setForm(true)}
              style={{ background:'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
              📍 Request Storing
            </button>
          </div>
        )}

        {/* Form request */}
        {showForm && (
          <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:12, padding:16, marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Form Request Storing</p>

            {/* Alasan */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Alasan Storing</label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {ALASAN.map(a => (
                  <label key={a} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                    border: alasan===a ? '2px solid #1a2b4b' : '1px solid #ebeced',
                    borderRadius:8, cursor:'pointer',
                    background: alasan===a ? '#e8edf5' : '#fff',
                  }}>
                    <input type="radio" name="alasan" checked={alasan===a} onChange={() => setAlasan(a)} style={{ accentColor:'#1a2b4b' }}/>
                    <span style={{ fontSize:12, fontWeight:500, color: alasan===a ? '#1a2b4b' : '#1a1c1e' }}>{a}</span>
                  </label>
                ))}
              </div>
              {alasan === 'Lainnya' && (
                <textarea rows={2} value={alasanCustom} onChange={e => setAC(e.target.value)} placeholder="Jelaskan alasan..."
                  style={{ width:'100%', marginTop:8, border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', resize:'none', outline:'none', boxSizing:'border-box' }}/>
              )}
            </div>

            {/* Lokasi */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Lokasi</label>
              <button onClick={ambilGPS} disabled={gpsLoad}
                style={{ width:'100%', border:`2px dashed ${lokasi ? '#10b981' : '#c4c7cf'}`, borderRadius:8, padding:'10px 0', background: lokasi ? '#f0fdf4' : '#f8f9fa', cursor:'pointer', color: lokasi ? '#065f46' : '#74777f', fontSize:12, fontWeight:600, fontFamily:'Montserrat,sans-serif', marginBottom:6 }}>
                {gpsLoad ? '⏳ Mengambil GPS...' : lokasi ? `✅ ${lokasi}` : '📍 Klik Ambil Lokasi GPS'}
              </button>
              <input value={lokasi} onChange={e => setLokasi(e.target.value)} placeholder="Atau ketik lokasi manual..."
                style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box' }}/>
            </div>

            {/* Foto */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Foto Unit (opsional)</label>
              {foto ? (
                <div style={{ position:'relative', width:100 }}>
                  <img src={URL.createObjectURL(foto)} alt="" style={{ width:100, height:100, objectFit:'cover', borderRadius:8, border:'1px solid #ebeced' }}/>
                  <button onClick={() => setFoto(null)}
                    style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'#ba1a1a', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  style={{ width:'100%', border:'2px dashed #c4c7cf', borderRadius:8, padding:'16px 0', background:'#f8f9fa', cursor:'pointer', color:'#74777f', fontSize:12, fontFamily:'Montserrat,sans-serif' }}>
                  📷 Ambil Foto
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => setFoto(e.target.files[0])}/>
            </div>

            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#1e40af', fontWeight:600 }}>
              ℹ Request akan dikirim ke admin untuk disetujui
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setForm(false)}
                style={{ flex:1, background:'#fff', color:'#1a2b4b', border:'1px solid #c4c7cf', borderRadius:8, padding:'11px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex:1, background: saving ? '#6b7280' : '#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'11px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
                {saving ? 'Mengirim...' : 'Kirim Request'}
              </button>
            </div>
          </div>
        )}

        {/* Riwayat */}
        {list.length > 0 && (
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:'#1a1c1e', marginBottom:10 }}>Riwayat Storing</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {list.map(s => {
                const sc = statusStyle[s.status] || { bg:'#f3f4f6', color:'#374151' };
                return (
                  <div key={s.id} style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:10, padding:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:700, fontFamily:'monospace' }}>{s.unit?.nopol}</span>
                      <span style={{ background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{s.status}</span>
                    </div>
                    <p style={{ fontSize:11, color:'#74777f' }}>{s.alasan}</p>
                    <p style={{ fontSize:10, color:'#c4c7cf', marginTop:3 }}>{new Date(s.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DriverLayout>
  );
}
