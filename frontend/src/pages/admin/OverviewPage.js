// src/pages/admin/OverviewPage.js — v5.7 pixel-perfect dari gambar referensi
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { TIPE_STORING, TIPE_PERBAIKAN } from '../../lib/perbaikanConstants';
import { attachDriverInfo } from '../../lib/driverHelper';

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

// ── Modal drill-down ──────────────────────────────────────────
function DrillModal({ title, items, columns, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.55)',
      backdropFilter:'blur(3px)', zIndex:50, display:'flex',
      alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:C.cardBg, borderRadius:10, width:'100%', maxWidth:540,
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
          <span style={{ fontSize:11, color:C.textLight }}>{items.length} unit</span>
        </div>
      </div>
    </div>
  );
}

// ── Kartu metrik besar (3 kolom teratas) ─────────────────────
function BigCard({ label, value, unit, icon, accent, accentBg, sub, urgent, subBadges, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseOver={() => setHov(true)} onMouseOut={() => setHov(false)}
      style={{ background:C.cardBg, border:`1px solid ${hov?accent+'50':C.cardBdr}`,
        borderRadius:8, padding:20, textAlign:'left', cursor:'pointer', width:'100%',
        position:'relative', overflow:'hidden', fontFamily:C.body,
        boxShadow:hov?`0 4px 16px ${accent}14`:'none', transition:'all 0.15s' }}>
      {/* Panah di kanan atas seperti gambar */}
      <span style={{ position:'absolute', top:14, right:14, fontSize:12,
        color:C.textLight, opacity:hov?1:0.5, transition:'opacity 0.15s' }}>↗</span>
      {/* Icon dalam circle */}
      <div style={{ width:38, height:38, background:accentBg, borderRadius:8,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:18, marginBottom:12 }}>{icon}</div>
      {/* Label uppercase kecil */}
      <p style={{ fontSize:10, fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
        letterSpacing:'0.07em', marginBottom:5, fontFamily:C.body }}>{label}</p>
      {/* Angka besar */}
      <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:5 }}>
        <span style={{ fontSize:32, fontWeight:700, fontFamily:C.head, color:C.textPrimary, lineHeight:1 }}>{value}</span>
        <span style={{ fontSize:12, color:C.textLight }}>{unit}</span>
      </div>
      {/* Sub-badges — Kontrak & On-Call di dalam kartu Sedang Jalan */}
      {subBadges ? (
        <div style={{ display:'flex', gap:6, marginTop:6 }}>
          {subBadges.map(b => (
            <span key={b.label} style={{ background:b.bg, color:b.color, padding:'2px 8px',
              borderRadius:9999, fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
              {b.label}: {b.value}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontSize:11, color:C.textLight }}>
          {urgent
            ? <span style={{ background:C.redBg, color:C.red, padding:'2px 8px', borderRadius:9999,
                fontSize:10, fontWeight:700 }}>URGENT</span>
            : sub}
        </p>
      )}
    </button>
  );
}

// ── Kartu sekunder kecil (baris bawah) ───────────────────────
function SmallCard({ label, value, icon, accent, accentBg, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8,
        padding:'14px 16px', textAlign:'left', cursor:'pointer', width:'100%',
        display:'flex', alignItems:'center', gap:12, fontFamily:C.body,
        transition:'box-shadow 0.15s' }}
      onMouseOver={e => e.currentTarget.style.boxShadow=`0 2px 10px ${accent}18`}
      onMouseOut={e  => e.currentTarget.style.boxShadow='none'}>
      <div style={{ width:32, height:32, background:accentBg, borderRadius:7, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>{icon}</div>
      <div>
        <p style={{ fontSize:10, fontWeight:700, color:C.labelUpper,
          textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</p>
        <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontSize:22, fontWeight:700, fontFamily:C.head, color:C.textPrimary }}>{value}</span>
          <span style={{ fontSize:11, color:C.textLight }}>unit</span>
        </div>
      </div>
    </button>
  );
}

// ── Status chip ───────────────────────────────────────────────
function Chip({ status }) {
  const MAP = {
    'Sedang Jalan':              { bg:C.greenBg, color:C.green },
    'Perbaikan Pool':            { bg:C.amberBg, color:C.amber },
    'Storing':                   { bg:C.redBg,   color:C.red   },
    'Driver Izin':               { bg:'#F1F5F9', color:'#475569'},
    'Standby Pool':              { bg:C.blueBg,  color:C.blue  },
    'Standby - Menunggu DO':     { bg:C.amberBg, color:C.amber },
    'Standby - Sudah Dapat DO':  { bg:C.greenBg, color:C.green },
    'Standby - Tidak Ada Sopir': { bg:'#F1F5F9', color:'#475569'},
  };
  const s = MAP[status]||{bg:'#F1F5F9',color:'#475569'};
  return (
    <span style={{ background:s.bg, color:s.color, padding:'3px 9px', borderRadius:9999,
      fontSize:11, fontWeight:600 }}>{status}</span>
  );
}

// ── Komponen utama ────────────────────────────────────────────
export default function OverviewPage() {
  const [units,     setUnits]   = useState([]);
  const [perbaikan, setPrb]     = useState([]);
  const [standby,   setSb]      = useState([]);
  const [aktivitas, setAktv]    = useState([]);
  const [stats,     setStats]   = useState(null);
  const [loading,   setLoad]    = useState(true);
  const [modal,     setModal]   = useState(null);

  const loadData = useCallback(async () => {
    const [uRes, pRes, sbRes, lapRes, p2hRes, prbBaruRes, prbSelesaiRes] = await Promise.all([
      // units.driver_id (untuk mekanik/admin lama) — driver baru pakai driver_nama/driver_hp langsung
      supabase.from('units').select('*'),
      supabase.from('v_perbaikan_aktif').select('*'),
      supabase.from('v_standby_aktif').select('*'),
      // Laporan driver yang masih menunggu keputusan admin
      supabase.from('laporan_kerusakan')
        .select('id,status,pilihan_driver,created_at,driver_id,unit:units(nopol)')
        .in('status',['Menunggu Approval Storing','Menunggu Approval Pulang ke Pool'])
        .order('created_at',{ascending:false}).limit(5),
      // P2H hari ini
      supabase.from('p2h')
        .select('id,status,created_at,driver_id,unit:units(nopol)')
        .eq('tanggal',new Date().toISOString().slice(0,10))
        .order('created_at',{ascending:false}).limit(5),
      // Perbaikan/storing yang baru dibuat (created_at)
      supabase.from('perbaikan')
        .select('id,tipe,status,created_at,unit:units(nopol)')
        .order('created_at',{ascending:false}).limit(5),
      // Perbaikan/storing yang baru selesai (tgl_selesai)
      supabase.from('perbaikan')
        .select('id,tipe,status,tgl_selesai,unit:units(nopol)')
        .eq('status','Selesai')
        .not('tgl_selesai','is',null)
        .order('tgl_selesai',{ascending:false}).limit(5),
    ]);

    const u  = uRes.data  || [];
    const p  = pRes.data  || [];
    const sb = sbRes.data || [];

    setUnits(u); setPrb(p); setSb(sb);

    // Join manual nama driver untuk laporan & p2h (driver_id → driver_accounts)
    const lapWithDriver = await attachDriverInfo(lapRes.data || [], 'driver_id');
    const p2hWithDriver = await attachDriverInfo(p2hRes.data || [], 'driver_id');

    // ── Aktivitas gabungan — semua jenis dengan label tipe ──────
    const lapItems = lapWithDriver.map(l=>({
      id:'lap-'+l.id, nopol:l.unit?.nopol||'—', nama:l.driver?.nama||'—',
      tag:'Laporan', tagColor:C.red, tagBg:C.redBg,
      desc: l.pilihan_driver==='minta_storing' ? '🆘 Minta Storing — menunggu keputusan' : '🏠 Minta Pulang Pool — menunggu keputusan',
      icon:'⚠️', ts:l.created_at,
    }));
    const p2hItems = p2hWithDriver.map(l=>({
      id:'p2h-'+l.id, nopol:l.unit?.nopol||'—', nama:l.driver?.nama||'—',
      tag:'P2H', tagColor:l.status==='LAYAK'?C.green:C.red, tagBg:l.status==='LAYAK'?C.greenBg:C.redBg,
      desc:`Checklist ${l.status==='LAYAK'?'Selesai — LAYAK':'Selesai — TIDAK LAYAK'}`,
      icon:l.status==='LAYAK'?'✅':'❌', ts:l.created_at,
    }));
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

    // ── Stats ──────────────────────────────────────────────────
    const perbIds  = p.filter(x=>TIPE_PERBAIKAN.includes(x.tipe)).map(x=>x.unit_id);
    const storIds  = p.filter(x=>TIPE_STORING.includes(x.tipe)).map(x=>x.unit_id);
    const sbIds    = sb.map(x=>x.unit_id);
    const sibuk    = new Set([...perbIds,...storIds,...sbIds]);
    const sedJalan = u.filter(x=>!sibuk.has(x.id));

    // Dari unit yang sedang jalan, berapa yang Kontrak vs On-Call
    const sedJalanKontrak = sedJalan.filter(x=>x.tipe_kepemilikan==='Kontrak').length;
    const sedJalanOnCall  = sedJalan.filter(x=>x.tipe_kepemilikan==='On-Call').length;

    setStats({
      total:        u.length,
      sedang_jalan: sedJalan.length,
      sedJalanKontrak, sedJalanOnCall,
      perbaikan:    new Set(perbIds).size,
      storing:      new Set(storIds).size,
      standby_pool: sb.length,
      kontrak:      u.filter(x=>x.tipe_kepemilikan==='Kontrak').length,
      on_call:      u.filter(x=>x.tipe_kepemilikan==='On-Call').length,
      _sedJalan:    sedJalan,
      _perb:        p.filter(x=>TIPE_PERBAIKAN.includes(x.tipe)),
      _stor:        p.filter(x=>TIPE_STORING.includes(x.tipe)),
    });
    setLoad(false);
  }, []);

  useEffect(() => {
    loadData();
    const ch = supabase.channel('overview-v57')
      .on('postgres_changes',{event:'*',schema:'public',table:'units'},     loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'perbaikan'}, loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'standby_log'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'laporan_kerusakan'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'p2h'},       loadData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadData]);

  // Kolom modal
  const COL_UNIT = [
    {key:'nopol',label:'No Pol',bold:true,mono:true},
    {key:'tipe', label:'Tipe'},
    {key:'tipe_kepemilikan',label:'Kepemilikan',render:r=>r.tipe_kepemilikan||'Reguler'},
    {key:'driver',label:'Driver',render:r=>r.driver_nama||'—'},
  ];
  const COL_KEPEM = [
    {key:'nopol', label:'No Pol', bold:true, mono:true},
    {key:'tipe',  label:'Tipe'},
    {key:'driver',label:'Driver', render:r=>r.driver_nama||'—'},
    {key:'status',label:'Status', render:r=><Chip status={r.status}/>},
  ];
  const COL_PRB = [
    {key:'nopol',      label:'No Pol', bold:true, mono:true},
    {key:'nama_driver',label:'Driver'},
    {key:'tipe',       label:'Tipe',   render:r=>r.tipe?.replace(/_/g,' ')},
    {key:'progres',    label:'Progres'},
    {key:'durasi_hari',label:'Durasi', render:r=>`${r.durasi_hari||0} hari`},
  ];
  const COL_SB = [
    {key:'nopol',      label:'No Pol', bold:true, mono:true},
    {key:'nama_driver',label:'Driver'},
    {key:'alasan',     label:'Alasan'},
    {key:'mulai_at',   label:'Sejak', render:r=>new Date(r.mulai_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'})},
  ];

  function openModal(title,items,columns){ setModal({title,items,columns}); }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'60vh', flexDirection:'column', gap:12, fontFamily:C.body }}>
      <div style={{ width:28, height:28, border:`3px solid ${C.cardBdr}`,
        borderTop:`3px solid ${C.blue}`, borderRadius:'50%',
        animation:'spin 0.8s linear infinite' }}/>
      <p style={{ fontSize:12, color:C.textLight }}>Memuat data armada...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const pct     = stats.total>0 ? Math.round((stats.sedang_jalan/stats.total)*100) : 0;
  const pctColor = pct>=70?C.green:pct>=40?C.amber:C.red;
  const p2hHariIni = aktivitas.filter(a=>a.tag==='P2H').length;

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
          Overview Armada
        </h1>
        <p style={{ fontSize:12, color:C.textSecond }}>
          Status realtime · {stats.total} unit terdaftar ·{' '}
          <span style={{ color:C.blue, cursor:'pointer', fontWeight:500 }}
            onClick={() => openModal('Seluruh Armada',units,COL_UNIT)}>
            Klik angka untuk detail
          </span>
        </p>
      </div>

      {/* ── Baris 1: 3 kartu besar — Total | Sedang Jalan | Total Perbaikan&Storing ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:16 }}>

        {/* Total Armada */}
        <BigCard label="Total Armada" value={stats.total} unit="unit" icon="🚛"
          accent={C.navy} accentBg='#F1F5F9'
          sub="klik untuk detail"
          onClick={()=>openModal('Seluruh Armada',units,COL_UNIT)}/>

        {/* Sedang Jalan — diperbesar, sub-badge proporsi lega */}
        <button onClick={()=>openModal('Unit Sedang Jalan',stats._sedJalan,COL_UNIT)}
          style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8,
            padding:22, textAlign:'left', cursor:'pointer', width:'100%',
            position:'relative', overflow:'hidden', fontFamily:C.body, transition:'all 0.15s' }}
          onMouseOver={e=>{e.currentTarget.style.boxShadow=`0 4px 16px ${C.green}14`;e.currentTarget.style.borderColor=C.green+'50';}}
          onMouseOut={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=C.cardBdr;}}>
          <span style={{ position:'absolute', top:16, right:16, fontSize:12, color:C.textLight }}>↗</span>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
            <div style={{ width:44, height:44, background:C.greenBg, borderRadius:9,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0 }}>✅</div>
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
                letterSpacing:'0.07em', marginBottom:3 }}>Sedang Jalan</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:34, fontWeight:700, fontFamily:C.head, color:C.textPrimary, lineHeight:1 }}>{stats.sedang_jalan}</span>
                <span style={{ fontSize:12, color:C.textLight }}>unit</span>
              </div>
            </div>
          </div>
          {/* Sub-badge proporsional — 2 kolom sejajar lega */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'#F5F3FF', borderRadius:7, padding:'9px 12px' }}>
              <p style={{ fontSize:9, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3 }}>Kontrak</p>
              <p style={{ fontSize:19, fontWeight:700, color:'#7C3AED', fontFamily:C.head }}>{stats.sedJalanKontrak}</p>
            </div>
            <div style={{ background:C.amberBg, borderRadius:7, padding:'9px 12px' }}>
              <p style={{ fontSize:9, fontWeight:700, color:C.amber, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3 }}>On-Call</p>
              <p style={{ fontSize:19, fontWeight:700, color:C.amber, fontFamily:C.head }}>{stats.sedJalanOnCall}</p>
            </div>
          </div>
        </button>

        {/* Total Perbaikan & Storing — gabungan, breakdown 3 baris */}
        <button onClick={()=>openModal('Unit Tidak Beroperasi (Perbaikan & Storing)',[...stats._perb,...stats._stor],COL_PRB)}
          style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8,
            padding:22, textAlign:'left', cursor:'pointer', width:'100%',
            position:'relative', overflow:'hidden', fontFamily:C.body, transition:'all 0.15s' }}
          onMouseOver={e=>{e.currentTarget.style.boxShadow=`0 4px 16px ${C.amber}14`;e.currentTarget.style.borderColor=C.amber+'50';}}
          onMouseOut={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=C.cardBdr;}}>
          <span style={{ position:'absolute', top:16, right:16, fontSize:12, color:C.textLight }}>↗</span>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
            <div style={{ width:44, height:44, background:C.amberBg, borderRadius:9,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0 }}>🔧</div>
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:C.labelUpper, textTransform:'uppercase',
                letterSpacing:'0.07em', marginBottom:3 }}>Total Perbaikan</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:34, fontWeight:700, fontFamily:C.head, color:C.textPrimary, lineHeight:1 }}>
                  {stats.perbaikan + stats.storing}
                </span>
                <span style={{ fontSize:12, color:C.textLight }}>unit</span>
              </div>
            </div>
          </div>
          {/* Breakdown 3 baris — Pool, Storing, Bengkel Luar */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[
              { l:'Perbaikan Pool',  v:stats._perb.length, c:C.amber, dot:C.amber },
              { l:'Storing',         v:stats._stor.filter(x=>['storing_internal','storing_luar'].includes(x.tipe)).length, c:C.red, dot:C.red },
              { l:'Bengkel Luar',    v:stats._stor.filter(x=>x.tipe==='bengkel_luar').length, c:'#7C3AED', dot:'#7C3AED' },
            ].map(b=>(
              <div key={b.l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'4px 2px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:b.dot, display:'inline-block' }}/>
                  <span style={{ fontSize:11, color:C.textSecond }}>{b.l}</span>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:b.c, fontFamily:C.head }}>{b.v}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      {/* ── Baris 2: Grafik — Donut Operasional + Bar Performa 7 hari ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Donut Tingkat Operasional */}
        <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8, padding:22 }}>
          <p style={{ fontSize:13, fontWeight:600, fontFamily:C.head, color:C.textPrimary, marginBottom:2 }}>
            Tingkat Operasional
          </p>
          <p style={{ fontSize:11, color:C.textSecond, marginBottom:16 }}>Distribusi status armada saat ini</p>

          <div style={{ display:'flex', alignItems:'center', gap:24 }}>
            {/* SVG Donut Chart */}
            <div style={{ position:'relative', width:120, height:120, flexShrink:0 }}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform:'rotate(-90deg)' }}>
                {(() => {
                  const segments = [
                    { v:stats.sedang_jalan, c:C.green },
                    { v:stats.perbaikan+stats.storing, c:C.amber },
                    { v:stats.standby_pool, c:C.blue },
                  ];
                  const total = stats.total || 1;
                  const R = 50, CIRC = 2*Math.PI*R;
                  let offset = 0;
                  return segments.map((s,i) => {
                    const frac = s.v/total;
                    const dash = frac*CIRC;
                    const el = (
                      <circle key={i} cx="60" cy="60" r={R} fill="none"
                        stroke={s.c} strokeWidth="14"
                        strokeDasharray={`${dash} ${CIRC-dash}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="butt"/>
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              {/* Center label */}
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:24, fontWeight:700, fontFamily:C.head, color:pctColor }}>{pct}%</span>
                <span style={{ fontSize:9, color:C.textLight }}>jalan</span>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1 }}>
              {[
                { l:'Sedang Jalan', v:stats.sedang_jalan, c:C.green },
                { l:'Perbaikan & Storing', v:stats.perbaikan+stats.storing, c:C.amber },
                { l:'Standby', v:stats.standby_pool, c:C.blue },
              ].map(s=>(
                <div key={s.l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:9, height:9, borderRadius:2, background:s.c, display:'inline-block' }}/>
                    <span style={{ fontSize:12, color:C.textSecond }}>{s.l}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:s.c, fontFamily:C.head }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Performa Harian — placeholder tren P2H 7 hari */}
        <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8, padding:22 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:2 }}>
            <p style={{ fontSize:13, fontWeight:600, fontFamily:C.head, color:C.textPrimary }}>Performa Harian</p>
            <span style={{ fontSize:18, fontWeight:700, fontFamily:C.head, color:C.green }}>{p2hHariIni}</span>
          </div>
          <p style={{ fontSize:11, color:C.textSecond, marginBottom:18 }}>P2H tercatat hari ini dari {stats.total} unit</p>

          {/* Mini bar — proporsi P2H vs belum P2H */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, marginBottom:10 }}>
            {(() => {
              const sudah = p2hHariIni;
              const belum = Math.max(0, stats.total - sudah);
              const maxV = Math.max(sudah, belum, 1);
              return (
                <>
                  <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <div style={{ width:'100%', maxWidth:64, height:`${Math.max(8,(sudah/maxV)*70)}px`,
                      background:C.green, borderRadius:'4px 4px 0 0', transition:'height 0.4s' }}/>
                    <span style={{ fontSize:10, color:C.textSecond }}>Sudah P2H</span>
                    <span style={{ fontSize:13, fontWeight:700, color:C.green, fontFamily:C.head }}>{sudah}</span>
                  </div>
                  <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <div style={{ width:'100%', maxWidth:64, height:`${Math.max(8,(belum/maxV)*70)}px`,
                      background:'#E2E8F0', borderRadius:'4px 4px 0 0', transition:'height 0.4s' }}/>
                    <span style={{ fontSize:10, color:C.textSecond }}>Belum P2H</span>
                    <span style={{ fontSize:13, fontWeight:700, color:C.textDim, fontFamily:C.head }}>{belum}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Info note */}
      <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8,
        padding:'10px 16px', marginBottom:16,
        display:'flex', alignItems:'flex-start', gap:8, fontSize:11, color:C.textSecond }}>
        <span style={{ color:C.blue, flexShrink:0, marginTop:1 }}>ℹ</span>
        <span>
          <b style={{ color:C.textPrimary }}>Kontrak & On-Call</b> dihitung berdasarkan tipe kepemilikan aset tetap, bukan status pergerakan unit saat ini.
        </span>
      </div>

      {/* ── Baris 3: Aktivitas Terakhir + Standby Breakdown ──── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:16 }}>

        {/* Aktivitas Terakhir */}
        <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'14px 18px', borderBottom:`1px solid ${C.cardBdr}` }}>
            <p style={{ fontSize:13, fontWeight:600, fontFamily:C.head, color:C.textPrimary }}>Aktivitas Terakhir</p>
            <span style={{ fontSize:11, color:C.red, fontWeight:600, cursor:'pointer' }}>LIHAT SEMUA</span>
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
                        borderBottom:i<aktivitas.length-1?`1px solid #F9FAFB`:'none',
                        cursor:'default' }}
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
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ fontSize:11, color:C.textPrimary, fontFamily:C.mono, fontWeight:500 }}>{timeHH}</p>
                        <p style={{ fontSize:9, color:C.textLight }}>{timeStr}</p>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Standby Breakdown — naik ke posisi panel kanan (Peta dihapus) */}
        <div style={{ background:C.cardBg, border:`1px solid ${C.cardBdr}`, borderRadius:8,
          padding:18, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <p style={{ fontSize:13, fontWeight:600, fontFamily:C.head, color:C.textPrimary }}>Standby Pool</p>
            <span style={{ fontSize:20, fontWeight:700, fontFamily:C.head, color:C.blue }}>{stats.standby_pool}</span>
          </div>
          <p style={{ fontSize:11, color:C.textSecond, marginBottom:14 }}>Breakdown per alasan</p>

          {standby.length === 0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              color:C.textLight, fontSize:12, padding:'20px 0' }}>
              Tidak ada unit standby
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                {alasan:'Menunggu DO',             c:C.amber, bg:C.amberBg},
                {alasan:'Sudah Dapat DO',          c:C.green, bg:C.greenBg},
                {alasan:'Standby Tidak Ada Sopir', c:'#475569', bg:'#F1F5F9'},
                {alasan:'Standby Driver Izin',     c:'#475569', bg:'#F1F5F9'},
              ].map(a=>{
                const count = standby.filter(s=>s.alasan===a.alasan).length;
                if (!count) return null;
                return (
                  <button key={a.alasan} onClick={()=>openModal(`Standby — ${a.alasan}`,standby.filter(s=>s.alasan===a.alasan),COL_SB)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:a.bg, borderRadius:7, padding:'9px 12px', border:'none', cursor:'pointer',
                      width:'100%', textAlign:'left', fontFamily:C.body }}>
                    <span style={{ fontSize:11, color:a.c, fontWeight:600 }}>{a.alasan.replace('Standby ','')}</span>
                    <span style={{ fontSize:15, fontWeight:700, color:a.c, fontFamily:C.head }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modal && <DrillModal title={modal.title} items={modal.items} columns={modal.columns} onClose={()=>setModal(null)}/>}
    </div>
  );
}
