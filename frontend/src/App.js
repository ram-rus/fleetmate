// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage             from './pages/auth/LoginPage';
import AdminLayout           from './components/layout/AdminLayout';
import OverviewPage          from './pages/admin/OverviewPage';
import P2HAdminPage          from './pages/admin/P2HPage';
import SPKPage               from './pages/admin/SPKPage';
import StoringAdminPage      from './pages/admin/StoringPage';
import StoringProgressPage   from './pages/admin/StoringProgressPage';
import LaporanKerusakanAdmin from './pages/admin/LaporanKerusakanPage';
import UnitPage              from './pages/admin/UnitPage';
import DriverHome            from './pages/driver/HomePage';
import DriverP2H             from './pages/driver/P2HPage';
import DriverStoring         from './pages/driver/StoringPage';
import DriverKerusakan       from './pages/driver/LaporanKerusakanPage';

// ============================================================
// Loading screen
// ============================================================
function Loading() {
  return (
    <div style={{
      minHeight:'100vh', background:'#1a2b4b',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      gap:16, fontFamily:'Montserrat,sans-serif'
    }}>
      <div style={{
        width:48, height:48,
        border:'4px solid rgba(255,255,255,0.2)',
        borderTop:'4px solid #fff',
        borderRadius:'50%',
        animation:'spin 0.8s linear infinite'
      }}/>
      <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600 }}>Memuat FleetMate...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ============================================================
// Route Guards
// ============================================================
function AdminOnly({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading/>;
  if (!user)   return <Navigate to="/login" replace/>;
  if (!['admin','supervisor','manager'].includes(profile?.role)) return <Navigate to="/login" replace/>;
  return children;
}

function DriverOnly({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading/>;
  if (!user)   return <Navigate to="/login" replace/>;
  if (profile?.role !== 'driver') return <Navigate to="/login" replace/>;
  return children;
}

function GuestOnly({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loading/>;
  if (user && profile) {
    if (['admin','supervisor','manager'].includes(profile.role)) return <Navigate to="/admin" replace/>;
    if (profile.role === 'driver')  return <Navigate to="/driver" replace/>;
    if (profile.role === 'mekanik') return <Navigate to="/admin" replace/>;
  }
  return children;
}

function W({ children }) {
  return <AdminLayout>{children}</AdminLayout>;
}

// ============================================================
// Routes
// ============================================================
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace/>}/>

      {/* Auth */}
      <Route path="/login" element={<GuestOnly><LoginPage/></GuestOnly>}/>

      {/* Admin */}
      <Route path="/admin"                  element={<AdminOnly><W><OverviewPage/></W></AdminOnly>}/>
      <Route path="/admin/p2h"              element={<AdminOnly><W><P2HAdminPage/></W></AdminOnly>}/>
      <Route path="/admin/spk"              element={<AdminOnly><W><SPKPage/></W></AdminOnly>}/>
      <Route path="/admin/storing"          element={<AdminOnly><W><StoringAdminPage/></W></AdminOnly>}/>
      <Route path="/admin/storing-progress" element={<AdminOnly><W><StoringProgressPage/></W></AdminOnly>}/>
      <Route path="/admin/laporan-kerusakan"element={<AdminOnly><W><LaporanKerusakanAdmin/></W></AdminOnly>}/>
      <Route path="/admin/unit"             element={<AdminOnly><W><UnitPage/></W></AdminOnly>}/>

      {/* Driver */}
      <Route path="/driver"           element={<DriverOnly><DriverHome/></DriverOnly>}/>
      <Route path="/driver/p2h"       element={<DriverOnly><DriverP2H/></DriverOnly>}/>
      <Route path="/driver/storing"   element={<DriverOnly><DriverStoring/></DriverOnly>}/>
      <Route path="/driver/kerusakan" element={<DriverOnly><DriverKerusakan/></DriverOnly>}/>

      <Route path="*" element={<Navigate to="/login" replace/>}/>
    </Routes>
  );
}

// ============================================================
// App Root
// ============================================================
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes/>
        <Toaster
          position="top-center"
          toastOptions={{
            style:{ fontFamily:'Montserrat,sans-serif', fontSize:13, fontWeight:600, borderRadius:10 },
            success:{ style:{ background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0' }},
            error:  { style:{ background:'#fef2f2', color:'#7f1d1d', border:'1px solid #fecaca' }},
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
