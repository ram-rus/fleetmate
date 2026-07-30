// src/App.js — FleetMate v6
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DriverAuthProvider, useDriverAuth } from './context/DriverAuthContext';

// Admin pages
import AdminLayout       from './components/layout/AdminLayout';
import OverviewPage      from './pages/admin/OverviewPage';
import P2HAdminPage      from './pages/admin/P2HPage';
import LaporanStoringPage from './pages/admin/LaporanStoringPage';
import UnitPage          from './pages/admin/UnitPage';

// Driver pages
import DriverLayout      from './components/layout/DriverLayout';
import DriverHome        from './pages/driver/HomePage';
import DriverP2H         from './pages/driver/P2HPage';
import DriverKerusakan   from './pages/driver/LaporanKerusakanPage';
import DriverHistori     from './pages/driver/HistoriStoringPage';
import DriverLoginPage   from './pages/driver/auth/DriverLoginPage';

// Auth admin
import LoginPage         from './pages/auth/LoginPage';

// ─── Loading screen ───────────────────────────────────────
function Loading() {
  return (
    <div style={{ minHeight:'100vh', background:'#1a2b4b', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, fontFamily:'Montserrat,sans-serif' }}>
      <div style={{ width:48, height:48, border:'4px solid rgba(255,255,255,0.2)', borderTop:'4px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600 }}>Memuat FleetMate...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Guards Admin ──────────────────────────────────────────
function AdminOnly({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading/>;
  if (!user)   return <Navigate to="/login" replace/>;
  if (!['admin','supervisor','manager'].includes(profile?.role)) return <Navigate to="/login" replace/>;
  return children;
}

function GuestOnly({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading/>;
  if (user && profile && ['admin','supervisor','manager'].includes(profile.role)) {
    return <Navigate to="/admin" replace/>;
  }
  return children;
}

// ─── Guards Driver ─────────────────────────────────────────
function DriverOnly({ children }) {
  const { driver, loading } = useDriverAuth();
  if (loading) return <Loading/>;
  if (!driver) return <Navigate to="/driver/login" replace/>;
  return children;
}

function DriverGuestOnly({ children }) {
  const { driver, loading } = useDriverAuth();
  if (loading) return <Loading/>;
  if (driver) return <Navigate to="/driver" replace/>;
  return children;
}

function A({ children }) {
  return <AdminLayout>{children}</AdminLayout>;
}

// ─── Component Penentu Root Path ──────────────────────────
function RootRedirect() {
  // Cek hostname secara dinamis
  const hostname = window.location.hostname;
  const isAdminDomain = hostname.includes('admin');
  
  // Jika domain mengandung kata 'admin' -> ke /login, jika tidak -> ke /driver
  const target = isAdminDomain ? '/login' : '/driver';
  return <Navigate to={target} replace />;
}

// ─── Routes ───────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect sesuai domain */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth Driver */}
      <Route path="/driver/login" element={<DriverGuestOnly><DriverLoginPage/></DriverGuestOnly>}/>

      {/* Driver Pages */}
      <Route path="/driver"           element={<DriverOnly><DriverHome/></DriverOnly>}/>
      <Route path="/driver/p2h"       element={<DriverOnly><DriverP2H/></DriverOnly>}/>
      <Route path="/driver/kerusakan" element={<DriverOnly><DriverKerusakan/></DriverOnly>}/>
      <Route path="/driver/histori"   element={<DriverOnly><DriverHistori/></DriverOnly>}/>

      {/* Auth Admin */}
      <Route path="/login" element={<GuestOnly><LoginPage/></GuestOnly>}/>

      {/* Admin Pages */}
      <Route path="/admin"                 element={<AdminOnly><A><OverviewPage/></A></AdminOnly>}/>
      <Route path="/admin/p2h"             element={<AdminOnly><A><P2HAdminPage/></A></AdminOnly>}/>
      <Route path="/admin/laporan-storing" element={<AdminOnly><A><LaporanStoringPage/></A></AdminOnly>}/>
      <Route path="/admin/unit"            element={<AdminOnly><A><UnitPage/></A></AdminOnly>}/>

      {/* Fallback jika route tidak ditemukan */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

// ─── App Root ─────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DriverAuthProvider>
          <AppRoutes/>
          <Toaster position="top-center" toastOptions={{
            style:{ fontFamily:'Montserrat,sans-serif', fontSize:13, fontWeight:600, borderRadius:10 },
            success:{ style:{ background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0' }},
            error:  { style:{ background:'#fef2f2', color:'#7f1d1d', border:'1px solid #fecaca' }},
          }}/>
        </DriverAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}