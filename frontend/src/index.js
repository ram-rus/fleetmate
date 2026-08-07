import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

// Aktifkan PWA (offline app-shell + banner install). File service-worker.js
// dan serviceWorkerRegistration.js harus ada di src/ — lihat instruksi
// pemasangan PWA. Tidak aktif otomatis di mode development (npm start),
// hanya jalan di hasil build produksi.
serviceWorkerRegistration.register();
