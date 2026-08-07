// src/components/InstallPrompt.js
// Banner ajakan install PWA. Taruh komponen ini SATU KALI di tempat yang
// selalu ke-render di semua halaman driver (rekomendasi: di dalam
// DriverLayout.js, supaya muncul konsisten di Home/P2H/Lapor Masalah/Histori
// tanpa perlu ditambahkan berulang di tiap halaman).
import React, { useEffect, useState } from 'react';

const DISMISS_KEY = 'fleetmate_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari — jangan spam driver yang sudah nolak

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // Safari iOS
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function wasRecentlyDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < DISMISS_COOLDOWN_MS;
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState(null); // 'android' | 'ios' | null
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isRunningStandalone() || wasRecentlyDismissed()) return; // sudah ke-install / baru saja ditolak

    if (isIOS()) {
      setPlatform('ios');
      setVisible(true);
      return; // iOS tidak punya beforeinstallprompt, langsung tampilkan instruksi manual
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault(); // cegah mini-infobar bawaan Chrome, kita pakai banner sendiri
      setDeferredPrompt(e);
      setPlatform('android');
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; // tidak perlu cek accepted/dismissed — dua-duanya cukup tutup banner kita
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 1000,
      background: '#1a2b4b', color: '#fff', borderRadius: 14,
      padding: '14px 14px 14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontFamily: 'Montserrat, sans-serif',
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        🚛
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Install FleetMate</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
          {platform === 'ios'
            ? <>Tap tombol Share <span style={{ fontWeight: 700 }}>⎋</span> lalu pilih "Add to Home Screen"</>
            : 'Akses lebih cepat, bisa dibuka tanpa browser'}
        </p>
      </div>

      {platform === 'android' && (
        <button onClick={handleInstallClick}
          style={{ background: '#fff', color: '#1a2b4b', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'Montserrat, sans-serif' }}>
          Install
        </button>
      )}

      <button onClick={handleDismiss} aria-label="Tutup"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
}
