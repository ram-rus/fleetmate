// src/context/DriverAuthContext.js
// Konteks auth khusus driver — terpisah dari Supabase Auth (admin/mekanik)
// Driver pakai No HP + PIN, sesi tersimpan di localStorage device

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DriverAuthContext = createContext(null);

const STORAGE_KEY = 'fleetmate_driver_session';

export function DriverAuthProvider({ children }) {
  const [driver, setDriver]   = useState(null);  // { id, nama, no_hp, unit_id, unit_nopol }
  const [loading, setLoading] = useState(true);

  // Cek sesi tersimpan saat app dibuka
  useEffect(() => {
    async function checkSession() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { setLoading(false); return; }
        const session = JSON.parse(raw);

        // Verifikasi driver masih aktif & ambil data terbaru
        const { data, error } = await supabase
          .from('driver_accounts')
          .select('id, nama, no_hp, unit_id, aktif, unit:units(nopol)')
          .eq('id', session.driver_id)
          .eq('aktif', true)
          .maybeSingle();

        if (error || !data) {
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        setDriver({
          id: data.id,
          nama: data.nama,
          no_hp: data.no_hp,
          unit_id: data.unit_id,
          unit_nopol: data.unit?.nopol || null,
        });
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  // Simpan sesi setelah login berhasil
  const saveSession = useCallback((driverData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ driver_id: driverData.id }));
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
