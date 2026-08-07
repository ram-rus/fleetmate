// src/pages/auth/LoginPage.js
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email dan password wajib diisi'); return; }

    setLoading(true);
    setError('');

    try {
      // Step 1: Login
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Step 2: Ambil role
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw new Error('Profil tidak ditemukan. Hubungi admin.');

      // Step 3: Redirect
      if (['admin','supervisor','manager'].includes(profile.role)) {
        window.location.replace('/admin');
      } else if (profile.role === 'driver') {
        window.location.replace('/driver');
      } else {
        window.location.replace('/admin');
      }

    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email atau password salah'
        : err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a2b4b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: 'Montserrat, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background circles */}
      <div style={{ position:'absolute', top:-80, right:-80, width:250, height:250, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
      <div style={{ position:'absolute', bottom:-60, left:-60, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.03)' }}/>

      <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:64, height:64, background:'rgba(255,255,255,0.1)',
            borderRadius:16, display:'none', alignItems:'center',
            justifyContent:'center', marginBottom:12,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <img src="/logo.png" alt="MMS FleetCare" style={{ width:64, height:64, objectFit:'contain', marginBottom:12 }}/>
          <h1 style={{ color:'#fff', fontSize:24, fontWeight:800, margin:0 }}>MMS FleetCare</h1>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, margin:'4px 0 0' }}>P2H & Perbaikan Driver</p>
        </div>

        {/* Card */}
        <div style={{ background:'#fff', borderRadius:16, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#1a1c1e', margin:'0 0 4px' }}>Masuk ke Akun</h2>
          <p style={{ fontSize:12, color:'#74777f', margin:'0 0 20px' }}>Gunakan email dan password yang diberikan</p>

          {error && (
            <div style={{
              background:'#fff1f2', border:'1px solid #fecdd3',
              borderRadius:8, padding:'10px 12px',
              color:'#9f1239', fontSize:12, fontWeight:600,
              marginBottom:16,
            }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@mms.co.id"
                disabled={loading}
                style={{
                  width:'100%', border:'1px solid #c4c7cf', borderRadius:8,
                  padding:'10px 12px', fontSize:13, fontFamily:'Montserrat, sans-serif',
                  outline:'none', boxSizing:'border-box',
                  background: loading ? '#f8f9fa' : '#fff',
                }}
                onFocus={e => e.target.style.borderColor = '#1a2b4b'}
                onBlur={e  => e.target.style.borderColor = '#c4c7cf'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#44474e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
                Password
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width:'100%', border:'1px solid #c4c7cf', borderRadius:8,
                    padding:'10px 40px 10px 12px', fontSize:13, fontFamily:'Montserrat, sans-serif',
                    outline:'none', boxSizing:'border-box',
                    background: loading ? '#f8f9fa' : '#fff',
                  }}
                  onFocus={e => e.target.style.borderColor = '#1a2b4b'}
                  onBlur={e  => e.target.style.borderColor = '#c4c7cf'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', color:'#74777f', padding:4,
                  }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width:'100%', background: loading ? '#6b7280' : '#1a2b4b',
                color:'#fff', border:'none', borderRadius:8,
                padding:'13px 0', fontSize:14, fontWeight:700,
                fontFamily:'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'background 0.15s',
              }}
              onMouseOver={e => { if (!loading) e.target.style.background = '#2d4a7a'; }}
              onMouseOut={e  => { if (!loading) e.target.style.background = '#1a2b4b'; }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite"/>
                    </path>
                  </svg>
                  Memproses...
                </>
              ) : 'Masuk'}
            </button>
          </form>

          <p style={{ textAlign:'center', fontSize:11, color:'#c4c7cf', marginTop:16, marginBottom:0 }}>
            Lupa password? Hubungi Admin Maintenance
          </p>
        </div>

        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:11, marginTop:20 }}>
          MMS FleetCare © 2025 PT. MMS
        </p>
      </div>
    </div>
  );
}
