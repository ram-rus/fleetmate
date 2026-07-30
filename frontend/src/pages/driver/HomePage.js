// src/pages/driver/HomePage.js — v6.4 — Robust Realtime Storing + Manual Refresh Button
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDriverAuth } from '../../context/DriverAuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import { getTipe, getProgres, PERBAIKAN_SELECT } from '../../lib/perbaikanConstants';

const STATUS_INFO = {
  'Menunggu Approval Storing':        { icon:'🆘', color:'#7f1d1d', bg:'#fff1f2', text:'Menunggu Approval Storing dari Admin' },
  'Menunggu Approval Pulang ke Pool': { icon:'🏠', color:'#1e3a8a', bg:'#eff6ff', text:'Menunggu Approval Pulang ke Pool' },
  'Storing Disetujui':                { icon:'✅', color:'#065f46', bg:'#d1fae5', text:'Storing Disetujui — Menyiapkan Mekanik' },
  'Storing Luar Disetujui':           { icon:'🏭', color:'#92400e', bg:'#fffbeb', text:'Storing Luar Disetujui — Mekanik Luar Ditugaskan' },
  'Pulang ke Pool Disetujui':         { icon:'🏠', color:'#1e3a8a', bg:'#dbeafe', text:'Pulang ke Pool Disetujui — Segera bawa unit ke pool' },
  'Lanjut Perjalanan':                { icon:'🚗', color:'#065f46', bg:'#f0fdf4', text:'Lanjutkan Perjalanan' },
};

const PROGRES_STEPS = [
  'Menunggu Mekanik',
  'Mekanik Ditugaskan',
  'Mekanik Berangkat',
  'Mekanik Tiba',
  'Perbaikan Berlangsung',
  'Selesai'
];

function getKeberangkatanStatus(progres, jamBerangkat, estimasiTiba) {
  if (progres === 'Mekanik Berangkat') {
    return {
      title: '🚗 Mekanik Dalam Perjalanan!',
      sub: jamBerangkat ? `Berangkat pukul ${jamBerangkat}${estimasiTiba ? ' · Estimasi tiba sekitar ' + estimasiTiba : ''}` : 'Mekanik sedang menuju ke lokasi unit Anda',
      color: '#5b21b6',
      bg: '#f3e8ff',
      border: '#c084fc',
      icon: '🚗'
    };
  }
  if (progres === 'Mekanik Tiba') {
    return {
      title: '📍 Mekanik Sudah Tiba di Lokasi',
      sub: 'Mekanik telah sampai di lokasi unit Anda. Temui mekanik di tempat.',
      color: '#047857',
      bg: '#ecfdf5',
      border: '#6ee7b7',
      icon: '📍'
    };
  }
  if (progres === 'Perbaikan Berlangsung') {
    return {
      title: '🔧 Perbaikan Sedang Berlangsung',
      sub: 'Mekanik sedang melakukan perbaikan pada unit Anda.',
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
      icon: '🔧'
    };
  }
  if (progres === 'Selesai') {
    return {
      title: '✅ Storing & Perbaikan Selesai',
      sub: 'Perbaikan rampung. Unit siap kembali beroperasi.',
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#86efac',
      icon: '✅'
    };
  }
  return {
    title: '⏸️ Mekanik Belum Berangkat',
    sub: jamBerangkat ? `Dijadwalkan berangkat pukul ${jamBerangkat}` : 'Mekanik telah ditugaskan dan sedang mempersiapkan alat & armada',
    color: '#1e40af',
    bg: '#eff6ff',
    border: '#93c5fd',
    icon: '⏳'
  };
}

export default function DriverHomePage() {
  const { driver, logout }     = useDriverAuth(); 
  const navigate               = useNavigate();
  const [p2hHariIni, setP2h]  = useState(null);
  const [laporanAktif, setLap]= useState(null);
  const [perbaikanAktif, setPrb]=useState(null);
  const [loading, setLoad]    = useState(true);
  const [refreshing, setRef]  = useState(false);
  const [jam, setJam]         = useState('');

  useEffect(() => {
    function tick() { setJam(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})); }
    tick(); const t = setInterval(tick,30000); return ()=>clearInterval(t);
  }, []);

  const loadData = useCallback(async (isManual = false) => {
    if (!driver?.unit_id) { setLoad(false); return; }
    if (isManual) setRef(true);
    const unitId = driver.unit_id;
    const today = new Date().toISOString().slice(0,10);
    try {
      const [p2hRes, lapRes, prbRes] = await Promise.all([
  supabase.from('p2h').select('*').eq('unit_id', unitId).eq('tanggal', today).maybeSingle(),
  
  supabase.from('laporan_kerusakan').select('id,status,deskripsi,pilihan_driver,created_at')
    .eq('driver_id', driver.id)
    .not('status', 'in', '("Selesai","Lanjut Perjalanan")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),

  // Tambahkan status 'Menunggu' / 'Proses' jika ada status lain dari admin
  supabase.from('perbaikan').select(PERBAIKAN_SELECT)
    .eq('unit_id', unitId)
    .not('status', 'eq', 'Selesai') // Lebih aman ambil yang belum Selesai
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
]);
      setP2h(p2hRes.data||null);
      setLap(lapRes.data||null);
      setPrb(prbRes.data||null);
    } catch(e) {
      console.error('Error loadData driver home:', e);
    } finally {
      setLoad(false);
      setRef(false);
    }
  }, [driver]);

  // Realtime channel + Auto Polling + Window Focus Refetch
  useEffect(() => {
    loadData();
    if (!driver?.unit_id) return;

    // 1. Supabase Realtime Subscription
    const channelId = `driver-home-${driver.unit_id}`;
const ch = supabase.channel(channelId)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'perbaikan', filter: `unit_id=eq.${driver.unit_id}` }, () => {
    loadData();
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_kerusakan', filter: `driver_id=eq.${driver.id}` }, () => {
    loadData();
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Realtime connected on HP/PC');
    }
  });

    // 2. Polling setiap 5 detik
    const pollInterval = setInterval(() => {
      loadData();
    }, 5000);

    // 3. Re-fetch saat tab/browser HP dibuka kembali
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData, driver?.unit_id]);

  const si   = laporanAktif ? STATUS_INFO[laporanAktif.status] : null;
  const pg   = perbaikanAktif ? getProgres(perbaikanAktif.progres, perbaikanAktif.tipe) : null;
  const tipe = perbaikanAktif ? getTipe(perbaikanAktif.tipe) : null;
  const pgIdx= perbaikanAktif ? PROGRES_STEPS.indexOf(perbaikanAktif.progres) : -1;

  const namaMekanik = perbaikanAktif?.mekanik?.nama || perbaikanAktif?.mekanik_luar_nama || '';
  const noHpMekanik = perbaikanAktif?.mekanik?.no_hp || perbaikanAktif?.mekanik_luar_hp || '';
  const isMekanikLuar = !!perbaikanAktif?.mekanik_luar_nama;

  const kebStatus = perbaikanAktif ? getKeberangkatanStatus(perbaikanAktif.progres, perbaikanAktif.jam_berangkat, perbaikanAktif.estimasi_tiba) : null;

  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari akun driver?')) {
      if (logout) {
        logout();
      } else {
        localStorage.clear();
        navigate('/login');
      }
    }
  };

  if (loading) return <DriverLayout><div style={{padding:40,textAlign:'center',color:'#74777f'}}>Memuat status driver...</div></DriverLayout>;

  return (
    <DriverLayout>
      <div style={{padding:16,fontFamily:"'Inter','Montserrat',sans-serif"}}>

        {/* Greeting Card */}
        <div style={{background:'#1a2b4b',borderRadius:16,padding:20,marginBottom:14,color:'#fff'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4}}>
            <div>
              <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:3}}>Selamat datang,</p>
              <p style={{fontSize:20,fontWeight:800,marginBottom:14}}>{driver?.nama||'Driver'}</p>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => loadData(true)} disabled={refreshing}
                style={{background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#fff', padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                {refreshing ? '⏳ Sync...' : '🔄 Refresh'}
              </button>
              <button onClick={handleLogout}
                style={{background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#fff', padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                🚪 Keluar
              </button>
            </div>
          </div>
          
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
            <div>
              <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:2}}>Unit Anda</p>
              <p style={{fontSize:18,fontWeight:700}}>{driver?.unit_nopol||'—'}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:2}}>
                {new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'})}
              </p>
              <p style={{fontSize:18,fontWeight:700}}>{jam}</p>
            </div>
          </div>
        </div>

        {/* Status P2H */}
        <div style={{background:p2hHariIni?'#f0fdf4':'#fff1f2',border:`1px solid ${p2hHariIni?'#bbf7d0':'#fecdd3'}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>{p2hHariIni?'✅':'⚠️'}</span>
            <div>
              <p style={{fontSize:12,fontWeight:700,color:p2hHariIni?'#166534':'#9f1239'}}>
                {p2hHariIni?'P2H Sudah Disubmit':'Belum P2H Hari Ini!'}
              </p>
              {p2hHariIni&&<p style={{fontSize:10,color:'#16a34a'}}>Status: <b>{p2hHariIni.status}</b></p>}
            </div>
          </div>
          {!p2hHariIni&&(
            <button onClick={()=>navigate('/driver/p2h')}
              style={{background:'#ba1a1a',color:'#fff',border:'none',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              Mulai P2H
            </button>
          )}
        </div>

        {/* Banner laporan menunggu (Sebelum perbaikan dibuat admin) */}
        {laporanAktif && si && !perbaikanAktif && (
          <div onClick={()=>navigate('/driver/kerusakan')}
            style={{background:si.bg,border:`1px solid ${si.color}40`,borderRadius:14,padding:'14px 16px',marginBottom:14,cursor:'pointer',display:'flex',alignItems:'center',gap:12,boxShadow:'0 2px 6px rgba(0,0,0,0.04)'}}>
            <span style={{fontSize:26}}>{si.icon}</span>
            <div style={{flex:1}}>
              <p style={{fontSize:10,fontWeight:700,color:si.color,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>STATUS LAPORAN KERUSAKAN</p>
              <p style={{fontSize:13,fontWeight:700,color:si.color}}>{si.text}</p>
              <p style={{fontSize:10,color:'#64748b',marginTop:2}}>Tap untuk lihat detail laporan & koordinat</p>
            </div>
            <span style={{fontSize:18,color:si.color}}>›</span>
          </div>
        )}

        {/* 🚨 KARTU TRACKING STORING & MEKANIK REALTIME */}
        {perbaikanAktif && (
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
            border: '2px solid #3b82f6',
            boxShadow: '0 8px 24px rgba(59,130,246,0.12)'
          }}>
            {/* Header Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{tipe?.icon || '🛠️'}</span>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3b82f6', letterSpacing: '0.04em' }}>
                    ● LIVE TRACKING STORING
                  </span>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {tipe?.label || 'Penanganan Storing'}
                  </h4>
                </div>
              </div>
              <span style={{
                background: tipe?.bg || '#f1f5f9',
                color: tipe?.color || '#334155',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700
              }}>
                {perbaikanAktif.status || 'Berjalan'}
              </span>
            </div>

            {/* Status Keberangkatan Badge Utama */}
            {kebStatus && (
              <div style={{
                background: kebStatus.bg,
                border: `1.5px solid ${kebStatus.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <span style={{ fontSize: 28 }}>{kebStatus.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: kebStatus.color, margin: 0 }}>
                    {kebStatus.title}
                  </p>
                  <p style={{ fontSize: 11, color: kebStatus.color, opacity: 0.95, margin: '3px 0 0', fontWeight: 500 }}>
                    {kebStatus.sub}
                  </p>
                </div>
              </div>
            )}

            {/* KOTAK INFORMASI MEKANIK TERPERINCI & PANGGILAN TLP */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 12,
              padding: 14,
              border: '1px solid #e2e8f0',
              marginBottom: 14
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                👷 MEKANIK YANG DITUGASKAN
              </p>

              {namaMekanik ? (
                <div style={{ background: '#ffffff', borderRadius: 10, padding: 12, border: '1px solid #cbd5e1', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {namaMekanik}
                        </p>
                        {isMekanikLuar && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>
                            Bengkel / Luar
                          </span>
                        )}
                      </div>
                      {noHpMekanik ? (
                        <p style={{ fontSize: 12, color: '#475569', fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>
                          📞 {noHpMekanik}
                        </p>
                      ) : (
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>No. HP tidak dicantumkan</p>
                      )}
                    </div>

                    {noHpMekanik && (
                      <a href={`tel:${noHpMekanik}`}
                        style={{
                          background: '#059669',
                          color: '#ffffff',
                          textDecoration: 'none',
                          padding: '10px 16px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 8px rgba(5,150,105,0.25)'
                        }}>
                        📞 Hubungi
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: '#92400e', fontStyle: 'italic', margin: 0 }}>
                    ⏳ Admin sedang menentukan mekanik yang akan ditugaskan ke lokasi...
                  </p>
                </div>
              )}

              {/* Rincian Jam Berangkat & Estimasi Tiba */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, margin: 0 }}>Jam Berangkat</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: perbaikanAktif.jam_berangkat ? '#0f172a' : '#94a3b8', margin: '2px 0 0' }}>
                    {perbaikanAktif.jam_berangkat ? `🕐 ${perbaikanAktif.jam_berangkat}` : '⏸️ Belum Diisi'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, margin: 0 }}>Estimasi Tiba</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: perbaikanAktif.estimasi_tiba ? '#0284c7' : '#94a3b8', margin: '2px 0 0' }}>
                    {perbaikanAktif.estimasi_tiba ? `⏳ ± ${perbaikanAktif.estimasi_tiba}` : '—'}
                  </p>
                </div>
              </div>

              {/* Catatan Admin/Mekanik untuk Driver */}
              {perbaikanAktif.catatan_untuk_driver && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', margin: '0 0 2px' }}>💬 Pesan untuk Driver:</p>
                  <p style={{ fontSize: 11, color: '#1e3a8a', margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
                    "{perbaikanAktif.catatan_untuk_driver}"
                  </p>
                </div>
              )}
            </div>

            {/* Visual Progress Stepper (6 Tahap) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>
                  PROGRES PENANGANAN ({pg?.label || perbaikanAktif.progres})
                </p>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>
                  {pgIdx >= 0 ? `Tahap ${pgIdx + 1} dari ${PROGRES_STEPS.length}` : 'Aktif'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {PROGRES_STEPS.map((stepName, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: i <= pgIdx ? '#2563eb' : '#e2e8f0',
                    transition: 'background 0.4s ease'
                  }} />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                <span>Menunggu</span>
                <span>Ditugaskan</span>
                <span>Berangkat</span>
                <span>Tiba</span>
                <span>Selesai</span>
              </div>
            </div>

            <p style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', marginTop: 10, margin: '10px 0 0' }}>
              ● Live auto-update realtime · {new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
            </p>
          </div>
        )}

        {/* Menu Grid Utama */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          {[
            {icon:'📋',label:'P2H Digital',desc:p2hHariIni?'Sudah disubmit':'Belum P2H hari ini!',to:'/driver/p2h',alert:!p2hHariIni,bg:'#eff6ff'},
            {icon:'⚠️',label:'Lapor Masalah',desc:'Laporkan kerusakan / minta storing',to:'/driver/kerusakan',alert:false,bg:'#fefce8'},
          ].map(m=>(
            <button key={m.label} onClick={()=>navigate(m.to)}
              style={{background:'#fff',border:'1px solid #ebeced',borderRadius:12,padding:14,textAlign:'left',cursor:'pointer',position:'relative',fontFamily:'inherit'}}
              onMouseOver={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'}
              onMouseOut={e=>e.currentTarget.style.boxShadow='none'}>
              {m.alert&&<span style={{position:'absolute',top:10,right:10,width:18,height:18,borderRadius:'50%',background:'#ba1a1a',color:'#fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>!</span>}
              <div style={{width:44,height:44,background:m.bg,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:10}}>{m.icon}</div>
              <p style={{fontSize:12,fontWeight:700,color:'#1a1c1e',marginBottom:3}}>{m.label}</p>
              <p style={{fontSize:10,color:'#74777f'}}>{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Menu Utama Logout di Bagian Paling Bawah */}
        <button onClick={handleLogout}
          style={{width:'100%', background:'#fff', border:'1px solid #ba1a1a', borderRadius:12, padding:'14px 0', color:'#ba1a1a', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s'}}
          onMouseOver={e=>{e.currentTarget.style.background='#fff1f2'}}
          onMouseOut={e=>{e.currentTarget.style.background='#fff'}}>
          <span>🚪</span> Keluar dari Akun Driver
        </button>

      </div>
    </DriverLayout>
  );
}