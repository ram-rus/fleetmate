// src/components/layout/AdminLayout.js — v5.7 pixel-perfect dari referensi gambar
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Token warna sesuai gambar referensi
const C = {
  // Sidebar
  sidebarBg:   '#FFFFFF',
  sidebarBdr:  '#EBEBEB',
  activeItemBg:'#FDE8E8',
  activeItemTx:'#C94A3A',
  activeItemIc:'#C94A3A',
  inactiveIc:  '#9CA3AF',
  inactiveTx:  '#374151',
  labelTx:     '#9CA3AF',
  // Topbar & content
  topbarBg:    '#FAF8F5',
  contentBg:   '#F5F3EF',
  // Text
  textPrimary: '#111827',
  textSecond:  '#6B7280',
  // Accent
  blue:        '#2170E4',
  green:       '#059669',
  red:         '#C94A3A',
  amber:       '#D97706',
  // Font
  head: "'Hanken Grotesk', 'Inter', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const NAV = [
  { path:'/admin',                 icon:'▦', label:'Overview',          },
  { path:'/admin/p2h',             icon:'☑', label:'P2H',               },
  { path:'/admin/laporan-storing', icon:'⚠', label:'Reports & Storing',  },
  { path:'/admin/unit',            icon:'⊞', label:'Unit Data',          },
];

export default function AdminLayout({ children }) {
  const { profile }    = useAuth();
  const navigate       = useNavigate();
  const location       = useLocation();
  const [mobileOpen, setMob] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.replace('/login');
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:C.contentBg, fontFamily:C.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside style={{
        width:200, minHeight:'100vh', background:C.sidebarBg,
        borderRight:`1px solid ${C.sidebarBdr}`,
        display:'flex', flexDirection:'column',
        position:'sticky', top:0, height:'100vh', flexShrink:0,
      }}>

        {/* Logo area */}
        <div style={{ padding:'20px 16px 16px', borderBottom:`1px solid ${C.sidebarBdr}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* Logo box — abu gelap kecil seperti di gambar */}
            <div style={{
              width:32, height:32, background:'#1F2937', borderRadius:6,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <span style={{ fontSize:14, color:'#fff' }}>FM</span>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:C.textPrimary, fontFamily:C.head, lineHeight:1.2 }}>
                FleetMate
              </p>
              <p style={{ fontSize:9, fontWeight:600, color:C.labelTx, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Operational Intel
              </p>
            </div>
          </div>
        </div>

        {/* Nav label */}
        <p style={{ fontSize:10, fontWeight:600, color:C.labelTx, textTransform:'uppercase',
          letterSpacing:'0.08em', padding:'14px 16px 6px', fontFamily:C.body }}>
          Menu Utama
        </p>

        {/* Nav items */}
        <nav style={{ flex:1, padding:'2px 8px', display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(n => {
            const active = n.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'9px 10px', borderRadius:7, width:'100%',
                  textAlign:'left', border:'none', cursor:'pointer',
                  background: active ? C.activeItemBg : 'transparent',
                  transition:'background 0.12s',
                  fontFamily:C.body,
                }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background='#F9FAFB'; }}
                onMouseOut={e  => { if (!active) e.currentTarget.style.background='transparent'; }}>
                {/* Icon */}
                <span style={{
                  fontSize:14, width:20, textAlign:'center', flexShrink:0,
                  color: active ? C.activeItemIc : C.inactiveIc,
                }}>{n.icon}</span>
                {/* Label */}
                <span style={{
                  fontSize:13, fontWeight: active ? 600 : 500,
                  color: active ? C.activeItemTx : C.inactiveTx,
                  whiteSpace:'nowrap',
                }}>{n.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section — Schedule Maintenance + Support */}
        <div style={{ padding:'12px 8px', borderTop:`1px solid ${C.sidebarBdr}` }}>
          {/* Schedule Maintenance button — hitam solid seperti di gambar */}
          <button
            style={{ width:'100%', background:'#111827', color:'#fff', border:'none',
              borderRadius:7, padding:'9px 12px', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:C.body, marginBottom:4, textAlign:'left',
              display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14 }}>📅</span>
            Schedule Maintenance
          </button>
          {/* Support */}
          <button
            style={{ width:'100%', background:'transparent', color:C.textSecond,
              border:'none', borderRadius:7, padding:'8px 10px', fontSize:12, fontWeight:500,
              cursor:'pointer', fontFamily:C.body, textAlign:'left',
              display:'flex', alignItems:'center', gap:8 }}
            onMouseOver={e => e.currentTarget.style.background='#F9FAFB'}
            onMouseOut={e  => e.currentTarget.style.background='transparent'}>
            <span style={{ fontSize:14, color:C.inactiveIc }}>?</span>
            Support
          </button>
        </div>

        {/* User profile row */}
        <div style={{ borderTop:`1px solid ${C.sidebarBdr}`, padding:'12px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Avatar initials */}
            <div style={{ width:30, height:30, borderRadius:'50%', background:'#E5E7EB',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700, color:'#374151', flexShrink:0 }}>
              {(profile?.nama||'A').slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:600, color:C.textPrimary, lineHeight:1.3,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.nama || 'Admin'}
              </p>
              <p style={{ fontSize:10, color:C.labelTx, textTransform:'capitalize' }}>{profile?.role}</p>
            </div>
            {/* Logout icon */}
            <button onClick={handleLogout} title="Keluar"
              style={{ background:'none', border:'none', cursor:'pointer', color:C.inactiveIc,
                fontSize:14, padding:4, borderRadius:4, flexShrink:0 }}
              onMouseOver={e => e.currentTarget.style.color=C.red}
              onMouseOut={e  => e.currentTarget.style.color=C.inactiveIc}>
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ─────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Topbar — cream background, seperti di gambar */}
        <header style={{
          background: C.topbarBg,
          borderBottom:`1px solid #E8E6E2`,
          padding:'0 20px', height:48,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          position:'sticky', top:0, zIndex:10, flexShrink:0,
        }}>
          {/* Kiri: hamburger + Realtime */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => setMob(!mobileOpen)}
              style={{ background:'none', border:'none', cursor:'pointer',
                color:C.textSecond, fontSize:18, padding:2, lineHeight:1 }}>
              ☰
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:C.green,
                display:'inline-block', animation:'pulse 2s infinite' }}/>
              <span style={{ fontSize:12, color:C.textSecond, fontWeight:500 }}>Realtime</span>
            </div>
          </div>

          {/* Kanan: jam + notif + avatar */}
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:12, color:C.textSecond, fontFamily:C.mono }}>
              {new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
            </span>
            {/* Notif bell */}
            <button style={{ background:'none', border:'none', cursor:'pointer',
              color:C.textSecond, fontSize:16, position:'relative', padding:2 }}>
              🔔
              <span style={{ position:'absolute', top:0, right:0, width:7, height:7,
                background:C.red, borderRadius:'50%', border:'1px solid '+C.topbarBg }}/>
            </button>
            {/* Avatar */}
            <button style={{ background:'none', border:'none', cursor:'pointer' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#374151',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, color:'#fff' }}>
                {(profile?.nama||'A').slice(0,2).toUpperCase()}
              </div>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex:1, padding:24, overflowY:'auto', animation:'fadeIn 0.18s ease' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
