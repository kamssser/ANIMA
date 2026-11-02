import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './lib/theme';
import './index.css';

applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

try {
  if (localStorage.getItem('anima-hemat') === '1') document.documentElement.classList.add('hemat');
} catch {
  /* localStorage tidak tersedia */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
