// src/pages/admin/P2HPage.js
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { attachDriverInfo } from '../../lib/driverHelper';


const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');`;
const T = {
  navy:'#0F172A', blue:'#2170E4', green:'#059669', amber:'#D97706', red:'#BA1A1A',
  bg:'#F8F9FF', border:'#E2E8F0', text:'#0B1C30', textDim:'#76777D', textMid:'#45464D',
  head:"'Hanken Grotesk', sans-serif", body:"'Inter', sans-serif", mono:"'JetBrains Mono', monospace",
};

const SECTION_LABEL = { fluida:'Cairan & fluida', rem:'Rem', ban:'Ban', dokumen:'Surat-surat', apd_perlengkapan:'APD dan Perlengkapan', lain:'Item lain' };

const ITEM_LABEL = {
  oli_mesin:'Oli mesin', air_radiator:'Air radiator', minyak_rem:'Minyak rem',
  rem_depan:'Rem depan', rem_belakang:'Rem belakang',
  stnk:'STNK', kir:'KIR', sim:'SIM driver',
  rompi_safety:'Rompi safety', helm_safety:'Helm safety', ganjal:'Ganjal', ganjal_1:'Ganjal 1', ganjal_2:'Ganjal 2', seragam_mms:'Seragam MMS',
  dongkrak:'Dongkrak', kunci_roda:'Kunci roda', apar:'APAR', kotak_p3k:'Kotak P3K', segitiga_pengaman:'Segitiga pengaman',
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
const SEV_BADGE = {
  0: { bg:'#d1fae5', color:'#065f46' },
  1: { bg:'#fffbeb', color:'#92400e' },
  2: { bg:'#fee2e2', color:'#7f1d1d' },
};

// hasil sejak v7 nested per section ({fluida:{...}, rem:{...}, ...}); baris P2H
// sebelum v7 masih flat ({key: 'ok'|'tidak_ok'}). Fungsi ini membedakan keduanya.
function isNestedHasil(hasil) {
  if (!hasil || typeof hasil !== 'object') return false;
  return ['fluida', 'rem', 'ban', 'dokumen', 'apd_perlengkapan', 'lain'].some(k => hasil[k] && typeof hasil[k] === 'object');
}

// Fallback label kalau ketemu data lama yang isinya string mentah, bukan object {value,label,severity}
const VALUE_LABEL = {
  normal:'Normal', berkurang:'Berkurang', kritis:'Kritis', kosong:'Kosong',
  kurang:'Kurang', bocor:'Bocor', gundul:'Gundul',
  ada:'Ada', rusak:'Rusak', tidak_ada:'Tidak ada', kadaluarsa:'Kadaluarsa',
  ok:'OK', nok:'NOK',
};
const NETRAL_BADGE = { bg:'#f1f0ea', color:'#5f5e5a' }; // dipakai saat severity data lama tidak diketahui

function checklistToExport(hasil) {
  if (!hasil || typeof hasil !== 'object') return {};
  const out = {};
  if (!isNestedHasil(hasil)) {
    Object.entries(hasil).forEach(([key, value]) => {
      out[ITEM_LABEL[key] || key] = VALUE_LABEL[value] || value || '';
    });
    return out;
  }
  Object.entries(hasil).forEach(([section, items]) => {
    if (!items || typeof items !== 'object') return;
    Object.entries(items).forEach(([key, raw]) => {
      const value = raw && typeof raw === 'object' ? (raw.label || raw.value) : raw;
      out[`${SECTION_LABEL[section] || section} - ${ITEM_LABEL[key] || key}`] = value || '';
    });
  });
  return out;
}

function HasilBreakdown({ hasil }) {
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
                const c = secId === 'dokumen' || secId === 'apd_perlengkapan'
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

export default function P2HPage() {
  const [list, setList]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('rekap');
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStart, setReportStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().slice(0,10));
  const [reportUnit, setReportUnit] = useState('');
  const [reportDriver, setReportDriver] = useState('');
  const [reportStatus, setReportStatus] = useState('');

  const today = new Date().toISOString().slice(0,10);

  useEffect(() => {
    load();
    const ch = supabase.channel('p2h-ch')
      .on('postgres_changes', { event:'*', schema:'public', table:'p2h' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    if (activeTab === 'laporan') loadReport();
  }, [activeTab, reportStart, reportEnd]);

  async function load() {
    const { data } = await supabase
      .from('p2h')
      .select('*, unit:units(nopol,tipe)')
      .eq('tanggal', today)
      .order('created_at', { ascending:false });
    const withDriver = await attachDriverInfo(data || [], 'driver_id');
    setList(withDriver);
    setLoad(false);
  }

  async function loadReport() {
    setReportLoading(true);
    const { data } = await supabase
      .from('p2h')
      .select('*, unit:units(nopol,tipe)')
      .gte('tanggal', reportStart)
      .lte('tanggal', reportEnd)
      .order('tanggal', { ascending:false })
      .order('created_at', { ascending:false });
    const withDriver = await attachDriverInfo(data || [], 'driver_id');
    setReportRows(withDriver);
    setReportLoading(false);
  }

  const reportUnits = useMemo(() => [...new Set(reportRows.map(row => row.unit?.nopol).filter(Boolean))].sort(), [reportRows]);
  const reportDrivers = useMemo(() => [...new Set(reportRows.map(row => row.driver?.nama).filter(Boolean))].sort(), [reportRows]);
  const filteredReport = useMemo(() => reportRows.filter(row =>
    (!reportUnit || row.unit?.nopol === reportUnit) &&
    (!reportDriver || row.driver?.nama === reportDriver) &&
    (!reportStatus || row.status === reportStatus)
  ), [reportRows, reportUnit, reportDriver, reportStatus]);

  function exportReport() {
    if (!filteredReport.length) return;
    const rows = filteredReport.map(row => ({
      Tanggal: row.tanggal,
      Waktu: row.created_at ? new Date(row.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '',
      'No. Polisi': row.unit?.nopol || '',
      'Tipe Unit': row.unit?.tipe || '',
      Driver: row.driver?.nama || '',
      Status: row.status || '',
      'KM Saat P2H': row.km_saat_p2h ?? '',
      Catatan: row.catatan || '',
      ...checklistToExport(row.hasil),
    }));
    const reportSheet = XLSX.utils.json_to_sheet(rows);
    reportSheet['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.min(Math.max(key.length + 2, 14), 32) }));
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Laporan P2H - MMS FleetCare'],
      ['Periode', `${reportStart} s.d. ${reportEnd}`],
      ['Jumlah data', filteredReport.length],
      ['Layak', filteredReport.filter(row => row.status === 'LAYAK').length],
      ['Layak dengan catatan', filteredReport.filter(row => row.status === 'LAYAK DENGAN CATATAN').length],
      ['Tidak layak', filteredReport.filter(row => row.status === 'TIDAK LAYAK').length],
    ]);
    summarySheet['!cols'] = [{ wch:26 }, { wch:30 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');
    XLSX.utils.book_append_sheet(workbook, reportSheet, 'Laporan P2H');
    XLSX.writeFile(workbook, `laporan-p2h-${reportStart}-${reportEnd}.xlsx`);
  }

  const sudah    = list.filter(p => p.status !== 'BELUM').length;
  const belum    = list.filter(p => p.status === 'BELUM').length;
  const nTidak   = list.filter(p => p.status === 'TIDAK LAYAK').length;
  const nCatatan = list.filter(p => p.status === 'LAYAK DENGAN CATATAN').length;

  const statusColor = {
    'LAYAK':                { bg:'#d1fae5', color:'#065f46' },
    'LAYAK DENGAN CATATAN': { bg:'#fffbeb', color:'#92400e' },
    'TIDAK LAYAK':          { bg:'#fee2e2', color:'#7f1d1d' },
    'BELUM':                { bg:'#f3f4f6', color:'#374151' },
  };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:T.body }}>Memuat...</div>;

  return (
    <div style={{ fontFamily:T.body }}>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Manajemen P2H</h2>
      <p style={{ fontSize:11, color:'#74777f', marginBottom:16 }}>Rekap harian · {new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p>

      <div style={{ display:'flex', gap:8, marginBottom:16, borderBottom:`1px solid ${T.border}` }}>
        {[
          { id:'rekap', label:'Rekap Hari Ini' },
          { id:'laporan', label:'Laporan P2H' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ background:'none', border:'none', borderBottom:activeTab===tab.id?`2px solid ${T.blue}`:'2px solid transparent', color:activeTab===tab.id?T.blue:T.textDim, padding:'8px 10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:T.body }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'rekap' && <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'Total Terjadwal', val:list.length,  color:T.navy },
          { label:'Sudah P2H',       val:sudah,         color:'#065f46' },
          { label:'Belum P2H',       val:belum,         color:'#7f1d1d' },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, padding:14, textAlign:'center' }}>
            <p style={{ fontSize:11, color:'#74777f', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{c.label}</p>
            <p style={{ fontSize:28, fontWeight:700, color:c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {belum > 0 && (
        <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#9f1239', fontWeight:600 }}>
          ⚠ {belum} unit belum P2H hari ini
        </div>
      )}
      {nTidak > 0 && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#7f1d1d', fontWeight:600 }}>
          ⛔ {nTidak} unit dinyatakan TIDAK LAYAK
        </div>
      )}
      {nCatatan > 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e', fontWeight:600 }}>
          ⚠ {nCatatan} unit LAYAK DENGAN CATATAN — perlu ditindaklanjuti / ditelepon
        </div>
      )}

      <div style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:T.bg, borderBottom:'1px solid #ebeced' }}>
              {['No Pol','Driver','Waktu','Status','Aksi'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:'#c4c7cf' }}>Belum ada data P2H hari ini</td></tr>
            ) : list.map(p => {
              const sc = statusColor[p.status] || statusColor['BELUM'];
              return (
                <tr key={p.id} style={{ borderBottom:'1px solid #f1f2f3' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseOut={e  => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding:'10px 14px', fontWeight:700, fontFamily:T.mono }}>{p.unit?.nopol}</td>
                  <td style={{ padding:'10px 14px', color:'#44474e' }}>{p.driver?.nama}</td>
                  <td style={{ padding:'10px 14px', color:'#74777f' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{p.status}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {p.status !== 'BELUM' && (
                      <button onClick={() => setDetail(p)}
                        style={{ background:'none', border:'1px solid #c4c7cf', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer', color:T.navy, fontWeight:600 }}>
                        Detail
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      </>}

      {activeTab === 'laporan' && (
        <div>
          <div style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14 }}>
              <div>
                <h3 style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:3 }}>Laporan P2H</h3>
                <p style={{ fontSize:11, color:T.textDim }}>Filter hasil P2H lalu unduh dalam format Excel.</p>
              </div>
              <button onClick={exportReport} disabled={!filteredReport.length}
                style={{ background:filteredReport.length?T.green:'#9CA3AF', color:'#fff', border:'none', borderRadius:7, padding:'9px 12px', fontSize:12, fontWeight:700, cursor:filteredReport.length?'pointer':'not-allowed', fontFamily:T.body, whiteSpace:'nowrap' }}>
                Export Excel
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0, 1fr))', gap:10 }}>
              <label style={{ fontSize:10, color:T.textDim, fontWeight:700 }}>TANGGAL MULAI
                <input type="date" value={reportStart} max={reportEnd} onChange={e => setReportStart(e.target.value)} style={{ width:'100%', marginTop:5, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 8px', fontFamily:T.body, fontSize:12 }}/>
              </label>
              <label style={{ fontSize:10, color:T.textDim, fontWeight:700 }}>TANGGAL SELESAI
                <input type="date" value={reportEnd} min={reportStart} max={today} onChange={e => setReportEnd(e.target.value)} style={{ width:'100%', marginTop:5, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 8px', fontFamily:T.body, fontSize:12 }}/>
              </label>
              <label style={{ fontSize:10, color:T.textDim, fontWeight:700 }}>UNIT
                <select value={reportUnit} onChange={e => setReportUnit(e.target.value)} style={{ width:'100%', marginTop:5, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 8px', background:'#fff', fontFamily:T.body, fontSize:12 }}>
                  <option value="">Semua unit</option>{reportUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <label style={{ fontSize:10, color:T.textDim, fontWeight:700 }}>DRIVER
                <select value={reportDriver} onChange={e => setReportDriver(e.target.value)} style={{ width:'100%', marginTop:5, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 8px', background:'#fff', fontFamily:T.body, fontSize:12 }}>
                  <option value="">Semua driver</option>{reportDrivers.map(driver => <option key={driver} value={driver}>{driver}</option>)}
                </select>
              </label>
              <label style={{ fontSize:10, color:T.textDim, fontWeight:700 }}>STATUS
                <select value={reportStatus} onChange={e => setReportStatus(e.target.value)} style={{ width:'100%', marginTop:5, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 8px', background:'#fff', fontFamily:T.body, fontSize:12 }}>
                  <option value="">Semua status</option><option value="LAYAK">Layak</option><option value="LAYAK DENGAN CATATAN">Layak dengan catatan</option><option value="TIDAK LAYAK">Tidak layak</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${T.border}`, fontSize:12, color:T.textDim }}>
              {reportLoading ? 'Memuat laporan...' : `${filteredReport.length} data P2H ditemukan`}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:T.bg, borderBottom:'1px solid #ebeced' }}>
                {['Tanggal','No Pol','Driver','Status','KM','Aksi'].map(h => <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {!reportLoading && filteredReport.length === 0 ? <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#c4c7cf' }}>Tidak ada data P2H pada filter ini</td></tr> : filteredReport.map(row => {
                  const sc = statusColor[row.status] || statusColor.BELUM;
                  return <tr key={row.id} style={{ borderBottom:'1px solid #f1f2f3' }}>
                    <td style={{ padding:'10px 14px', color:T.textMid }}>{new Date(`${row.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
                    <td style={{ padding:'10px 14px', fontWeight:700, fontFamily:T.mono }}>{row.unit?.nopol || '—'}</td>
                    <td style={{ padding:'10px 14px', color:T.textMid }}>{row.driver?.nama || '—'}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{row.status}</span></td>
                    <td style={{ padding:'10px 14px', color:T.textMid }}>{row.km_saat_p2h?.toLocaleString('id-ID') || '—'}</td>
                    <td style={{ padding:'10px 14px' }}><button onClick={() => setDetail(row)} style={{ background:'none', border:'1px solid #c4c7cf', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer', color:T.navy, fontWeight:600 }}>Detail</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {detail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:400, maxHeight:'calc(100vh - 32px)', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, padding:'20px 20px 16px', position:'sticky', top:0, zIndex:1, background:'#fff', borderBottom:`1px solid ${T.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>Detail P2H — {detail.unit?.nopol}</h3>
              <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#74777f' }}>×</button>
            </div>
            <div style={{ padding:'0 20px 20px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12 }}>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>Driver</p><p style={{ fontWeight:700 }}>{detail.driver?.nama}</p></div>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>Status</p>
                <span style={{ background: statusColor[detail.status]?.bg, color: statusColor[detail.status]?.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{detail.status}</span>
              </div>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>KM Saat P2H</p><p style={{ fontWeight:700 }}>{detail.km_saat_p2h?.toLocaleString('id-ID') || '—'} km</p></div>
              <div><p style={{ color:'#74777f', marginBottom:2 }}>Tanggal</p><p style={{ fontWeight:700 }}>{detail.tanggal}</p></div>
            </div>
            {detail.catatan && <div style={{ marginTop:12, background:T.bg, borderRadius:8, padding:10, fontSize:12, color:'#44474e' }}>{detail.catatan}</div>}
            <HasilBreakdown hasil={detail.hasil} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
