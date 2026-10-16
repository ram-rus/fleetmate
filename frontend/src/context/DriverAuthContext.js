// src/context/DriverAuthContext.js
// Konteks auth khusus driver — terpisah dari Supabase Auth (admin/mekanik)
// Driver pakai No HP + PIN, sesi tersimpan di localStorage device
// v6 — tambah refresh token periodik + timestamp session

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DriverAuthContext = createContext(null);

const STORAGE_KEY = 'fleetmate_driver_session';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 jam

export function DriverAuthProvider({ children }) {
  const [driver, setDriver]   = useState(null);  // { id, nama, no_hp, unit_id, unit_nopol }
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // Verifikasi session & refresh data dari DB
  const verifyAndSetSession = useCallback(async (raw) => {
    if (!raw) { setLoading(false); return; }
    try {
      const session = JSON.parse(raw);
      const { data, error } = await supabase
        .from('driver_accounts')
        .select('id, nama, no_hp, unit_id, aktif, unit:units(nopol)')
        .eq('id', session.driver_id)
        .eq('aktif', true)
        .maybeSingle();

      if (error || !data) {
        localStorage.removeItem(STORAGE_KEY);
        setDriver(null);
        return;
      }

      const driverData = {
        id: data.id,
        nama: data.nama,
        no_hp: data.no_hp,
        unit_id: data.unit_id,
        unit_nopol: data.unit?.nopol || null,
      };

      // Update timestamp session
      const updatedSession = { driver_id: data.id, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
      setDriver(driverData);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      setDriver(null);
    }
  }, []);

  // Cek sesi tersimpan saat app dibuka
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setLoading(false); return; }
    verifyAndSetSession(raw);
  }, [verifyAndSetSession]);

  // Refresh session periodik: cek tiap REFRESH_INTERVAL_MS apakah driver masih aktif
  useEffect(() => {
    if (!driver?.id) return;
    
    timerRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('driver_accounts')
        .select('id, aktif')
        .eq('id', driver.id)
        .maybeSingle();

      if (error || !data || !data.aktif) {
        // Driver dinonaktifkan — logout otomatis
        localStorage.removeItem(STORAGE_KEY);
        setDriver(null);
        clearInterval(timerRef.current);
      } else {
        // Update timestamp saja
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const session = JSON.parse(raw);
          session.timestamp = Date.now();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [driver?.id]);

  // Simpan sesi setelah login berhasil
  const saveSession = useCallback((driverData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      driver_id: driverData.id,
      timestamp: Date.now(),
    }));
    setDriver(driverData);
  }, []);

  // Logout — hapus sesi device
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDriver(null);
  }, []);

  return (
    <DriverAuthContext.Provider value={{ driver, loading, saveSession, logout }}>
      {children}
    </DriverAuthContext.Provider>
  );
}

export function useDriverAuth() {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) throw new Error('useDriverAuth harus dipakai di dalam DriverAuthProvider');
  return ctx;
}
