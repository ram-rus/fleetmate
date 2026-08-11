// src/pages/admin/P2HPage.js
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { attachDriverInfo } from '../../lib/driverHelper';
import HasilBreakdown from '../../components/HasilP2HBreakdown';

const T = {
  navy:'#0F172A', blue:'#2170E4', bg:'#F8F9FF', border:'#E2E8F0',
  body:"'Inter', sans-serif", mono:"'JetBrains Mono', monospace",
};

const statusColor = {
  'LAYAK': { bg:'#d1fae5', color:'#065f46' },
  'LAYAK DENGAN CATATAN': { bg:'#fffbeb', color:'#92400e' },
  'TIDAK LAYAK': { bg:'#fee2e2', color:'#7f1d1d' },
  'BELUM': { bg:'#f3f4f6', color:'#374151' },
};

function statusBadge(status) {
  const color = statusColor[status] || statusColor.BELUM;
  return <span style={{ background:color.bg, color:color.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{status || 'BELUM'}</span>;
}

function formatDate(date) {
  return date ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
}

function hasilColumns(rows) {
  const keys = new Set();
  rows.forEach(row => {
    const hasil = row.hasil;
    if (!hasil || typeof hasil !== 'object') return;
    Object.entries(hasil).forEach(([section, items]) => {
      if (items && typeof items === 'object' && !Array.isArray(items) && !('value' in items)) {
        Object.keys(items).forEach(item => keys.add(`${section} - ${item}`));
      } else keys.add(section);
    });
  });
  return [...keys];
}

function hasilValue(hasil, column) {
  if (!hasil || typeof hasil !== 'object') return '';
  const separator = column.indexOf(' - ');
  const value = separator > -1
    ? hasil[column.slice(0, separator)]?.[column.slice(separator + 3)]
    : hasil[column];
  if (value && typeof value === 'object') return value.label || value.value || value.status || '';
  return value || '';
}

export default function P2HPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [activeTab, setActiveTab] = useState('rekap');
  const [list, setList] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reportStart, setReportStart] = useState(monthStart);
  const [reportEnd, setReportEnd] = useState(today);
  const [unitFilter, setUnitFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function loadToday() {
    const { data } = await supabase.from('p2h').select('*, unit:units(nopol,tipe)').eq('tanggal', today).order('created_at', { ascending:false });
    setList(await attachDriverInfo(data || [], 'driver_id'));
    setLoading(false);
  }

  async function loadReport() {
    if (!reportStart || !reportEnd || reportStart > reportEnd) return;
    setReportLoading(true);
    const { data } = await supabase.from('p2h').select('*, unit:units(nopol,tipe)').gte('tanggal', reportStart).lte('tanggal', reportEnd).order('tanggal', { ascending:false }).order('created_at', { ascending:false });
    setReportRows(await attachDriverInfo(data || [], 'driver_id'));
    setReportLoading(false);
  }

  useEffect(() => {
    loadToday();
    const channel = supabase.channel('p2h-admin-channel').on('postgres_changes', { event:'*', schema:'public', table:'p2h' }, () => {
      loadToday();
      if (activeTab === 'laporan') loadReport();
    }).subscribe();
    return () => supabase.removeChannel(channel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'laporan') loadReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportStart, reportEnd]);

  const filteredReport = useMemo(() => reportRows.filter(row => (
    (!unitFilter || String(row.unit_id) === unitFilter) &&
    (!driverFilter || String(row.driver_id) === driverFilter) &&
    (!statusFilter || row.status === statusFilter)
  )), [reportRows, unitFilter, driverFilter, statusFilter]);

  const unitOptions = useMemo(() => [...new Map(reportRows.filter(row => row.unit?.nopol).map(row => [row.unit_id, row.unit])).entries()], [reportRows]);
  const driverOptions = useMemo(() => [...new Map(reportRows.filter(row => row.driver?.nama).map(row => [row.driver_id, row.driver])).entries()], [reportRows]);
  const sudah = list.filter(row => row.status !== 'BELUM').length;
  const belum = list.filter(row => row.status === 'BELUM').length;
  const nTidak = list.filter(row => row.status === 'TIDAK LAYAK').length;
  const nCatatan = list.filter(row => row.status === 'LAYAK DENGAN CATATAN').length;

  function exportExcel() {
    const columns = hasilColumns(filteredReport);
    const summary = [
      ['LAPORAN HASIL P2H - MMS FLEETCARE'],
      ['Periode', `${formatDate(reportStart)} s/d ${formatDate(reportEnd)}`],
      ['Total P2H', filteredReport.length],
      ['Layak', filteredReport.filter(row => row.status === 'LAYAK').length],
      ['Layak dengan catatan', filteredReport.filter(row => row.status === 'LAYAK DENGAN CATATAN').length],
      ['Tidak layak', filteredReport.filter(row => row.status === 'TIDAK LAYAK').length],
    ];
    const records = filteredReport.map(row => {
      const values = {
        Tanggal: row.tanggal,
        'No. Polisi': row.unit?.nopol || '',
        'Tipe Unit': row.unit?.tipe || '',
        Driver: row.driver?.nama || '',
        'KM Saat P2H': row.km_saat_p2h || '',
        Status: row.status || '',
        Catatan: row.catatan || '',
      };
      columns.forEach(column => { values[column] = hasilValue(row.hasil, column); });
      return values;
    });
    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet(summary);
    summarySheet['!cols'] = [{ wch:26 }, { wch:45 }];
    const reportSheet = XLSX.utils.json_to_sheet(records);
    reportSheet['!cols'] = Object.keys(records[0] || { Tanggal:'', 'No. Polisi':'', Driver:'', Status:'' }).map(() => ({ wch:20 }));
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');
    XLSX.utils.book_append_sheet(workbook, reportSheet, 'Laporan P2H');
    XLSX.writeFile(workbook, `laporan-p2h-${reportStart}-${reportEnd}.xlsx`);
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#74777f', fontFamily:T.body }}>Memuat...</div>;

  const tabStyle = tab => ({ background:'none', border:'none', borderBottom:activeTab === tab ? `2px solid ${T.blue}` : '2px solid transparent', padding:'9px 10px', color:activeTab === tab ? T.blue : '#64748B', fontSize:12, fontWeight:700, cursor:'pointer' });
  const selectStyle = { minWidth:145, border:`1px solid ${T.border}`, borderRadius:6, padding:'8px 10px', fontSize:12, background:'#fff', color:T.navy };

  return (
    <div style={{ fontFamily:T.body }}>
      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Manajemen P2H</h2>
      <p style={{ fontSize:11, color:'#74777f', marginBottom:10 }}>Rekap dan laporan pemeriksaan harian kendaraan</p>
      <div style={{ display:'flex', gap:8, borderBottom:`1px solid ${T.border}`, marginBottom:16 }}>
        <button onClick={() => setActiveTab('rekap')} style={tabStyle('rekap')}>Rekap Hari Ini</button>
        <button onClick={() => setActiveTab('laporan')} style={tabStyle('laporan')}>Laporan P2H</button>
      </div>

      {activeTab === 'rekap' ? <>
        <p style={{ fontSize:11, color:'#74777f', marginBottom:16 }}>Rekap harian - {new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
          {[{ label:'Total Terjadwal', val:list.length, color:T.navy }, { label:'Sudah P2H', val:sudah, color:'#065f46' }, { label:'Belum P2H', val:belum, color:'#7f1d1d' }].map(card => <div key={card.label} style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, padding:14, textAlign:'center' }}><p style={{ fontSize:11, color:'#74777f', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{card.label}</p><p style={{ fontSize:28, fontWeight:700, color:card.color }}>{card.val}</p></div>)}
        </div>
        {belum > 0 && <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#9f1239', fontWeight:600 }}>Perhatian: {belum} unit belum P2H hari ini</div>}
        {nTidak > 0 && <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#7f1d1d', fontWeight:600 }}>{nTidak} unit dinyatakan TIDAK LAYAK</div>}
        {nCatatan > 0 && <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e', fontWeight:600 }}>{nCatatan} unit layak dengan catatan dan perlu ditindaklanjuti</div>}
        <P2HTable rows={list} onDetail={setDetail} showTime />
      </> : <>
        <div style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, padding:14, marginBottom:14 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'end' }}>
            <label style={{ fontSize:11, color:'#475569', fontWeight:600 }}>Dari tanggal<input type="date" value={reportStart} max={reportEnd} onChange={event => setReportStart(event.target.value)} style={{ ...selectStyle, display:'block', marginTop:5 }} /></label>
            <label style={{ fontSize:11, color:'#475569', fontWeight:600 }}>Sampai tanggal<input type="date" value={reportEnd} min={reportStart} max={today} onChange={event => setReportEnd(event.target.value)} style={{ ...selectStyle, display:'block', marginTop:5 }} /></label>
            <label style={{ fontSize:11, color:'#475569', fontWeight:600 }}>Unit<select value={unitFilter} onChange={event => setUnitFilter(event.target.value)} style={{ ...selectStyle, display:'block', marginTop:5 }}><option value="">Semua unit</option>{unitOptions.map(([id, unit]) => <option key={id} value={id}>{unit.nopol}</option>)}</select></label>
            <label style={{ fontSize:11, color:'#475569', fontWeight:600 }}>Driver<select value={driverFilter} onChange={event => setDriverFilter(event.target.value)} style={{ ...selectStyle, display:'block', marginTop:5 }}><option value="">Semua driver</option>{driverOptions.map(([id, driver]) => <option key={id} value={id}>{driver.nama}</option>)}</select></label>
            <label style={{ fontSize:11, color:'#475569', fontWeight:600 }}>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={{ ...selectStyle, display:'block', marginTop:5 }}><option value="">Semua status</option><option value="LAYAK">Layak</option><option value="LAYAK DENGAN CATATAN">Layak dengan catatan</option><option value="TIDAK LAYAK">Tidak layak</option><option value="BELUM">Belum</option></select></label>
            <button onClick={exportExcel} disabled={!filteredReport.length} style={{ border:'none', borderRadius:6, padding:'9px 14px', background:filteredReport.length ? '#059669' : '#94a3b8', color:'#fff', fontSize:12, fontWeight:700, cursor:filteredReport.length ? 'pointer' : 'not-allowed' }}>Export Excel</button>
          </div>
        </div>
        <p style={{ fontSize:12, color:'#64748B', marginBottom:10 }}>{reportLoading ? 'Memuat laporan...' : `${filteredReport.length} hasil P2H ditemukan`}</p>
        <P2HTable rows={filteredReport} onDetail={setDetail} />
      </>}

      {detail && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:400, maxHeight:'calc(100vh - 32px)', overflowY:'auto' }}>
          <div style={{ position:'sticky', top:0, zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', background:'#fff', borderBottom:`1px solid ${T.border}` }}>
            <h3 style={{ fontSize:14, fontWeight:700 }}>Detail P2H - {detail.unit?.nopol}</h3>
            <button aria-label="Tutup detail" onClick={() => setDetail(null)} style={{ background:'#f1f5f9', border:'none', width:30, height:30, borderRadius:15, fontSize:20, lineHeight:'28px', cursor:'pointer', color:'#475569' }}>x</button>
          </div>
          <div style={{ padding:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12 }}><div><p style={{ color:'#74777f', marginBottom:2 }}>Driver</p><p style={{ fontWeight:700 }}>{detail.driver?.nama}</p></div><div><p style={{ color:'#74777f', marginBottom:2 }}>Status</p>{statusBadge(detail.status)}</div><div><p style={{ color:'#74777f', marginBottom:2 }}>KM Saat P2H</p><p style={{ fontWeight:700 }}>{detail.km_saat_p2h?.toLocaleString('id-ID') || '-'} km</p></div><div><p style={{ color:'#74777f', marginBottom:2 }}>Tanggal</p><p style={{ fontWeight:700 }}>{detail.tanggal}</p></div></div>
            {detail.catatan && <div style={{ marginTop:12, background:T.bg, borderRadius:8, padding:10, fontSize:12, color:'#44474e' }}>{detail.catatan}</div>}
            <HasilBreakdown hasil={detail.hasil} />
          </div>
        </div>
      </div>}
    </div>
  );
}

function P2HTable({ rows, onDetail, showTime = false }) {
  return <div style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:8, overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}><thead><tr style={{ background:T.bg, borderBottom:'1px solid #ebeced' }}>{['Tanggal', 'No Pol', 'Driver', ...(showTime ? ['Waktu'] : ['KM']), 'Status', 'Aksi'].map(header => <th key={header} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#74777f', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{header}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Belum ada data P2H</td></tr> : rows.map(row => <tr key={row.id} style={{ borderBottom:'1px solid #f1f2f3' }}><td style={{ padding:'10px 14px', color:'#64748B', whiteSpace:'nowrap' }}>{formatDate(row.tanggal)}</td><td style={{ padding:'10px 14px', fontWeight:700, fontFamily:T.mono, whiteSpace:'nowrap' }}>{row.unit?.nopol || '-'}</td><td style={{ padding:'10px 14px', color:'#44474e' }}>{row.driver?.nama || '-'}</td><td style={{ padding:'10px 14px', color:'#64748B', whiteSpace:'nowrap' }}>{showTime ? (row.created_at ? new Date(row.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-') : (row.km_saat_p2h?.toLocaleString('id-ID') || '-')}</td><td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>{statusBadge(row.status)}</td><td style={{ padding:'10px 14px' }}>{row.status !== 'BELUM' && <button onClick={() => onDetail(row)} style={{ background:'none', border:'1px solid #c4c7cf', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer', color:T.navy, fontWeight:600 }}>Detail</button>}</td></tr>)}</tbody></table></div>;
}
