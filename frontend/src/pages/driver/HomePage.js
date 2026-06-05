// Driver Home — greeting, P2H status, storing tracking card realtime

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import StoringTrackingCard from '../../components/storing/StoringTrackingCard';
import { STORING_SELECT } from '../../lib/storingConstants';

export default function DriverHomePage() {
  const { profile }         = useAuth();
  const navigate            = useNavigate();
  const [p2hHariIni, setP2h]   = useState(null);
  const [storingAktif, setStr] = useState(null);
  const [unitInfo, setUnit]    = useState(null);
  const [loading, setLoad]     = useState(true);

  const loadStoring = useCallback(async (unitId) => {
    const { data } = await supabase
      .from('storing')
      .select(STORING_SELECT)
      .eq('unit_id', unitId)
      .in('status', ['Aktif', 'Pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setStr(data);
    return data;
  }, []);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const today = new Date().toISOString().slice(0, 10);

    if (profile.nopol_assign) {
      const { data: unit } = await supabase
        .from('units').select('*')
        .eq('nopol', profile.nopol_assign).single();
      setUnit(unit);

      if (unit) {
        const { data: p2h } = await supabase
          .from('p2h').select('*')
          .eq('unit_id', unit.id)
          .eq('tanggal', today)
          .maybeSingle();
        setP2h(p2h);
        await loadStoring(unit.id);
      }
    }
    setLoad(false);
  }, [profile, loadStoring]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: update tracking card otomatis tanpa refresh
  useEffect(() => {
    if (!unitInfo?.id) return;

    const channel = supabase
      .channel(`driver-storing-${unitInfo.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'storing',
        filter: `unit_id=eq.${unitInfo.id}`,
      }, () => loadStoring(unitInfo.id))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifikasi',
        filter: `user_id=eq.${profile?.id}`,
      }, () => loadStoring(unitInfo.id))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unitInfo?.id, profile?.id, loadStoring]);

  const MENU = [
    { icon: '📋', label: 'P2H Digital',       desc: p2hHariIni ? 'Sudah disubmit hari ini' : 'Belum P2H hari ini!', to: '/driver/p2h',       alert: !p2hHariIni, bg: '#eff6ff' },
    { icon: '🔧', label: 'Laporan Kerusakan', desc: 'Laporkan kerusakan unit',                                        to: '/driver/kerusakan', alert: false,          bg: '#fefce8' },
    { icon: '📍', label: 'Request Storing',   desc: storingAktif ? `Progres: ${storingAktif.progres || storingAktif.status}` : 'Laporkan unit storing', to: '/driver/storing', alert: storingAktif?.status === 'Pending', bg: '#fef2f2' },
  ];

  if (loading) {
    return (
      <DriverLayout>
        <div style={{ padding: 40, textAlign: 'center', color: '#74777f' }}>Memuat data...</div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout>
      <div style={{ padding: 16 }}>

        {/* Greeting Card */}
        <div style={{ background: '#1a2b4b', borderRadius: 16, padding: 20, marginBottom: 16, color: '#fff' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>Selamat datang,</p>
          <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{profile?.nama || 'Driver'}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Unit Anda</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{profile?.nopol_assign || '—'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* Tracking Card Storing — fitur utama */}
        {storingAktif && (
          <StoringTrackingCard storing={storingAktif}/>
        )}

        {/* Status P2H */}
        <div style={{
          background: p2hHariIni ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${p2hHariIni ? '#bbf7d0' : '#fecdd3'}`,
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{p2hHariIni ? '✅' : '⚠️'}</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: p2hHariIni ? '#166534' : '#9f1239' }}>
                {p2hHariIni ? 'P2H Sudah Disubmit' : 'Belum P2H Hari Ini!'}
              </p>
              {p2hHariIni && (
                <p style={{ fontSize: 10, color: '#16a34a' }}>Status: <b>{p2hHariIni.status}</b></p>
              )}
            </div>
          </div>
          {!p2hHariIni && (
            <button onClick={() => navigate('/driver/p2h')}
              style={{ background: '#ba1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Mulai P2H
            </button>
          )}
        </div>

        {/* Menu */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {MENU.map(m => (
            <button key={m.label} onClick={() => navigate(m.to)}
              style={{
                background: '#fff', border: '1px solid #ebeced', borderRadius: 12,
                padding: 16, textAlign: 'left', cursor: 'pointer', position: 'relative',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseOut={e  => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              {m.alert && (
                <span style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#ba1a1a', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>!</span>
              )}
              <div style={{ width: 44, height: 44, background: m.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>
                {m.icon}
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1c1e', marginBottom: 3 }}>{m.label}</p>
              <p style={{ fontSize: 10, color: '#74777f' }}>{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Fallback alert jika storing pending tanpa detail */}
        {storingAktif && !storingAktif.mekanik_id && storingAktif.status === 'Pending' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⏳ Menunggu Persetujuan Admin</p>
            <p style={{ fontSize: 11, color: '#92400e' }}>Request storing Anda sedang diproses pengurus.</p>
          </div>
        )}
      </div>
    </DriverLayout>
  );
}
