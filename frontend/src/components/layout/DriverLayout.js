// src/components/layout/DriverLayout.js
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import InstallPrompt from '../InstallPrompt';

const NAV = [
  { to:'/driver',           label:'Home',         icon:'🏠', exact:true },
  { to:'/driver/p2h',       label:'P2H',          icon:'📋' },
  { to:'/driver/kerusakan', label:'Lapor Masalah',icon:'⚠️' },
  { to:'/driver/histori',   label:'Histori',      icon:'📜' },
];

export default function DriverLayout({ children, title, back }) {
  const navigate = useNavigate();

  return (
    <div style={{
      display:'flex', flexDirection:'column', height:'100vh',
      background:'#f1f2f3', maxWidth:480, margin:'0 auto',
      fontFamily:'Montserrat,sans-serif', position:'relative',
    }}>
      {/* Header */}
      <div style={{ background:'#1a2b4b', color:'#fff', padding:'40px 16px 16px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {back && (
            <button onClick={() => navigate(-1)}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:20, padding:0, lineHeight:1 }}>
              ←
            </button>
          )}
          <h1 style={{ fontSize:16, fontWeight:700, margin:0 }}>{title || 'MMS FleetCare'}</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>
        {children}
      </div>

      {/* Bottom Nav */}
      <nav style={{
        position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:'100%', maxWidth:480,
        background:'#fff', borderTop:'1px solid #ebeced',
        display:'flex', zIndex:30,
      }}>
        {NAV.map(({ to, label, icon, exact }) => (
          <NavLink key={to} to={to} end={exact}
            style={({ isActive }) => ({
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              padding:'10px 0', textDecoration:'none', gap:3,
              color: isActive ? '#1a2b4b' : '#c4c7cf',
              borderTop: isActive ? '2px solid #1a2b4b' : '2px solid transparent',
              transition:'all 0.15s',
            })}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ fontSize:10, fontWeight:700 }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  );
}
