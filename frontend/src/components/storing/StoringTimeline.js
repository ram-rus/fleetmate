import React from 'react';
import { PROGRES_LIST, getProgresIndex, normalizeProgres } from '../../lib/storingConstants';

/** Timeline visual progres storing — dipakai admin & driver */
export default function StoringTimeline({ progres, compact }) {
  const currentIdx = getProgresIndex(normalizeProgres(progres));

  if (compact) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {PROGRES_LIST.map((p, i) => {
            const done    = i < currentIdx;
            const current = i === currentIdx;
            return (
              <React.Fragment key={p.value}>
                <div title={p.label || p.value} style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: done ? '#10b981' : current ? '#1a2b4b' : '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: done || current ? '#fff' : '#9ca3af',
                  border: current ? '2px solid #1a2b4b' : 'none',
                  boxShadow: current ? '0 0 0 3px rgba(26,43,75,0.15)' : 'none',
                }}>
                  {done ? '✓' : p.icon}
                </div>
                {i < PROGRES_LIST.length - 1 && (
                  <div style={{ flex: 1, height: 3, background: i < currentIdx ? '#10b981' : '#e5e7eb', borderRadius: 2 }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#1a2b4b', marginTop: 8, textAlign: 'center' }}>
          {PROGRES_LIST[currentIdx]?.label || PROGRES_LIST[currentIdx]?.value || progres}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 4 }}>
      {PROGRES_LIST.map((p, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        const last    = i === PROGRES_LIST.length - 1;
        return (
          <div key={p.value} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: last ? 0 : 16 }}>
            {!last && (
              <div style={{
                position: 'absolute', left: 13, top: 28, bottom: 0, width: 2,
                background: done ? '#10b981' : '#e5e7eb',
              }}/>
            )}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, zIndex: 1,
              background: done ? '#10b981' : current ? p.bg : '#f3f4f6',
              border: current ? `2px solid ${p.color}` : done ? '2px solid #10b981' : '2px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            }}>
              {done ? '✓' : p.icon}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <p style={{
                fontSize: 12, fontWeight: current ? 700 : done ? 600 : 500,
                color: current ? p.color : done ? '#065f46' : '#9ca3af',
              }}>
                {p.label || p.value}
              </p>
              {current && (
                <span style={{ fontSize: 10, background: p.bg, color: p.color, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                  Saat ini
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
