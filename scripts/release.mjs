// Unggah hasil build ke GitHub Releases kamssser/ANIMA supaya aplikasi teman menerima update.
// Dijalankan oleh `npm run release` setelah electron-builder membuat installer (tanpa publish).
// Urutannya sengaja satu per satu (tag -> release -> aset) karena publish paralel electron-builder
// pernah gagal dengan "Published releases must have a valid tag".
//
// Catatan rilis diambil dari CHANGELOG.md (bagian "## <versi>"); tanpa itu rilis ditolak.
// `node scripts/release.mjs --notes-only` hanya menyinkronkan catatan ke release yang sudah ada.
//
// Butuh env GH_TOKEN (token dengan izin Contents: Read and write di repo ANIMA).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OWNER = 'kamssser';
const REPO = 'ANIMA';
const root = path.resolve(import.meta.dirname, '..');
const { version, productName } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tag = `v${version}`;
const token = process.env.GH_TOKEN;
if (!token) {
  console.error('GH_TOKEN belum diset. Jalankan: setx GH_TOKEN "token", lalu buka terminal baru.');
  process.exit(1);
}

const api = async (url, init = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'hyperforge-release', ...init.headers },
  });
  if (!res.ok && res.status !== 404) throw new Error(`${init.method || 'GET'} ${url} -> ${res.status} ${await res.text()}`);
  return res.status === 404 || res.status === 204 ? null : res.json();
};

// Catatan update per versi dari CHANGELOG.md (aturan: setiap rilis WAJIB punya catatan).
function changelogSections() {
  const text = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const out = new Map();
  const parts = text.split(/^## /m).slice(1);
  for (const p of parts) {
    const [head, ...rest] = p.split('\n');
    const v = head.trim().split(/\s+/)[0];
    out.set(v, rest.join('\n').trim());
  }
  return out;
}
const notesFor = (v) => changelogSections().get(v);

// --notes-only: sinkronkan catatan CHANGELOG ke semua release GitHub yang sudah ada, tanpa build.
if (process.argv.includes('--notes-only')) {
  for (const [v, body] of changelogSections()) {
    const rel = await api(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/v${v}`);
    if (!rel) continue;
    await api(`https://api.github.com/repos/${OWNER}/${REPO}/releases/${rel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${productName} ${v}`, body }),
    });
    console.log(`catatan v${v} diperbarui`);
  }
  process.exit(0);
}

const notes = notesFor(version);
if (!notes) {
  console.error(`Catatan update untuk versi ${version} belum ada di CHANGELOG.md.`);
  console.error(`Tambahkan bagian "## ${version} - YYYY-MM-DD" berisi apa yang baru/diperbaiki, lalu jalankan ulang.`);
  process.exit(1);
}

const dir = path.join(root, 'release');
const exeLocal = path.join(dir, `${productName} Setup ${version}.exe`);
const exeName = `${productName}-Setup-${version}.exe`;
if (!fs.existsSync(exeLocal)) {
  console.error(`Installer tidak ditemukan: ${exeLocal}`);
  process.exit(1);
}

// 1. latest.yml (dibaca electron-updater untuk tahu versi terbaru).
const bytes = fs.readFileSync(exeLocal);
const sha512 = createHash('sha512').update(bytes).digest('base64');
const latestYml = [
  `version: ${version}`,
  'files:',
  `  - url: ${exeName}`,
  `    sha512: ${sha512}`,
  `    size: ${bytes.length}`,
  `path: ${exeName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  // Ditampilkan di dialog update aplikasi ("Yang baru").
  `releaseNotes: ${JSON.stringify(notes)}`,
  '',
].join('\n');
fs.writeFileSync(path.join(dir, 'latest.yml'), latestYml);

// 2. Tag git (dibuat & di-push dulu supaya GitHub menerima release-nya).
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
const remoteTag = git('ls-remote', 'origin', `refs/tags/${tag}`);
if (!remoteTag) {
  if (!git('tag', '--list', tag)) git('tag', '-a', tag, '-m', `${productName} ${version}`, head);
  git('push', 'origin', tag);
  console.log(`tag ${tag} di-push`);
}

// 3. Release (pakai yang sudah ada kalau rilis sebelumnya terputus).
let rel = await api(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${tag}`);
if (!rel) {
  rel = await api(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: tag, name: `${productName} ${version}`, body: notes, draft: false, prerelease: false }),
  });
  console.log(`release ${tag} dibuat`);
} else {
  await api(`https://api.github.com/repos/${OWNER}/${REPO}/releases/${rel.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${productName} ${version}`, body: notes }),
  });
}

// 4. Aset: installer, blockmap, latest.yml (yang sudah ada diganti).
const assets = [
  { local: exeLocal, name: exeName, type: 'application/octet-stream' },
  { local: `${exeLocal}.blockmap`, name: `${exeName}.blockmap`, type: 'application/octet-stream' },
  { local: path.join(dir, 'latest.yml'), name: 'latest.yml', type: 'text/yaml' },
];
for (const a of assets) {
  if (!fs.existsSync(a.local)) continue;
  const old = rel.assets?.find((x) => x.name === a.name);
  if (old) await api(`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${old.id}`, { method: 'DELETE' }).catch(() => {});
  const body = fs.readFileSync(a.local);
  const mb = (body.length / 1048576).toFixed(1);
  process.stdout.write(`mengunggah ${a.name} (${mb} MB)... `);
  await api(`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${rel.id}/assets?name=${encodeURIComponent(a.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': a.type },
    body,
  });
  console.log('ok');
}

console.log(`\nSelesai: ${rel.html_url}`);
console.log(`Link unduh: https://github.com/${OWNER}/${REPO}/releases/latest/download/${exeName}`);
