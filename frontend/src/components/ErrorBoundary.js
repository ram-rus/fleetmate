// src/components/ErrorBoundary.js — FleetMate v6
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[FleetMate] ErrorBoundary caught:', error?.message, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: 40,
          fontFamily: "'Inter', sans-serif", color: '#374151',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Terjadi Kesalahan</h2>
          <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 400, marginBottom: 20 }}>
            {this.state.error?.message || 'Halaman ini mengalami error. Silakan coba refresh.'}
          </p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              background: '#C94A3A', color: '#fff', border: 'none',
              borderRadius: 7, padding: '10px 24px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}>
            Refresh Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
