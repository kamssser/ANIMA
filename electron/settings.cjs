// Pengaturan aplikasi (disimpan di %APPDATA%/ANIMA Studio/settings.json).
// API key (vibiApiKey, brainApiKey) dienkripsi sebelum ditulis ke disk (shared/secret.cjs, Windows DPAPI).
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const secret = require('../shared/secret.cjs');

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// Bawaan installer (URL + publishable key Supabase bersama). Bukan rahasia: data dilindungi RLS per akun.
// Jangan taruh secret key / API key vibi.pro di sini.
const appDefaults = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app-defaults.json'), 'utf8'));
  } catch {
    return {};
  }
};

const defaultSettings = () => ({
  supabaseUrl: '',
  supabaseAnonKey: '',
  ...appDefaults(),
  remotionProjectPath: '',
  remotionEntry: 'src/index.ts',
  defaultComposition: 'Main',
  outputDir: path.join(app.getPath('videos'), 'ANIMA'),
  tempDir: path.join(app.getPath('temp'), 'anima-remotion'),
  // 1 = 1080x1920 (hemat). 1.3333 = 1440x2560 (2K, jauh lebih lama).
  scale: 1,
  // 1 proses render agar RAM dan CPU laptop tidak penuh.
  concurrency: 1,
  crf: 18,
  frameTimeoutMs: 300000,
  // 'draft' mematikan efek berat skill (ink, lens blur, bloom): ~2x lebih cepat di laptop i7-4710MQ.
  renderQuality: 'full',
  // 'angle' = WebGL di kartu grafis (Direct3D). Tanpa flag, Chrome render memakai SwiftShader (CPU) yang jauh lebih lambat.
  // 'swiftshader' = cadangan kalau GPU/driver bermasalah.
  gl: 'angle',
  benchFrame: 400,
  // Suara narasi lewat vibi.pro (https://vibi.pro/docs).
  vibiApiKey: '',
  vibiProvider: 'elevenlabs',
  vibiModel: 'eleven_multilingual_v2',
  vibiVoiceId: '',
  vibiVoiceName: '',
  vibiLanguage: 'id',
  vibiSpeed: 1,
  // Suara B (pembicara kedua): provider SAMA dengan suara A, model berbeda (mis. eleven_v3).
  vibi2Provider: 'elevenlabs',
  vibi2Model: 'eleven_v3',
  vibi2VoiceId: '',
  vibi2VoiceName: '',
  vibi2Language: 'id',
  vibi2Speed: 1,
  wordTimestamps: true,
  // Branding: nama kanal/akun sosmed, tampil kecil di tengah paling bawah semua video ('' = mati).
  brandOn: false,
  brandText: '',
  // Pipeline audio skill: <proyek Remotion>/voice (input) dan /audio (mix.py).
  voiceDir: 'voice',
  audioDir: 'audio',
  pythonPath: 'python',
  runMix: true,
  muxAudio: true,
  // Otak Claude: 'claude' = login Claude Code bawaan; 'custom' = API kompatibel Anthropic (base URL + key + model).
  brainMode: 'claude',
  brainPreset: 'custom',
  brainBaseUrl: '',
  brainApiKey: '',
  brainAuth: 'bearer',
  brainModel: '',
  brainSmallModel: '',
  // Keamanan: sesi produksi skill (boleh menjalankan perintah) TIDAK membaca web kecuali pengguna menyalakan ini.
  // Riset internet tetap jalan di tahap "Generate dengan Claude" yang tidak boleh menjalankan perintah.
  skillWebResearch: false,
  // Google Flow dioperasikan otomatis oleh Claude: hanya setelah pengguna menyetujui risiko akun Google.
  flowRiskAccepted: false,
});

// Model bawaan suara B per provider: dibuat beda dari model bawaan suara A.
const VOICE_B_MODEL = { elevenlabs: 'eleven_v3', minimax: 'speech-2.8-hd', capcut: 'capcut' };

/**
 * Suara A dan B memakai SATU provider (beda model). Pengaturan lama dengan provider B yang berbeda:
 * suara B-nya milik provider lain, jadi dikosongkan dan harus dipilih ulang.
 */
function oneProvider(s) {
  if (s.vibi2Provider === s.vibiProvider) return s;
  const p = s.vibiProvider;
  return { ...s, vibi2Provider: p, vibi2Model: VOICE_B_MODEL[p] || s.vibiModel, vibi2VoiceId: '', vibi2VoiceName: '', vibi2Language: p === 'minimax' ? 'Indonesian' : 'id' };
}

const dataDir = () => path.dirname(settingsFile());

function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return null;
  }
}

/** Pengaturan lengkap dengan API key sudah dibuka (untuk dipakai proses utama dan ditampilkan di Pengaturan). */
function readSettings() {
  const raw = readRaw();
  if (!raw) return defaultSettings();
  return oneProvider({ ...defaultSettings(), ...secret.revealSettings(dataDir(), raw) });
}

function writeSettings(next) {
  const merged = { ...readSettings(), ...next };
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(secret.sealSettings(dataDir(), merged), null, 2));
  return merged;
}

/** Sekali saat start: API key lama yang masih teks biasa dienkripsi. */
function migrateSecrets() {
  const raw = readRaw();
  if (!raw || !secret.SECRET_KEYS.some((k) => raw[k] && !secret.isEncrypted(raw[k]))) return;
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(secret.sealSettings(dataDir(), raw), null, 2));
  } catch {
    /* gagal mengenkripsi: biarkan, dicoba lagi saat start berikutnya */
  }
}

module.exports = { settingsFile, readSettings, writeSettings, migrateSecrets, defaultSettings };
