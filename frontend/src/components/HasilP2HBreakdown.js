// src/components/HasilP2HBreakdown.js
// Komponen bersama untuk menampilkan rincian checklist P2H (per section,
// dengan warna severity). Dipakai di Manajemen P2H (src/pages/admin/P2HPage.js)
// dan Overview (src/pages/admin/OverviewPage.js) — jangan duplikasi definisi
// ini di file lain, import dari sini supaya kalau ada perbaikan cukup di satu
// tempat.
import React from 'react';

export const SECTION_LABEL = { fluida:'Cairan & fluida', rem:'Rem', ban:'Ban', dokumen:'Surat-surat', apd_perlengkapan:'APD & Perlengkapan', lain:'Item lain' };

export const ITEM_LABEL = {
  oli_mesin:'Oli mesin', air_radiator:'Air radiator', minyak_rem:'Minyak rem',
  rem_depan:'Rem depan', rem_belakang:'Rem belakang',
  stnk:'STNK', kir:'KIR', sim:'SIM driver',
  rompi_safety:'Rompi safety', helm_safety:'Helm safety', ganjal_1:'Ganjal 1', ganjal_2:'Ganjal 2', seragam_mms:'Seragam MMS', dongkrak:'Dongkrak', kunci_roda:'Kunci roda', apar:'APAR', kotak_p3k:'Kotak P3K', segitiga_pengaman:'Segitiga pengaman',
  lampu_depan:'Lampu depan', lampu_belakang:'Lampu belakang', lampu_sein:'Lampu sein',
  wiper:'Wiper / kaca', klakson:'Klakson', kebersihan:'Kebersihan kabin',
  depan_kiri:'Depan kiri', depan_kanan:'Depan kanan',
  engkel_kiri:'Engkel kiri', engkel_kanan:'Engkel kanan',
  engkel_kiri_luar:'Engkel kiri luar', engkel_kiri_dalam:'Engkel kiri dalam',
  engkel_kanan_luar:'Engkel kanan luar', engkel_kanan_dalam:'Engkel kanan dalam',
  tronton_kiri_luar:'Tronton kiri luar', tronton_kiri_dalam:'Tronton kiri dalam',
  tronton_kanan_luar:'Tronton kanan luar', tronton_kanan_dalam:'Tronton kanan dalam',
  ban_stip:'Ban stip',
};

// 0 = OK/hijau, 1 = perhatian/kuning, 2 = bahaya/merah — sama seperti di P2HPage driver
export const SEV_BADGE = {
  0: { bg:'#d1fae5', color:'#065f46' },
  1: { bg:'#fffbeb', color:'#92400e' },
  2: { bg:'#fee2e2', color:'#7f1d1d' },
};

// hasil sejak v7 nested per section ({fluida:{...}, rem:{...}, ...}); baris P2H
// sebelum v7 masih flat ({key: 'ok'|'tidak_ok'}). Fungsi ini membedakan keduanya.
export function isNestedHasil(hasil) {
  if (!hasil || typeof hasil !== 'object') return false;
  return ['fluida', 'rem', 'ban', 'dokumen', 'apd_perlengkapan', 'lain'].some(k => hasil[k] && typeof hasil[k] === 'object');
}

// Fallback label kalau ketemu data lama yang isinya string mentah, bukan object {value,label,severity}
export const VALUE_LABEL = {
  normal:'Normal', berkurang:'Berkurang', kritis:'Kritis', kosong:'Kosong',
  kurang:'Kurang', bocor:'Bocor', gundul:'Gundul',
  ada:'Ada', tidak_ada:'Tidak ada', kadaluarsa:'Kadaluarsa', rusak:'Rusak',
  ok:'OK', nok:'NOK',
};
export const NETRAL_BADGE = { bg:'#f1f0ea', color:'#5f5e5a' }; // dipakai saat severity data lama tidak diketahui

export default function HasilBreakdown({ hasil }) {
  if (!hasil || Object.keys(hasil).length === 0) return null;

  if (!isNestedHasil(hasil)) {
    // Format lama (P2H sebelum v7): flat {key: 'ok'|'tidak_ok'}
    return (
      <div style={{ marginTop:12 }}>
        <p style={{ fontSize:11, color:'#74777f', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Checklist (format lama)</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
          {Object.entries(hasil).map(([k, v]) => {
            const ok = v === 'ok';
            const c = ok ? SEV_BADGE[0] : SEV_BADGE[2];
            return (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, padding:'6px 8px', border:'1px solid #ebeced', borderRadius:6 }}>
                <span style={{ color:'#44474e' }}>{ITEM_LABEL[k] || k}</span>
                <span style={{ background:c.bg, color:c.color, padding:'1px 8px', borderRadius:12, fontWeight:700 }}>{ok ? 'OK' : 'NOK'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop:12 }}>
      {['fluida', 'rem', 'ban', 'dokumen', 'apd_perlengkapan', 'lain'].map(secId => {
        const items = hasil[secId];
        if (!items || Object.keys(items).length === 0) return null;
        return (
          <div key={secId} style={{ marginBottom:10 }}>
            <p style={{ fontSize:11, color:'#74777f', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{SECTION_LABEL[secId] || secId}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
              {Object.entries(items).map(([key, raw]) => {
                const label = ITEM_LABEL[key] || key;
                const isObj = raw && typeof raw === 'object';
                const rawValue = isObj ? raw.value : raw;
                const valLabel = isObj ? (raw.label || raw.value || '—') : (VALUE_LABEL[raw] || raw || '—');
                const c = (secId === 'dokumen' || secId === 'apd_perlengkapan')
                  ? (rawValue === 'ada' ? SEV_BADGE[0] : SEV_BADGE[2])
                  : isObj
                    ? (SEV_BADGE[raw.severity] ?? SEV_BADGE[0])
                    : NETRAL_BADGE; // data lama (nested-string) — severity tidak tercatat, jangan nebak warna
                return (
                  <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, padding:'6px 8px', border:'1px solid #ebeced', borderRadius:6 }}>
                    <span style={{ color:'#44474e' }}>{label}</span>
                    <span style={{ background:c.bg, color:c.color, padding:'1px 8px', borderRadius:12, fontWeight:700 }}>{valLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
