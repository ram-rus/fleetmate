// src/pages/admin/LaporanBaruTab.js
// Tab "Laporan Baru" — REVIEW LAPORAN KERUSAKAN DRIVER (COMPATIBLE WITH V5.0)

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Style Status yang disesuaikan dengan skema database v5.0
const STATUS_STYLE = {
  'Dilaporkan':                       { bg:'#f3f4f6', color:'#374151' },
  'Menunggu Approval Storing':        { bg:'#fee2e2', color:'#7f1d1d' },
  'Menunggu Approval Pulang ke Pool': { bg:'#fef3c7', color:'#92400e' },
  'Menunggu Keputusan Pengurus':      { bg:'#fef3c7', color:'#92400e' },
  'Storing Disetujui':                { bg:'#d1fae5', color:'#065f46' },
  'Storing Luar Disetujui':           { bg:'#ede9fe', color:'#4c1d95' },
  'Pulang ke Pool Disetujui':         { bg:'#dbeafe', color:'#1e3a8a' },
  'Lanjut Perjalanan':                { bg:'#f3f4f6', color:'#374151' },
  'Selesai':                          { bg:'#d1fae5', color:'#065f46' },
};

export function LaporanBaruTab({ onApproved }) {
  const { profile }             = useAuth();
  const [list, setList]         = useState([]);
  const [loading, setLoad]      = useState(true);
  const [detail, setDetail]     = useState(null);
  const [filter, setFilter]     = useState('Perlu Tindakan');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoad(true);
    try {
      let q = supabase
        .from('laporan_kerusakan')
        .select('*, unit:units(nopol,tipe), driver:users!laporan_kerusakan_driver_id_fkey(nama)');

      if (filter === 'Perlu Tindakan') {
        // Menangkap semua status gres dari driver yang membutuhkan approval admin v5.0
        q = q.in('status', ['Dilaporkan', 'Menunggu Approval Storing', 'Menunggu Approval Pulang ke Pool', 'Menunggu Keputusan Pengurus']);
      } else {
        q = q.not('status', 'in', '("Dilaporkan","Menunggu Approval Storing","Menunggu Approval Pulang ke Pool","Menunggu Keputusan Pengurus")');
      }

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      setList(data || []);
    } catch (err) {
      toast.error('Gagal memuat laporan: ' + err.message);
    } finally {
      setLoad(false);
    }
  }

  // Handle keputusan Admin v5.0 (Membuat data di tabel public.perbaikan)
  async function handleKeputusan(item, tindakan) {
    setSaving(true);
    try {
      let statusLaporan = 'Selesai';
      let tipePerbaikan = 'perbaikan_pool';

      // Logika penentuan tipe berdasarkan tindakan di tombol admin
      if (tindakan === 'approve_storing') {
        statusLaporan = 'Storing Disetujui';
        tipePerbaikan = 'storing_internal';
      } else if (tindakan === 'storing_luar') {
        statusLaporan = 'Storing Luar Disetujui';
        tipePerbaikan = 'storing_luar';
      } else if (tindakan === 'pulang_ke_pool') {
        statusLaporan = 'Pulang ke Pool Disetujui';
        tipePerbaikan = 'pulang_ke_pool';
      } else if (tindakan === 'lanjut_jalan') {
        statusLaporan = 'Lanjut Perjalanan';
        tipePerbaikan = 'pulang_ke_pool'; // fallback tracking
      }

      // 1. Insert data ke tabel pusat baru: public.perbaikan
      const { data: pbr, error: errPbr } = await supabase
        .from('perbaikan')
        .insert([{
          unit_id: item.unit_id,
          driver_id: item.driver_id,
          laporan_id: item.id,
          sumber: 'driver_app',
          tipe: tipePerbaikan,
          status: (tindakan === 'lanjut_jalan' || tindakan === 'pulang_ke_pool') ? 'Selesai' : 'Disetujui',
          deskripsi: item.deskripsi_kerusakan,
          km_kendaraan: item.km_kendaraan,
          koordinat_lat: item.koordinat_lat,
          koordinat_lng: item.koordinat_lng,
          tgl_mulai: new Date().toISOString(),
          dibuat_oleh: profile?.id
        }])
        .select()
        .single();

      if (errPbr) throw errPbr;

      // 2. Update tabel laporan_kerusakan asal driver
      const { error: errLap } = await supabase
        .from('laporan_kerusakan')
        .update({
          status: statusLaporan,
          perbaikan_id: pbr.id
        })
        .eq('id', item.id);

      if (errLap) throw errLap;

      // 3. Update status unit di tabel units jika diperlukan
      let statusUnit = 'Standby Pool';
      if (tindakan === 'approve_storing' || tindakan === 'storing_luar') statusUnit = 'Storing';
      if (tindakan === 'lanjut_jalan') statusUnit = 'Sedang Jalan';
      
      await supabase
        .from('units')
        .update({ status: statusUnit })
        .eq('id', item.unit_id);

      toast.success('Keputusan berhasil disimpan!');
      setDetail(null);
      load();
      if (onApproved) onApproved();
    } catch (err) {
      toast.error('Gagal memproses keputusan: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {['Perlu Tindakan', 'Riwayat'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setDetail(null); }}
            style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: filter === f ? '#1a2b4b' : '#f3f4f6', color: filter === f ? '#fff' : '#44474e', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#74777f', padding: 20 }}>Mengecek laporan baru...</p>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#c4c7cf', fontSize: 13, background: '#fff', borderRadius: 10, border: '1px solid #ebeced' }}>Tidak ada laporan</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(item => {
            const st = STATUS_STYLE[item.status] || { bg: '#f3f4f6', color: '#374151' };
            return (
              <div key={item.id} onClick={() => setDetail(item)}
                style={{ background: '#fff', border: '1px solid #ebeced', borderRadius: 10, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1e' }}>{item.unit?.nopol}</span>
                    <span style={{ fontSize: 11, color: '#74777f' }}>• {item.unit?.tipe}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#44474e', margin: '4px 0' }}>Driver: <b>{item.driver?.nama || '—'}</b></p>
                  <p style={{ fontSize: 11, color: '#74777f' }}>Kendala: {item.deskripsi_kerusakan || '-'}</p>
                </div>
                <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail & Aksi Penanganan */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #ebeced' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Detail Laporan Kendala</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
                <tbody>
                  <tr><td style={{ padding: '6px 0', color: '#74777f' }}>No. Polisi</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.unit?.nopol}</td></tr>
                  <tr><td style={{ padding: '6px 0', color: '#74777f' }}>Driver</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.driver?.nama}</td></tr>
                  <tr><td style={{ padding: '6px 0', color: '#74777f' }}>KM Kendaraan</td><td style={{ fontWeight: 700, textAlign: 'right' }}>{detail.km_kendaraan?.toLocaleString('id-ID')} km</td></tr>
                  <tr><td style={{ padding: '6px 0', color: '#74777f' }}>Opsi Driver</td><td style={{ fontWeight: 700, textAlign: 'right', color: '#ba1a1a' }}>{detail.pilihan_driver === 'minta_storing' ? '🆘 MINTA STORING' : '🏠 PULANG POOL'}</td></tr>
                </tbody>
              </table>

              <div style={{ background: '#f3f4f6', borderRadius: 8, padding: 12, fontSize: 12, marginBottom: 16 }}>
                <p style={{ fontWeight: 700, marginBottom: 4, color: '#1a1c1e' }}>Deskripsi Kerusakan:</p>
                <p style={{ color: '#44474e', lineHeight: 1.4 }}>{detail.deskripsi_kerusakan}</p>
              </div>

              {/* Tombol Opsi Dinamis Sesuai Permintaan v5 */}
              {['Dilaporkan', 'Menunggu Approval Storing', 'Menunggu Approval Pulang ke Pool', 'Menunggu Keputusan Pengurus'].includes(detail.status) && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', marginBottom: 10 }}>Pilih Tindakan Solusi Admin:</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => handleKeputusan(detail, 'approve_storing')} disabled={saving}
                      style={{ background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🛠️ APPROVE STORING INTERNAL (Mekanik Sendiri)
                    </button>
                    
                    <button onClick={() => handleKeputusan(detail, 'storing_luar')} disabled={saving}
                      style={{ background: '#6b21a8', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🚀 PERBAIKAN MEKANIK LUAR
                    </button>
                    
                    <button onClick={() => handleKeputusan(detail, 'pulang_ke_pool')} disabled={saving}
                      style={{ background: '#b45309', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🏠 SETUJUI PULANG KE POOL
                    </button>

                    <button onClick={() => handleKeputusan(detail, 'lanjut_jalan')} disabled={saving}
                      style={{ background: '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🛑 TOLAK (LANJUTKAN PERJALANAN)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}