// src/pages/driver/HistoriStoringPage.js
// v5 — Histori semua perbaikan (storing + pulang ke pool) yang sudah selesai

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useDriverAuth } from '../../context/DriverAuthContext';
import DriverLayout from '../../components/layout/DriverLayout';
import { getTipe, getStatus, PERBAIKAN_SELECT } from '../../lib/perbaikanConstants';

export default function HistoriStoringPage() {
  const { driver }          = useDriverAuth();
  const [list, setList]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [expanded, setExp]  = useState(null);

  useEffect(() => {
    if (!driver?.id) return;
    load();
  }, [driver?.id]);

  async function load() {
    // Ambil perbaikan yang sudah selesai milik driver ini
    const { data: perbaikanData } = await supabase
      .from('perbaikan')
      .select(PERBAIKAN_SELECT)
      .eq('driver_id', driver.id)
      .in('status', ['Selesai','Lanjut Perjalanan','Ditolak'])
      .order('updated_at', { ascending:false });

    setList(perbaikanData || []);
    setLoad(false);
  }

  function durasi(p) {
    const mulai   = p.tgl_mulai ? new Date(p.tgl_mulai) : new Date(p.created_at);
    const selesai = p.tgl_selesai ? new Date(p.tgl_selesai) : new Date();
    return Math.max(0, Math.floor((selesai - mulai) / (1000*60*60*24)));
  }

  if (loading) return (
    <DriverLayout title="Histori Perbaikan" back>
      <div style={{ padding:40, textAlign:'center', color:'#74777f' }}>Memuat...</div>
    </DriverLayout>
  );

  return (
    <DriverLayout title="Histori Perbaikan" back>
      <div style={{ padding:16 }}>

        {list.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:48, marginBottom:10 }}>📋</div>
            <p style={{ fontSize:14, fontWeight:700, color:'#1a1c1e', marginBottom:6 }}>Belum ada riwayat perbaikan</p>
            <p style={{ fontSize:12, color:'#74777f' }}>Riwayat perbaikan yang sudah selesai akan muncul di sini</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:11, color:'#74777f', marginBottom:12 }}>
              {list.length} riwayat perbaikan
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {list.map(p => {
                const tipe   = getTipe(p.tipe);
                const status = getStatus(p.status);
                const isOpen = expanded === p.id;

                return (
                  <div key={p.id} style={{ background:'#fff', border:'1px solid #ebeced', borderRadius:12, overflow:'hidden' }}>
                    {/* Card header */}
                    <button onClick={() => setExp(isOpen ? null : p.id)}
                      style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:14, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div>
                          <p style={{ fontSize:13, fontWeight:700, fontFamily:'monospace' }}>{p.unit?.nopol}</p>
                          <p style={{ fontSize:10, color:'#74777f', marginTop:2 }}>
                            {new Date(p.created_at).toLocaleDateString('id-ID',{ day:'numeric', month:'long', year:'numeric' })}
                          </p>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                          <span style={{ background:tipe.bg, color:tipe.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                            {tipe.icon} {tipe.label}
                          </span>
                          <span style={{ background:status.bg, color:status.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize:11, color:'#44474e', lineHeight:1.5 }}>
                        {p.deskripsi?.slice(0, isOpen ? undefined : 80)}{!isOpen && (p.deskripsi?.length||0) > 80 ? '...' : ''}
                      </p>

                      <p style={{ fontSize:10, color:'#c4c7cf', marginTop:6 }}>
                        {isOpen ? '▲ Sembunyikan' : '▼ Lihat detail'}
                      </p>
                    </button>

                    {/* Detail expanded */}
                    {isOpen && (
                      <div style={{ borderTop:'1px solid #f1f2f3', padding:14, background:'#f8f9fa' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:11 }}>

                          {p.no_perbaikan && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>No. Perbaikan</span>
                              <span style={{ fontWeight:700, fontFamily:'monospace' }}>{p.no_perbaikan}</span>
                            </div>
                          )}

                          {p.lokasi && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>📍 Lokasi</span>
                              <span style={{ fontWeight:600, textAlign:'right', maxWidth:'60%' }}>{p.lokasi}</span>
                            </div>
                          )}

                          {(p.mekanik?.nama || p.mekanik_luar_nama) && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>👷 Mekanik</span>
                              <span style={{ fontWeight:600 }}>
                                {p.mekanik?.nama || p.mekanik_luar_nama}
                                {p.mekanik_luar_hp && ` (${p.mekanik_luar_hp})`}
                              </span>
                            </div>
                          )}

                          {p.tgl_mulai && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>📅 Mulai</span>
                              <span style={{ fontWeight:600 }}>
                                {new Date(p.tgl_mulai).toLocaleDateString('id-ID',{ day:'numeric', month:'short', year:'numeric' })}
                              </span>
                            </div>
                          )}

                          {p.tgl_selesai && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>✅ Selesai</span>
                              <span style={{ fontWeight:600 }}>
                                {new Date(p.tgl_selesai).toLocaleDateString('id-ID',{ day:'numeric', month:'short', year:'numeric' })}
                              </span>
                            </div>
                          )}

                          {p.tgl_mulai && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>⏱️ Durasi</span>
                              <span style={{ fontWeight:600 }}>{durasi(p)} hari</span>
                            </div>
                          )}

                          {p.km_kendaraan && (
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#74777f' }}>📏 KM</span>
                              <span style={{ fontWeight:600 }}>{p.km_kendaraan.toLocaleString('id-ID')} km</span>
                            </div>
                          )}

                          {/* Foto */}
                          {p.foto_urls?.length > 0 && (
                            <div style={{ marginTop:4 }}>
                              <p style={{ color:'#74777f', marginBottom:6 }}>📷 Foto</p>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                                {p.foto_urls.slice(0,3).map((url,i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="" style={{ width:'100%', aspectRatio:1, objectFit:'cover', borderRadius:6, border:'1px solid #ebeced' }}/>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DriverLayout>
  );
}
