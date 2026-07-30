// src/pages/driver/P2HPage.js — v5.1 (tidak ada perubahan logika, copy dari upload)
import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadFile, getPublicUrl } from '../../lib/supabase';
import { useDriverAuth } from '../../context/DriverAuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import toast from 'react-hot-toast';

const ITEMS = [
  { key:'rem_depan',       label:'Rem Depan',        kritis:true  },
  { key:'rem_belakang',    label:'Rem Belakang',      kritis:true  },
  { key:'ban_depan_kiri',  label:'Ban Depan Kiri',    kritis:true  },
  { key:'ban_depan_kanan', label:'Ban Depan Kanan',   kritis:true  },
  { key:'ban_belakang',    label:'Ban Belakang',      kritis:true  },
  { key:'lampu_depan',     label:'Lampu Depan',       kritis:true  },
  { key:'lampu_belakang',  label:'Lampu Belakang',    kritis:false },
  { key:'lampu_sein',      label:'Lampu Sein',        kritis:false },
  { key:'wiper',           label:'Wiper / Kaca',      kritis:false },
  { key:'klakson',         label:'Klakson',           kritis:false },
  { key:'oli_mesin',       label:'Oli Mesin',         kritis:false },
  { key:'air_radiator',    label:'Air Radiator',      kritis:false },
  { key:'bahan_bakar',     label:'Bahan Bakar',       kritis:false },
  { key:'kebersihan',      label:'Kebersihan Kabin',  kritis:false },
  { key:'stnk',            label:'STNK',              kritis:true  },
  { key:'kir',             label:'KIR',               kritis:true  },
];

export default function DriverP2HPage() {
  const { driver }           = useDriverAuth();
  const [unitId,  setUnitId] = useState(null);
  const [existing, setExist] = useState(null);
  const [loadingCek, setCek] = useState(true);
  const [hasil,  setHasil]   = useState(() => Object.fromEntries(ITEMS.map(i => [i.key,'ok'])));
  const [km,     setKm]      = useState('');
  const [catatan,setCatatan] = useState('');
  const [fotos,  setFotos]   = useState([]);
  const [saving, setSaving]  = useState(false);
  const [done,   setDone]    = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (!driver?.unit_id) { setCek(false); return; }
    async function cek() {
      setUnitId(driver.unit_id);
      const today = new Date().toISOString().slice(0,10);
      const { data: p2h } = await supabase.from('p2h').select('*').eq('unit_id', driver.unit_id).eq('tanggal', today).maybeSingle();
      setExist(p2h);
      setCek(false);
    }
    cek();
  }, [driver]);

  const adaNOK    = Object.values(hasil).some(v => v !== 'ok');
  const adaKritis = ITEMS.filter(i => i.kritis).some(i => hasil[i.key] !== 'ok');
  const statusHasil = adaKritis ? 'TIDAK LAYAK' : 'LAYAK';

  function toggleItem(key) {
    setHasil(prev => ({ ...prev, [key]: prev[key] === 'ok' ? 'tidak_ok' : 'ok' }));
  }

  function handleFoto(e) {
    const files = Array.from(e.target.files);
    if (fotos.length + files.length > 5) { toast.error('Maks 5 foto'); return; }
    setFotos(prev => [...prev, ...files.map(f => ({ file:f, preview: URL.createObjectURL(f) }))]);
    e.target.value = '';
  }

  async function handleSubmit() {
    if (adaNOK && fotos.length === 0) { toast.error('Upload minimal 1 foto untuk item NOK'); return; }
    if (!unitId) { toast.error('Unit tidak ditemukan'); return; }
    setSaving(true);
    try {
      const urls = [];
      for (const { file } of fotos) {
        const path = await uploadFile('p2h-photos', file, driver.id);
        urls.push(getPublicUrl('p2h-photos', path));
      }
      const { error } = await supabase.from('p2h').insert({
        unit_id:     unitId,
        driver_id:   driver.id,
        tanggal:     new Date().toISOString().slice(0,10),
        hasil,
        status:      statusHasil,
        foto_urls:   urls,
        km_saat_p2h: km ? parseInt(km) : null,
        catatan,
      });
      if (error) {
        if (error.code === '23505') toast.error('P2H sudah disubmit hari ini');
        else throw error;
        return;
      }
      if (km) await supabase.from('units').update({ km_terakhir: parseInt(km) }).eq('id', unitId);
      setDone(true);
      toast.success('P2H berhasil disubmit!');
    } catch(e) { toast.error('Gagal: ' + e.message); }
    finally { setSaving(false); }
  }

  if (loadingCek) return <DriverLayout title="P2H Digital" back><div style={{ padding:40, textAlign:'center' }}>Memuat...</div></DriverLayout>;

  if (existing || done) {
    const data = existing || {};
    const sc = data.status === 'LAYAK' ? '#065f46' : '#7f1d1d';
    return (
      <DriverLayout title="P2H Digital" back>
        <div style={{ padding:24, textAlign:'center' }}>
          <div style={{ width:80, height:80, background:'#d1fae5', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'20px auto 16px' }}>✅</div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#1a1c1e', marginBottom:6 }}>P2H Sudah Disubmit</h2>
          <p style={{ fontSize:12, color:'#74777f', marginBottom:20 }}>Anda sudah melakukan P2H hari ini</p>
          <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:12, padding:16, textAlign:'left' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, fontSize:12 }}>
              <span style={{ color:'#74777f' }}>Status</span>
              <span style={{ fontWeight:700, color:sc }}>{data.status || statusHasil}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
              <span style={{ color:'#74777f' }}>Waktu</span>
              <span style={{ fontWeight:600 }}>
                {data.created_at ? new Date(data.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
              </span>
            </div>
          </div>
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout title="P2H Digital" back>
      <div style={{ padding:16 }}>
        <div style={{ background:'#1a2b4b', borderRadius:12, padding:14, marginBottom:16, color:'#fff' }}>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:2 }}>Unit Anda</p>
          <p style={{ fontSize:18, fontWeight:700 }}>{driver?.unit_nopol || '—'}</p>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:4 }}>
            {new Date().toLocaleDateString('id-ID',{ weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>

        {adaKritis && (
          <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#9f1239', fontWeight:600 }}>
            ⚠ Unit akan dinyatakan TIDAK LAYAK — ada item kritis NOK
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>KM Saat Ini</label>
          <input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="Contoh: 87500"
            style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 12px', fontSize:13, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box' }}/>
        </div>

        <p style={{ fontSize:13, fontWeight:700, color:'#1a1c1e', marginBottom:10 }}>Checklist 16 Item</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {ITEMS.map(item => {
            const isOK = hasil[item.key] === 'ok';
            return (
              <div key={item.key} onClick={() => toggleItem(item.key)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:10, cursor:'pointer',
                  border: isOK ? '1px solid #ebeced' : item.kritis ? '1px solid #fca5a5' : '1px solid #fcd34d',
                  background: isOK ? '#fff' : item.kritis ? '#fff1f2' : '#fffbeb',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {item.kritis && <span style={{ fontSize:10, background:'#fee2e2', color:'#7f1d1d', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>KRITIS</span>}
                  <span style={{ fontSize:13, fontWeight:600, color: isOK ? '#1a1c1e' : item.kritis ? '#7f1d1d' : '#92400e' }}>{item.label}</span>
                </div>
                <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background: isOK?'#d1fae5':'#fee2e2', color: isOK?'#065f46':'#7f1d1d' }}>
                  {isOK ? '✓ OK' : '✕ NOK'}
                </span>
              </div>
            );
          })}
        </div>

        {adaNOK && (
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
              Foto Bukti NOK <span style={{ color:'#ba1a1a' }}>*</span>
            </label>
            {fotos.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                {fotos.map((f, i) => (
                  <div key={i} style={{ position:'relative', aspectRatio:1 }}>
                    <img src={f.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8, border:'1px solid #ebeced' }}/>
                    <button onClick={() => setFotos(prev => prev.filter((_,idx) => idx !== i))}
                      style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'#ba1a1a', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                  </div>
                ))}
                {fotos.length < 5 && (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ aspectRatio:1, border:'2px dashed #c4c7cf', borderRadius:8, background:'#f8f9fa', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, color:'#74777f' }}>
                    <span style={{ fontSize:20 }}>+</span><span style={{ fontSize:10 }}>Tambah</span>
                  </button>
                )}
              </div>
            )}
            {fotos.length === 0 && (
              <button onClick={() => fileRef.current?.click()}
                style={{ width:'100%', border:'2px dashed #c4c7cf', borderRadius:10, padding:'20px 0', background:'#f8f9fa', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'#74777f' }}>
                <span style={{ fontSize:28 }}>📷</span>
                <span style={{ fontSize:12, fontWeight:600 }}>Ambil / Pilih Foto</span>
                <span style={{ fontSize:10 }}>Maks 5 foto</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display:'none' }} onChange={handleFoto}/>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>Catatan (opsional)</label>
          <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan tambahan..."
            style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 12px', fontSize:12, fontFamily:'Montserrat,sans-serif', resize:'none', outline:'none', boxSizing:'border-box' }}/>
        </div>

        <div style={{ padding:'12px 16px', borderRadius:10, textAlign:'center', fontWeight:700, fontSize:14, marginBottom:16,
          background: statusHasil==='LAYAK'?'#d1fae5':'#fee2e2', color: statusHasil==='LAYAK'?'#065f46':'#7f1d1d' }}>
          Hasil P2H: {statusHasil}
        </div>

        <button onClick={handleSubmit} disabled={saving}
          style={{ width:'100%', background: saving?'#6b7280':'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'14px 0', fontSize:14, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor: saving?'not-allowed':'pointer' }}>
          {saving ? 'Menyimpan...' : 'Submit P2H'}
        </button>
      </div>
    </DriverLayout>
  );
}
