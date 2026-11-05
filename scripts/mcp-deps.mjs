// Server MCP (mcp/server.mjs) dijalankan node milik Claude, di luar Electron, jadi tidak bisa membaca app.asar.
// Skrip ini menghitung semua paket npm yang dibutuhkan server MCP (dari package-lock.json) dan menuliskan daftar
// "asarUnpack" di package.json: folder aplikasi yang dibaca proses luar + paket-paket itu.
//
//   node scripts/mcp-deps.mjs          -> cek saja (exit 1 kalau package.json belum sesuai)
//   node scripts/mcp-deps.mjs --write  -> perbarui package.json
import fs from 'node:fs';

/** Paket yang di-import langsung oleh mcp/server.mjs. */
export const MCP_ROOTS = ['@modelcontextprotocol/sdk', '@supabase/supabase-js', 'zod'];
/** Folder/berkas aplikasi yang dibaca dari luar Electron (lihat electron/paths.cjs). */
export const APP_UNPACK = [
  'mcp/**',
  'shared/**',
  'electron/svg.cjs',
  'remotion-template/**',
  'animate-skill/**',
  'bang-motion-skill/**',
  'studio-skill/**',
  'edu-skill/**',
  'flow-skill/**',
  'kamal-skill/**',
];

export function mcpPackages(lock) {
  const pkgs = lock.packages;
  const find = (name, from) => {
    let base = from;
    for (;;) {
      const k = `${base ? `${base}/` : ''}node_modules/${name}`;
      if (pkgs[k]) return k;
      if (!base) return null;
      const i = base.lastIndexOf('/node_modules/');
      base = i >= 0 ? base.slice(0, i) : '';
    }
  };
  const seen = new Set();
  const walk = (k) => {
    if (!k || seen.has(k)) return;
    seen.add(k);
    const p = pkgs[k];
    for (const d of Object.keys({ ...p.dependencies, ...p.optionalDependencies, ...p.peerDependencies })) walk(find(d, k));
  };
  for (const r of MCP_ROOTS) walk(find(r, ''));
  // Paket bersarang ikut folder paket induknya; cukup daftar paket tingkat atas.
  return [...new Set([...seen].map((k) => k.replace(/^node_modules\//, '').split('/node_modules/')[0]))].sort();
}

export function expectedUnpack(lock) {
  return [...APP_UNPACK, ...mcpPackages(lock).map((p) => `node_modules/${p}/**`)];
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/mcp-deps.mjs')) {
  const pkgFile = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const want = expectedUnpack(lock);
  const same = JSON.stringify(pkg.build.asarUnpack || []) === JSON.stringify(want);
  if (process.argv.includes('--write')) {
    pkg.build.asarUnpack = want;
    fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`asarUnpack ditulis: ${want.length} entri`);
  } else if (!same) {
    console.error('asarUnpack di package.json tidak sesuai kebutuhan server MCP. Jalankan: node scripts/mcp-deps.mjs --write');
    process.exit(1);
  } else {
    console.log('asarUnpack sesuai');
  }
}
