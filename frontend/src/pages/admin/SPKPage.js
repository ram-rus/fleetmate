// src/pages/admin/SPKPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function SPKPage() {
  const { profile }               = useAuth();
  const [list, setList]           = useState([]);
  const [loading, setLoad]        = useState(true);
  const [filter, setFilter]       = useState('Semua');
  const [showForm, setShowForm]   = useState(false);
  const [units, setUnits]         = useState([]);
  const [mekaniks, setMekaniks]   = useState([]);
  const [form, setForm]           = useState({ unit_id:'', mekanik_id:'', keluhan:'', jenis:'Korektif', lokasi:'Pool', prioritas:'Normal' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { loadAll(); }, [filter]);
  useEffect(() => {
    supabase.from('units').select('id,nopol,tipe').order('nopol').then(({data}) => setUnits(data||[]));
    supabase.from('users').select('id,nama').eq('role','mekanik').then(({data}) => setMekaniks(data||[]));
  }, []);

  async function loadAll() {
    let q = supabase.from('spk')
      .select('*, unit:units(nopol,tipe), mekanik:users!spk_mekanik_id_fkey(nama)')
      .order('created_at', { ascending:false });
    if (filter !== 'Semua') q = q.eq('status', filter);
    const { data } = await q;
    setList(data||[]);
    setLoad(false);
  }

  async function handleBuat() {
    if (!form.unit_id || !form.keluhan.trim()) { toast.error('Unit dan keluhan wajib diisi'); return; }
    setSaving(true);
    try {
      // Generate no SPK
      const year = new Date().getFullYear();
      const { count } = await supabase.from('spk').select('*', { count:'exact', head:true })
        .gte('created_at', `${year}-01-01`);
      const noSpk = `SPK-${year}-${String((count||0)+1).padStart(4,'0')}`;

      const { error } = await supabase.from('spk').insert({
        no_spk:      noSpk,
        unit_id:     form.unit_id,
        mekanik_id:  form.mekanik_id || null,
        keluhan:     form.keluhan,
        jenis:       form.jenis,
        lokasi:      form.lokasi,
        prioritas:   form.prioritas,
        status:      'Waiting',
        dibuat_oleh: profile?.id,
      });
      if (error) throw error;
      toast.success(`SPK ${noSpk} berhasil dibuat!`);
      setShowForm(false);
      setForm({ unit_id:'', mekanik_id:'', keluhan:'', jenis:'Korektif', lokasi:'Pool', prioritas:'Normal' });
      loadAll();
    } catch(e) { toast.error('Gagal buat SPK: '+e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const upd = { status };
    if (status === 'In Progress') upd.tgl_mulai = new Date().toISOString().slice(0,10);
    if (status === 'Selesai')     upd.tgl_selesai = new Date().toISOString().slice(0,10);
    const { error } = await supabase.from('spk').update(upd).eq('id', id);
    if (error) { toast.error('Gagal update'); return; }
    toast.success(`Status diubah ke ${status}`);
    loadAll();
  }

  const fTabs = ['Semua','Waiting','In Progress','Selesai'];
  const statusStyle = {
    'Waiting':    { bg:'#fef3c7', color:'#92400e' },
    'In Progress':{ bg:'#dbeafe', color:'#1e3a8a' },
    'Selesai':    { bg:'#d1fae5', color:'#065f46' },
    'Dibatalkan': { bg:'#f3f4f6', color:'#374151' },
  };

  const inp = (v, k) => ({ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box', value:v, onChange:e=>setForm(p=>({...p,[k]:e.target.value})) });

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:'Montserrat,sans-serif' }}>Memuat...</div>;

  return (
    <div style={{ fontFamily:'Montserrat,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Manajemen SPK</h2>
          <p style={{ fontSize:11, color:'#74777f' }}>Surat Perintah Kerja perbaikan unit</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background:'#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          + Buat SPK
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {fTabs.map(f => {
          const cnt = f === 'Semua' ? list.length : list.filter(s=>s.status===f).length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid', transition:'all 0.15s',
                background: filter===f ? '#1a2b4b' : '#fff',
                color:      filter===f ? '#fff'    : '#44474e',
                borderColor:filter===f ? '#1a2b4b' : '#c4c7cf',
              }}>
              {f} ({cnt})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {list.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>
            Belum ada SPK
          </div>
        ) : list.map(s => {
          const sc = statusStyle[s.status] || statusStyle['Dibatalkan'];
          return (
            <div key={s.id} style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:'14px 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color:'#74777f', fontFamily:'monospace' }}>{s.no_spk}</span>
                  <span style={{ background:sc.bg, color:sc.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{s.status}</span>
                  <span style={{ background:'#f3f4f6', color:'#374151', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600 }}>{s.jenis}</span>
                  {s.prioritas === 'Urgent' && <span style={{ background:'#fee2e2', color:'#7f1d1d', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>🔴 URGENT</span>}
                </div>
                <p style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{s.unit?.nopol}</p>
                <p style={{ fontSize:11, color:'#74777f', marginBottom:8 }}>{s.keluhan}</p>
                <div style={{ display:'flex', gap:16, fontSize:10, color:'#c4c7cf' }}>
                  <span>🔧 {s.mekanik?.nama || 'Belum assign'}</span>
                  <span>📍 {s.lokasi}</span>
                  {s.tgl_mulai && <span>📅 {s.tgl_mulai}</span>}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                {s.status === 'Waiting' && (
                  <button onClick={() => updateStatus(s.id,'In Progress')}
                    style={{ background:'#1a2b4b', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    Mulai
                  </button>
                )}
                {s.status === 'In Progress' && (
                  <button onClick={() => updateStatus(s.id,'Selesai')}
                    style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    Selesai
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Buat SPK */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:20, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>Buat SPK Baru</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#74777f' }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Unit</label>
                <select style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
                  value={form.unit_id} onChange={e => setForm(p=>({...p,unit_id:e.target.value}))}>
                  <option value="">-- Pilih Unit --</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.nopol} — {u.tipe}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Mekanik</label>
                <select style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
                  value={form.mekanik_id} onChange={e => setForm(p=>({...p,mekanik_id:e.target.value}))}>
                  <option value="">-- Pilih Mekanik (opsional) --</option>
                  {mekaniks.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Jenis</label>
                  <select style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
                    value={form.jenis} onChange={e => setForm(p=>({...p,jenis:e.target.value}))}>
                    <option>Korektif</option><option>Preventif</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Lokasi</label>
                  <select style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
                    value={form.lokasi} onChange={e => setForm(p=>({...p,lokasi:e.target.value}))}>
                    <option>Pool</option><option>Bengkel Luar</option><option>Lapangan</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Prioritas</label>
                <select style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
                  value={form.prioritas} onChange={e => setForm(p=>({...p,prioritas:e.target.value}))}>
                  <option>Normal</option><option>Urgent</option>
                </select>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Keluhan / Pekerjaan *</label>
                <textarea rows={3}
                  style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', resize:'none', boxSizing:'border-box' }}
                  value={form.keluhan} onChange={e => setForm(p=>({...p,keluhan:e.target.value}))}
                  placeholder="Deskripsi kerusakan atau pekerjaan..."/>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ flex:1, background:'#fff', color:'#1a2b4b', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  Batal
                </button>
                <button onClick={handleBuat} disabled={saving}
                  style={{ flex:1, background: saving ? '#6b7280' : '#1a2b4b', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor: saving ? 'not-allowed':'pointer' }}>
                  {saving ? 'Menyimpan...' : 'Buat SPK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
