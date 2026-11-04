// "Otak" untuk semua sesi Claude Code dari HyperForge: login Claude bawaan, atau API custom (base URL + key + model).
// Claude Code membaca ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY / ANTHROPIC_MODEL dari environment,
// jadi cukup diset di process.env proses utama: semua proses claude yang dijalankan aplikasi ikut memakainya.
// Server custom harus kompatibel dengan Anthropic Messages API (/v1/messages), mis. OpenRouter, DeepSeek, Z.ai, Kimi.

const KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'CLAUDE_CODE_SUBAGENT_MODEL',
];
/** Nilai env bawaan sebelum HyperForge mengubahnya (supaya mode "Claude bawaan" bisa dipulihkan). */
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/v1\/messages$/, '').replace(/\/v1$/, '');

/** Env untuk mode custom (kosong untuk mode bawaan). */
function brainEnv(s) {
  if (s.brainMode !== 'custom' || !s.brainBaseUrl || !s.brainApiKey) return null;
  const model = String(s.brainModel || '').trim();
  const small = String(s.brainSmallModel || '').trim() || model;
  const env = { ANTHROPIC_BASE_URL: trimUrl(s.brainBaseUrl) };
  if (s.brainAuth === 'x-api-key') env.ANTHROPIC_API_KEY = s.brainApiKey;
  else env.ANTHROPIC_AUTH_TOKEN = s.brainApiKey;
  if (model) {
    env.ANTHROPIC_MODEL = model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
    env.CLAUDE_CODE_SUBAGENT_MODEL = model;
  }
  if (small) {
    env.ANTHROPIC_SMALL_FAST_MODEL = small;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = small;
  }
  return env;
}

/** Terapkan pengaturan otak ke process.env (dipanggil saat aplikasi mulai dan setiap Simpan). */
function applyBrainEnv(s) {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
  const env = brainEnv(s);
  if (env) Object.assign(process.env, env);
  return Boolean(env);
}

const headers = (apiKey, auth) => ({
  'content-type': 'application/json',
  'anthropic-version': '2023-06-01',
  ...(auth === 'x-api-key' ? { 'x-api-key': apiKey } : { authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey }),
});

/** Daftar model dari server: coba /v1/models (Anthropic & OpenAI), juga tanpa akhiran /anthropic. */
async function listModels({ baseUrl, apiKey, auth }) {
  const base = trimUrl(baseUrl);
  if (!/^https?:\/\//.test(base)) throw new Error('Base URL harus diawali http:// atau https://');
  const roots = [base];
  const stripped = base.replace(/\/(anthropic|api\/anthropic|claude)$/i, '');
  if (stripped !== base) roots.push(stripped);
  const urls = [...new Set(roots.flatMap((r) => [`${r}/v1/models`, `${r}/models`]))];
  const errors = [];
  for (const url of urls) {
    try {
      // Format Anthropic memakai halaman (limit/after_id/has_more); format OpenAI mengembalikan semuanya sekaligus.
      const arr = [];
      let after = null;
      let failed = null;
      for (let page = 0; page < 30; page++) {
        const u = `${url}?limit=1000${after ? `&after_id=${encodeURIComponent(after)}` : ''}`;
        const r = await fetch(u, { headers: headers(apiKey, auth), signal: AbortSignal.timeout(20000) });
        if (!r.ok) {
          failed = `HTTP ${r.status}`;
          break;
        }
        const j = await r.json();
        const items = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : [];
        arr.push(...items);
        if (!j.has_more || !j.last_id || j.last_id === after || !items.length) break;
        after = j.last_id;
      }
      if (failed && !arr.length) {
        errors.push(`${url}: ${failed}`);
        continue;
      }
      const seen = new Set();
      const models = arr
        .map((m) => (typeof m === 'string' ? { id: m } : { id: String(m.id || m.name || ''), name: m.display_name || m.name || '', context: m.context_length || m.context_window || null }))
        .filter((m) => m.id && !seen.has(m.id) && seen.add(m.id))
        .sort((a, b) => a.id.localeCompare(b.id));
      if (models.length) return { url, models };
      errors.push(`${url}: daftar kosong`);
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  throw new Error(`Daftar model tidak bisa diambil. Ketik nama model secara manual.\n${errors.slice(0, 4).join('\n')}`);
}

/** Uji kecil: satu pesan pendek ke /v1/messages (format yang dipakai Claude Code). */
async function testBrain({ baseUrl, apiKey, auth, model }) {
  const url = `${trimUrl(baseUrl)}/v1/messages`;
  const t0 = Date.now();
  const r = await fetch(url, {
    method: 'POST',
    headers: headers(apiKey, auth),
    body: JSON.stringify({ model, max_tokens: 20, messages: [{ role: 'user', content: 'Balas satu kata: siap' }] }),
    signal: AbortSignal.timeout(60000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  let reply = '';
  try {
    const j = JSON.parse(text);
    reply = (j.content || []).map((c) => c.text || '').join('').trim();
  } catch {
    reply = text.slice(0, 80);
  }
  return { ok: true, ms: Date.now() - t0, reply: reply.slice(0, 120) };
}

function register({ ipcMain }) {
  ipcMain.handle('brain:models', (_e, p) => listModels(p));
  ipcMain.handle('brain:test', (_e, p) => testBrain(p));
}

module.exports = { register, applyBrainEnv, brainEnv };
