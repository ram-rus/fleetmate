// src/components/layout/AdminLayout.js
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to:'/admin',                 label:'Overview',          icon:'📊', exact:true },
  { to:'/admin/p2h',             label:'P2H',               icon:'📋' },
  { to:'/admin/spk',             label:'SPK',               icon:'🔧' },
  { to:'/admin/laporan-kerusakan',label:'Laporan Kerusakan', icon:'⚠️' },
  { to:'/admin/storing-progress',label:'Storing',           icon:'📍' },
  { to:'/admin/unit',            label:'Data Unit',         icon:'🚛' },
];

export default function AdminLayout({ children }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = profile?.nama
    ? profile.nama.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
    : 'FM';

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'Montserrat,sans-serif', overflow:'hidden' }}>

      {/* Overlay mobile */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:30 }}/>
      )}

      {/* SIDEBAR */}
      <aside style={{
        width:220, background:'#1a2b4b', display:'flex', flexDirection:'column', flexShrink:0,
        position:'fixed', top:0, left:0, height:'100vh', zIndex:40,
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.2s',
      }}
        className="sidebar-mobile"
      >
        {/* Logo */}
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, background:'#2d4a7a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🚛</div>
            <div>
              <p style={{ color:'#fff', fontWeight:700, fontSize:13, lineHeight:1.2 }}>FleetMate</p>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:10 }}>PT. MMS · Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'8px 8px 4px' }}>Menu Utama</p>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:10,
                padding:'9px 10px', borderRadius:8,
                cursor:'pointer', fontSize:12, fontWeight:500,
                marginBottom:1, textDecoration:'none', transition:'all 0.15s',
                background: isActive ? '#2d4a7a' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              })}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#2d4a7a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#fff', fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.nama || 'Admin'}</p>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:10, textTransform:'capitalize' }}>{profile?.role}</p>
            </div>
            <button onClick={handleLogout} title="Logout"
              style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:18, padding:2 }}>↩</button>
          </div>
        </div>
      </aside>

      {/* Sidebar Desktop — selalu tampil di layar besar */}
      <style>{`
        @media (min-width: 1024px) {
          .sidebar-mobile {
            position: static !important;
            transform: none !important;
            z-index: auto !important;
          }
        }
      `}</style>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', marginLeft:0 }}>
        {/* Topbar */}
        <header style={{ height:52, background:'#fff', borderBottom:'1px solid #ebeced', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {/* Hamburger menu */}
            <button onClick={() => setMenuOpen(true)}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#44474e', padding:4 }}>
              ☰
            </button>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', display:'inline-block' }}/>
            <span style={{ color:'#10b981', fontSize:11, fontWeight:600 }}>Realtime</span>
            <span style={{ color:'#c4c7cf', fontSize:11 }}>·</span>
            <span style={{ color:'#74777f', fontSize:11, display:'none' }} className="date-label">
              {new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </span>
          </div>
          <span style={{ fontSize:12, color:'#44474e', fontWeight:600 }}>
            {new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
          </span>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', padding:20, background:'#f1f2f3' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
