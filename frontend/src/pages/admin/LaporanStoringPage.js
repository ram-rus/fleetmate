// Fleet Precision Design Tokens Applied
// src/pages/admin/LaporanStoringPage.js — v5.3
// 5 tab: Laporan Baru | Perbaikan | Storing | Standby | Histori

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import KeputusanModal from '../../components/admin/KeputusanModal';
import {
  getTipe, getStatus, getProgres, getProgresIdx, getProgresList,
  TIPE_STORING, TIPE_PERBAIKAN, TIPE_PULANG_POOL, ALASAN_STANDBY, PERBAIKAN_SELECT
} from '../../lib/perbaikanConstants';
import { attachDriverInfo } from '../../lib/driverHelper';

const STATUS_LAPORAN_STYLE = {
  'Menunggu Approval Storing':        { bg:'#fee2e2', color:'#7f1d1d' },
  'Menunggu Approval Pulang ke Pool': { bg:'#fef3c7', color:'#92400e' },
};

function getStatusUnitDariAlasan(alasan) {
  const map = {
    'Menunggu DO':             'Standby - Menunggu DO',
    'Sudah Dapat DO':          'Standby - Sudah Dapat DO',
    'Standby Tidak Ada Sopir': 'Standby - Tidak Ada Sopir',
    'Standby Driver Izin':     'Driver Izin',
  };
  return map[alasan] || 'Standby Pool';
}

function getStatusUnitSelesaiStandby(alasan) {
  return 'Sedang Jalan';
}

export default function LaporanStoringPage() {
  const { profile }               = useAuth();
  const [tab, setTab]             = useState('laporan');
  const [laporan, setLaporan]     = useState([]);
  const [perbaikan, setPerbaikan] = useState([]);
  const [storing, setStoring]     = useState([]);
  const [pulangPool, setPulangPool] = useState([]);
  const [histori, setHistori]     = useState([]);
  const [standby, setStandby]     = useState([]);
  const [mekaniks, setMekaniks]   = useState([]);
  const [units, setUnits]         = useState([]);
  const [loading, setLoad]        = useState(true);
  const [selected, setSelected]   = useState(null);
  const [selectedPrb, setSelPrb]  = useState(null);
  const [logs, setLogs]           = useState([]);
  const [tabModal, setTabModal]   = useState('progres');
  const [saving, setSaving]       = useState(false);
  const [showSF, setShowSF]       = useState(false);
  const [showMF, setShowMF]       = useState(false);

  // Form standby
  const [sbUnit, setSbUnit]   = useState('');
  const [sbAlasan, setSbAls]  = useState('');
  const [sbCatatan, setSbCat] = useState('');

  // Form perbaikan manual
  const [mfUnit, setMfUnit]       = useState('');
  const [mfDeskripsi, setMfDesk]  = useState('');
  const [mfTipe, setMfTipe]       = useState('perbaikan_pool');
  const [mfMekanik, setMfMekanik] = useState('');
  const [mfNamaLuar, setMfNL]     = useState('');
  const [mfHpLuar, setMfHL]       = useState('');

  const loadData = useCallback(async () => {
    setLoad(true);
    const [lapRes, prbRes, sbRes, histRes] = await Promise.all([
      supabase.from('laporan_kerusakan')
        .select('*, unit:units(id,nopol,tipe)')
        .in('status', ['Menunggu Approval Storing','Menunggu Approval Pulang ke Pool'])
        .order('created_at', { ascending:false }),
      supabase.from('perbaikan')
        .select(PERBAIKAN_SELECT)
        .in('status', ['Berjalan','Disetujui','Menunggu Tiba di Pool'])
        .order('created_at', { ascending:false }),
      supabase.from('v_standby_aktif').select('*'),
      supabase.from('perbaikan')
        .select(PERBAIKAN_SELECT)
        .in('status', ['Selesai','Ditolak','Lanjut Perjalanan'])
        .order('updated_at', { ascending:false })
        .limit(100),
    ]);
    const allAktif = prbRes.data || [];
    const lapWithDriver = await attachDriverInfo(lapRes.data || [], 'driver_id');
    setLaporan(lapWithDriver);
    setPerbaikan(allAktif.filter(p => TIPE_PERBAIKAN.includes(p.tipe)));
    setStoring(  allAktif.filter(p => TIPE_STORING.includes(p.tipe)));
    setPulangPool(allAktif.filter(p => TIPE_PULANG_POOL.includes(p.tipe)));
    setStandby(  sbRes.data   || []);
    setHistori(  histRes.data || []);
    setLoad(false);
  }, []);

  useEffect(() => {
    loadData();
    supabase.from('users').select('id,nama,no_hp').eq('role','mekanik').then(({data})=>setMekaniks(data||[]));
    supabase.from('units').select('id,nopol,tipe').order('nopol').then(({data})=>setUnits(data||[]));
    const ch = supabase.channel('laporan-storing-v53')
      .on('postgres_changes',{event:'*',schema:'public',table:'laporan_kerusakan'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'perbaikan'},loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'standby_log'},loadData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadData]);

  async function loadLogs(id) {
    const { data } = await supabase.from('perbaikan_log')
      .select('*, user:users!perbaikan_log_dibuat_oleh_fkey(nama)')
      .eq('perbaikan_id', id).order('created_at', { ascending:true });
    setLogs(data || []);
  }

  async function updateProgres(prb, nextProgres) {
    setSaving(true);
    try {
      const isSelesai = nextProgres === 'Selesai';
      await supabase.from('perbaikan').update({
        progres:     nextProgres,
        status:      isSelesai ? 'Selesai' : 'Berjalan',
        tgl_selesai: isSelesai ? new Date().toISOString() : null,
      }).eq('id', prb.id);
      if (isSelesai) {
        const { error: uErr } = await supabase.from('units').update({ status:'Sedang Jalan' }).eq('id', prb.unit_id);
        if (uErr) console.error('Update unit status error:', uErr);
        if (prb.laporan_id)
          await supabase.from('laporan_kerusakan').update({ status:'Selesai' }).eq('id', prb.laporan_id);
      }
      await supabase.from('perbaikan_log').insert({
        perbaikan_id: prb.id, status_lama: prb.progres, status_baru: nextProgres, dibuat_oleh: profile?.id,
      });
      if (TIPE_STORING.includes(prb.tipe) && prb.driver_id) {
        const notifMap = {
          'Mekanik Berangkat':'🚗 Mekanik Sudah Berangkat','Mekanik Tiba':'📍 Mekanik Sudah Tiba',
          'Perbaikan Berlangsung':'🔧 Perbaikan Berlangsung','Selesai':'✅ Perbaikan Selesai',
        };
        if (notifMap[nextProgres]) await supabase.from('notifikasi').insert({
          user_id: prb.driver_id, judul: notifMap[nextProgres],
          isi: nextProgres==='Selesai'?'Kendaraan siap kembali ke pool.':`Status: ${nextProgres}`, tipe:'storing',
        });
      }
      toast.success(`Progres: ${nextProgres}`);
      if (selectedPrb?.id === prb.id) { setSelPrb(p=>({...p,progres:nextProgres,status:isSelesai?'Selesai':p.status})); loadLogs(prb.id); }
      loadData();
    } catch(e) { toast.error('Gagal: '+e.message); }
    finally { setSaving(false); }
  }

  async function handleAddStandby() {
    if (!sbUnit || !sbAlasan) { toast.error('Unit dan alasan wajib diisi'); return; }
    setSaving(true);
    try {
      await supabase.from('standby_log').insert({
        unit_id: sbUnit, dicatat_oleh: profile?.id, alasan: sbAlasan,
        catatan: sbCatatan||null, status:'Aktif', mulai_at: new Date().toISOString(),
      });
      await supabase.from('units').update({ status: getStatusUnitDariAlasan(sbAlasan) }).eq('id', sbUnit);
      toast.success('Status standby dicatat!');
      setSbUnit(''); setSbAls(''); setSbCat(''); setShowSF(false); loadData();
    } catch(e) { toast.error('Gagal: '+e.message); }
    finally { setSaving(false); }
  }

  async function handleSelesaiStandby(id, unitId, alasan) {
    try {
      const { error: e1 } = await supabase.from('standby_log')
        .update({ status:'Selesai', selesai_at: new Date().toISOString() }).eq('id', id);
      if (e1) throw new Error('standby_log: ' + e1.message);

      const { error: e2, data: d2 } = await supabase.from('units')
        .update({ status:'Sedang Jalan' }).eq('id', unitId).select();
      if (e2) throw new Error('units: ' + e2.message);
      if (!d2 || d2.length === 0) {
        toast.error('Status unit tidak terupdate — jalankan fix_v5_5_rls_units.sql di Supabase');
        loadData(); return;
      }
      toast.success('Standby selesai! Unit kembali ke Sedang Jalan.');
      loadData();
    } catch(e) {
      console.error('handleSelesaiStandby error:', e);
      toast.error('Gagal: ' + e.message);
      loadData();
    }
  }

  async function handleTibaPool(prb) {
    if (!window.confirm(`Konfirmasi ${prb.unit?.nopol || 'kendaraan'} sudah tiba di pool?`)) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('perbaikan').update({
        status:'Selesai', progres:'Tiba di Pool', tgl_selesai:now,
      }).eq('id', prb.id);
      if (error) throw error;
      await supabase.from('units').update({ status:'Tiba di Pool' }).eq('id', prb.unit_id);
      if (prb.laporan_id) await supabase.from('laporan_kerusakan').update({ status:'Tiba di Pool' }).eq('id', prb.laporan_id);
      await supabase.from('perbaikan_log').insert({ perbaikan_id:prb.id, status_lama:prb.progres, status_baru:'Tiba di Pool', dibuat_oleh:profile?.id });
      if (prb.driver_id) await supabase.from('notifikasi').insert({ user_id:prb.driver_id, judul:'✅ Kendaraan Tiba di Pool', isi:'Kedatangan kendaraan telah dikonfirmasi oleh pengurus.', tipe:'storing' });
      toast.success('Kendaraan ditandai tiba di pool dan dipindahkan ke histori.');
      loadData();
    } catch (e) { toast.error('Gagal: ' + e.message); }
    finally { setSaving(false); }
  }

  async function handleAddManual() {
    if (!mfUnit || !mfDeskripsi.trim()) { toast.error('Unit dan deskripsi wajib diisi'); return; }
    const isBengkelLuar = mfTipe === 'bengkel_luar';
    if (isBengkelLuar && (!mfNamaLuar.trim()||!mfHpLuar.trim())) { toast.error('Nama & HP bengkel wajib diisi'); return; }
    setSaving(true);
    try {
      // FIX: Guard duplikat — cek apakah unit sudah punya perbaikan/storing aktif
      const tipeGroup = isBengkelLuar ? ['storing_internal','storing_luar','bengkel_luar'] : ['perbaikan_pool'];
      const { data: existing } = await supabase.from('perbaikan')
        .select('id,tipe,status')
        .eq('unit_id', mfUnit)
        .in('status', ['Berjalan','Disetujui','Menunggu Approval'])
        .in('tipe', tipeGroup)
        .limit(1);
      if (existing && existing.length > 0) {
        const label = isBengkelLuar ? 'storing/bengkel' : 'perbaikan pool';
        toast.error(`Unit ini sudah punya ${label} aktif yang belum selesai!`);
        setSaving(false); return;
      }
      const { data: inserted, error: insertErr } = await supabase.from('perbaikan').insert({
        unit_id: mfUnit, dibuat_oleh: profile?.id, sumber:'admin_manual', tipe: mfTipe,
        status:'Berjalan',
        progres: isBengkelLuar ? 'Mekanik Ditugaskan' : 'Tanpa Tahapan',
        deskripsi: mfDeskripsi,
        lokasi_tipe: isBengkelLuar ? 'Di Bengkel Luar' : 'Di Pool',
        mekanik_id:       (!isBengkelLuar && mfMekanik) ? mfMekanik : null,
        mekanik_luar_nama: isBengkelLuar ? mfNamaLuar.trim() : null,
        mekanik_luar_hp:   isBengkelLuar ? mfHpLuar.trim()   : null,
        tgl_mulai: new Date().toISOString(),
      }).select();

      if (insertErr) {
        console.error('Insert perbaikan error:', insertErr);
        if (insertErr.code === '42501') {
          toast.error('Akses ditolak RLS — jalankan fix_v5_5_rls_units.sql di Supabase');
        } else if (insertErr.code === '23505') {
          toast.error('Unit ini sudah punya perbaikan aktif (unique index)');
        } else {
          toast.error('Gagal simpan perbaikan: ' + insertErr.message);
        }
        return;
      }

      if (!inserted || inserted.length === 0) {
        toast.error('Data tidak tersimpan — kemungkinan RLS policy perbaikan_insert belum diatur. Jalankan fix_v5_bugs.sql');
        return;
      }

      const { error: unitErr } = await supabase.from('units')
        .update({ status: isBengkelLuar ? 'Storing' : 'Perbaikan Pool' })
        .eq('id', mfUnit);
      if (unitErr) {
        console.error('Update unit status error:', unitErr);
        // Perbaikan sudah masuk, tapi status unit tidak terupdate
        toast.error('Perbaikan disimpan tapi status unit tidak terupdate — cek RLS policy units');
      } else {
        toast.success('Perbaikan berhasil ditambahkan!');
      }
      setMfUnit(''); setMfDesk(''); setMfTipe('perbaikan_pool'); setMfMekanik(''); setMfNL(''); setMfHL('');
      setShowMF(false); loadData();
    } catch(e) { toast.error('Gagal: '+e.message); }
    finally { setSaving(false); }
  }

  // ── Card perbaikan/storing berjalan ─────────────────────────
  function CardBerjalan({ p }) {
    const tipe        = getTipe(p.tipe);
    const progresList = getProgresList(p.tipe);
    const pg          = getProgres(p.progres, p.tipe);
    const pgIdx       = getProgresIdx(p.progres, p.tipe);
    const durasi      = p.tgl_mulai ? Math.floor((new Date()-new Date(p.tgl_mulai))/(1000*60*60*24)) : 0;
    const isOver7     = durasi > 7 && durasi <= 30;
    const isOver30    = durasi > 30;
    return (
      <div style={{ background:'#fff', borderRadius:10, padding:'14px 16px',
        border: isOver30?'1px solid #fca5a5':isOver7?'1px solid #fcd34d':'1px solid #ebeced',
        borderLeft: isOver30?'4px solid #ba1a1a':isOver7?'4px solid #f59e0b':`4px solid ${tipe.color}`,
        display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{p.unit?.nopol}</span>
            <span style={{ background:tipe.bg, color:tipe.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{tipe.icon} {tipe.label}</span>
            <span style={{ background:pg.bg,   color:pg.color,   padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{pg.icon} {p.progres}</span>
            {isOver30 && <span style={{ background:'#fee2e2', color:'#7f1d1d', padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>⚠ {durasi}h</span>}
            {isOver7&&!isOver30 && <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>⚠ {durasi}h</span>}
          </div>
          <p style={{ fontSize:11, color:'#44474e', marginBottom:8 }}>
            👷 {p.mekanik?.nama||p.mekanik_luar_nama||'Belum ditugaskan'}
            {p.mekanik_luar_hp&&` · ${p.mekanik_luar_hp}`}
          </p>
          <div style={{ display:'flex', gap:2 }}>
            {progresList.map((pl,i) => (
              <div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<=pgIdx?pl.color:'#e5e7eb', transition:'background 0.3s' }}/>
            ))}
          </div>
          <p style={{ fontSize:9, color:'#c4c7cf', marginTop:3 }}>{pgIdx+1}/{progresList.length} tahap{durasi>0?` · ${durasi} hari`:''}</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
          {pg.next && (
            <button onClick={() => updateProgres(p, pg.next)} disabled={saving}
              style={{ background:pg.next==='Selesai'?'#10b981':'#1a2b4b', color:'#fff', border:'none',
                borderRadius:8, padding:'7px 12px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              {pg.next==='Selesai'?'✅ Selesai':`→ ${pg.next}`}
            </button>
           )}
           {p.tipe === 'perbaikan_pool' && (
             <button onClick={() => updateProgres(p, 'Selesai')} disabled={saving}
               style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
               Selesaikan
             </button>
           )}
           <button onClick={() => { setSelPrb(p); setTabModal('progres'); loadLogs(p.id); }}
            style={{ background:'#fff', color:'#0F172A', border:'1px solid #c4c7cf', borderRadius:8, padding:'6px 12px', fontSize:11, cursor:'pointer' }}>
            📋 Detail
          </button>
        </div>
      </div>
    );
  }

  // ── Card histori ─────────────────────────────────────────────
  function CardHistori({ p }) {
    const [open, setOpen] = useState(false);
    const tipe   = getTipe(p.tipe);
    const status = getStatus(p.status);
    const durasi = p.tgl_mulai ? Math.max(0,Math.floor((new Date(p.tgl_selesai||Date.now())-new Date(p.tgl_mulai))/(1000*60*60*24))) : 0;
    return (
      <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:10, overflow:'hidden' }}>
        <button onClick={() => setOpen(!open)}
          style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:'12px 16px', cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', gap:6, marginBottom:4, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{p.unit?.nopol}</span>
                <span style={{ background:tipe.bg,   color:tipe.color,   padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>{tipe.icon} {tipe.label}</span>
                <span style={{ background:status.bg, color:status.color, padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>{status.label}</span>
              </div>
              <p style={{ fontSize:10, color:'#74777f' }}>
                {new Date(p.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                {durasi>0&&` · ${durasi} hari`}
              </p>
            </div>
            <span style={{ fontSize:12, color:'#c4c7cf' }}>{open?'▲':'▼'}</span>
          </div>
        </button>
        {open && (
          <div style={{ borderTop:'1px solid #f1f2f3', padding:'10px 16px', background:'#F8F9FF', fontSize:11, display:'flex', flexDirection:'column', gap:4 }}>
            {p.deskripsi && <p style={{ color:'#44474e' }}>{p.deskripsi}</p>}
            {p.no_perbaikan && <p style={{ color:'#74777f' }}>No: <b style={{ fontFamily:'monospace' }}>{p.no_perbaikan}</b></p>}
            {(p.mekanik?.nama||p.mekanik_luar_nama) && <p style={{ color:'#74777f' }}>Mekanik: <b>{p.mekanik?.nama||p.mekanik_luar_nama}</b></p>}
            {p.tgl_selesai && <p style={{ color:'#74777f' }}>Selesai: <b>{new Date(p.tgl_selesai).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</b></p>}
          </div>
        )}
      </div>
    );
  }

  // ── Style helpers ────────────────────────────────────────────
  const sL = { width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'Inter',sans-serif", outline:'none' };
  const iS = { ...sL, boxSizing:'border-box' };

  const TABS = [
    { value:'laporan',   label:'⚠️ Laporan Baru',      badge: laporan.length   },
    { value:'perbaikan', label:'🔧 Perbaikan Berjalan', badge: perbaikan.length },
    { value:'storing',   label:'📍 Storing Berjalan',   badge: storing.length   },
    { value:'pulang_pool', label:'🏠 Pulang ke Pool',   badge: pulangPool.length },
    { value:'standby',   label:'🅿️ Standby',            badge: standby.length   },
    { value:'histori',   label:'📋 Histori',            badge: 0                },
  ];

  return (
    <div style={{ fontFamily:"'Inter',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Laporan & Perbaikan</h2>
          <p style={{ fontSize:11, color:'#74777f' }}>Kelola laporan driver, perbaikan pool, storing, dan standby armada</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowMF(true)}
            style={{ background:'#0F172A', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            + Tambah Perbaikan
          </button>
          <button onClick={() => setShowSF(true)}
            style={{ background:'#fff', color:'#0F172A', border:'1px solid #0F172A', borderRadius:8, padding:'8px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            + Standby
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #ebeced', marginBottom:16, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            style={{ padding:'10px 14px', fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
              background:'transparent', fontFamily:"'Inter',sans-serif", whiteSpace:'nowrap', flexShrink:0,
              color: tab===t.value?'#1a2b4b':'#74777f',
              borderBottom: tab===t.value?'2px solid #1a2b4b':'2px solid transparent', marginBottom:-1,
              display:'flex', alignItems:'center', gap:6 }}>
            {t.label}
            {t.badge > 0 && <span style={{ background: t.value==='standby'?'#1e3a8a':'#ba1a1a', color:'#fff', borderRadius:20, fontSize:9, fontWeight:700, padding:'1px 6px' }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:'center', padding:40, color:'#74777f' }}>Memuat...</div>}

      {/* TAB: LAPORAN BARU */}
      {!loading && tab==='laporan' && (
        laporan.length===0
          ? <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada laporan baru</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {laporan.map(l => {
                const sc      = STATUS_LAPORAN_STYLE[l.status]||{bg:'#f3f4f6',color:'#374151'};
                const isMinta = l.pilihan_driver==='minta_storing';
                return (
                  <div key={l.id} style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:10,
                    borderLeft: isMinta?'4px solid #ba1a1a':'4px solid #1e3a8a',
                    padding:'14px 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{l.unit?.nopol}</span>
                        <span style={{ background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                          {isMinta?'🆘 Minta Storing':'🏠 Pulang ke Pool'}
                        </span>
                      </div>
                      <p style={{ fontSize:11, color:'#44474e', marginBottom:2 }}>Driver: <b>{l.driver?.nama}</b> · {l.driver?.no_hp}</p>
                      <p style={{ fontSize:11, color:'#74777f', fontStyle:'italic', marginBottom:4 }}>"{l.deskripsi?.slice(0,80)}..."</p>
                      {l.koordinat && <p style={{ fontSize:10, color:'#74777f' }}>📍 {l.koordinat}</p>}
                      <p style={{ fontSize:10, color:'#c4c7cf', marginTop:4 }}>
                        {new Date(l.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                    <button onClick={() => setSelected(l)}
                      style={{ background:'#0F172A', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                      Putuskan →
                    </button>
                  </div>
                );
              })}
            </div>
      )}

      {/* TAB: PERBAIKAN BERJALAN */}
      {!loading && tab==='perbaikan' && (
        <div>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:11, color:'#1e3a8a', fontWeight:600 }}>
            🔧 Perbaikan di pool — Alur 3 tahap: Perbaikan Ditugaskan → Perbaikan Berlangsung → Selesai
          </div>
          {perbaikan.length===0
            ? <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada perbaikan pool yang berjalan</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{perbaikan.map(p=><CardBerjalan key={p.id} p={p}/>)}</div>
          }
        </div>
      )}

      {/* TAB: STORING BERJALAN */}
      {!loading && tab==='storing' && (
        <div>
          <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:11, color:'#7f1d1d', fontWeight:600 }}>
            📍 Storing & Bengkel Rekanan — Alur 6 tahap
          </div>
          {storing.length > 0 && (
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              {[['storing_internal','Storing Internal'],['storing_luar','Storing Luar'],['bengkel_luar','Bengkel Rekanan']].map(([tipeVal,lbl]) => {
                const count = storing.filter(p=>p.tipe===tipeVal).length;
                if (!count) return null;
                const t = getTipe(tipeVal);
                return <span key={tipeVal} style={{ background:t.bg, color:t.color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>{t.icon} {lbl}: {count}</span>;
              })}
            </div>
          )}
          {storing.length===0
            ? <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada storing yang berjalan</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{storing.map(p=><CardBerjalan key={p.id} p={p}/>)}</div>
          }
        </div>
      )}

      {!loading && tab==='pulang_pool' && (
        <div>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:11, color:'#1e3a8a', fontWeight:600 }}>
            🏠 Menunggu kendaraan tiba di pool. Tidak menggunakan tahapan storing.
          </div>
          {pulangPool.length===0 ? <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada kendaraan dalam perjalanan ke pool</div> : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{pulangPool.map(p => <div key={p.id} style={{ background:'#fff', border:'1px solid #bfdbfe', borderLeft:'4px solid #1e3a8a', borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}><div><div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:5 }}><span style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{p.unit?.nopol}</span><span style={{ background:'#dbeafe', color:'#1e3a8a', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>🏠 Menunggu Tiba di Pool</span></div><p style={{ fontSize:11, color:'#475569' }}>Driver: {p.driver?.nama || '-'}</p><p style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Disetujui {new Date(p.tgl_mulai || p.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p></div><button onClick={() => handleTibaPool(p)} disabled={saving} style={{ background:'#059669', color:'#fff', border:'none', borderRadius:8, padding:'9px 14px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>✓ Mobil Tiba di Pool</button></div>)}</div>}
        </div>
      )}

      {/* TAB: STANDBY — tab sendiri, selalu visible, bisa diselesaikan */}
      {!loading && tab==='standby' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ background:'#dbeafe', border:'1px solid #93c5fd', borderRadius:8, padding:'8px 14px', fontSize:11, color:'#1e3a8a', fontWeight:600, flex:1, marginRight:10 }}>
              🅿️ Unit standby pool — klik <b>Selesai</b> untuk mengakhiri status standby
            </div>
            <button onClick={() => setShowSF(true)}
              style={{ background:'#1e3a8a', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              + Tambah Standby
            </button>
          </div>

          {standby.length===0 ? (
            <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🅿️</div>
              <p style={{ fontWeight:700, marginBottom:4 }}>Tidak ada unit standby saat ini</p>
              <p style={{ fontSize:12 }}>Klik "+ Tambah Standby" untuk mencatat unit yang sedang standby</p>
            </div>
          ) : (
            <>
              {/* Breakdown alasan */}
              <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                {[
                  { alasan:'Menunggu DO',             icon:'📋', color:'#92400e', bg:'#fef3c7' },
                  { alasan:'Sudah Dapat DO',           icon:'✅', color:'#065f46', bg:'#d1fae5' },
                  { alasan:'Standby Tidak Ada Sopir',  icon:'🚫', color:'#374151', bg:'#f3f4f6' },
                  { alasan:'Standby Driver Izin',      icon:'🙅', color:'#374151', bg:'#f3f4f6' },
                ].map(a => {
                  const count = standby.filter(s=>s.alasan===a.alasan).length;
                  if (!count) return null;
                  return (
                    <span key={a.alasan} style={{ background:a.bg, color:a.color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {a.icon} {a.alasan}: {count}
                    </span>
                  );
                })}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {standby.map(s => {
                  const als = ALASAN_STANDBY.find(a=>a.value===s.alasan)||{icon:'🅿️',label:s.alasan};
                  const durasi = Math.floor((new Date()-new Date(s.mulai_at))/(1000*60*60));
                  return (
                    <div key={s.id} style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:10,
                      padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:8, marginBottom:4, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{s.nopol}</span>
                          <span style={{ background:'#F1F5F9', color:'#374151', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                            {als.icon} {als.label}
                          </span>
                          {durasi > 48 && <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>⚠ {Math.floor(durasi/24)}h</span>}
                        </div>
                        {s.nama_driver && <p style={{ fontSize:11, color:'#74777f' }}>Driver: {s.nama_driver}</p>}
                        {s.catatan     && <p style={{ fontSize:10, color:'#74777f', fontStyle:'italic' }}>"{s.catatan}"</p>}
                        <p style={{ fontSize:9, color:'#c4c7cf', marginTop:3 }}>
                          Sejak {new Date(s.mulai_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                          {durasi > 0 && ` · ${durasi < 24 ? durasi+'j' : Math.floor(durasi/24)+'h'}`}
                        </p>
                      </div>
                      <button onClick={() => handleSelesaiStandby(s.id, s.unit_id, s.alasan)}
                        style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:8,
                          padding:'8px 16px', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                        ✓ Selesai
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: HISTORI */}
      {!loading && tab==='histori' && (
        histori.length===0
          ? <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>Belum ada riwayat perbaikan</div>
          : <>
              <p style={{ fontSize:11, color:'#74777f', marginBottom:10 }}>{histori.length} riwayat perbaikan</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{histori.map(p=><CardHistori key={p.id} p={p}/>)}</div>
            </>
      )}

      {/* MODAL KEPUTUSAN */}
      {selected && <KeputusanModal laporan={selected} mekaniks={mekaniks} onClose={()=>setSelected(null)} onDone={()=>{setSelected(null);loadData();}}/>}

      {/* MODAL DETAIL PERBAIKAN */}
      {selectedPrb && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:480, maxHeight:'92vh', overflowY:'auto', fontFamily:"'Inter',sans-serif" }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #ebeced' }}>
              <div>
                <h3 style={{ fontSize:15, fontWeight:700 }}>{selectedPrb.unit?.nopol}</h3>
                <p style={{ fontSize:11, color:'#74777f' }}>{getTipe(selectedPrb.tipe).label}</p>
              </div>
              <button onClick={()=>{setSelPrb(null);setLogs([]);}} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#74777f' }}>×</button>
            </div>
            <div style={{ display:'flex', borderBottom:'1px solid #ebeced' }}>
              {['progres','log'].map(t=>(
                <button key={t} onClick={()=>setTabModal(t)}
                  style={{ flex:1, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                    background:'transparent', fontFamily:"'Inter',sans-serif",
                    color:tabModal===t?'#1a2b4b':'#74777f',
                    borderBottom:tabModal===t?'2px solid #1a2b4b':'2px solid transparent', marginBottom:-1 }}>
                  {t==='progres'?'📊 Progres':'📋 Log Audit'}
                </button>
              ))}
            </div>
            <div style={{ padding:20 }}>
              {tabModal==='progres' && (()=>{
                const pl    = getProgresList(selectedPrb.tipe);
                const pgIdx = getProgresIdx(selectedPrb.progres, selectedPrb.tipe);
                const pg    = getProgres(selectedPrb.progres, selectedPrb.tipe);
                return (
                  <div>
                    <div style={{ background:'#F8F9FF', borderRadius:8, padding:12, marginBottom:14, fontSize:11 }}>
                      {(selectedPrb.mekanik?.nama||selectedPrb.mekanik_luar_nama)&&<p><b>Mekanik:</b> {selectedPrb.mekanik?.nama||selectedPrb.mekanik_luar_nama}</p>}
                      {(selectedPrb.mekanik?.no_hp||selectedPrb.mekanik_luar_hp)&&<p><b>HP:</b> {selectedPrb.mekanik?.no_hp||selectedPrb.mekanik_luar_hp}</p>}
                      {selectedPrb.deskripsi&&<p style={{ color:'#74777f',marginTop:4,fontStyle:'italic' }}>{selectedPrb.deskripsi}</p>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                      {pl.map((step,i)=>{
                        const isDone=i<pgIdx, isCurr=i===pgIdx;
                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8,
                            background:isCurr?step.bg:isDone?'#f0fdf4':'#f9fafb',
                            border:isCurr?`2px solid ${step.color}40`:'1px solid transparent' }}>
                            <span style={{ fontSize:18 }}>{isDone?'✅':step.icon}</span>
                            <div style={{ flex:1 }}>
                              <p style={{ fontSize:12, fontWeight:isCurr?700:500, color:isCurr?step.color:isDone?'#065f46':'#9ca3af' }}>{step.value}</p>
                              {isCurr&&<p style={{ fontSize:10, color:step.color, opacity:0.7 }}>Saat ini</p>}
                            </div>
                            {isCurr&&<span style={{ background:step.bg, color:step.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>Aktif</span>}
                          </div>
                        );
                      })}
                    </div>
                    {pg.next&&(
                      <button onClick={()=>updateProgres(selectedPrb,pg.next)} disabled={saving}
                        style={{ width:'100%', background:saving?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:10, padding:'12px 0', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                        {saving?'Memproses...':`${getProgres(pg.next,selectedPrb.tipe).icon} Update ke: ${pg.next}`}
                      </button>
                    )}
                  </div>
                );
              })()}
              {tabModal==='log'&&(
                logs.length===0
                  ? <p style={{ textAlign:'center', color:'#c4c7cf', fontSize:12, padding:20 }}>Belum ada log</p>
                  : <div style={{ position:'relative' }}>
                      <div style={{ position:'absolute', left:10, top:8, bottom:8, width:2, background:'#e5e7eb' }}/>
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {logs.map((lg,i)=>(
                          <div key={i} style={{ display:'flex', gap:14, paddingLeft:4 }}>
                            <div style={{ width:16, height:16, borderRadius:'50%', background:'#0F172A', border:'2px solid #fff', boxShadow:'0 0 0 2px #1a2b4b', flexShrink:0, marginTop:2 }}/>
                            <div style={{ background:'#F8F9FF', borderRadius:8, padding:'8px 12px', flex:1 }}>
                              <p style={{ fontSize:12, fontWeight:700, color:'#1a1c1e', marginBottom:2 }}>{lg.status_lama?`${lg.status_lama} → ${lg.status_baru}`:lg.status_baru}</p>
                              {lg.catatan&&<p style={{ fontSize:11, color:'#44474e', marginBottom:3 }}>{lg.catatan}</p>}
                              <p style={{ fontSize:10, color:'#c4c7cf' }}>{lg.user?.nama} · {new Date(lg.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL STANDBY */}
      {showSF&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:400, padding:20, fontFamily:"'Inter',sans-serif" }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>🅿️ Tambah Status Standby</h3>
              <button onClick={()=>setShowSF(false)} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#74777f' }}>×</button>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Unit <span style={{ color:'#ba1a1a' }}>*</span></label>
              <select value={sbUnit} onChange={e=>setSbUnit(e.target.value)} style={sL}>
                <option value="">-- Pilih Unit --</option>
                {units.map(u=><option key={u.id} value={u.id}>{u.nopol} ({u.tipe})</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Alasan <span style={{ color:'#ba1a1a' }}>*</span></label>
              {ALASAN_STANDBY.map(a=>(
                <label key={a.value} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', marginBottom:6,
                  border:sbAlasan===a.value?'2px solid #1a2b4b':'1px solid #ebeced',
                  borderRadius:8, cursor:'pointer', background:sbAlasan===a.value?'#e8edf5':'#fff' }}>
                  <input type="radio" name="sbAlasan" checked={sbAlasan===a.value} onChange={()=>setSbAls(a.value)} style={{ accentColor:'#1a2b4b' }}/>
                  <span style={{ fontSize:16 }}>{a.icon}</span>
                  <div>
                    <p style={{ fontSize:12, fontWeight:600, color:sbAlasan===a.value?'#1a2b4b':'#1a1c1e' }}>{a.label}</p>
                    <p style={{ fontSize:9, color:'#74777f' }}>Status unit → {getStatusUnitDariAlasan(a.value)}</p>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Catatan (opsional)</label>
              <textarea rows={2} value={sbCatatan} onChange={e=>setSbCat(e.target.value)} placeholder="Info tambahan..." style={{ ...iS, resize:'none' }}/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowSF(false)} style={{ flex:1, background:'#fff', color:'#0F172A', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>Batal</button>
              <button onClick={handleAddStandby} disabled={saving||!sbUnit||!sbAlasan}
                style={{ flex:1, background:(saving||!sbUnit||!sbAlasan)?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                {saving?'Menyimpan...':'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERBAIKAN MANUAL */}
      {showMF&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto', padding:20, fontFamily:"'Inter',sans-serif" }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>+ Tambah Perbaikan Manual</h3>
              <button onClick={()=>setShowMF(false)} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#74777f' }}>×</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:6 }}>Lokasi Perbaikan <span style={{ color:'#ba1a1a' }}>*</span></label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { val:'perbaikan_pool', icon:'🔧', label:'Di Pool',               desc:'→ Tab Perbaikan', color:'#b45309', bg:'#fef9c3' },
                  { val:'bengkel_luar',   icon:'🔩', label:'Bengkel Luar / Rekanan', desc:'→ Tab Storing',   color:'#6d28d9', bg:'#ede9fe' },
                ].map(o=>(
                  <button key={o.val} onClick={()=>setMfTipe(o.val)}
                    style={{ padding:'12px 10px', border:`2px solid ${mfTipe===o.val?o.color:'#ebeced'}`,
                      borderRadius:10, background:mfTipe===o.val?o.bg:'#fff', cursor:'pointer', textAlign:'left', fontFamily:"'Inter',sans-serif" }}>
                    <span style={{ fontSize:22, display:'block', marginBottom:4 }}>{o.icon}</span>
                    <p style={{ fontSize:11, fontWeight:700, color:mfTipe===o.val?o.color:'#1a1c1e', marginBottom:2 }}>{o.label}</p>
                    <p style={{ fontSize:9, color:mfTipe===o.val?o.color:'#74777f' }}>{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Unit <span style={{ color:'#ba1a1a' }}>*</span></label>
              <select value={mfUnit} onChange={e=>setMfUnit(e.target.value)} style={sL}>
                <option value="">-- Pilih Unit --</option>
                {units.map(u=><option key={u.id} value={u.id}>{u.nopol} ({u.tipe})</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Detail Perbaikan <span style={{ color:'#ba1a1a' }}>*</span></label>
              <textarea rows={3} value={mfDeskripsi} onChange={e=>setMfDesk(e.target.value)} placeholder="Deskripsi pekerjaan perbaikan..." style={{ ...iS, resize:'none' }}/>
            </div>
            {mfTipe==='perbaikan_pool'&&(
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Mekanik (opsional)</label>
                <select value={mfMekanik} onChange={e=>setMfMekanik(e.target.value)} style={sL}>
                  <option value="">-- Pilih Mekanik --</option>
                  {mekaniks.map(m=><option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
            )}
            {mfTipe==='bengkel_luar'&&(
              <>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Nama Bengkel / Rekanan <span style={{ color:'#ba1a1a' }}>*</span></label>
                  <input value={mfNamaLuar} onChange={e=>setMfNL(e.target.value)} placeholder="Nama bengkel rekanan..." style={iS}/>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>No HP <span style={{ color:'#ba1a1a' }}>*</span></label>
                  <input value={mfHpLuar} onChange={e=>setMfHL(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" style={iS}/>
                </div>
              </>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowMF(false)} style={{ flex:1, background:'#fff', color:'#0F172A', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>Batal</button>
              <button onClick={handleAddManual} disabled={saving||!mfUnit||!mfDeskripsi.trim()}
                style={{ flex:2, background:(saving||!mfUnit||!mfDeskripsi.trim())?'#9ca3af':'#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                {saving?'Menyimpan...':'Simpan Perbaikan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
