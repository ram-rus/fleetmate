// src/pages/admin/MekanikPage.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function MekanikPage() {
  const [mekaniks, setMekaniks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: '', no_hp: '', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadMekanik(); }, []);

  async function loadMekanik() {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').eq('role', 'mekanik').order('nama');
    setMekaniks(data || []);
    setLoading(false);
  }

  async function handleTambah() {
    if (!form.nama.trim()) { toast.error('Nama mekanik wajib diisi'); return; }
    setSaving(true);
    try {
      // Karena ini ditambahkan manual oleh Admin, kita generate ID UUID dummy untuk auth relasi
      const dummyId = crypto.randomUUID(); 
      const { error } = await supabase.from('users').insert({
        id: dummyId,
        nama: form.nama,
        role: 'mekanik',
        no_hp: form.no_hp,
        is_active: form.is_active
      });

      if (error) throw error;
      toast.success('Mekanik baru berhasil didaftarkan!');
      setShowForm(false);
      setForm({ nama: '', no_hp: '', is_active: true });
      loadMekanik();
    } catch (e) {
      toast.error('Gagal menambah mekanik: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Montserrat' }}>Memuat data mekanik...</div>;

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Database Mekanik</h2>
          <p style={{ fontSize: 11, color: '#74777f' }}>Kelola daftar montir dan mekanik operasional pool</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: '#1a2b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + Tambah Mekanik
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #ebeced' }}>
              <th style={{ padding: '12px 16px' }}>Nama Mekanik</th>
              <th style={{ padding: '12px 16px' }}>No. HP / WhatsApp</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {mekaniks.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#c4c7cf' }}>Belum ada data mekanik</td></tr>
            ) : mekaniks.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #ebeced' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.nama}</td>
                <td style={{ padding: '12px 16px' }}>{m.no_hp || '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: m.is_active ? '#d1fae5' : '#fee2e2', color: m.is_active ? '#065f46' : '#991b1b', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                    {m.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Tambah Mekanik Baru</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Nama Lengkap</label>
                <input type="text" style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12 }} value={form.nama} onChange={e => setForm(p => ({ ...p, nama: e.target.value }))} placeholder="Nama Mekanik" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>No. HP / WhatsApp</label>
                <input type="text" style={{ width: '100%', border: '1px solid #c4c7cf', borderRadius: 8, padding: '8px 10px', fontSize: 12 }} value={form.no_hp} onChange={e => setForm(p => ({ ...p, no_hp: e.target.value }))} placeholder="Contoh: 08123456789" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#fff', border: '1px solid #c4c7cf', borderRadius: 8, padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>Batal</button>
                <button onClick={handleTambah} disabled={saving} style={{ flex: 1, background: '#1a2b4b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}