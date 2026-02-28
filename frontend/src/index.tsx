import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Recover from ChunkLoadError (stale cache / webpack chunk hash mismatch)
const isChunkLoadError = (e: Error) =>
  e?.name === 'ChunkLoadError' ||
  (e?.message && typeof e.message === 'string' && e.message.includes('Loading chunk'));

const handleChunkLoadError = () => {
  const reloadKey = 'chunk-load-reload';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  } else {
    sessionStorage.removeItem(reloadKey);
  }
};

window.addEventListener('error', (event) => {
  if (event.error && isChunkLoadError(event.error)) {
    event.preventDefault();
    handleChunkLoadError();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;
  if (err && isChunkLoadError(err instanceof Error ? err : new Error(String(err)))) {
    event.preventDefault();
    handleChunkLoadError();
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
