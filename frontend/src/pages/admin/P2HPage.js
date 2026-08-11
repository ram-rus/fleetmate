// src/pages/admin/P2HPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { attachDriverInfo } from '../../lib/driverHelper';
import HasilBreakdown from '../../components/HasilP2HBreakdown';


const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');`;
const T = {
  navy:'#0F172A', blue:'#2170E4', green:'#059669', amber:'#D97706', red:'#BA1A1A',
  bg:'#F8F9FF', border:'#E2E8F0', text:'#0B1C30', textDim:'#76777D', textMid:'#45464D',
  head:"'Hanken Grotesk', sans-serif", body:"'Inter', sans-serif", mono:"'JetBrains Mono', monospace",
};

export default function P2HPage() {
  const [list, setList]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [detail, setDetail] = useState(null);

  const today = new Date().toISOString().slice(0,10);

  useEffect(() => {
    load();
    const ch = supabase.channel('p2h-ch')
      .on('postgres_changes', { event:'*', schema:'public', table:'p2h' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function load() {
    const { data } = await supabase
      .from('p2h')
      .select('*, unit:units(nopol,tipe)')
      .eq('tanggal', today)
      .order('created_at', { ascending:false });
    const withDriver = await attachDriverInfo(data || [], 'driver_id');
    setList(withDriver);
    setLoad(false);
  }

  const sudah    = list.filter(p => p.status !== 'BELUM').length;
  const belum    = list.filter(p => p.status === 'BELUM').length;
  const nTidak   = list.filter(p => p.status === 'TIDAK LAYAK').length;
  const nCatatan = list.filter(p => p.status === 'LAYAK DENGAN CATATAN').length;

  const statusColor = {
    'LAYAK':                { bg:'#d1fae5', color:'#065f46' },
    'LAYAK DENGAN CATATAN': { bg:'#fffbeb', color:'#92400e' },
    'TIDAK LAYAK':          { bg:'#fee2e2', color:'#7f1d1d' },
    'BELUM':                { bg:'#f3f4f6', color:'#374151' },
  };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:T.body }}>Memuat...</div>;

  return (
    <div style={{ fontFamily:T.body }}>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Manajemen P2H</h2>
      <p style={{ fontSize:11, color:'#74777f', marginBottom:16 }}>Rekap harian · {new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'Total Terjadwal', val:list.length,  color:T.navy },
          { label:'Sudah P2H',       val:sudah,         color:'#065f46' },
          { label:'Belum P2H',       val:belum,         color:'#7f1d1d' },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, padding:14, textAlign:'center' }}>
            <p style={{ fontSize:11, color:'#74777f', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{c.label}</p>
            <p style={{ fontSize:28, fontWeight:700, color:c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {belum > 0 && (
        <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#9f1239', fontWeight:600 }}>
          ⚠ {belum} unit belum P2H hari ini
        </div>
      )}
      {nTidak > 0 && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#7f1d1d', fontWeight:600 }}>
          ⛔ {nTidak} unit dinyatakan TIDAK LAYAK
        </div>
      )}
      {nCatatan > 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e', fontWeight:600 }}>
          ⚠ {nCatatan} unit LAYAK DENGAN CATATAN — perlu ditindaklanjuti / ditelepon
        </div>
      )}

      <div style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:T.bg, borderBottom:'1px solid #ebeced' }}>
              {['No Pol','Driver','Waktu','Status','Aksi'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:'#c4c7cf' }}>Belum ada data P2H hari ini</td></tr>
            ) : list.map(p => {
              const sc = statusColor[p.status] || statusColor['BELUM'];
              return (
                <tr key={p.id} style={{ borderBottom:'1px solid #f1f2f3' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseOut={e  => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding:'10px 14px', fontWeight:700, fontFamily:T.mono }}>{p.unit?.nopol}</td>
                  <td style={{ padding:'10px 14px', color:'#44474e' }}>{p.driver?.nama}</td>
                  <td style={{ padding:'10px 14px', color:'#74777f' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{p.status}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {p.status !== 'BELUM' && (
                      <button onClick={() => setDetail(p)}
                        style={{ background:'none', border:'1px solid #c4c7cf', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer', color:T.navy, fontWeight:600 }}>
                        Detail
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Detail */}
      {detail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:20, width:'100%', maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>Detail P2H — {detail.unit?.nopol}</h3>
              <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#74777f' }}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12 }}>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>Driver</p><p style={{ fontWeight:700 }}>{detail.driver?.nama}</p></div>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>Status</p>
                <span style={{ background: statusColor[detail.status]?.bg, color: statusColor[detail.status]?.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{detail.status}</span>
              </div>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>KM Saat P2H</p><p style={{ fontWeight:700 }}>{detail.km_saat_p2h?.toLocaleString('id-ID') || '—'} km</p></div>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>Tanggal</p><p style={{ fontWeight:700 }}>{detail.tanggal}</p></div>
            </div>
            {detail.catatan && <div style={{ marginTop:12, background:T.bg, borderRadius:8, padding:10, fontSize:12, color:'#44474e' }}>{detail.catatan}</div>}
            <HasilBreakdown hasil={detail.hasil} />
          </div>
        </div>
      )}
    </div>
  );
}
