// src/pages/admin/StoringPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function StoringPage() {
  const { profile }             = useAuth();
  const [list, setList]         = useState([]);
  const [loading, setLoad]      = useState(true);
  const [selected, setSelected] = useState(null);
  const [action, setAction]     = useState(null);
  const [catatan, setCatatan]   = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('storing')
      .select('*, unit:units(id,nopol,tipe), driver:users(nama)')
      .in('status', ['Pending','Aktif'])
      .order('created_at', { ascending:false });
    setList(data || []);
    setLoad(false);
  }

  function getDurasi(tgl_mulai) {
    if (!tgl_mulai) return 0;
    return Math.floor((new Date() - new Date(tgl_mulai)) / (1000 * 60 * 60 * 24));
  }

  async function handleAction() {
    if (!selected) return;
    setSaving(true);
    try {
      const newStatus = action === 'approve' ? 'Aktif' : 'Ditolak';
      const { error } = await supabase.from('storing').update({
        status:        newStatus,
        approved_by:   profile?.id,
        catatan_admin: catatan,
        tgl_mulai:     action === 'approve' ? new Date().toISOString() : null,
      }).eq('id', selected.id);
      if (error) throw error;

      // Jika approve, update status unit
      if (action === 'approve') {
        await supabase.from('units').update({ status:'Storing' }).eq('id', selected.unit?.id);

        // Buat SPK otomatis
        const year = new Date().getFullYear();
        const { count } = await supabase.from('spk').select('*', { count:'exact', head:true }).gte('created_at',`${year}-01-01`);
        await supabase.from('spk').insert({
          no_spk:      `SPK-${year}-${String((count||0)+1).padStart(4,'0')}`,
          unit_id:     selected.unit?.id,
          keluhan:     `Storing di: ${selected.lokasi}. ${selected.alasan}`,
          jenis:       'Korektif',
          lokasi:      'Lapangan',
          prioritas:   'Urgent',
          status:      'Waiting',
          dibuat_oleh: profile?.id,
          storing_id:  selected.id,
        });
        toast.success('Storing disetujui & SPK otomatis dibuat!');
      } else {
        toast.success('Storing ditolak');
      }

      setSelected(null); setAction(null); setCatatan('');
      load();
    } catch(e) { toast.error('Gagal: '+e.message); }
    finally { setSaving(false); }
  }

  async function handleSelesai(id, unitId) {
    await supabase.from('storing').update({ status:'Selesai', tgl_selesai: new Date().toISOString() }).eq('id', id);
    await supabase.from('units').update({ status:'Standby Pool' }).eq('id', unitId);
    toast.success('Storing selesai, unit kembali ke pool');
    load();
  }

  const pending = list.filter(s => s.status === 'Pending');
  const aktif   = list.filter(s => s.status === 'Aktif');

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:'Montserrat,sans-serif' }}>Memuat...</div>;

  return (
    <div style={{ fontFamily:'Montserrat,sans-serif' }}>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Storing & Approval</h2>
      <p style={{ fontSize:11, color:'#74777f', marginBottom:16 }}>Kelola request dan monitoring unit storing</p>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'Pending Approval', val:pending.length, color:'#1e3a8a', bg:'#dbeafe' },
          { label:'Storing Aktif',    val:aktif.length,   color:'#92400e', bg:'#fef3c7' },
          { label:'Flag >7 Hari',     val:aktif.filter(s=>getDurasi(s.tgl_mulai)>7).length, color:'#7f1d1d', bg:'#fee2e2' },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:14, textAlign:'center', borderTop:`3px solid ${c.color}` }}>
            <p style={{ fontSize:10, fontWeight:700, color:c.color, textTransform:'uppercase', marginBottom:6 }}>{c.label}</p>
            <p style={{ fontSize:28, fontWeight:700, color:c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#1e40af', fontWeight:600 }}>
          ℹ {pending.length} request storing menunggu persetujuan
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada storing aktif</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {list.map(s => {
            const durasi   = getDurasi(s.tgl_mulai);
            const isOver30 = durasi > 30;
            const isOver7  = durasi > 7 && !isOver30;
            return (
              <div key={s.id} style={{
                background:'#fff', borderRadius:8, padding:'14px 16px',
                border: isOver30 ? '1px solid #fca5a5' : isOver7 ? '1px solid #fcd34d' : '1px solid #ebeced',
                borderLeft: isOver30 ? '4px solid #ba1a1a' : isOver7 ? '4px solid #f59e0b' : '1px solid #ebeced',
                display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12,
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{s.unit?.nopol}</span>
                    <span style={{
                      background: s.status==='Pending' ? '#dbeafe' : '#fef3c7',
                      color:      s.status==='Pending' ? '#1e3a8a' : '#92400e',
                      padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                    }}>{s.status}</span>
                    {isOver30 && <span style={{ background:'#fee2e2', color:'#7f1d1d', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>⚠ &gt;30 Hari</span>}
                    {isOver7  && <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>⚠ &gt;7 Hari</span>}
                  </div>
                  <p style={{ fontSize:11, color:'#44474e', marginBottom:2 }}>Driver: <b>{s.driver?.nama}</b></p>
                  <p style={{ fontSize:11, color:'#44474e', marginBottom:2 }}>📍 {s.lokasi}</p>
                  <p style={{ fontSize:11, color:'#74777f', fontStyle:'italic', marginBottom:6 }}>"{s.alasan}"</p>
                  {s.status === 'Aktif' && (
                    <p style={{ fontSize:10, fontWeight:700, color: isOver30 ? '#ba1a1a' : isOver7 ? '#f59e0b' : '#74777f' }}>
                      Durasi: {durasi} hari
                    </p>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                  {s.status === 'Pending' && (
                    <>
                      <button onClick={() => { setSelected(s); setAction('approve'); }}
                        style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        ✓ Setujui
                      </button>
                      <button onClick={() => { setSelected(s); setAction('reject'); }}
                        style={{ background:'#ba1a1a', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        ✕ Tolak
                      </button>
                    </>
                  )}
                  {s.status === 'Aktif' && (
                    <button onClick={() => handleSelesai(s.id, s.unit?.id)}
                      style={{ background:'#1a2b4b', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      Selesai
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi */}
      {selected && action && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:20, width:'100%', maxWidth:400 }}>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>
              {action === 'approve' ? '✅ Setujui Storing' : '❌ Tolak Storing'}
            </h3>
            <div style={{ background:'#f8f9fa', borderRadius:8, padding:12, marginBottom:12, fontSize:12 }}>
              <p><b>Unit:</b> {selected.unit?.nopol}</p>
              <p><b>Driver:</b> {selected.driver?.nama}</p>
              <p><b>Lokasi:</b> {selected.lokasi}</p>
              <p><b>Alasan:</b> {selected.alasan}</p>
            </div>
            <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#44474e', textTransform:'uppercase', marginBottom:4 }}>Catatan Admin (opsional)</label>
            <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)}
              style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', resize:'none', outline:'none', boxSizing:'border-box', marginBottom:12 }}
              placeholder="Catatan untuk driver..."/>
            {action === 'approve' && (
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#1e40af', fontWeight:600 }}>
                ℹ SPK akan dibuat otomatis setelah disetujui
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setSelected(null); setAction(null); setCatatan(''); }}
                style={{ flex:1, background:'#fff', color:'#1a2b4b', border:'1px solid #c4c7cf', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                Batal
              </button>
              <button onClick={handleAction} disabled={saving}
                style={{ flex:1, background: action==='approve' ? '#10b981' : '#ba1a1a', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {saving ? 'Memproses...' : action==='approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
