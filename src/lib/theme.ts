export type Theme = 'dark' | 'light' | 'system';

const KEY = 'hf-theme';

/** Default gelap: navy logo HyperForge paling cocok di tema gelap. */
export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light' || t === 'system') return t;
  } catch {
    /* localStorage tidak tersedia */
  }
  return 'dark';
}

export function applyTheme(theme: Theme = getTheme()) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* abaikan */
  }
  applyTheme(theme);
}
