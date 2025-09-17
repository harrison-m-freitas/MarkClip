import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '~/entrypoints/popup/style.css';

const mount = document.getElementById('root');
if (!mount) {
  // eslint-disable-next-line no-console
  console.error('[Popup] Elemento #root não encontrado no DOM');
} else {
  ReactDOM.createRoot(mount).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
