// Kemasan installer: asar aktif, berkas yang dibaca proses luar dikeluarkan dari asar, dan paket UI tidak ikut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { expectedUnpack, mcpPackages } from '../scripts/mcp-deps.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('asar aktif dan asarUnpack sesuai kebutuhan server MCP', () => {
  assert.equal(pkg.build.asar, true);
  assert.deepEqual(pkg.build.asarUnpack, expectedUnpack(lock), 'jalankan: node scripts/mcp-deps.mjs --write');
});

test('semua import server MCP ikut dikeluarkan dari asar', () => {
  const pk = mcpPackages(lock);
  for (const p of ['@modelcontextprotocol/sdk', '@supabase/supabase-js', 'zod']) assert.ok(pk.includes(p), p);
  for (const f of ['mcp/server.mjs', 'mcp/shots.mjs']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    for (const [, spec] of src.matchAll(/from '([^.'][^']*)'/g)) {
      if (spec.startsWith('node:')) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      assert.ok(pk.includes(name), `${f} meng-import ${name} tapi tidak ada di asarUnpack`);
    }
  }
});

test('paket tampilan (sudah dibundel Vite) tidak ikut installer', () => {
  for (const ui of ['react', 'react-dom', 'radix-ui', 'lucide-react', 'react-router-dom']) {
    assert.ok(!pkg.dependencies[ui], `${ui} harus di devDependencies`);
  }
});

test('publish GitHub menunjuk repo yang benar', () => {
  assert.deepEqual(
    pkg.build.publish.map((p) => [p.provider, p.owner, p.repo]),
    [['github', 'kamssser', 'ANIMA']],
  );
});
