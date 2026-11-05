// Keamanan: izin perintah Claude, enkripsi API key, dan validasi slug.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ENGINES, scriptRules, WEB_TOOLS, slugOk } = require('../electron/skills.cjs');
const secret = require('../shared/secret.cjs');

const BROAD = ['Bash(bash:*)', 'Bash(sh:*)', 'Bash(curl:*)', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(powershell:*)', 'Bash(cmd:*)'];

test('tidak ada mesin skill yang memberi izin shell/unduh bebas', () => {
  for (const e of Object.values(ENGINES)) {
    for (const t of e.extraTools || []) assert.ok(!BROAD.includes(t), `${e.id}: ${t}`);
    // curl hanya ke localhost
    for (const t of (e.extraTools || []).filter((x) => x.startsWith('Bash(curl'))) assert.match(t, /^Bash\(curl -sN http:\/\/127\.0\.0\.1:/, `${e.id}: ${t}`);
  }
});

test('scriptRules: hanya satu skrip, beberapa bentuk path', () => {
  const f = path.join(os.homedir(), '.claude', 'skills', 'x', 'setup.sh');
  const rules = scriptRules('sh', f);
  assert.ok(rules.length >= 4);
  for (const r of rules) {
    assert.match(r, /^Bash\(sh "?[^ ]*setup\.sh"?:\*\)$/);
    assert.ok(!BROAD.includes(r));
  }
  assert.ok(rules.includes('Bash(sh ~/.claude/skills/x/setup.sh:*)'));
});

test('alat riset web terdaftar untuk ditolak saat riset dimatikan', () => {
  assert.deepEqual(WEB_TOOLS.slice(0, 2), ['WebSearch', 'WebFetch']);
  assert.ok(WEB_TOOLS.includes('Bash(agent-reach:*)'));
});

test('slugOk menolak path keluar folder', () => {
  for (const bad of ['../x', '..', 'a/b', 'a\\b', '', 'A-besar', '-awal', 'x'.repeat(65)]) assert.equal(slugOk(bad), false, bad);
  for (const good of ['sejarah-kereta', 'a', 'video-2026']) assert.equal(slugOk(good), true, good);
});

test('API key terenkripsi di disk dan terbuka kembali', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-secret-'));
  const plain = { vibiApiKey: 'vibi-rahasia-123', brainApiKey: 'sk-rahasia', vibiProvider: 'elevenlabs' };
  const sealed = secret.sealSettings(dir, plain);
  assert.equal(sealed.vibiProvider, 'elevenlabs');
  if (process.platform === 'win32') {
    assert.ok(secret.isEncrypted(sealed.vibiApiKey));
    assert.ok(!JSON.stringify(sealed).includes('rahasia'));
    // nilai rusak -> kosong (tidak melempar)
    assert.equal(secret.decryptValue(dir, `${sealed.vibiApiKey.slice(0, -6)}AAAAA=`), '');
  } else {
    assert.equal(sealed.vibiApiKey, plain.vibiApiKey); // tanpa DPAPI: apa adanya
  }
  assert.deepEqual(secret.revealSettings(dir, sealed), plain);
  // enkripsi dua kali tidak membungkus ulang
  assert.equal(secret.encryptValue(dir, sealed.vibiApiKey), sealed.vibiApiKey);
  fs.rmSync(dir, { recursive: true, force: true });
});
