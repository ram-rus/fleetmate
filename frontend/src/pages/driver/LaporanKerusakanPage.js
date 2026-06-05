// src/pages/driver/LaporanKerusakanPage.js
// VERSI BARU — 2 pilihan tindakan: Minta Storing atau Pulang ke Pool

import React, { useState, useRef } from 'react';
import { supabase, uploadFile, getPublicUrl } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import toast from 'react-hot-toast';

const JENIS_KERUSAKAN = [
  { label:'Mesin & Transmisi', icon:'⚙️', items:['Mesin Mati','Mesin Overheat','Mesin Brebet','Oli Bocor','Transmisi Bermasalah','Kopling Slip','Aki Soak'] },
  { label:'Ban & Roda',        icon:'🔄', items:['Ban Bocor','Ban Pecah','Velg Bengkok','Mur Roda Kendur'] },
  { label:'Rem',               icon:'🛑', items:['Rem Blong','Rem Bunyi/Kasar','Rem Tangan Tidak Berfungsi','Minyak Rem Habis'] },
  { label:'Lampu & Listrik',   icon:'💡', items:['Lampu Depan Mati','Lampu Belakang Mati','Lampu Sein Mati','AC Tidak Dingin','Wiper Rusak'] },
  { label:'Bodi & Karoseri',   icon:'🚛', items:['Pintu Tidak Menutup','Kaca Pecah','Wing Box Rusak','Spion Lepas'] },
  { label:'Bahan Bakar',       icon:'⛽', items:['Kehabisan BBM','Tangki Bocor','Filter Tersumbat'] },
  { label:'Lainnya',           icon:'🔧', items:['Lainnya (isi manual)'] },
];

const TINGKAT = [
  { value:'berat',  label:'Berat',   desc:'Tidak bisa jalan sama sekali', icon:'🔴', color:'#7f1d1d', bg:'#fff1f2', border:'#fca5a5' },
  { value:'sedang', label:'Sedang',  desc:'Bisa jalan tapi tidak aman',   icon:'🟡', color:'#92400e', bg:'#fffbeb', border:'#fcd34d' },
  { value:'ringan', label:'Ringan',  desc:'Masih bisa beroperasi normal', icon:'🔵', color:'#1e3a8a', bg:'#eff6ff', border:'#93c5fd' },
];

export default function LaporanKerusakanPage() {
  const { profile } = useAuth();
  const [step, setStep]           = useState(1); // 1=jenis, 2=detail, 3=foto&lokasi, 4=tindakan, 5=done
  const [katOpen, setKatOpen]     = useState(null);
  const [jenis, setJenis]         = useState('');
  const [jenisCustom, setJC]      = useState('');
  const [tingkat, setTingkat]     = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [catatan, setCatatan]     = useState('');
  const [fotos, setFotos]         = useState([]);
  const [lokasi, setLokasi]       = useState('');
  const [lat, setLat]             = useState(null);
  const [lng, setLng]             = useState(null);
  const [km, setKm]               = useState('');
  const [gpsLoad, setGPS]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [pilihanDriver, setPilihan] = useState('');
  const [laporanId, setLaporanId] = useState(null);
  const fileRef = useRef();

  function ambilGPS() {
    if (!navigator.geolocation) { toast.error('GPS tidak tersedia'); return; }
    setGPS(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLokasi(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        toast.success('GPS berhasil diambil');
        setGPS(false);
      },
      () => { toast.error('GPS gagal. Isi manual.'); setGPS(false); },
      { timeout: 10000 }
    );
  }

  function handleFoto(e) {
    const files = Array.from(e.target.files);
    if (fotos.length + files.length > 5) { toast.error('Maks 5 foto'); return; }
    setFotos(prev => [...prev, ...files.map(f => ({ file:f, preview:URL.createObjectURL(f) }))]);
    e.target.value = '';
  }

  async function handleSubmit(pilihan) {
    if (!lokasi.trim()) { toast.error('Lokasi wajib diisi'); return; }
    setSaving(true);
    setPilihan(pilihan);

    try {
      // Upload foto
      const urls = [];
      for (const { file } of fotos) {
        const path = await uploadFile('kerusakan-photos', file, profile.id);
        urls.push(getPublicUrl('kerusakan-photos', path));
      }

      // Ambil unit
      const { data: unit } = await supabase.from('units').select('id').eq('nopol', profile.nopol_assign).single();
      if (!unit) { toast.error('Unit tidak ditemukan'); setSaving(false); return; }

      const finalJenis    = jenis === 'Lainnya (isi manual)' ? jenisCustom : jenis;
      const statusBaru    = pilihan === 'minta_storing' ? 'Menunggu Approval Storing' : 'Menunggu Keputusan Pengurus';

      // Insert laporan
      const { data: laporan, error } = await supabase.from('laporan_kerusakan').insert({
        unit_id:        unit.id,
        driver_id:      profile.id,
        jenis:          finalJenis,
        deskripsi,
        catatan,
        foto_urls:      urls,
        koordinat:      lokasi,
        koordinat_lat:  lat,
        koordinat_lng:  lng,
        km_kendaraan:   km ? parseInt(km) : null,
        pilihan_driver: pilihan,
        status:         statusBaru,
      }).select().single();

      if (error) throw error;
      setLaporanId(laporan.id);

      // Notifikasi ke admin
      const { data: admins } = await supabase.from('users').select('id').eq('role','admin');
      for (const a of (admins || [])) {
        await supabase.from('notifikasi').insert({
          user_id: a.id,
          judul:   pilihan === 'minta_storing'
            ? `🆘 Minta Storing — ${profile.nopol_assign}`
            : `🔧 Laporan Kerusakan — ${profile.nopol_assign}`,
          isi: `${finalJenis} (${tingkat}). Driver: ${profile.nama}. ${pilihan === 'minta_storing' ? 'Kendaraan tidak bisa jalan.' : 'Kendaraan akan pulang ke pool.'}`,
          tipe: 'storing',
        });
      }

      setStep(5);
      toast.success('Laporan berhasil dikirim!');
    } catch(e) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // STEP 5 — SELESAI
  // ============================================================
  if (step === 5) {
    const isMintaStoring = pilihanDriver === 'minta_storing';
    return (
      <DriverLayout title="Laporan Kerusakan" back>
        <div style={{ padding:24, textAlign:'center' }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background: isMintaStoring ? '#fee2e2' : '#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'20px auto 16px' }}>
            {isMintaStoring ? '🆘' : '🏠'}
          </div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#1a1c1e', marginBottom:6 }}>Laporan Terkirim!</h2>
          <p style={{ fontSize:12, color:'#74777f', marginBottom:20 }}>
            {isMintaStoring
              ? 'Request storing menunggu approval pengurus'
              : 'Laporan diterima. Silakan bawa kendaraan ke pool'}
          </p>

          <div style={{ background: isMintaStoring ? '#fff1f2' : '#eff6ff', border:`1px solid ${isMintaStoring ? '#fecdd3' : '#bfdbfe'}`, borderRadius:12, padding:14, marginBottom:20, textAlign:'left' }}>
            <p style={{ fontSize:11, fontWeight:700, color: isMintaStoring ? '#7f1d1d' : '#1e3a8a', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              {isMintaStoring ? '🆘 Status: Menunggu Approval Storing' : '🏠 Status: Menunggu Keputusan Pengurus'}
            </p>
            <p style={{ fontSize:11, color: isMintaStoring ? '#7f1d1d' : '#1e3a8a' }}>
              {isMintaStoring
                ? 'Tetap di lokasi dan tunggu konfirmasi dari pengurus. Jangan tinggalkan kendaraan.'
                : 'Bawa kendaraan ke pool dengan hati-hati. Pengurus akan memutuskan tindak lanjut.'}
            </p>
          </div>

          <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:12, padding:14, textAlign:'left', marginBottom:20 }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', marginBottom:8 }}>Ringkasan</p>
            {[
              ['Unit',    profile?.nopol_assign],
              ['Jenis',   jenis === 'Lainnya (isi manual)' ? jenisCustom : jenis],
              ['Tingkat', TINGKAT.find(t=>t.value===tingkat)?.label],
              ['Foto',    `${fotos.length} foto`],
              ['Pilihan', isMintaStoring ? 'Minta Storing' : 'Pulang ke Pool'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:11 }}>
                <span style={{ color:'#74777f' }}>{k}</span>
                <span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>

          <button onClick={() => { setStep(1); setJenis(''); setJC(''); setTingkat(''); setDeskripsi(''); setCatatan(''); setFotos([]); setLokasi(''); setLat(null); setLng(null); setKm(''); setPilihan(''); }}
            style={{ background:'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
            Buat Laporan Baru
          </button>
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout title="Laporan Kerusakan" back>
      <div style={{ padding:16 }}>

        {/* Progress */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20 }}>
          {['Jenis','Detail','Foto & Lokasi','Tindakan'].map((label, i) => (
            <React.Fragment key={i}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                  background: step > i+1 ? '#10b981' : step === i+1 ? '#1a2b4b' : '#e5e7eb',
                  color: step >= i+1 ? '#fff' : '#9ca3af'
                }}>
                  {step > i+1 ? '✓' : i+1}
                </div>
                <span style={{ fontSize:9, color: step === i+1 ? '#1a2b4b' : '#9ca3af', fontWeight: step===i+1?700:400 }}>{label}</span>
              </div>
              {i < 3 && <div style={{ flex:1, height:2, borderRadius:1, background: step>i+1 ? '#10b981' : '#e5e7eb', marginBottom:14 }}/>}
            </React.Fragment>
          ))}
        </div>

        {/* ===== STEP 1: JENIS KERUSAKAN ===== */}
        {step === 1 && (
          <div>
            <p style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Jenis Kerusakan</p>
            <p style={{ fontSize:11, color:'#74777f', marginBottom:14 }}>Pilih kategori dan jenis kerusakan unit {profile?.nopol_assign}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {JENIS_KERUSAKAN.map(kat => (
                <div key={kat.label} style={{ border:'1px solid #ebeced', borderRadius:10, overflow:'hidden', background:'#fff' }}>
                  <button onClick={() => setKatOpen(katOpen===kat.label ? null : kat.label)}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'none', border:'none', cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span>{kat.icon}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'#1a1c1e' }}>{kat.label}</span>
                      {kat.items.some(i => i===jenis) && <span style={{ width:6, height:6, borderRadius:'50%', background:'#1a2b4b', display:'inline-block' }}/>}
                    </div>
                    <span style={{ color:'#c4c7cf', transform: katOpen===kat.label ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                  </button>
                  {katOpen === kat.label && (
                    <div style={{ borderTop:'1px solid #f1f2f3', padding:'8px 14px 12px' }}>
                      {kat.items.map(item => (
                        <label key={item} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background: jenis===item ? '#1a2b4b' : 'transparent', marginBottom:2 }}>
                          <input type="radio" name="jenis" checked={jenis===item} onChange={() => setJenis(item)} style={{ accentColor:'#1a2b4b' }}/>
                          <span style={{ fontSize:12, color: jenis===item ? '#fff' : '#1a1c1e' }}>{item}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {jenis === 'Lainnya (isi manual)' && (
              <input value={jenisCustom} onChange={e => setJC(e.target.value)} placeholder="Jelaskan jenis kerusakan..."
                style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box', marginBottom:14 }}/>
            )}

            {/* Tingkat */}
            {jenis && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Tingkat Kerusakan</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {TINGKAT.map(t => (
                    <label key={t.value} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                      border: tingkat===t.value ? `2px solid ${t.border}` : '1px solid #ebeced',
                      borderRadius:10, cursor:'pointer', background: tingkat===t.value ? t.bg : '#fff' }}>
                      <input type="radio" name="tingkat" checked={tingkat===t.value} onChange={() => setTingkat(t.value)} style={{ accentColor:'#1a2b4b' }}/>
                      <span style={{ fontSize:18 }}>{t.icon}</span>
                      <div>
                        <p style={{ fontSize:12, fontWeight:700, color: tingkat===t.value ? t.color : '#1a1c1e' }}>{t.label}</p>
                        <p style={{ fontSize:10, color: tingkat===t.value ? t.color : '#74777f' }}>{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setStep(2)}
              disabled={!jenis || !tingkat || (jenis==='Lainnya (isi manual)' && !jenisCustom.trim())}
              style={{ width:'100%', background:(!jenis||!tingkat)?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'13px 0', fontSize:13, fontWeight:700, cursor:(!jenis||!tingkat)?'not-allowed':'pointer', fontFamily:'Montserrat,sans-serif' }}>
              Lanjut →
            </button>
          </div>
        )}

        {/* ===== STEP 2: DETAIL ===== */}
        {step === 2 && (
          <div>
            <p style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Detail Kerusakan</p>
            <p style={{ fontSize:11, color:'#74777f', marginBottom:14 }}>Jelaskan kondisi kerusakan secara detail</p>

            <div style={{ background:'#f8f9fa', border:'1px solid #ebeced', borderRadius:10, padding:'10px 14px', display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <p style={{ fontSize:10, color:'#74777f' }}>Jenis</p>
                <p style={{ fontSize:12, fontWeight:700 }}>{jenis === 'Lainnya (isi manual)' ? jenisCustom : jenis}</p>
              </div>
              {(() => { const t = TINGKAT.find(x=>x.value===tingkat); return t ? (
                <span style={{ background:t.bg, color:t.color, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, alignSelf:'center' }}>{t.icon} {t.label}</span>
              ) : null; })()}
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
                Deskripsi Kerusakan <span style={{ color:'#ba1a1a' }}>*</span>
              </label>
              <textarea rows={4} value={deskripsi} onChange={e => setDeskripsi(e.target.value)}
                placeholder="Ceritakan kondisi kerusakan: kapan terjadi, gejala apa, kondisi saat ini..."
                style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:10, padding:'10px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', resize:'none', outline:'none', boxSizing:'border-box' }}/>
              <p style={{ fontSize:10, color: deskripsi.length>=10?'#10b981':'#c4c7cf', textAlign:'right', marginTop:3 }}>
                {deskripsi.length} karakter {deskripsi.length<10?'(min 10)':'✓'}
              </p>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
                Catatan Tambahan (opsional)
              </label>
              <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)}
                placeholder="Informasi tambahan yang perlu diketahui pengurus..."
                style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:10, padding:'10px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', resize:'none', outline:'none', boxSizing:'border-box' }}/>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>KM Kendaraan Saat Ini</label>
              <input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="Contoh: 87500"
                style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box' }}/>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStep(1)} style={{ flex:1, background:'#fff', color:'#1a2b4b', border:'1px solid #c4c7cf', borderRadius:8, padding:'11px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>← Kembali</button>
              <button onClick={() => setStep(3)} disabled={deskripsi.length<10}
                style={{ flex:1, background:deskripsi.length<10?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'11px 0', fontSize:12, fontWeight:700, cursor:deskripsi.length<10?'not-allowed':'pointer', fontFamily:'Montserrat,sans-serif' }}>
                Lanjut →
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: FOTO & LOKASI ===== */}
        {step === 3 && (
          <div>
            <p style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Foto & Lokasi</p>
            <p style={{ fontSize:11, color:'#74777f', marginBottom:14 }}>Lampirkan foto dan lokasi kejadian</p>

            {/* Foto */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em' }}>Foto Kerusakan <span style={{ color:'#ba1a1a' }}>*</span></label>
                <span style={{ fontSize:10, color:'#c4c7cf' }}>{fotos.length}/5</span>
              </div>

              {fotos.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                  {fotos.map((f,i) => (
                    <div key={i} style={{ position:'relative', aspectRatio:1 }}>
                      <img src={f.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8, border:'1px solid #ebeced' }}/>
                      <button onClick={() => setFotos(p => p.filter((_,idx)=>idx!==i))}
                        style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'#ba1a1a', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                    </div>
                  ))}
                  {fotos.length < 5 && (
                    <button onClick={() => fileRef.current?.click()}
                      style={{ aspectRatio:1, border:'2px dashed #c4c7cf', borderRadius:8, background:'#f8f9fa', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#74777f' }}>
                      <span style={{ fontSize:20 }}>+</span>
                      <span style={{ fontSize:9 }}>Tambah</span>
                    </button>
                  )}
                </div>
              )}

              {fotos.length === 0 && (
                <button onClick={() => fileRef.current?.click()}
                  style={{ width:'100%', border:'2px dashed #c4c7cf', borderRadius:10, padding:'24px 0', background:'#f8f9fa', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'#74777f' }}>
                  <span style={{ fontSize:32 }}>📷</span>
                  <span style={{ fontSize:12, fontWeight:600 }}>Ambil / Pilih Foto</span>
                  <span style={{ fontSize:10 }}>Maks 5 foto</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display:'none' }} onChange={handleFoto}/>
              {fotos.length === 0 && <p style={{ fontSize:10, color:'#ba1a1a', marginTop:4 }}>⚠ Minimal 1 foto wajib</p>}
            </div>

            {/* Lokasi */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                Lokasi Kejadian <span style={{ color:'#ba1a1a' }}>*</span>
              </label>
              <button onClick={ambilGPS} disabled={gpsLoad}
                style={{ width:'100%', border:`2px dashed ${lokasi?'#10b981':'#c4c7cf'}`, borderRadius:8, padding:'11px 0', background:lokasi?'#f0fdf4':'#f8f9fa', cursor:'pointer', color:lokasi?'#065f46':'#74777f', fontSize:12, fontWeight:600, fontFamily:'Montserrat,sans-serif', marginBottom:8 }}>
                {gpsLoad ? '⏳ Mengambil GPS...' : lokasi ? `✅ ${lokasi}` : '📍 Klik Ambil Lokasi GPS'}
              </button>
              <input value={lokasi} onChange={e => setLokasi(e.target.value)} placeholder="Atau isi manual: Jl. Raya Bekasi KM 25..."
                style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box' }}/>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStep(2)} style={{ flex:1, background:'#fff', color:'#1a2b4b', border:'1px solid #c4c7cf', borderRadius:8, padding:'11px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>← Kembali</button>
              <button onClick={() => setStep(4)} disabled={fotos.length===0||!lokasi.trim()}
                style={{ flex:2, background:(fotos.length===0||!lokasi.trim())?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'11px 0', fontSize:12, fontWeight:700, cursor:(fotos.length===0||!lokasi.trim())?'not-allowed':'pointer', fontFamily:'Montserrat,sans-serif' }}>
                Lanjut →
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: PILIH TINDAKAN ===== */}
        {step === 4 && (
          <div>
            <p style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Pilih Tindakan</p>
            <p style={{ fontSize:11, color:'#74777f', marginBottom:20 }}>Pilih tindakan sesuai kondisi kendaraan Anda saat ini</p>

            {/* Ringkasan laporan */}
            <div style={{ background:'#f8f9fa', border:'1px solid #ebeced', borderRadius:10, padding:12, marginBottom:20 }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', marginBottom:8 }}>Ringkasan Laporan</p>
              {[
                ['Unit',     profile?.nopol_assign],
                ['Kerusakan',jenis==='Lainnya (isi manual)'?jenisCustom:jenis],
                ['Tingkat',  TINGKAT.find(t=>t.value===tingkat)?.label],
                ['Lokasi',   lokasi.length > 30 ? lokasi.slice(0,30)+'...' : lokasi],
                ['Foto',     `${fotos.length} foto`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
                  <span style={{ color:'#74777f' }}>{k}</span>
                  <span style={{ fontWeight:600, maxWidth:'60%', textAlign:'right' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Tombol tindakan */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* MINTA STORING */}
              <button
                onClick={() => handleSubmit('minta_storing')}
                disabled={saving}
                style={{ background: saving?'#9ca3af':'#7f1d1d', color:'#fff', border:'none', borderRadius:12, padding:'16px 20px', cursor:saving?'not-allowed':'pointer', textAlign:'left', fontFamily:'Montserrat,sans-serif', transition:'all 0.15s' }}
                onMouseOver={e => { if(!saving) e.currentTarget.style.background='#991b1b'; }}
                onMouseOut={e  => { if(!saving) e.currentTarget.style.background='#7f1d1d'; }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:32 }}>🆘</span>
                  <div>
                    <p style={{ fontSize:14, fontWeight:800, marginBottom:3 }}>MINTA STORING</p>
                    <p style={{ fontSize:11, opacity:0.85, lineHeight:1.4 }}>
                      Kendaraan tidak memungkinkan melanjutkan perjalanan. Butuh bantuan di lokasi.
                    </p>
                  </div>
                </div>
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.2)', fontSize:10, opacity:0.75 }}>
                  Status → Menunggu Approval Storing
                </div>
              </button>

              {/* PULANG KE POOL */}
              <button
                onClick={() => handleSubmit('pulang_ke_pool')}
                disabled={saving}
                style={{ background: saving?'#9ca3af':'#1e3a8a', color:'#fff', border:'none', borderRadius:12, padding:'16px 20px', cursor:saving?'not-allowed':'pointer', textAlign:'left', fontFamily:'Montserrat,sans-serif', transition:'all 0.15s' }}
                onMouseOver={e => { if(!saving) e.currentTarget.style.background='#1e40af'; }}
                onMouseOut={e  => { if(!saving) e.currentTarget.style.background='#1e3a8a'; }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:32 }}>🏠</span>
                  <div>
                    <p style={{ fontSize:14, fontWeight:800, marginBottom:3 }}>PULANG KE POOL</p>
                    <p style={{ fontSize:11, opacity:0.85, lineHeight:1.4 }}>
                      Kendaraan masih bisa berjalan menuju pool untuk diperbaiki.
                    </p>
                  </div>
                </div>
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.2)', fontSize:10, opacity:0.75 }}>
                  Status → Menunggu Keputusan Pengurus
                </div>
              </button>

            </div>

            {saving && (
              <p style={{ textAlign:'center', fontSize:12, color:'#74777f', marginTop:16, fontWeight:600 }}>
                ⏳ Mengirim laporan...
              </p>
            )}

            <button onClick={() => setStep(3)} disabled={saving}
              style={{ width:'100%', marginTop:12, background:'transparent', color:'#74777f', border:'1px solid #ebeced', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
              ← Kembali
            </button>
          </div>
        )}

      </div>
    </DriverLayout>
  );
}
