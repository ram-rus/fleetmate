// src/pages/admin/UnitPage.js — v5.8
// Fix: import XLSX langsung (bukan window.XLSX), field nama_customer jika Kontrak,
//      guard duplikat storing di frontend

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const C = {
  navy:'#0F172A', blue:'#2170E4', green:'#059669', amber:'#D97706',
  red:'#C94A3A', redBg:'#FDE8E8', border:'#E2E8F0', bg:'#F5F3EF',
  text:'#111827', textDim:'#6B7280', textLight:'#9CA3AF',
  card:'#FFFFFF', head:"'Hanken Grotesk','Inter',sans-serif",
  body:"'Inter',sans-serif", mono:"'JetBrains Mono',monospace",
};

const STATUS_STYLE = {
  'Sedang Jalan':              { bg:'#ECFDF5', color:'#059669' },
  'Standby Pool':              { bg:'#EFF6FF', color:'#2170E4' },
  'Perbaikan Pool':            { bg:'#FEF3C7', color:'#D97706' },
  'Bengkel Luar':              { bg:'#F5F3FF', color:'#7C3AED' },
  'Storing':                   { bg:'#FDE8E8', color:'#C94A3A' },
  'Driver Izin':               { bg:'#F1F5F9', color:'#475569' },
  'Standby - Menunggu DO':     { bg:'#FEF3C7', color:'#D97706' },
  'Standby - Sudah Dapat DO':  { bg:'#ECFDF5', color:'#059669' },
  'Standby - Tidak Ada Sopir': { bg:'#F1F5F9', color:'#475569' },
};

const STATUS_LIST = [
  'Sedang Jalan','Standby Pool','Perbaikan Pool','Bengkel Luar','Storing',
  'Driver Izin','Standby - Menunggu DO','Standby - Sudah Dapat DO','Standby - Tidak Ada Sopir',
];
const TIPE_UNIT  = ['Wing Box','CDD','CDE','Fuso','Grandmax'];
const TIPE_KEPEM = ['Reguler','Kontrak','On-Call'];
const FILTER_KP  = ['Semua','Reguler','Kontrak','On-Call'];

const FORM_DEFAULT = {
  nopol:'', tipe:'Wing Box', merk:'', tahun_buat:'', warna:'',
  status:'Sedang Jalan', tipe_kepemilikan:'Reguler',
  km_terakhir:'', driver_id:'', nama_customer:'',
};

export default function UnitPage() {
  const { profile }             = useAuth();
  const [units, setUnits]       = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [loading, setLoad]      = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFSt]  = useState('Semua');
  const [filterKepem, setFKp]   = useState('Semua');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEdit]   = useState(null);
  const [form, setForm]         = useState(FORM_DEFAULT);
  const [saving, setSaving]     = useState(false);
  const [importing, setImp]     = useState(false);
  const [confirmDel, setDel]    = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    load();
    // Catatan: dropdown "Assign Driver" dari tabel users sekarang tidak relevan lagi
    // karena driver baru self-register via No HP + PIN ke driver_accounts, bukan via admin assign.
    // Driver yang sudah login otomatis ter-assign ke unit (lihat driver_nama/driver_hp di units).
  }, []);

  async function load() {
    const { data } = await supabase
      .from('units')
      .select('*')
      .order('nopol');
    setUnits(data||[]);
    setLoad(false);
  }

  const filtered = units.filter(u => {
    const mS = filterStatus === 'Semua' || u.status === filterStatus;
    const mK = filterKepem  === 'Semua' || (u.tipe_kepemilikan||'Reguler') === filterKepem;
    const mQ = !search
      || u.nopol.toLowerCase().includes(search.toLowerCase())
      || (u.merk||'').toLowerCase().includes(search.toLowerCase())
      || (u.driver_nama||'').toLowerCase().includes(search.toLowerCase())
      || (u.nama_customer||'').toLowerCase().includes(search.toLowerCase());
    return mS && mK && mQ;
  });

  function openTambah() { setEdit(null); setForm(FORM_DEFAULT); setShowForm(true); }

  function openEdit(u) {
    setEdit(u);
    setForm({
      nopol:           u.nopol,
      tipe:            u.tipe,
      merk:            u.merk,
      tahun_buat:      u.tahun_buat?.toString()||'',
      warna:           u.warna||'',
      status:          u.status,
      tipe_kepemilikan:u.tipe_kepemilikan||'Reguler',
      km_terakhir:     u.km_terakhir?.toString()||'',
      driver_id:       u.driver_id||'',
      nama_customer:   u.nama_customer||'',
    });
    setShowForm(true);
  }

  async function handleSimpan() {
    if (!form.nopol.trim()||!form.merk.trim()||!form.tahun_buat) {
      toast.error('Nopol, merk, dan tahun wajib diisi'); return;
    }
    if (form.tipe_kepemilikan === 'Kontrak' && !form.nama_customer.trim()) {
      toast.error('Nama customer wajib diisi untuk unit Kontrak'); return;
    }
    setSaving(true);
    try {
      const payload = {
        nopol:           form.nopol.trim().toUpperCase(),
        tipe:            form.tipe,
        merk:            form.merk.trim(),
        tahun_buat:      parseInt(form.tahun_buat),
        warna:           form.warna.trim()||null,
        status:          form.status,
        tipe_kepemilikan:form.tipe_kepemilikan,
        km_terakhir:     form.km_terakhir ? parseInt(form.km_terakhir) : 0,
        driver_id:       form.driver_id||null,
        nama_customer:   form.tipe_kepemilikan==='Kontrak' ? form.nama_customer.trim() : null,
      };

      if (editTarget) {
        const { error, data: updData } = await supabase.from('units')
          .update(payload).eq('id', editTarget.id).select();
        if (error) {
          if (error.code==='42501') { toast.error('Akses ditolak — jalankan fix_v5_5_rls_units.sql'); return; }
          throw error;
        }
        if (!updData||updData.length===0) {
          toast.error('Update tidak tersimpan — cek RLS policy di Supabase'); return;
        }
        toast.success(`Unit ${payload.nopol} berhasil diupdate!`);
      } else {
        const { error } = await supabase.from('units').insert(payload);
        if (error) {
          if (error.code==='23505') { toast.error('Nopol sudah terdaftar'); return; }
          if (error.code==='42501') { toast.error('Akses ditolak — jalankan fix_v5_5_rls_units.sql'); return; }
          throw error;
        }
        toast.success(`Unit ${payload.nopol} berhasil ditambahkan!`);
      }
      setShowForm(false); setForm(FORM_DEFAULT); setEdit(null);
      load();
    } catch(e) { toast.error('Gagal: '+e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('units').delete().eq('id', confirmDel.id);
      if (error) throw error;
      toast.success(`Unit ${confirmDel.nopol} berhasil dihapus`);
      setDel(null); load();
    } catch(e) { toast.error('Gagal hapus: '+e.message); }
    finally { setSaving(false); }
  }

  // FIX: Gunakan import XLSX langsung, bukan window.XLSX
  async function handleImportExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImp(true);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      if (!rows.length) { toast.error('File Excel kosong'); return; }

      const mapped = rows.map(r => ({
        nopol:           (r['Nopol']||r['nopol']||r['NO_POL']||'').toString().trim().toUpperCase(),
        tipe:            (r['Tipe']||r['tipe']||'Wing Box').toString().trim(),
        merk:            (r['Merk']||r['merk']||'').toString().trim(),
        tahun_buat:      parseInt(r['Tahun']||r['tahun_buat']||new Date().getFullYear()),
        warna:           (r['Warna']||'').toString().trim()||null,
        status:          'Sedang Jalan',
        tipe_kepemilikan:(r['Kepemilikan']||'Reguler').toString().trim(),
        km_terakhir:     parseInt(r['KM']||0)||0,
        nama_customer:   (r['Customer']||r['nama_customer']||'').toString().trim()||null,
      })).filter(r => r.nopol && r.merk)
        // Normalisasi tipe_kepemilikan — apapun nilainya di Excel, map ke yang valid
        .map(r => {
          const kp = (r.tipe_kepemilikan||'').toLowerCase().trim();
          let kepemilikan = 'Reguler';
          if (kp.includes('kontrak')) kepemilikan = 'Kontrak';
          else if (kp.includes('on') || kp.includes('call')) kepemilikan = 'On-Call';
          // Normalisasi tipe kendaraan
          const tp = (r.tipe||'').toLowerCase().trim();
          let tipe = 'Wing Box';
          if (tp.includes('cdd')) tipe = 'CDD';
          else if (tp.includes('cde')) tipe = 'CDE';
          else if (tp.includes('fuso')) tipe = 'Fuso';
          else if (tp.includes('gran') || tp.includes('grand') || tp.includes('max')) tipe = 'Grandmax';
          else if (tp.includes('wing') || tp.includes('box')) tipe = 'Wing Box';
          return { ...r, tipe_kepemilikan: kepemilikan, tipe };
        });

      if (!mapped.length) {
        toast.error('Tidak ada data valid. Pastikan kolom: Nopol, Tipe, Merk, Tahun'); return;
      }

      // Insert satu per satu agar yang duplikat diskip, sisanya tetap masuk
      let ok = 0;
      const gagal = [];

      for (const row of mapped) {
        const { error } = await supabase.from('units').insert(row);
        if (error) {
          if (error.code === '23505') {
            gagal.push(`${row.nopol} (nopol sudah ada)`);
          } else if (error.code === '42703') {
            // Kolom tidak ada — nama_customer belum ada di DB
            // Coba insert tanpa nama_customer
            const { nama_customer, ...rowTanpaCustomer } = row;
            const { error: e2 } = await supabase.from('units').insert(rowTanpaCustomer);
            if (e2) gagal.push(`${row.nopol} (${e2.message})`);
            else ok++;
          } else {
            gagal.push(`${row.nopol} (${error.message})`);
          }
        } else {
          ok++;
        }
      }

      if (ok > 0) toast.success(`${ok} unit berhasil diimport!`);
      if (gagal.length > 0) {
        console.warn('Unit gagal diimport:', gagal);
        toast.error(`${gagal.length} unit gagal: ${gagal.slice(0,3).join(', ')}${gagal.length>3?` +${gagal.length-3} lainnya`:''}`);
      }
      load();
    } catch(e) { toast.error('Gagal baca file: '+e.message); }
    finally { setImp(false); e.target.value=''; }
  }

  // FIX: downloadTemplate juga pakai import XLSX
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nopol','Tipe','Merk','Tahun','Warna','Kepemilikan','KM','Customer'],
      ['B 1001 MMS','Wing Box','Mitsubishi Fuso',2020,'Putih','Reguler',50000,''],
      ['B 2001 MMS','CDD','Hino Dutro',2021,'Putih','Kontrak',30000,'PT. XYZ'],
      ['B 3001 MMS','Wing Box','Isuzu Giga',2022,'Putih','On-Call',0,''],
    ]);
    // Set lebar kolom
    ws['!cols'] = [12,12,18,8,10,12,10,20].map(w=>({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Unit');
    XLSX.writeFile(wb, 'template_import_unit.xlsx');
    toast.success('Template berhasil didownload!');
  }

  const inp = key => ({
    style:{ width:'100%', border:`1px solid ${C.border}`, borderRadius:6, padding:'9px 12px',
      fontSize:13, fontFamily:C.body, outline:'none', boxSizing:'border-box',
      background:'#F8FAFC' },
    value: form[key],
    onChange: e => setForm(p=>({...p,[key]:e.target.value})),
  });

  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:C.textDim,
    textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 };

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:C.textDim, fontFamily:C.body }}>Memuat...</div>
  );

  return (
    <div style={{ fontFamily:C.body, color:C.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, fontFamily:C.head, marginBottom:3 }}>Data Unit</h2>
          <p style={{ fontSize:12, color:C.textDim }}>{units.length} unit terdaftar</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={downloadTemplate}
            style={{ background:C.card, color:C.text, border:`1px solid ${C.border}`, borderRadius:7,
              padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:C.body }}>
            📥 Template Excel
          </button>
          <button onClick={()=>fileRef.current?.click()} disabled={importing}
            style={{ background:C.card, color:C.blue, border:`1px solid ${C.blue}`, borderRadius:7,
              padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:C.body }}>
            {importing?'⏳ Import...':'📊 Import Excel'}
          </button>
          <button onClick={openTambah}
            style={{ background:C.navy, color:'#fff', border:'none', borderRadius:7,
              padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:C.body }}>
            + Tambah Unit
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleImportExcel}/>
        </div>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:10 }}>
        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
          color:C.textLight, fontSize:14 }}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Cari nopol, merk, driver, customer..."
          style={{ width:'100%', border:`1px solid ${C.border}`, borderRadius:7,
            padding:'9px 12px 9px 36px', fontSize:13, fontFamily:C.body,
            outline:'none', boxSizing:'border-box', background:C.card }}/>
      </div>

      {/* Filter kepemilikan */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
        {FILTER_KP.map(k=>(
          <button key={k} onClick={()=>setFKp(k)}
            style={{ padding:'4px 12px', borderRadius:9999, fontSize:12, fontWeight:600,
              cursor:'pointer', border:'1px solid', transition:'all 0.12s',
              background:filterKepem===k?C.navy:'#fff',
              color:filterKepem===k?'#fff':C.textDim,
              borderColor:filterKepem===k?C.navy:C.border }}>
            {k}
          </button>
        ))}
      </div>

      {/* Filter status — scroll horizontal */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6, marginBottom:16 }}>
        {['Semua',...STATUS_LIST].map(s=>(
          <button key={s} onClick={()=>setFSt(s)}
            style={{ padding:'4px 12px', borderRadius:9999, fontSize:12, fontWeight:600,
              cursor:'pointer', border:'1px solid', whiteSpace:'nowrap', flexShrink:0,
              transition:'all 0.12s',
              background:filterStatus===s?C.navy:'#fff',
              color:filterStatus===s?'#fff':C.textDim,
              borderColor:filterStatus===s?C.navy:C.border }}>
            {s}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:860 }}>
            <thead>
              <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                {['No Pol','Tipe','Merk','Tahun','Kepemilikan','Customer','Status','Driver','KM','Aksi'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10,
                    fontWeight:700, color:C.textLight, textTransform:'uppercase',
                    letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={10} style={{ padding:40, textAlign:'center', color:C.textLight }}>
                  Tidak ada unit ditemukan
                </td></tr>
              ):filtered.map(u=>{
                const sc = STATUS_STYLE[u.status]||{bg:'#F1F5F9',color:'#475569'};
                return (
                  <tr key={u.id} style={{ borderBottom:`1px solid #F9FAFB` }}
                    onMouseOver={e=>e.currentTarget.style.background=C.bg}
                    onMouseOut={e=>e.currentTarget.style.background='#fff'}>
                    <td style={{ padding:'11px 14px', fontFamily:C.mono, fontWeight:700,
                      whiteSpace:'nowrap', color:C.text }}>{u.nopol}</td>
                    <td style={{ padding:'11px 14px', color:C.textDim }}>{u.tipe}</td>
                    <td style={{ padding:'11px 14px', color:C.textDim }}>{u.merk}</td>
                    <td style={{ padding:'11px 14px', color:C.textLight }}>{u.tahun_buat}</td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{
                        background:u.tipe_kepemilikan==='Kontrak'?'#F5F3FF':u.tipe_kepemilikan==='On-Call'?'#FEF3C7':'#F1F5F9',
                        color:     u.tipe_kepemilikan==='Kontrak'?'#7C3AED':u.tipe_kepemilikan==='On-Call'?'#D97706':'#475569',
                        padding:'2px 10px', borderRadius:9999, fontSize:11, fontWeight:600 }}>
                        {u.tipe_kepemilikan||'Reguler'}
                      </span>
                    </td>
                    {/* Kolom Customer — hanya tampil jika Kontrak */}
                    <td style={{ padding:'11px 14px', color:C.textDim, fontSize:12 }}>
                      {u.tipe_kepemilikan==='Kontrak'
                        ? (u.nama_customer||<span style={{color:C.textLight,fontStyle:'italic'}}>—</span>)
                        : <span style={{color:'#E2E8F0'}}>—</span>
                      }
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ background:sc.bg, color:sc.color, padding:'3px 9px',
                        borderRadius:9999, fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding:'11px 14px', color:C.textDim }}>{u.driver_nama||'—'}</td>
                    <td style={{ padding:'11px 14px', fontFamily:C.mono, color:C.textLight,
                      whiteSpace:'nowrap' }}>{(u.km_terakhir||0).toLocaleString('id-ID')} km</td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>openEdit(u)}
                          style={{ background:'#EFF6FF', color:C.blue, border:`1px solid #BFDBFE`,
                            borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600,
                            cursor:'pointer', fontFamily:C.body }}>
                          ✏️ Edit
                        </button>
                        <button onClick={()=>setDel(u)}
                          style={{ background:C.redBg, color:C.red, border:`1px solid #FECDD3`,
                            borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600,
                            cursor:'pointer', fontFamily:C.body }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'8px 14px', borderTop:`1px solid #F9FAFB`,
          fontSize:11, color:C.textLight, textAlign:'right' }}>
          {filtered.length} dari {units.length} unit
        </div>
      </div>

      {/* MODAL TAMBAH / EDIT */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.55)',
          backdropFilter:'blur(3px)', zIndex:50, display:'flex',
          alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:C.card, borderRadius:10, width:'100%', maxWidth:500,
            maxHeight:'92vh', overflowY:'auto', border:`1px solid ${C.border}`,
            boxShadow:'0 16px 48px rgba(17,24,39,0.14)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'18px 22px', borderBottom:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:15, fontWeight:700, fontFamily:C.head, color:C.text }}>
                {editTarget ? `✏️ Edit Unit — ${editTarget.nopol}` : '+ Tambah Unit Baru'}
              </h3>
              <button onClick={()=>{setShowForm(false);setEdit(null);setForm(FORM_DEFAULT);}}
                style={{ background:'none', border:'none', fontSize:20,
                  cursor:'pointer', color:C.textLight }}>×</button>
            </div>
            <div style={{ padding:22 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

                {/* Nopol */}
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={labelStyle}>No Polisi <span style={{color:C.red}}>*</span></label>
                  <input {...inp('nopol')} placeholder="B 1001 MMS"
                    style={{...inp('nopol').style, textTransform:'uppercase', fontFamily:C.mono}}/>
                </div>

                {/* Tipe & Kepemilikan */}
                <div>
                  <label style={labelStyle}>Tipe Kendaraan</label>
                  <select {...inp('tipe')} style={inp('tipe').style}>
                    {TIPE_UNIT.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Kepemilikan</label>
                  <select {...inp('tipe_kepemilikan')} style={inp('tipe_kepemilikan').style}>
                    {TIPE_KEPEM.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>

                {/* Field Customer — hanya muncul jika Kontrak */}
                {form.tipe_kepemilikan === 'Kontrak' && (
                  <div style={{ gridColumn:'1 / -1' }}>
                    <label style={labelStyle}>
                      Nama Customer / Perusahaan <span style={{color:C.red}}>*</span>
                    </label>
                    <input {...inp('nama_customer')} placeholder="PT. Nama Perusahaan / Nama Customer"/>
                    <p style={{ fontSize:10, color:C.textLight, marginTop:3 }}>
                      Wajib diisi untuk unit dengan kepemilikan Kontrak
                    </p>
                  </div>
                )}

                {/* Merk */}
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={labelStyle}>Merk <span style={{color:C.red}}>*</span></label>
                  <input {...inp('merk')} placeholder="Mitsubishi Fuso / Hino Dutro / dll"/>
                </div>

                {/* Tahun & Warna */}
                <div>
                  <label style={labelStyle}>Tahun <span style={{color:C.red}}>*</span></label>
                  <input {...inp('tahun_buat')} type="number" placeholder="2020"/>
                </div>
                <div>
                  <label style={labelStyle}>Warna</label>
                  <input {...inp('warna')} placeholder="Putih"/>
                </div>

                {/* Status & KM */}
                <div>
                  <label style={labelStyle}>Status Awal</label>
                  <select {...inp('status')} style={inp('status').style}>
                    {STATUS_LIST.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>KM Terakhir</label>
                  <input {...inp('km_terakhir')} type="number" placeholder="0"/>
                </div>

                {/* Driver — sekarang self-register, admin tidak assign manual */}
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={labelStyle}>Driver Saat Ini</label>
                  {editTarget?.driver_nama ? (
                    <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:7,
                      padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:600, color:'#166534' }}>{editTarget.driver_nama}</p>
                        <p style={{ fontSize:11, color:'#16A34A', fontFamily:C.mono }}>{editTarget.driver_hp}</p>
                      </div>
                      <span style={{ fontSize:10, color:'#16A34A', fontWeight:600 }}>Self-registered</span>
                    </div>
                  ) : (
                    <div style={{ background:C.bg, border:`1px dashed ${C.border}`, borderRadius:7,
                      padding:'10px 12px', textAlign:'center' }}>
                      <p style={{ fontSize:12, color:C.textLight }}>Belum ada driver — driver akan otomatis terhubung saat login pertama kali</p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{setShowForm(false);setEdit(null);setForm(FORM_DEFAULT);}}
                  style={{ flex:1, background:'#fff', color:C.textDim, border:`1px solid ${C.border}`,
                    borderRadius:7, padding:'11px 0', fontSize:13, fontWeight:600,
                    cursor:'pointer', fontFamily:C.body }}>
                  Batal
                </button>
                <button onClick={handleSimpan} disabled={saving}
                  style={{ flex:2, background:saving?'#9CA3AF':C.navy, color:'#fff', border:'none',
                    borderRadius:7, padding:'11px 0', fontSize:13, fontWeight:600,
                    cursor:saving?'not-allowed':'pointer', fontFamily:C.body }}>
                  {saving?'Menyimpan...':editTarget?'✓ Simpan Perubahan':'+ Tambah Unit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI DELETE */}
      {confirmDel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.55)',
          backdropFilter:'blur(3px)', zIndex:50, display:'flex',
          alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:C.card, borderRadius:10, width:'100%', maxWidth:360,
            padding:28, textAlign:'center', border:`1px solid ${C.border}`,
            boxShadow:'0 16px 48px rgba(17,24,39,0.14)' }}>
            <div style={{ width:52, height:52, background:C.redBg, borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, margin:'0 auto 16px' }}>🗑️</div>
            <h3 style={{ fontSize:15, fontWeight:700, fontFamily:C.head, marginBottom:8 }}>Hapus Unit?</h3>
            <p style={{ fontSize:13, color:C.textDim, marginBottom:6 }}>
              Unit <b style={{ fontFamily:C.mono, color:C.text }}>{confirmDel.nopol}</b> akan dihapus permanen.
            </p>
            <p style={{ fontSize:12, color:C.red, marginBottom:22 }}>
              ⚠ Semua data P2H, perbaikan, dan storing terkait akan ikut terhapus.
            </p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setDel(null)}
                style={{ flex:1, background:'#fff', color:C.textDim, border:`1px solid ${C.border}`,
                  borderRadius:7, padding:'10px 0', fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:C.body }}>
                Batal
              </button>
              <button onClick={handleDelete} disabled={saving}
                style={{ flex:1, background:saving?'#9CA3AF':C.red, color:'#fff', border:'none',
                  borderRadius:7, padding:'10px 0', fontSize:13, fontWeight:600,
                  cursor:saving?'not-allowed':'pointer', fontFamily:C.body }}>
                {saving?'Menghapus...':'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
