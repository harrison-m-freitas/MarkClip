import React from 'react';
import ReactDOM from 'react-dom/client';
import Options from './App';
import '~/entrypoints/popup/style.css';

const mount = document.getElementById('root');
if (!mount) {
  // Evita crash silencioso caso o HTML não tenha #root
  // eslint-disable-next-line no-console
  console.error('[Options] Elemento #root não encontrado no DOM');
} else {
  ReactDOM.createRoot(mount).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
}
