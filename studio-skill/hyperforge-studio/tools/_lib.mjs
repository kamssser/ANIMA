// Bersama untuk alat HyperForge Studio. Dijalankan dari FOLDER KERJA (tempat node_modules berisi puppeteer & three).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORK = path.resolve(process.env.HF_STUDIO_WORK || process.cwd());

/** puppeteer dari folder kerja (bukan dari folder skill). */
export function loadPuppeteer() {
  for (const base of [WORK, process.cwd()]) {
    try {
      return createRequire(path.join(base, 'noop.js'))('puppeteer');
    } catch {
      /* coba berikutnya */
    }
  }
  console.error(`puppeteer tidak ditemukan di ${WORK}/node_modules. Jalankan alat ini dari folder kerja HyperForge Studio (atau npm i puppeteer di sana).`);
  process.exit(2);
}

export const args = (argv = process.argv.slice(2)) => {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      opt[k] = v;
    } else pos.push(a);
  }
  return { pos, opt };
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

/** Server statis tanpa cache: / = folder kerja, /kit/ = kit skill. Resolves { url, close }. */
export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = u.startsWith('/kit/') ? path.join(SKILL, 'kit', u.slice(5)) : path.join(WORK, u);
    const root = u.startsWith('/kit/') ? path.join(SKILL, 'kit') : WORK;
    if (!path.resolve(file).startsWith(root)) return res.writeHead(403).end();
    let f = file;
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) return res.writeHead(404).end('tidak ada: ' + u);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

/** URL halaman relatif ke folder kerja. */
export function pageUrl(base, htmlPath, query = '') {
  const rel = path.relative(WORK, path.resolve(htmlPath)).split(path.sep).join('/');
  if (rel.startsWith('..')) {
    console.error(`Halaman harus di dalam folder kerja (${WORK}): ${htmlPath}`);
    process.exit(2);
  }
  return `${base}/${rel}${query}`;
}

const COMMON = ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'];
const GPU = process.platform === 'win32' ? ['--use-gl=angle', '--use-angle=d3d11'] : ['--use-gl=angle'];
const CPU = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
/** argumen bawaan (dipakai alat yang meluncurkan browser sendiri) */
export const BROWSER_ARGS = [...COMMON, ...GPU];

/**
 * Chrome headless shell dengan kartu grafis (sekitar 6x lebih cepat dari SwiftShader). Kalau WebGL tidak jalan di
 * kartu grafis (laptop tanpa GPU yang memadai) atau HF_GL=cpu, pakai SwiftShader (CPU).
 */
export async function launchBrowser(puppeteer, extra = {}) {
  const want = process.env.HF_GL === 'cpu' ? 'cpu' : 'gpu';
  if (want === 'gpu') {
    const b = await puppeteer.launch({ headless: 'shell', args: [...COMMON, ...GPU], protocolTimeout: 600000, ...extra });
    const p = await b.newPage();
    const r = await p.evaluate(() => {
      const g = document.createElement('canvas').getContext('webgl');
      const d = g && g.getExtension('WEBGL_debug_renderer_info');
      return g ? String(g.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : g.RENDERER)) : '';
    });
    await p.close();
    if (r && !/swiftshader/i.test(r)) return b;
    await b.close();
  }
  return puppeteer.launch({ headless: 'shell', args: [...COMMON, ...CPU], protocolTimeout: 600000, ...extra });
}

/** Buka halaman adegan, tunggu STUDIO.ready, kembalikan info. */
export async function openScene(browser, url, scale = 1) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && !/favicon\.ico$/.test(r.url()) && errors.push(`${r.status()} ${new URL(r.url()).pathname}`));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  try {
    await page.waitForFunction('window.STUDIO && window.STUDIO.ready', { timeout: 120000 });
    await page.evaluate(() => window.STUDIO.ready);
  } catch {
    throw new Error(`Halaman tidak memanggil HF.setup / window.STUDIO tidak siap.\n${errors.slice(0, 5).join('\n')}`);
  }
  const info = await page.evaluate(() => ({ width: STUDIO.width, height: STUDIO.height, fps: STUDIO.fps, duration: STUDIO.duration }));
  await page.setViewport({ width: info.width, height: info.height, deviceScaleFactor: scale });
  await page.evaluate(() => window.STUDIO.seek(0));
  return { page, info, errors };
}

/** Seek ke t lalu tunggu dua frame gambar. */
export async function seek(page, t) {
  await page.evaluate(async (time) => {
    await window.STUDIO.seek(time);
    // dua frame gambar; batas waktu cadangan karena rAF bisa berhenti di tab yang tidak aktif
    await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 120))]);
  }, t);
}

/** Susun gambar (PNG buffer) jadi satu lembar kontak berlabel, lewat halaman HTML. */
export async function contactSheet(browser, images, labels, outFile, { cols = 4, cellWidth = 270, title = '' } = {}) {
  const page = await browser.newPage();
  const cells = images
    .map((b, i) => `<figure><img src="data:image/png;base64,${b.toString('base64')}"><figcaption>${labels[i] ?? ''}</figcaption></figure>`)
    .join('');
  await page.setViewport({ width: cols * (cellWidth + 12) + 24, height: 400 });
  await page.setContent(
    `<html><body style="margin:0;background:#111;color:#ddd;font:600 14px Arial;padding:12px">${title ? `<div style="margin:0 0 10px">${title}</div>` : ''}<div style="display:grid;grid-template-columns:repeat(${cols},${cellWidth}px);gap:12px">${cells}</div><style>figure{margin:0}img{width:${cellWidth}px;display:block;border-radius:6px}figcaption{padding:4px 2px}</style></body></html>`,
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: cols * (cellWidth + 12) + 24, height: h });
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  await page.screenshot({ path: outFile, fullPage: true });
  await page.close();
}

export function ffmpeg(argv, opts = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...argv], { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) {
    console.error('ffmpeg tidak ditemukan di PATH (butuh ffmpeg lengkap).');
    process.exit(2);
  }
  return r;
}

export const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
