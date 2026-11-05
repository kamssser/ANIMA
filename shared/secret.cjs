// Enkripsi API key di settings.json (vibiApiKey, brainApiKey) supaya tidak tersimpan sebagai teks biasa.
//
// Cara kerja (sama seperti safeStorage Electron di Windows): satu kunci acak AES-256 dibungkus Windows DPAPI
// (hanya akun Windows ini yang bisa membukanya) dan disimpan di secret.key di samping settings.json. Nilai rahasia
// disimpan sebagai "enc:v1:<iv>.<data>.<tag>" (AES-256-GCM). Modul ini dipakai proses utama Electron DAN server MCP
// (proses Node biasa yang dijalankan Claude), jadi tidak bergantung pada API Electron.
//
// Di luar Windows (tidak ada DPAPI) nilai tetap disimpan apa adanya.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const PREFIX = 'enc:v1:';
/** Kolom pengaturan yang dienkripsi. */
const SECRET_KEYS = ['vibiApiKey', 'brainApiKey'];
const isWin = process.platform === 'win32';

function dpapi(op, b64) {
  const ps = [
    'Add-Type -AssemblyName System.Security',
    '$b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())',
    `[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${op}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`,
  ].join(';');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { input: b64, encoding: 'utf8', windowsHide: true, timeout: 20000 });
  const out = String(r.stdout || '').trim();
  if (r.status !== 0 || !out) throw new Error(`DPAPI ${op} gagal: ${String(r.stderr || r.error || '').trim().slice(0, 200)}`);
  return out;
}

const cache = new Map();
/** Kunci AES untuk folder data ini (dibuat sekali). create=false: null kalau belum ada. */
function masterKey(dir, create) {
  if (cache.has(dir)) return cache.get(dir);
  const f = path.join(dir, 'secret.key');
  let key = null;
  if (fs.existsSync(f)) {
    key = Buffer.from(dpapi('Unprotect', fs.readFileSync(f, 'utf8').trim()), 'base64');
  } else if (create) {
    key = crypto.randomBytes(32);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, dpapi('Protect', key.toString('base64')));
  }
  if (key) cache.set(dir, key);
  return key;
}

const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

function encryptValue(dir, plain) {
  if (!isWin || !plain || isEncrypted(plain)) return plain;
  const key = masterKey(dir, true);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `${PREFIX}${iv.toString('base64')}.${data.toString('base64')}.${c.getAuthTag().toString('base64')}`;
}

/** Nilai terenkripsi -> teks asli. Gagal dibuka (akun/laptop lain) -> '' supaya pengguna mengisi ulang. */
function decryptValue(dir, v) {
  if (!isEncrypted(v)) return v;
  try {
    const key = masterKey(dir, false);
    if (!key) return '';
    const [iv, data, tag] = v.slice(PREFIX.length).split('.').map((x) => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/** Objek pengaturan dengan semua kolom rahasia dibuka. dir = folder settings.json. */
function revealSettings(dir, s) {
  const out = { ...s };
  for (const k of SECRET_KEYS) if (out[k]) out[k] = decryptValue(dir, out[k]);
  return out;
}

/** Objek pengaturan dengan semua kolom rahasia dienkripsi (untuk ditulis ke disk). */
function sealSettings(dir, s) {
  const out = { ...s };
  for (const k of SECRET_KEYS) if (out[k]) out[k] = encryptValue(dir, out[k]);
  return out;
}

module.exports = { SECRET_KEYS, encryptValue, decryptValue, revealSettings, sealSettings, isEncrypted };
