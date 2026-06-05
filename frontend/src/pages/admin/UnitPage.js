// src/pages/admin/UnitPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const STATUS_LIST = ['Semua','Sedang Jalan','Standby Pool','Kontrak','On-Call','Perbaikan Pool','Bengkel Luar','Storing','Driver Izin'];

const STATUS_STYLE = {
  'Sedang Jalan':   { bg:'#d1fae5', color:'#065f46' },
  'Standby Pool':   { bg:'#dbeafe', color:'#1e3a8a' },
  'Kontrak':        { bg:'#ede9fe', color:'#4c1d95' },
  'On-Call':        { bg:'#fef3c7', color:'#92400e' },
  'Perbaikan Pool': { bg:'#fef9c3', color:'#b45309' },
  'Bengkel Luar':   { bg:'#fee2e2', color:'#7f1d1d' },
  'Storing':        { bg:'#fee2e2', color:'#7f1d1d' },
  'Driver Izin':    { bg:'#f3f4f6', color:'#374151' },
};

export default function UnitPage() {
  const [units,   setUnits]   = useState([]);
  const [loading, setLoad]    = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('Semua');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('units')
      .select('*, driver:users!units_driver_id_fkey(nama)')
      .order('nopol');
    setUnits(data || []);
    setLoad(false);
  }

  const filtered = units.filter(u => {
    const matchSearch = !search
      || u.nopol.toLowerCase().includes(search.toLowerCase())
      || u.merk.toLowerCase().includes(search.toLowerCase())
      || u.driver?.nama?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === 'Semua' || u.status === status;
    return matchSearch && matchStatus;
  });

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:'Montserrat,sans-serif' }}>Memuat...</div>;

  return (
    <div style={{ fontFamily:'Montserrat,sans-serif' }}>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Data Unit</h2>
      <p style={{ fontSize:11, color:'#74777f', marginBottom:16 }}>Master armada PT. MMS — {units.length} unit terdaftar</p>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#c4c7cf', fontSize:14 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nopol, merk, driver..."
          style={{ width:'100%', border:'1px solid #c4c7cf', borderRadius:8, padding:'9px 12px 9px 32px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', boxSizing:'border-box' }}
          onFocus={e => e.target.style.borderColor='#1a2b4b'}
          onBlur={e  => e.target.style.borderColor='#c4c7cf'}
        />
      </div>

      {/* Filter status */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {STATUS_LIST.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid',
              background: status===s ? '#1a2b4b' : '#fff',
              color:      status===s ? '#fff'    : '#44474e',
              borderColor:status===s ? '#1a2b4b' : '#c4c7cf',
            }}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#f8f9fa', borderBottom:'1px solid #ebeced' }}>
              {['No Pol','Tipe','Merk','Tahun','Status','Driver','KM Terakhir'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada unit ditemukan</td></tr>
            ) : filtered.map(u => {
              const sc = STATUS_STYLE[u.status] || { bg:'#f3f4f6', color:'#374151' };
              return (
                <tr key={u.id} style={{ borderBottom:'1px solid #f1f2f3', cursor:'default' }}
                    onMouseOver={e => e.currentTarget.style.background='#f8f9fa'}
                    onMouseOut={e  => e.currentTarget.style.background='#fff'}>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'#1a1c1e' }}>{u.nopol}</td>
                  <td style={{ padding:'10px 14px', color:'#44474e' }}>{u.tipe}</td>
                  <td style={{ padding:'10px 14px', color:'#44474e' }}>{u.merk}</td>
                  <td style={{ padding:'10px 14px', color:'#74777f' }}>{u.tahun_buat}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{u.status}</span>
                  </td>
                  <td style={{ padding:'10px 14px', color:'#44474e' }}>{u.driver?.nama || '—'}</td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#74777f' }}>{u.km_terakhir?.toLocaleString('id-ID')} km</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding:'8px 14px', borderTop:'1px solid #f1f2f3', fontSize:10, color:'#c4c7cf', textAlign:'right' }}>
          Menampilkan {filtered.length} dari {units.length} unit
        </div>
      </div>
    </div>
  );
}
