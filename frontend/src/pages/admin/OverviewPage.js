// src/pages/admin/OverviewPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function OverviewPage() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('v_overview_armada').select('*').single();
      setStats(data);
      setLoading(false);
    }
    load();

    const channel = supabase.channel('units-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'units' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const cards = [
    { label:'Total Armada',    key:'total',          color:'#1a2b4b', bg:'#e8edf5', icon:'🚛' },
    { label:'Sedang Jalan',    key:'sedang_jalan',   color:'#065f46', bg:'#d1fae5', icon:'✅' },
    { label:'Kontrak',         key:'kontrak',        color:'#4c1d95', bg:'#ede9fe', icon:'📝' },
    { label:'On-Call',         key:'on_call',        color:'#92400e', bg:'#fef3c7', icon:'📞' },
    { label:'Perbaikan Pool',  key:'perbaikan_pool', color:'#b45309', bg:'#fef9c3', icon:'🔧' },
    { label:'Bengkel Luar',    key:'bengkel_luar',   color:'#7f1d1d', bg:'#fee2e2', icon:'🏭' },
    { label:'Storing',         key:'storing',        color:'#7f1d1d', bg:'#fee2e2', icon:'📍' },
    { label:'Standby Pool',    key:'standby_pool',   color:'#1e3a8a', bg:'#dbeafe', icon:'🅿️' },
    { label:'Driver Izin',     key:'driver_izin',    color:'#374151', bg:'#f3f4f6', icon:'🙅' },
  ];

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#74777f', fontFamily:'Montserrat,sans-serif' }}>Memuat data...</div>;

  return (
    <div style={{ fontFamily:'Montserrat,sans-serif' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'#1a1c1e', marginBottom:4 }}>Overview Armada</h2>
      <p style={{ fontSize:11, color:'#74777f', marginBottom:16 }}>Status realtime seluruh unit fleet PT. MMS</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {cards.map(c => (
          <div key={c.key} style={{
            background:'#fff', border:'1px solid #ebeced', borderRadius:8,
            padding:'14px 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          }}>
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{c.label}</p>
              <p style={{ fontSize:28, fontWeight:700, color:c.color, lineHeight:1 }}>{stats?.[c.key] ?? 0}</p>
            </div>
            <div style={{ width:38, height:38, background:c.bg, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
              {c.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:8, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1a1c1e' }}>Tingkat Operasional</span>
          <span style={{ fontSize:20, fontWeight:700, color:'#1a2b4b' }}>
            {stats?.total > 0 ? Math.round(((stats.sedang_jalan + stats.kontrak + stats.on_call + stats.standby_pool) / stats.total) * 100) : 0}%
          </span>
        </div>
        <div style={{ height:8, background:'#f1f2f3', borderRadius:4, overflow:'hidden' }}>
          <div style={{
            height:'100%', background:'#1a2b4b', borderRadius:4, transition:'width 0.5s',
            width: stats?.total > 0 ? `${Math.round(((stats.sedang_jalan + stats.kontrak + stats.on_call + stats.standby_pool) / stats.total) * 100)}%` : '0%'
          }}/>
        </div>
        <p style={{ fontSize:11, color:'#74777f', marginTop:6 }}>
          {stats ? (stats.sedang_jalan + stats.kontrak + stats.on_call + stats.standby_pool) : 0} dari {stats?.total ?? 0} unit aktif beroperasi
        </p>
      </div>
    </div>
  );
}
