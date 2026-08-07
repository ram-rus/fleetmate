// src/pages/driver/auth/DriverLoginPage.js
// Alur login driver self-service:
// 1. Ketik nopol unit langsung → tombol "Cari Unit" → sistem cocokkan ke database
// 2. Jika ada driver tetap & device dikenali → tombol besar "Lanjutkan sebagai [Nama]"
// 3. Jika driver pengganti / device baru → form No HP + PIN (daftar otomatis jika baru)

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useDriverAuth } from '../../../context/DriverAuthContext';
import toast from 'react-hot-toast';

const T = {
  navy:'#0F172A', blue:'#2170E4', green:'#059669', amber:'#D97706', red:'#C94A3A',
  bg:'#F5F3EF', card:'#FFFFFF', border:'#E2E8F0',
  text:'#111827', textDim:'#6B7280', textLight:'#9CA3AF',
  head:"'Hanken Grotesk','Inter',sans-serif", body:"'Inter',sans-serif", mono:"'JetBrains Mono',monospace",
};

const STEPS = { PILIH_UNIT:'pilih_unit', KONFIRMASI:'konfirmasi', FORM_HP_PIN:'form_hp_pin' };

// Normalisasi nopol: hapus spasi berlebih, uppercase — agar "b 1001 mms" = "B 1001 MMS"
function normalisasiNopol(s) {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

export default function DriverLoginPage() {
  const navigate = useNavigate();
  const { saveSession } = useDriverAuth();

  const [step, setStep]           = useState(STEPS.PILIH_UNIT);
  const [nopolInput, setNopolInput] = useState('');
  const [selectedUnit, setSelUnit]= useState(null);
  const [driverTetap, setDrvTetap]= useState(null);
  const [cariLoading, setCariLoading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [notFound, setNotFound]   = useState(false);

  const [noHp, setNoHp]   = useState('');
  const [pin, setPin]     = useState('');
  const [nama, setNama]   = useState('');
  const [mode, setMode]   = useState('cek');

  // Cari unit berdasarkan nopol yang diketik, lalu cek driver tetapnya
  const handleCariUnit = useCallback(async () => {
    const nopolBersih = normalisasiNopol(nopolInput);
    if (!nopolBersih) { toast.error('Masukkan nomor polisi terlebih dahulu'); return; }

    setCariLoading(true);
    setNotFound(false);
    try {
      // Cari unit — ambil semua, cocokkan di JS agar toleran spasi/huruf kecil-besar
      const { data: allUnits, error: unitErr } = await supabase
        .from('units')
        .select('id, nopol, tipe');

      if (unitErr) {
        toast.error('Gagal mencari unit: ' + unitErr.message);
        setCariLoading(false); return;
      }

      // Cocokkan: hapus semua spasi dari keduanya lalu bandingkan uppercase
      const nopolKompak = nopolBersih.replace(/\s/g,'');
      const unit = (allUnits||[]).find(u =>
        normalisasiNopol(u.nopol).replace(/\s/g,'') === nopolKompak
      );

      if (!unit) {
        setNotFound(true);
        setCariLoading(false);
        return;
      }

      setSelUnit(unit);

      const { data: drv } = await supabase
        .from('driver_accounts')
        .select('id, nama, no_hp')
        .eq('unit_id', unit.id)
        .eq('aktif', true)
        .maybeSingle();

      setDrvTetap(drv || null);
      setStep(drv ? STEPS.KONFIRMASI : STEPS.FORM_HP_PIN);
      setMode(drv ? 'cek' : 'daftar');
    } catch (e) {
      toast.error('Terjadi kesalahan: ' + e.message);
    } finally {
      setCariLoading(false);
    }
  }, [nopolInput]);

  function handleLanjutSebagaiDriverTetap() {
    if (!driverTetap) return;
    saveSession({
      id: driverTetap.id, nama: driverTetap.nama, no_hp: driverTetap.no_hp,
      unit_id: selectedUnit.id, unit_nopol: selectedUnit.nopol,
    });
    toast.success('Selamat datang, ' + driverTetap.nama + '!');
    navigate('/driver');
  }

  async function handleSubmitHpPin() {
    if (!noHp.trim() || noHp.trim().length < 9) { toast.error('Nomor HP tidak valid'); return; }
    if (!/^[0-9]{4}$/.test(pin)) { toast.error('PIN harus 4 digit angka'); return; }
    setSaving(true);
    try {
      const hpClean = noHp.trim().replace(/[\s-]/g,'');

      const { data: existing } = await supabase
        .from('driver_accounts').select('id, nama, no_hp, pin_hash').eq('no_hp', hpClean).maybeSingle();

      if (existing) {
        const { data, error } = await supabase.rpc('driver_login', {
          p_no_hp: hpClean, p_pin: pin, p_unit_id: selectedUnit.id,
        });
        if (error) throw error;
        if (!data.success) {
          if (data.error === 'wrong_pin') {
            toast.error('PIN salah. Jika lupa, hubungi admin untuk reset.');
          } else {
            toast.error(data.message);
          }
          setSaving(false); return;
        }
        saveSession({
          id: data.driver_id, nama: data.nama, no_hp: data.no_hp,
          unit_id: selectedUnit.id, unit_nopol: selectedUnit.nopol,
        });
        toast.success('Selamat datang kembali, ' + data.nama + '!');
        navigate('/driver');
      } else {
        if (!nama.trim() || nama.trim().length < 2) {
          toast.error('Nama wajib diisi untuk pendaftaran baru'); setSaving(false); return;
        }
        const { data, error } = await supabase.rpc('driver_register', {
          p_no_hp: hpClean, p_nama: nama.trim(), p_pin: pin, p_unit_id: selectedUnit.id,
        });
        if (error) throw error;
        if (!data.success) { toast.error(data.message); setSaving(false); return; }
        saveSession({
          id: data.driver_id, nama: data.nama, no_hp: hpClean,
          unit_id: selectedUnit.id, unit_nopol: selectedUnit.nopol,
        });
        toast.success('Pendaftaran berhasil! Selamat datang, ' + data.nama);
        navigate('/driver');
      }
    } catch(e) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNoHpBlur() {
    const hpClean = noHp.trim().replace(/[\s-]/g,'');
    if (hpClean.length < 9) return;
    const { data } = await supabase.from('driver_accounts').select('nama').eq('no_hp', hpClean).maybeSingle();
    if (data) { setMode('login'); setNama(data.nama); }
    else { setMode('daftar'); setNama(''); }
  }

  const inputStyle = {
    width:'100%', border:'1.5px solid ' + T.border, borderRadius:10, padding:'14px 16px',
    fontSize:16, fontFamily:T.body, outline:'none', boxSizing:'border-box', background:'#F8FAFC',
  };

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:T.body, display:'flex',
      flexDirection:'column', alignItems:'center', padding:'24px 16px' }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');"}</style>

      <div style={{ textAlign:'center', marginBottom:28, marginTop:20 }}>
        <div style={{ width:56, height:56, background:T.navy, borderRadius:14,
          display:'none', alignItems:'center', justifyContent:'center', fontSize:26,
          margin:'0 auto 12px' }}>🚛</div>
        <img src="/logo.png" alt="MMS FleetCare" style={{ width:56, height:56, objectFit:'contain', margin:'0 auto 12px' }}/>
        <h1 style={{ fontSize:20, fontWeight:700, fontFamily:T.head, color:T.text }}>MMS FleetCare</h1>
        <p style={{ fontSize:12, color:T.textDim }}>P2H & Perbaikan Driver</p>
      </div>

      <div style={{ width:'100%', maxWidth:420 }}>

        {step === STEPS.PILIH_UNIT && (
          <div style={{ background:T.card, borderRadius:14, padding:24, border:'1px solid ' + T.border }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:4 }}>Masukkan Nomor Polisi</h2>
            <p style={{ fontSize:12, color:T.textDim, marginBottom:18 }}>Ketik nopol kendaraan Anda dengan lengkap</p>

            <input
              value={nopolInput}
              onChange={e=>{ setNopolInput(e.target.value); setNotFound(false); }}
              onKeyDown={e=>{ if (e.key==='Enter') handleCariUnit(); }}
              placeholder="Contoh: B 1001 MMS"
              style={Object.assign({}, inputStyle, {
                marginBottom:14, textAlign:'center', fontSize:20, fontFamily:T.mono,
                textTransform:'uppercase', letterSpacing:'0.05em',
              })}
              autoFocus autoCapitalize="characters"
            />

            {notFound && (
              <div style={{ background:'#FDE8E8', border:'1px solid #FCA5A5', borderRadius:8,
                padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <p style={{ fontSize:12, color:T.red }}>
                  Nomor polisi <b>{normalisasiNopol(nopolInput)}</b> tidak ditemukan. Periksa kembali ejaan, atau hubungi admin.
                </p>
              </div>
            )}

            <button onClick={handleCariUnit} disabled={cariLoading || !nopolInput.trim()}
              style={{ width:'100%', background:cariLoading||!nopolInput.trim()?'#9CA3AF':T.navy,
                color:'#fff', border:'none', borderRadius:12, padding:'16px 0', fontSize:16,
                fontWeight:700, cursor:cariLoading||!nopolInput.trim()?'not-allowed':'pointer',
                fontFamily:T.body }}>
              {cariLoading ? 'Mencari...' : 'Cari Unit'}
            </button>
          </div>
        )}

        {step === STEPS.KONFIRMASI && driverTetap && (
          <div style={{ background:T.card, borderRadius:14, padding:24, border:'1px solid ' + T.border, textAlign:'center' }}>
            <button onClick={()=>{ setStep(STEPS.PILIH_UNIT); setSelUnit(null); setDrvTetap(null); setNotFound(false); }}
              style={{ background:'none', border:'none', color:T.textDim, fontSize:12,
                cursor:'pointer', marginBottom:16, display:'flex', alignItems:'center', gap:4 }}>
              {'\u2190'} Ganti unit
            </button>

            <div style={{ width:64, height:64, background:'#EFF6FF', borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
              margin:'0 auto 16px' }}>🚛</div>

            <p style={{ fontSize:12, color:T.textDim, marginBottom:4 }}>Unit</p>
            <p style={{ fontSize:20, fontWeight:700, fontFamily:T.mono, color:T.text, marginBottom:20 }}>
              {selectedUnit && selectedUnit.nopol}
            </p>

            <div style={{ background:T.bg, borderRadius:12, padding:16, marginBottom:20 }}>
              <p style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>Driver Terdaftar</p>
              <p style={{ fontSize:18, fontWeight:700, color:T.text, marginBottom:2 }}>{driverTetap.nama}</p>
              <p style={{ fontSize:12, color:T.textDim, fontFamily:T.mono }}>{driverTetap.no_hp}</p>
            </div>

            <button onClick={handleLanjutSebagaiDriverTetap}
              style={{ width:'100%', background:T.green, color:'#fff', border:'none', borderRadius:12,
                padding:'16px 0', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:T.body,
                marginBottom:10 }}>
              Lanjutkan sebagai {driverTetap.nama.split(' ')[0]}
            </button>

            <button onClick={()=>{ setMode('cek'); setStep(STEPS.FORM_HP_PIN); }}
              style={{ width:'100%', background:'none', color:T.textDim, border:'1px solid ' + T.border,
                borderRadius:12, padding:'14px 0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:T.body }}>
              Bukan saya — Saya driver pengganti
            </button>
          </div>
        )}

        {step === STEPS.FORM_HP_PIN && (
          <div style={{ background:T.card, borderRadius:14, padding:24, border:'1px solid ' + T.border }}>
            <button onClick={()=>setStep(driverTetap ? STEPS.KONFIRMASI : STEPS.PILIH_UNIT)}
              style={{ background:'none', border:'none', color:T.textDim, fontSize:12,
                cursor:'pointer', marginBottom:16, display:'flex', alignItems:'center', gap:4 }}>
              {'\u2190'} Kembali
            </button>

            <p style={{ fontSize:11, color:T.textDim, marginBottom:2 }}>Unit</p>
            <p style={{ fontSize:16, fontWeight:700, fontFamily:T.mono, color:T.text, marginBottom:18 }}>
              {selectedUnit && selectedUnit.nopol}
            </p>

            <h2 style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:4 }}>
              {mode==='daftar' ? 'Daftar Sebagai Driver' : 'Masuk dengan PIN'}
            </h2>
            <p style={{ fontSize:12, color:T.textDim, marginBottom:18 }}>
              {mode==='daftar'
                ? 'Nomor belum terdaftar — isi data berikut untuk mendaftar'
                : 'Nomor sudah terdaftar — masukkan PIN Anda'}
            </p>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textDim,
                textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>
                Nomor HP <span style={{color:T.red}}>*</span>
              </label>
              <input value={noHp} onChange={e=>setNoHp(e.target.value)} onBlur={handleNoHpBlur}
                type="tel" placeholder="08xxxxxxxxxx" style={inputStyle} autoFocus/>
            </div>

            {mode === 'daftar' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textDim,
                  textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>
                  Nama Lengkap <span style={{color:T.red}}>*</span>
                </label>
                <input value={nama} onChange={e=>setNama(e.target.value)}
                  placeholder="Nama Anda" style={inputStyle}/>
              </div>
            )}

            {mode === 'login' && (
              <div style={{ background:'#EFF6FF', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
                <p style={{ fontSize:13, fontWeight:600, color:T.blue }}>{'\uD83D\uDC4B'} {nama}</p>
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textDim,
                textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>
                PIN 4 Digit <span style={{color:T.red}}>*</span>
              </label>
              <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                type="password" inputMode="numeric" placeholder="****" maxLength={4}
                style={Object.assign({}, inputStyle, {textAlign:'center', fontSize:24, letterSpacing:'0.5em', fontFamily:T.mono})}/>
              {mode === 'daftar' && (
                <p style={{ fontSize:10, color:T.textLight, marginTop:5 }}>
                  Buat PIN yang mudah Anda ingat. Anda akan memakainya untuk masuk berikutnya.
                </p>
              )}
            </div>

            <button onClick={handleSubmitHpPin} disabled={saving}
              style={{ width:'100%', background:saving?'#9CA3AF':T.navy, color:'#fff', border:'none',
                borderRadius:12, padding:'16px 0', fontSize:16, fontWeight:700,
                cursor:saving?'not-allowed':'pointer', fontFamily:T.body }}>
              {saving ? 'Memproses...' : mode==='daftar' ? 'Daftar & Masuk' : 'Masuk'}
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize:10, color:T.textLight, marginTop:24, textAlign:'center' }}>
        Lupa PIN? Hubungi admin maintenance Anda.
      </p>
    </div>
  );
}
