// src/pages/admin/OverviewPage.js — v8: fokus P2H + insiden lapangan
// Redesign: breakdown Kontrak/On-Call/Standby dihapus (di luar fokus maintenance).
// Overview sekarang jadi "antrian kerja" — apa yang perlu ditindaklanjuti admin
// hari ini — bukan laporan status utilisasi armada.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { TIPE_STORING, TIPE_PERBAIKAN } from '../../lib/perbaikanConstants';
import { attachDriverInfo } from '../../lib/driverHelper';
import HasilBreakdown from '../../components/HasilP2HBreakdown';

const C = {
  contentBg:  '#F5F3EF',
  cardBg:     '#FFFFFF',
  cardBdr:    '#EBEBEB',
  textPrimary:'#111827',
  textSecond: '#6B7280',
  textLight:  '#9CA3AF',
  labelUpper: '#9CA3AF',
  navy:       '#1F2937',
  blue:       '#2170E4',
  green:      '#059669',
  amber:      '#D97706',
  red:        '#C94A3A',
  redBg:      '#FDE8E8',
  amberBg:    '#FEF3C7',
  greenBg:    '#ECFDF5',
  blueBg:     '#EFF6FF',
  head:       "'Hanken Grotesk','Inter',sans-serif",
  body:       "'Inter',sans-serif",
  mono:       "'JetBrains Mono',monospace",
};

const STATUS_P2H_COLOR = {
  'LAYAK':                { bg:C.greenBg, color:C.green },
  'LAYAK DENGAN CATATAN': { bg:C.amberBg, color:C.amber },
  'TIDAK LAYAK':          { bg:C.redBg,   color:C.red   },
};

// ── Modal drill-down ──────────────────────────────────────────
function DrillModal({ title, items, columns, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.55)',
      backdropFilter:'blur(3px)', zIndex:50, display:'flex',
      alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:C.cardBg, borderRadius:10, width:'100%', maxWidth:560,
        maxHeight:'82vh', display:'flex', flexDirection:'column',
        border:`1px solid ${C.cardBdr}`, boxShadow:'0 16px 48px rgba(17,24,39,0.14)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'16px 20px', borderBottom:`1px solid ${C.cardBdr}`, flexShrink:0 }}>
          <h3 style={{ fontSize:15, fontWeight:700, fontFamily:C.head, color:C.textPrimary }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18,
            cursor:'pointer', color:C.textLight, width:28, height:28, borderRadius:5,
            display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {items.length === 0
            ? <div style={{ padding:40, textAlign:'center', color:C.textLight, fontSize:13 }}>Tidak ada data</div>
            : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:C.contentBg }}>
                    {columns.map(col => (
                      <th key={col.key} style={{ textAlign:'left', padding:'9px 18px', fontSize:10,
                        fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
                        letterSpacing:'0.06em', borderBottom:`1px solid ${C.cardBdr}` }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderBottom:`1px solid #F9FAFB` }}
                      onMouseOver={e => e.currentTarget.style.background=C.contentBg}
                      onMouseOut={e  => e.currentTarget.style.background='#fff'}>
                      {columns.map(col => (
                        <td key={col.key} style={{ padding:'11px 18px', color:C.textSecond,
                          fontWeight:col.bold?600:400, fontFamily:col.mono?C.mono:C.body }}>
                          {col.render ? col.render(item) : (item[col.key]||'—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
        <div style={{ padding:'8px 20px', borderTop:`1px solid ${C.cardBdr}`, flexShrink:0 }}>
          <span style={{ fontSize:11, color:C.textLight }}>{items.length} item</span>
        </div>
      </div>
    </div>
  );
}

// ── Kartu statistik generik (dipakai di section P2H & Insiden) ─
function StatCard({ label, value, unit, icon, accent, accentBg, urgent, sub, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={!onClick}
      onMouseOver={() => setHov(true)} onMouseOut={() => setHov(false)}
      style={{ background:C.cardBg, border:`1px solid ${hov&&onClick?accent+'50':C.cardBdr}`,
        borderRadius:8, padding:18, textAlign:'left', cursor:onClick?'pointer':'default', width:'100%',
        position:'relative', overflow:'hidden', fontFamily:C.body,
        boxShadow:hov&&onClick?`0 4px 16px ${accent}14`:'none', transition:'all 0.15s' }}>
      {onClick && (
        <span style={{ position:'absolute', top:14, right:14, fontSize:12,
          color:C.textLight, opacity:hov?1:0.5, transition:'opacity 0.15s' }}>↗</span>
      )}
      <div style={{ width:36, height:36, background:accentBg, borderRadius:8,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:17, marginBottom:10 }}>{icon}</div>
      <p style={{ fontSize:10, fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
        letterSpacing:'0.06em', marginBottom:4 }}>{label}</p>
      <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:sub?4:0 }}>
        <span style={{ fontSize:28, fontWeight:700, fontFamily:C.head, color:C.textPrimary, lineHeight:1 }}>{value}</span>
        {unit && <span style={{ fontSize:11, color:C.textLight }}>{unit}</span>}
      </div>
      {sub && (
        <p style={{ fontSize:11, color:C.textLight }}>
          {urgent
            ? <span style={{ background:C.redBg, color:C.red, padding:'2px 8px', borderRadius:9999,
                fontSize:10, fontWeight:700 }}>{sub}</span>
            : sub}
        </p>
      )}
    </button>
  );
}

function StatusChip({ status }) {
  const s = STATUS_P2H_COLOR[status] || { bg:'#F1F5F9', color:'#475569' };
  return (
    <span style={{ background:s.bg, color:s.color, padding:'2px 8px', borderRadius:9999,
      fontSize:10, fontWeight:700 }}>{status}</span>
  );
}

// ── Popup detail hasil P2H — dipakai dari tombol Detail di Aktivitas Terkini ─
function P2HDetailModal({ p2h, onClose }) {
  const sc = STATUS_P2H_COLOR[p2h.status] || { bg:'#F1F5F9', color:'#475569' };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.55)',
      backdropFilter:'blur(3px)', zIndex:50, display:'flex',
      alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:C.cardBg, borderRadius:10, width:'100%', maxWidth:420,
        maxHeight:'85vh', display:'flex', flexDirection:'column',
        border:`1px solid ${C.cardBdr}`, boxShadow:'0 16px 48px rgba(17,24,39,0.14)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'16px 20px', borderBottom:`1px solid ${C.cardBdr}`, flexShrink:0 }}>
          <h3 style={{ fontSize:15, fontWeight:700, fontFamily:C.head, color:C.textPrimary }}>
            Detail P2H — {p2h.unit?.nopol || '—'}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18,
            cursor:'pointer', color:C.textLight, width:28, height:28, borderRadius:5,
            display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12, marginBottom:8 }}>
            <div>
              <p style={{ color:C.textLight, marginBottom:2 }}>Driver</p>
              <p style={{ fontWeight:700, color:C.textPrimary }}>{p2h.driver?.nama || '—'}</p>
            </div>
            <div>
              <p style={{ color:C.textLight, marginBottom:2 }}>Status</p>
              <span style={{ background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:9999,
                fontSize:11, fontWeight:700 }}>{p2h.status}</span>
            </div>
            <div>
              <p style={{ color:C.textLight, marginBottom:2 }}>KM Saat P2H</p>
              <p style={{ fontWeight:700, color:C.textPrimary }}>
                {p2h.km_saat_p2h?.toLocaleString('id-ID') || '—'} km
              </p>
            </div>
            <div>
              <p style={{ color:C.textLight, marginBottom:2 }}>Waktu</p>
              <p style={{ fontWeight:700, color:C.textPrimary }}>
                {new Date(p2h.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
              </p>
            </div>
          </div>
          {p2h.catatan && (
            <div style={{ marginTop:8, background:C.contentBg, borderRadius:8, padding:10, fontSize:12, color:C.textSecond }}>
              {p2h.catatan}
            </div>
          )}
          <HasilBreakdown hasil={p2h.hasil} />
        </div>
      </div>
    </div>
  );
}

// ── Komponen utama ────────────────────────────────────────────
export default function OverviewPage() {
  const [units,        setUnits]       = useState([]);
  const [perbaikan,    setPrb]         = useState([]);
  const [p2hHariIni,   setP2hHariIni]  = useState([]);
  const [laporanPending, setLapPending]= useState([]);
  const [aktivitas,    setAktv]        = useState([]);
  const [loading,      setLoad]        = useState(true);
  const [modal,        setModal]       = useState(null);
  const [p2hDetail,    setP2hDetail]   = useState(null);
  const [tindakanOpen, setTindakanOpen]= useState(false);
  const [tindakanAutoOpened, setAutoOpened] = useState(false);

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().slice(0,10);
    const [uRes, pRes, lapRes, p2hRes, prbBaruRes, prbSelesaiRes] = await Promise.all([
      supabase.from('units').select('id,nopol,tipe'),
      supabase.from('v_perbaikan_aktif').select('*'),
      // SEMUA laporan menunggu approval (bukan cuma 5) — dipakai untuk hitungan & drill-down
      supabase.from('laporan_kerusakan')
        .select('id,status,pilihan_driver,created_at,driver_id,unit:units(nopol)')
        .in('status',['Menunggu Approval Storing','Menunggu Approval Pulang ke Pool'])
        .order('created_at',{ascending:false}),
      // SEMUA P2H hari ini (bukan cuma 5) — dipakai untuk hitungan sudah/belum/tidak layak
      // + kolom hasil/catatan/km_saat_p2h untuk popup detail dari Aktivitas Terkini
      supabase.from('p2h')
        .select('id,status,created_at,driver_id,unit_id,hasil,catatan,km_saat_p2h,tanggal,unit:units(nopol)')
        .eq('tanggal', today)
        .order('created_at',{ascending:false}),
      // Perbaikan/storing yang baru dibuat — untuk feed aktivitas
      supabase.from('perbaikan')
        .select('id,tipe,status,created_at,unit:units(nopol)')
        .order('created_at',{ascending:false}).limit(5),
      // Perbaikan/storing yang baru selesai — untuk feed aktivitas
      supabase.from('perbaikan')
        .select('id,tipe,status,tgl_selesai,unit:units(nopol)')
        .eq('status','Selesai')
        .not('tgl_selesai','is',null)
        .order('tgl_selesai',{ascending:false}).limit(5),
    ]);

    const u  = uRes.data  || [];
    const p  = pRes.data  || [];
    setUnits(u); setPrb(p);

    // Join manual nama driver (driver_id → driver_accounts)
    const lapWithDriver = await attachDriverInfo(lapRes.data || [], 'driver_id');
    const p2hWithDriver = await attachDriverInfo(p2hRes.data || [], 'driver_id');
    setLapPending(lapWithDriver);
    setP2hHariIni(p2hWithDriver);

    // ── Aktivitas gabungan (feed) — pakai status P2H 3-tingkat yang benar ──
    const lapItems = lapWithDriver.slice(0,5).map(l=>({
      id:'lap-'+l.id, nopol:l.unit?.nopol||'—', nama:l.driver?.nama||'—',
      tag:'Laporan', tagColor:C.red, tagBg:C.redBg,
      desc: l.pilihan_driver==='minta_storing' ? '🆘 Minta Storing — menunggu keputusan' : '🏠 Minta Pulang Pool — menunggu keputusan',
      icon:'⚠️', ts:l.created_at,
    }));
    const P2H_TAG = {
      'LAYAK':                { color:C.green, bg:C.greenBg, icon:'✅', text:'Selesai — LAYAK' },
      'LAYAK DENGAN CATATAN': { color:C.amber, bg:C.amberBg, icon:'⚠️', text:'Selesai — LAYAK DENGAN CATATAN' },
      'TIDAK LAYAK':          { color:C.red,   bg:C.redBg,   icon:'❌', text:'Selesai — TIDAK LAYAK' },
    };
    const p2hItems = p2hWithDriver.slice(0,5).map(l=>{
      const t = P2H_TAG[l.status] || P2H_TAG['TIDAK LAYAK'];
      return {
        id:'p2h-'+l.id, p2hId:l.id, nopol:l.unit?.nopol||'—', nama:l.driver?.nama||'—',
        tag:'P2H', tagColor:t.color, tagBg:t.bg,
        desc:`Checklist ${t.text}`, icon:t.icon, ts:l.created_at,
      };
    });
    const prbBaruItems = (prbBaruRes.data||[]).filter(x=>x.status!=='Selesai').map(x=>({
      id:'baru-'+x.id, nopol:x.unit?.nopol||'—', nama:'—',
      tag: TIPE_STORING.includes(x.tipe)?'Storing':'Perbaikan',
      tagColor: TIPE_STORING.includes(x.tipe)?C.red:C.amber,
      tagBg:    TIPE_STORING.includes(x.tipe)?C.redBg:C.amberBg,
      desc:`Mulai ${TIPE_STORING.includes(x.tipe)?'storing':'perbaikan'} baru`,
      icon:'🔧', ts:x.created_at,
    }));
    const prbSelesaiItems = (prbSelesaiRes.data||[]).map(x=>({
      id:'selesai-'+x.id, nopol:x.unit?.nopol||'—', nama:'—',
      tag:'Selesai', tagColor:C.green, tagBg:C.greenBg,
      desc:`${TIPE_STORING.includes(x.tipe)?'Storing':'Perbaikan'} selesai — unit kembali jalan`,
      icon:'✅', ts:x.tgl_selesai,
    }));

    setAktv(
      [...lapItems, ...p2hItems, ...prbBaruItems, ...prbSelesaiItems]
        .sort((a,b)=>new Date(b.ts)-new Date(a.ts))
        .slice(0,10)
    );

    setLoad(false);
  }, []);

  useEffect(() => {
    loadData();
    const ch = supabase.channel('overview-v8')
      .on('postgres_changes',{event:'*',schema:'public',table:'units'},     loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'perbaikan'}, loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'laporan_kerusakan'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'p2h'},       loadData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadData]);

  // Kolom modal
  const COL_UNIT = [
    {key:'nopol',label:'No Pol',bold:true,mono:true},
    {key:'tipe', label:'Tipe'},
  ];
  const COL_P2H = [
    {key:'nopol',  label:'No Pol', bold:true, mono:true, render:r=>r.unit?.nopol||'—'},
    {key:'driver', label:'Driver', render:r=>r.driver?.nama||'—'},
    {key:'status', label:'Status', render:r=><StatusChip status={r.status}/>},
    {key:'waktu',  label:'Waktu',  render:r=>new Date(r.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})},
  ];
  const COL_LAP = [
    {key:'nopol',  label:'No Pol', bold:true, mono:true, render:r=>r.unit?.nopol||'—'},
    {key:'driver', label:'Driver', render:r=>r.driver?.nama||'—'},
    {key:'permintaan', label:'Permintaan', render:r=>r.pilihan_driver==='minta_storing'?'🆘 Minta Storing':'🏠 Minta Pulang Pool'},
    {key:'waktu',  label:'Waktu',  render:r=>new Date(r.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})},
  ];
  const COL_PRB = [
    {key:'nopol',      label:'No Pol', bold:true, mono:true, render:r=>r.nopol||'—'},
    {key:'nama_driver',label:'Driver'},
    {key:'progres',    label:'Progres'},
    {key:'durasi_hari',label:'Durasi', render:r=>`${r.durasi_hari||0} hari`},
  ];

  function openModal(title,items,columns){ setModal({title,items,columns}); }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'60vh', flexDirection:'column', gap:12, fontFamily:C.body }}>
      <div style={{ width:28, height:28, border:`3px solid ${C.cardBdr}`,
        borderTop:`3px solid ${C.blue}`, borderRadius:'50%',
        animation:'spin 0.8s linear infinite' }}/>
      <p style={{ fontSize:12, color:C.textLight }}>Memuat data...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Hitungan P2H hari ini (dari data lengkap, bukan potongan feed) ──
  const unitP2HSet   = new Set(p2hHariIni.map(x=>x.unit_id));
  const sudahP2H     = unitP2HSet.size;
  const belumP2H     = Math.max(0, units.length - sudahP2H);
  const tidakLayak   = p2hHariIni.filter(x=>x.status==='TIDAK LAYAK').length;
  const layakCatatan = p2hHariIni.filter(x=>x.status==='LAYAK DENGAN CATATAN').length;

  // ── Insiden lapangan aktif — per tipe ──
  const storingAktif    = perbaikan.filter(x=>['storing_internal','storing_luar','bengkel_luar'].includes(x.tipe));
  const pulangPool       = perbaikan.filter(x=>x.tipe==='pulang_ke_pool');
  const perbaikanPoolList= perbaikan.filter(x=>TIPE_PERBAIKAN.includes(x.tipe));

  // ── Perlu tindakan segera — dihitung client-side, level peringatan sederhana ──
  const belumAdaMekanik = storingAktif.filter(x=>x.progres==='Menunggu Mekanik');
  const storingOver7    = storingAktif.filter(x=>(x.durasi_hari||0) > 7  && (x.durasi_hari||0) <= 30);
  const storingOver30   = storingAktif.filter(x=>(x.durasi_hari||0) > 30);
  const tindakanList = [
    ...p2hHariIni.filter(x=>x.status==='TIDAK LAYAK').map(x=>({
      key:'p2h-tl-'+x.id, level:'critical', icon:'⛔',
      text:`${x.unit?.nopol||'—'} — P2H TIDAK LAYAK, jangan dioperasikan`,
    })),
    ...laporanPending.map(l=>({
      key:'lap-'+l.id, level:'warn', icon:'📋',
      text:`${l.unit?.nopol||'—'} — ${l.pilihan_driver==='minta_storing'?'Menunggu approval storing':'Menunggu approval pulang pool'}`,
    })),
    ...belumAdaMekanik.map(x=>({
      key:'mek-'+x.id, level:'warn', icon:'👷',
      text:`${x.nopol||'—'} — belum ada mekanik ditugaskan`,
    })),
    ...storingOver7.map(x=>({
      key:'d7-'+x.id, level:'warn', icon:'⏱️',
      text:`${x.nopol||'—'} — storing sudah ${x.durasi_hari} hari, perlu ditindaklanjuti`,
    })),
    ...storingOver30.map(x=>({
      key:'d30-'+x.id, level:'critical', icon:'🚨',
      text:`${x.nopol||'—'} — storing sudah ${x.durasi_hari} hari, eskalasi ke manajemen`,
    })),
    ...p2hHariIni.filter(x=>x.status==='LAYAK DENGAN CATATAN').map(x=>({
      key:'p2h-cat-'+x.id, level:'info', icon:'📝',
      text:`${x.unit?.nopol||'—'} — LAYAK DENGAN CATATAN, perlu ditelepon`,
    })),
  ];
  const LEVEL_PRIORITY = { critical:0, warn:1, info:2 };
  tindakanList.sort((a,b) => LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level]);
  // Auto-expand sekali kalau ada yang perlu ditindaklanjuti, tapi tetap hormati
  // pilihan admin kalau mereka sudah collapse manual sebelumnya.
  if (tindakanList.length > 0 && !tindakanAutoOpened) {
    setTindakanOpen(true);
    setAutoOpened(true);
  }

  const TINDAKAN_COLOR = {
    info:     { bg:C.blueBg,  color:C.blue  },
    warn:     { bg:C.amberBg, color:C.amber },
    critical: { bg:C.redBg,   color:C.red   },
  };

  return (
    <div style={{ fontFamily:C.body, color:C.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, fontFamily:C.head, color:C.textPrimary, marginBottom:4 }}>
          Overview
        </h1>
        <p style={{ fontSize:12, color:C.textSecond }}>
          Status realtime · {units.length} unit terdaftar
        </p>
      </div>

      {/* ── Section 1: P2H Hari Ini ───────────────────────── */}
      <p style={{ fontSize:11, fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
        letterSpacing:'0.06em', marginBottom:8 }}>P2H Hari Ini</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <StatCard label="Total Terjadwal" value={units.length} unit="unit" icon="🚛"
          accent={C.navy} accentBg="#F1F5F9"
          onClick={()=>openModal('Seluruh Unit',units,COL_UNIT)}/>
        <StatCard label="Sudah P2H" value={sudahP2H} unit="unit" icon="✅"
          accent={C.green} accentBg={C.greenBg}
          onClick={()=>openModal('Sudah P2H Hari Ini',p2hHariIni,COL_P2H)}/>
        <StatCard label="Belum P2H" value={belumP2H} unit="unit" icon="⏳"
          accent={C.amber} accentBg={C.amberBg}/>
        <StatCard label="Tidak Layak" value={tidakLayak} unit="unit" icon="⛔"
          accent={C.red} accentBg={C.redBg} urgent={tidakLayak>0} sub={tidakLayak>0?'PERLU TINDAKAN':null}
          onClick={()=>openModal('Unit TIDAK LAYAK',p2hHariIni.filter(x=>x.status==='TIDAK LAYAK'),COL_P2H)}/>
      </div>

      {layakCatatan > 0 && (
        <div onClick={()=>openModal('LAYAK DENGAN CATATAN',p2hHariIni.filter(x=>x.status==='LAYAK DENGAN CATATAN'),COL_P2H)}
          style={{ background:C.amberBg, border:`1px solid #FCD34D`, borderRadius:8, padding:'10px 16px',
            marginBottom:20, fontSize:12, color:C.amber, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', gap:8 }}>
          ⚠ {layakCatatan} unit LAYAK DENGAN CATATAN — perlu ditelepon / ditindaklanjuti
          <span style={{ marginLeft:'auto', fontSize:11 }}>klik untuk lihat →</span>
        </div>
      )}

      {/* ── Section 2: Insiden Lapangan Aktif ─────────────── */}
      <p style={{ fontSize:11, fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
        letterSpacing:'0.06em', marginBottom:8 }}>Insiden Lapangan Aktif</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <StatCard label="Menunggu Approval" value={laporanPending.length} unit="laporan" icon="📋"
          accent={C.blue} accentBg={C.blueBg}
          onClick={()=>openModal('Menunggu Approval Admin',laporanPending,COL_LAP)}/>
        <StatCard label="Storing Aktif" value={storingAktif.length} unit="unit" icon="🆘"
          accent={C.red} accentBg={C.redBg}
          onClick={()=>openModal('Storing Aktif',storingAktif,COL_PRB)}/>
        <StatCard label="Pulang ke Pool" value={pulangPool.length} unit="unit" icon="🏠"
          accent={C.blue} accentBg={C.blueBg}
          onClick={()=>openModal('Pulang ke Pool',pulangPool,COL_PRB)}/>
        <StatCard label="Perbaikan Pool" value={perbaikanPoolList.length} unit="unit" icon="🔧"
          accent={C.amber} accentBg={C.amberBg}
          onClick={()=>openModal('Perbaikan Pool',perbaikanPoolList,COL_PRB)}/>
      </div>

      {/* ── Section 3: Perlu Tindakan Segera (collapsible) ── */}
      <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8,
        marginBottom:20, overflow:'hidden' }}>
        <button onClick={()=>setTindakanOpen(o=>!o)}
          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'14px 18px', background:'none', border:'none', cursor:'pointer', fontFamily:C.body }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <p style={{ fontSize:13, fontWeight:600, fontFamily:C.head, color:C.textPrimary }}>Perlu Tindakan Segera</p>
            {tindakanList.length > 0 ? (
              <span style={{ background:C.redBg, color:C.red, padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700 }}>
                {tindakanList.length}
              </span>
            ) : (
              <span style={{ background:C.greenBg, color:C.green, padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700 }}>
                Aman
              </span>
            )}
          </div>
          <span style={{ fontSize:12, color:C.textLight, transform:tindakanOpen?'rotate(180deg)':'none', transition:'transform 0.15s' }}>▾</span>
        </button>
        {tindakanOpen && (
          <div style={{ borderTop:`1px solid ${C.cardBdr}` }}>
            {tindakanList.length === 0 ? (
              <div style={{ padding:'20px 18px', textAlign:'center', color:C.textLight, fontSize:12 }}>
                Tidak ada yang perlu ditindaklanjuti saat ini 👍
              </div>
            ) : tindakanList.map((t,i) => {
              const c = TINDAKAN_COLOR[t.level];
              return (
                <div key={t.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 18px',
                  borderBottom:i<tindakanList.length-1?`1px solid #F9FAFB`:'none' }}>
                  <span style={{ width:26, height:26, borderRadius:6, background:c.bg, color:c.color,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{t.icon}</span>
                  <span style={{ fontSize:12, color:C.textSecond }}>{t.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 4: Aktivitas Terkini ───────────────────── */}
      <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8, overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'14px 18px', borderBottom:`1px solid ${C.cardBdr}` }}>
          <p style={{ fontSize:13, fontWeight:600, fontFamily:C.head, color:C.textPrimary }}>Aktivitas Terkini</p>
        </div>
        <div>
          {aktivitas.length === 0
            ? <div style={{ padding:32, textAlign:'center', color:C.textLight, fontSize:12 }}>Belum ada aktivitas</div>
            : aktivitas.map((a,i) => {
                const minsAgo = Math.floor((new Date()-new Date(a.ts))/60000);
                const timeStr = minsAgo < 60
                  ? `${minsAgo} MNT LALU`
                  : minsAgo < 1440
                    ? `${Math.floor(minsAgo/60)} JAM LALU`
                    : new Date(a.ts).toLocaleDateString('id-ID',{day:'numeric',month:'short'});
                const timeHH = new Date(a.ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
                return (
                  <div key={a.id+i}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px',
                      borderBottom:i<aktivitas.length-1?`1px solid #F9FAFB`:'none' }}
                    onMouseOver={e=>e.currentTarget.style.background=C.contentBg}
                    onMouseOut={e=>e.currentTarget.style.background='#fff'}>
                    <div style={{ width:34, height:34, borderRadius:7, background:a.tagBg,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:15, flexShrink:0 }}>{a.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:C.mono, fontSize:12, fontWeight:600,
                          color:C.textPrimary }}>{a.nopol}</span>
                        <span style={{ background:a.tagBg, color:a.tagColor, padding:'1px 7px',
                          borderRadius:9999, fontSize:9, fontWeight:700, textTransform:'uppercase',
                          letterSpacing:'0.03em' }}>{a.tag}</span>
                        {a.nama!=='—' && <span style={{ fontSize:11, color:C.textSecond }}>{a.nama}</span>}
                      </div>
                      <p style={{ fontSize:11, color:C.textSecond }}>{a.desc}</p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
                      <div>
                        <p style={{ fontSize:11, color:C.textPrimary, fontFamily:C.mono, fontWeight:500 }}>{timeHH}</p>
                        <p style={{ fontSize:9, color:C.textLight }}>{timeStr}</p>
                      </div>
                      {a.tag === 'P2H' && (
                        <button onClick={()=>{
                            const rec = p2hHariIni.find(x=>x.id===a.p2hId);
                            if (rec) setP2hDetail(rec);
                          }}
                          style={{ background:'none', border:`1px solid ${C.cardBdr}`, borderRadius:6,
                            padding:'4px 10px', fontSize:11, fontWeight:600, color:C.blue,
                            cursor:'pointer', fontFamily:C.body, whiteSpace:'nowrap' }}>
                          Detail
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {modal && <DrillModal title={modal.title} items={modal.items} columns={modal.columns} onClose={()=>setModal(null)}/>}
      {p2hDetail && <P2HDetailModal p2h={p2hDetail} onClose={()=>setP2hDetail(null)}/>}
    </div>
  );
}
