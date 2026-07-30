// src/pages/admin/SPKPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function SPKPage() {
  const { profile }               = useAuth();
  const [list, setList]           = useState([]);
  const [loading, setLoad]        = useState(true);
  const [filter, setFilter]       = useState('Semua'); // Semua, Perbaikan, Standby
  const [showForm, setShowForm]   = useState(false);
  const [formType, setFormType]   = useState('perbaikan'); // perbaikan atau standby
  const [units, setUnits]         = useState([]);
  const [mekaniks, setMekaniks]   = useState([]);
  
  // State form gabungan perbaikan dan standby
  const [form, setForm]           = useState({ 
    unit_id: '', 
    mekanik_id: '', 
    keluhan: '', 
    jenis: 'Korektif', 
    lokasi: 'Pool', 
    prioritas: 'Normal',
    alasan_standby: 'Standby Pool' // Default isi alasan standby
  });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { loadAll(); }, [filter]);
  useEffect(() => {
    supabase.from('units').select('id,nopol,tipe').order('nopol').then(({data}) => setUnits(data||[]));
    supabase.from('users').select('id,nama').eq('role','mekanik').then(({data}) => setMekaniks(data||[]));
  }, []);

  async function loadAll() {
    setLoad(true);
    // Kita ambil data SPK (Perbaikan) sekaligus mencocokkannya dengan status unit terbaru
    let q = supabase.from('spk')
      .select('*, unit:units(nopol,tipe,status), mekanik:users(nama)')
      .order('created_at', { ascending: false });

    const { data: spkData } = await q;

    // Kita juga ambil data mobil yang statusnya "Standby%" langsung dari tabel units
    const { data: unitStandby } = await supabase.from('units')
      .select('id, nopol, tipe, status, catatan')
      .ilike('status', 'Standby%');

    // Gabungkan data untuk visualisasi dashboard admin
    let combinedList = [
      ...(spkData || []).map(item => ({ ...item, displayType: 'perbaikan' })),
      ...(unitStandby || []).map(item => ({ 
        id: item.id,
        no_spk: 'STANDBY',
        status: item.status,
        unit: { nopol: item.nopol, tipe: item.tipe, status: item.status },
        keluhan: item.catatan || 'Unit standby siap beroperasi.',
        displayType: 'standby',
        created_at: new Date().toISOString()
      }))
    ];

    // Logika Filter Tab Frontend
    if (filter === 'Sedang Perbaikan') {
      combinedList = combinedList.filter(item => item.displayType === 'perbaikan' && item.status !== 'Selesai');
    } else if (filter === 'Standby Pool') {
      combinedList = combinedList.filter(item => item.displayType === 'standby' || item.status === 'Standby Pool');
    }

    setList(combinedList);
    setLoad(false);
  }

  async function handleSimpanStatus() {
    if (!form.unit_id) { toast.error('Unit wajib dipilih'); return; }
    setSaving(true);

    try {
      if (formType === 'perbaikan') {
        if (!form.keluhan.trim()) { toast.error('Keluhan/Deskripsi perbaikan wajib diisi'); setSaving(false); return; }
        
        // 1. Generate No SPK/Laporan
        const year = new Date().getFullYear();
        const { count } = await supabase.from('spk').select('*', { count: 'exact', head: true })
          .gte('created_at', `${year}-01-01`);
        const noSpk = `SPK-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

        // 2. Insert ke tabel SPK
        const { error: spkErr } = await supabase.from('spk').insert({
          no_spk:      noSpk,
          unit_id:     form.unit_id,
          mekanik_id:  form.mekanik_id || null,
          keluhan:     form.keluhan,
          jenis:       form.jenis,
          lokasi:      form.lokasi,
          prioritas:   form.prioritas,
          status:      'Waiting',
          dibuat_oleh: profile?.id,
        });
        if (spkErr) throw spkErr;

        // 3. Update status unit di pool menjadi Perbaikan Pool
        const statusUnit = form.lokasi === 'Lapangan' ? 'Storing' : 'Perbaikan Pool';
        await supabase.from('units').update({ status: statusUnit }).eq('id', form.unit_id);
        
        toast.success(`Laporan perbaikan ${noSpk} berhasil dibuat!`);

      } else {
        // Logika untuk simpan status STANDBY langsung merubah status di tabel units
        const { error: unitErr } = await supabase.from('units').update({
          status: form.alasan_standby,
          catatan: form.keluhan || `Unit standby karena ${form.alasan_standby}`
        }).eq('id', form.unit_id);

        if (unitErr) throw unitErr;
        toast.success(`Status unit berhasil diubah ke ${form.alasan_standby}`);
      }

      setShowForm(false);
      setForm({ unit_id: '', mekanik_id: '', keluhan: '', jenis: 'Korektif', lokasi: 'Pool', prioritas: 'Normal', alasan_standby: 'Standby Pool' });
      loadAll();
    } catch (e) {
      toast.error('Gagal menyimpan data: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatusPerbaikan(id, unitId, statusId) {
    const upd = { status: statusId };
    if (statusId === 'In Progress') upd.tgl_mulai = new Date().toISOString().slice(0, 10);
    if (statusId === 'Selesai')     upd.tgl_selesai = new Date().toISOString().slice(0, 10);
    
    const { error } = await supabase.from('spk').update(upd).eq('id', id);
    if (error) { toast.error('Gagal update status'); return; }

    // Jika perbaikan selesai, kembalikan status unit ke Standby Pool secara otomatis
    if (statusId === 'Selesai') {
      await supabase.from('units').update({ status: 'Standby Pool' }).eq('id', unitId);
    }
    
    toast.success(`Status perbaikan diperbarui!`);
    loadAll();
  }

  const fTabs = ['Semua', 'Sedang Perbaikan', 'Standby Pool'];
  
  const statusStyle = {
    'Waiting':                { bg: '#fef3c7', color: '#92400e' },
    'In Progress':            { bg: '#dbeafe', color: '#1e3a8a' },
    'Selesai':                { bg: '#d1fae5', color: '#065f46' },
    'Standby Pool':           { bg: '#e0f2fe', color: '#0369a1' },
    'Standby Sopir Libur':    { bg: '#f3e8ff', color: '#6b21a8' },
    'Standby Tunggu DO':      { bg: '#ccfbf1', color: '#115e59' },
    'Standby Berangkat Sore': { bg: '#ffedd5', color: '#9a3412' },
    'Storing':                { bg: '#fee2e2', color: '#991b1b' },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#74777f', fontFamily: 'Montserrat,sans-serif' }}>Memuat data pool...</div>;

  return (
    <div style={{ fontFamily: 'Montserrat,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Laporan Perbaikan & Status Unit</h2>
          <p style={{ fontSize: 11, color: '#74777f' }}>Pantau unit perbaikan, unit standby, dan kendala storing di Pool PT. MMS</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: '#1a2b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + Update Status Unit
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {fTabs.map(f => {
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: filter === f ? '#1a2b4b' : '#fff',
                color:      filter === f ? '#fff'    : '#44474e',
                borderColor:filter === f ? '#1a2b4b' : '#c4c7cf',
              }}>
              {f}
            </button>
          );
        })}
      </div>

      {/* List Item Dashboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 8, padding: 40, textAlign: 'center', color: '#c4c7cf' }}>
            Tidak ada unit dalam kategori ini
          </div>
        ) : list.map(s => {
          const sc = statusStyle[s.status] || { bg: '#f3f4f6', color: '#374151' };
          return (
            <div key={s.id} style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#74777f', fontFamily: 'monospace' }}>{s.no_spk}</span>
                  <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{s.status}</span>
                  {s.jenis && <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{s.jenis}</span>}
                  {s.prioritas === 'Urgent' && <span style={{ background: '#fee2e2', color: '#7f1d1d', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>🔴 URGENT</span>}
                </div>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: '#1a2b4b' }}>{s.unit?.nopol} <span style={{fontWeight: 400, fontSize: 12, color: '#74777f'}}>({s.unit?.tipe})</span></p>
                <p style={{ fontSize: 12, color: '#374151', marginBottom: 8, lineHeight: '1.4' }}>{s.keluhan}</p>
                
                {s.displayType === 'perbaikan' && (
                  <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#74777f' }}>
                    <span>🔧 Mekanik: <strong>{s.mekanik?.nama || 'Belum ditunjuk'}</strong></span>
                    <span>📍 Lokasi: <strong>{s.lokasi}</strong></span>
                    {s.tgl_mulai && <span>📅 Mulai: {s.tgl_mulai}</span>}
                  </div>
                )}
              </div>

              {/* Tombol Aksi Kontrol Status untuk Admin */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                {s.displayType === 'perbaikan' && s.status === 'Waiting' && (
                  <button onClick={() => updateStatusPerbaikan(s.id, s.unit_id, 'In Progress')}
                    style={{ background: '#1a2b4b', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Mulai Perbaikan
                  </button>
                )}
                {s.displayType === 'perbaikan' && s.status === 'In Progress' && (
                  <button onClick={() => updateStatusPerbaikan(s.id, s.unit_id, 'Selesai')}
                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Selesai & Siap Jalan
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Input Gabungan (Perbaikan & Standby) */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Update Status Kondisi Unit</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#74777f' }}>×</button>
            </div>

            {/* Navigasi Pilihan Tipe Form */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#f3f4f6', padding: 4, borderRadius: 8 }}>
              <button onClick={() => setFormType('perbaikan')} type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', background: formType === 'perbaikan' ? '#fff' : 'transparent', boxShadow: formType === 'perbaikan' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: formType === 'perbaikan' ? '#1a2b4b' : '#74777f' }}>
                🔧 Unit Perbaikan
              </button>
              <button onClick={() => setFormType('standby')} type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', background: formType === 'standby' ? '#fff' : 'transparent', boxShadow: formType === 'standby' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: formType === 'standby' ? '#1a2b4b' : '#74777f' }}>
                🅿️ Unit Standby Pool
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Pilih Unit Mobil</label>
                <select style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif' }}
                  value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}>
                  <option value="">-- Pilih Nomor Plat / Nopol --</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.nopol} — {u.tipe}</option>)}
                </select>
              </div>

              {/* FORM KHUSUS PERBAIKAN POOL */}
              {formType === 'perbaikan' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Pilih Mekanik</label>
                    <select style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif' }}
                      value={form.mekanik_id} onChange={e => setForm(p => ({ ...p, mekanik_id: e.target.value }))}>
                      <option value="">-- Pilih Mekanik Yang Menangani --</option>
                      {mekaniks.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Jenis Perbaikan</label>
                      <select style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif' }}
                        value={form.jenis} onChange={e => setForm(p => ({ ...p, jenis: e.target.value }))}>
                        <option>Korektif</option>
                        <option>Preventif</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Lokasi Unit</label>
                      <select style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif' }}
                        value={form.lokasi} onChange={e => setForm(p => ({ ...p, lokasi: e.target.value }))}>
                        <option>Pool</option>
                        <option>Bengkel Luar</option>
                        <option>Lapangan</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Prioritas Perbaikan</label>
                    <select style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif' }}
                      value={form.prioritas} onChange={e => setForm(p => ({ ...p, prioritas: e.target.value }))}>
                      <option>Normal</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                </>
              )}

              {/* FORM KHUSUS STANDBY POOL */}
              {formType === 'standby' && (
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>Alasan Standby di Pool</label>
                  <select style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif' }}
                    value={form.alasan_standby} onChange={e => setForm(p => ({ ...p, alasan_standby: e.target.value }))}>
                    <option value="Standby Pool">Standby Ready (Normal)</option>
                    <option value="Standby Sopir Libur">Sopir Libur</option>
                    <option value="Standby Tunggu DO">Sedang Tunggu DO</option>
                    <option value="Standby Berangkat Sore">Sudah DO (Berangkat Sore)</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#44474e', textTransform: 'uppercase', marginBottom: 4 }}>
                  {formType === 'perbaikan' ? 'Detail Kerusakan & Perbaikan *' : 'Catatan / Keterangan Tambahan'}
                </label>
                <textarea rows={3}
                  style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat,sans-serif', resize: 'none', boxSizing: 'border-box' }}
                  value={form.keluhan} onChange={e => setForm(p => ({ ...p, keluhan: e.target.value }))}
                  placeholder={formType === 'perbaikan' ? "Contoh: Ganti kampas rem roda belakang kiri les privat..." : "Contoh: Supir izin ada urusan keluarga..."} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} type="button"
                  style={{ flex: 1, background: '#fff', color: '#1a2b4b', border: '1px solid #c4c7cf', borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Batal
                </button>
                <button onClick={handleSimpanStatus} disabled={saving} type="button"
                  style={{ flex: 1, background: saving ? '#6b7280' : '#1a2b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Menyimpan...' : 'Simpan Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}