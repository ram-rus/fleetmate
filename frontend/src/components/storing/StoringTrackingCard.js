import React from 'react';
import StoringTimeline from './StoringTimeline';
import { formatJadwal, getProgresStyle } from '../../lib/storingConstants';

/** Card tracking storing aktif — tampil di Home driver */
export default function StoringTrackingCard({ storing }) {
  if (!storing || storing.status === 'Selesai') return null;

  const ps = getProgresStyle(storing.progres);
  const mekanikNama = storing.mekanik?.nama;
  const mekanikHp   = storing.mekanik?.no_hp;
  const ditugaskan  = !!storing.mekanik_id;

  return (
    <div style={{
      background: '#fff', borderRadius: 16, overflow: 'hidden',
      border: '1px solid #fcd34d', marginBottom: 16,
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ background: '#1a2b4b', padding: '14px 16px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>STORING AKTIF</p>
            <p style={{ fontSize: 16, fontWeight: 800 }}>{storing.unit?.nopol || '—'}</p>
          </div>
          <span style={{ background: ps.bg, color: ps.color, padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
            {ps.icon} {ps.value}
          </span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Info mekanik */}
        {ditugaskan ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 8 }}>
              Penugasan Mekanik
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: '#74777f' }}>Mekanik</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>👷 {mekanikNama}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: '#74777f' }}>Berangkat</p>
                <p style={{ fontSize: 13, fontWeight: 700 }}>🚗 {formatJadwal(storing.tgl_berangkat, storing.jam_berangkat)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: '#74777f' }}>Estimasi Tiba</p>
                <p style={{ fontSize: 13, fontWeight: 700 }}>📍 {formatJadwal(storing.tgl_berangkat, storing.jam_estimasi_tiba)}</p>
              </div>
              {storing.lokasi && (
                <div>
                  <p style={{ fontSize: 10, color: '#74777f' }}>Lokasi</p>
                  <p style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{storing.lokasi.slice(0, 40)}{storing.lokasi.length > 40 ? '…' : ''}</p>
                </div>
              )}
            </div>
            {storing.catatan_driver && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #bbf7d0' }}>
                <p style={{ fontSize: 10, color: '#166534', fontWeight: 700 }}>Catatan Pengurus:</p>
                <p style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>{storing.catatan_driver}</p>
              </div>
            )}
            {mekanikHp && (
              <a href={`tel:${mekanikHp}`}
                style={{
                  display: 'block', marginTop: 12, background: '#166534', color: '#fff',
                  textAlign: 'center', borderRadius: 10, padding: '11px 0',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                📞 Hubungi Mekanik — {mekanikHp}
              </a>
            )}
          </div>
        ) : (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: 14, marginBottom: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 20, marginBottom: 6 }}>⏳</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Menunggu Penugasan Mekanik</p>
            <p style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
              Storing sudah disetujui. Pengurus sedang menugaskan mekanik ke lokasi Anda.
            </p>
          </div>
        )}

        {/* Timeline */}
        <p style={{ fontSize: 10, fontWeight: 700, color: '#74777f', textTransform: 'uppercase', marginBottom: 10 }}>
          Progres Realtime
        </p>
        <StoringTimeline progres={storing.progres || 'Menunggu Mekanik'} compact/>
      </div>
    </div>
  );
}
