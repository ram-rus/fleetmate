// src/lib/theme.js — Tokens visual terpusat untuk FleetMate
// Semua komponen diharapkan import dari sini, bukan bikin const C sendiri.

export const C = {
  // Sidebar
  sidebarBg:   '#FFFFFF',
  sidebarBdr:  '#EBEBEB',
  activeItemBg:'#FDE8E8',
  activeItemTx:'#C94A3A',
  activeItemIc:'#C94A3A',
  inactiveIc:  '#9CA3AF',
  inactiveTx:  '#374151',
  labelTx:     '#9CA3AF',

  // Topbar & content
  topbarBg:    '#FAF8F5',
  contentBg:   '#F5F3EF',

  // Card
  cardBg:      '#FFFFFF',
  cardBdr:     '#EBEBEB',
  border:      '#E2E8F0',

  // Text
  textPrimary: '#111827',
  textSecond:  '#6B7280',
  textLight:   '#9CA3AF',
  textDim:     '#6B7280',
  navy:        '#1F2937',
  labelUpper:  '#9CA3AF',

  // Accent
  blue:        '#2170E4',
  blueBg:      '#EFF6FF',
  green:       '#059669',
  greenBg:     '#ECFDF5',
  amber:       '#D97706',
  amberBg:     '#FFF7ED',
  red:         '#C94A3A',
  redBg:       '#FEF2F2',
  purple:      '#7C3AED',
  purpleBg:    '#F5F3FF',

  // Font
  head: "'Hanken Grotesk', 'Inter', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// Helper umum
export const STATUS_INFO = {
  'Menunggu Approval Storing':    { color: C.amber, bg: C.amberBg, icon: '⏳', text: 'Menunggu Approval Storing' },
  'Menunggu Approval Pulang ke Pool': { color: C.blue,  bg: C.blueBg,  icon: '🏠', text: 'Menunggu Approval Pulang ke Pool' },
  'Disetujui Storing':            { color: C.red,   bg: C.redBg,    icon: '🔴', text: 'Disetujui Storing — dalam perbaikan' },
  'Disetujui Pulang ke Pool':     { color: C.green, bg: C.greenBg,  icon: '✅', text: 'Disetujui Pulang ke Pool' },
  'Selesai':                      { color: C.green, bg: C.greenBg,  icon: '✅', text: 'Selesai' },
  'Lanjut Perjalanan':            { color: C.green, bg: C.greenBg,  icon: '🚛', text: 'Lanjut Perjalanan' },
  'Tiba di Pool':                 { color: C.green, bg: C.greenBg,  icon: '🏁', text: 'Tiba di Pool' },
};
